/**
 * Orquestrador de guardrails — Anexo B §B.5.5.
 *
 * Ordem canônica de avaliação:
 *   1. Emergência (override — tratada no intent classifier, NÃO aqui).
 *   2. Guardrail de DIAGNÓSTICO (entrada).
 *   3. Guardrail de PRESCRIÇÃO (entrada).
 *   4. Guardrail de PROMESSA (entrada).
 *   5. Tool-use loop (fora deste módulo).
 *   6. Guardrail de PRESCRIÇÃO (saída).
 *   7. Guardrail de PROMESSA (saída).
 *   8. Validação PII de saída (fora deste módulo — usa `pii.redactor`).
 *
 * Este arquivo expõe duas funções públicas:
 *   • `runInboundGuardrails` — etapas 2-4, para-no-primeiro-hit.
 *   • `runOutboundGuardrails` — etapas 6-7, determinístico.
 *
 * A decisão de regenerar/fallback ou de qual mensagem B.3.x enviar é do
 * caller (AuroraService). Aqui apenas reportamos hits e metadados.
 */

import {
  checkDiagnosis,
  type DiagnosisGuardResult,
  type DiagnosisLlmJudge,
} from './diagnosis.guard.js';
import {
  checkPrescription,
  checkPrescriptionOutbound,
  PRESCRIPTION_REGENERATE_INSTRUCTION,
  type PrescriptionGuardResult,
  type PrescriptionLlmJudge,
  type PrescriptionOutboundResult,
} from './prescription.guard.js';
import {
  checkPromise,
  checkPromiseOutbound,
  PROMISE_REGENERATE_INSTRUCTION,
  type PromiseGuardResult,
} from './promise.guard.js';
import { AuroraMsg, type AuroraMessageCode } from '../messages.js';

/* ── Tipos de resultado agregado ─────────────────────────────────────────── */

export type InboundGuardrailType = 'diagnosis' | 'prescription' | 'promise';

export interface InboundGuardrailBlock {
  blocked:         true;
  type:            InboundGuardrailType;
  /** Código B.3.x a enviar ao paciente (mensagem padrão de recusa). */
  replyCode:       AuroraMessageCode;
  /** Resultado bruto do guardrail disparado. */
  detail:
    | { type: 'diagnosis';    result: DiagnosisGuardResult }
    | { type: 'prescription'; result: PrescriptionGuardResult }
    | { type: 'promise';      result: PromiseGuardResult };
  /**
   * Se true, a ação requer também transferência humana (oncológico,
   * geração bloqueada, etc.) — caller decide prioridade.
   */
  requiresTransfer: boolean;
  /** Prioridade sugerida quando `requiresTransfer = true`. */
  transferPriority: 'normal' | 'high' | 'urgent' | null;
}

export interface InboundGuardrailPass {
  blocked: false;
  /** Executados mesmo quando todos passaram — útil para telemetria. */
  results: {
    diagnosis:    DiagnosisGuardResult;
    prescription: PrescriptionGuardResult;
    promise:      PromiseGuardResult;
  };
}

export type InboundGuardrailOutcome = InboundGuardrailBlock | InboundGuardrailPass;

export interface InboundGuardrailOptions {
  /** Judge para diagnóstico (zona cinzenta 0.4-0.7). */
  diagnosisJudge?:    DiagnosisLlmJudge;
  /** Judge para prescrição (match só em regex genérico). */
  prescriptionJudge?: PrescriptionLlmJudge;
}

/* ── ENTRADA ─────────────────────────────────────────────────────────────── */

/**
 * Roda os guardrails de ENTRADA em ordem §B.5.5.
 *
 * **Para no primeiro hit** — não avalia guardrails subsequentes. Isso
 * minimiza custo de LLM judge e evita logs duplicados; o que importa para
 * a resposta ao paciente é a primeira violação detectada.
 */
export async function runInboundGuardrails(
  text:    string,
  options: InboundGuardrailOptions = {},
): Promise<InboundGuardrailOutcome> {
  // 2. Diagnóstico
  const diagnosis = await checkDiagnosis(
    text,
    options.diagnosisJudge ? { judge: options.diagnosisJudge } : {},
  );
  if (diagnosis.hit) {
    // Oncológico: transferência humana com priority='high' (§B.5.1 item c).
    if (diagnosis.oncologicalHit) {
      return {
        blocked:          true,
        type:             'diagnosis',
        replyCode:        AuroraMsg.diagnosisRefusal,  // B.3.11
        detail:           { type: 'diagnosis', result: diagnosis },
        requiresTransfer: true,
        transferPriority: 'high',
      };
    }
    return {
      blocked:          true,
      type:             'diagnosis',
      replyCode:        AuroraMsg.diagnosisRefusal,  // B.3.11
      detail:           { type: 'diagnosis', result: diagnosis },
      requiresTransfer: false,
      transferPriority: null,
    };
  }

  // 3. Prescrição
  const prescription = await checkPrescription(
    text,
    options.prescriptionJudge ? { judge: options.prescriptionJudge } : {},
  );
  if (prescription.hit) {
    return {
      blocked:          true,
      type:             'prescription',
      replyCode:        AuroraMsg.prescriptionRefusal,  // B.3.12
      detail:           { type: 'prescription', result: prescription },
      requiresTransfer: false,
      transferPriority: null,
    };
  }

  // 4. Promessa
  const promise = checkPromise(text);
  if (promise.hit) {
    return {
      blocked:          true,
      type:             'promise',
      replyCode:        AuroraMsg.promiseRefusal,  // B.3.14
      detail:           { type: 'promise', result: promise },
      requiresTransfer: false,
      transferPriority: null,
    };
  }

  return {
    blocked: false,
    results: { diagnosis, prescription, promise },
  };
}

/* ── SAÍDA ───────────────────────────────────────────────────────────────── */

export type OutboundGuardrailType = 'prescription' | 'promise';

export interface OutboundGuardrailResult {
  /** Nenhum hit — texto pode ser enviado. */
  safe:            boolean;
  /** Primeiro hit encontrado, se houver. Ordem §B.5.5: prescrição antes de promessa. */
  firstHit:        OutboundGuardrailType | null;
  /** Instrução adicional sugerida ao regenerar (quando houver hit). */
  regenerateHint:  string | null;
  /** Resultados determinísticos de cada validador (para telemetria/testes). */
  results: {
    prescription: PrescriptionOutboundResult;
    promise:      PromiseGuardResult;
  };
}

/**
 * Valida o texto gerado pela Aurora. 100% determinístico (regex literais).
 *
 * Retorna o PRIMEIRO hit em ordem §B.5.5 (prescrição → promessa) e a
 * instrução adicional canônica para o regenerate. Quem decide se regenera
 * ou cai em fallback é o caller (AuroraService).
 */
export function runOutboundGuardrails(text: string): OutboundGuardrailResult {
  const prescription = checkPrescriptionOutbound(text);
  const promise      = checkPromiseOutbound(text);

  let firstHit: OutboundGuardrailType | null = null;
  let regenerateHint: string | null = null;

  if (prescription.hit) {
    firstHit = 'prescription';
    regenerateHint = PRESCRIPTION_REGENERATE_INSTRUCTION;
  } else if (promise.hit) {
    firstHit = 'promise';
    regenerateHint = PROMISE_REGENERATE_INSTRUCTION;
  }

  return {
    safe:           firstHit === null,
    firstHit,
    regenerateHint,
    results: { prescription, promise },
  };
}

/* ── Re-exports úteis ────────────────────────────────────────────────────── */

export {
  checkDiagnosis,
  checkPrescription,
  checkPrescriptionOutbound,
  checkPromise,
  checkPromiseOutbound,
};
export type {
  DiagnosisGuardResult,
  DiagnosisLlmJudge,
  PrescriptionGuardResult,
  PrescriptionLlmJudge,
  PrescriptionOutboundResult,
  PromiseGuardResult,
};

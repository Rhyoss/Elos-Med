/**
 * AuroraService — núcleo do raciocínio — Anexo A §A.4.2 passos 8a–8f.
 *
 * Orquestra o pipeline inteiro para UMA mensagem entrante:
 *   8a. loadContext         — últimas 20 mensagens via Postgres (cache fica em Phase 3).
 *   8b. piiRedactor.redact  — sobre a mensagem nova (strict).
 *   8c. classifyIntent      — lexical + (opcional) LLM judge.
 *   8d. guardrails entrada  — diagnóstico → prescrição → promessa.
 *   8e. tool-use loop       — via callback injetada (Phase 3 conecta Anthropic SDK).
 *   8f. guardrails saída    — prescrição → promessa → PII (determinísticos).
 *   ---  persistência da resposta + auditoria.
 *
 * **Phase 2 scope**: a chamada LLM real (Anthropic tool-use loop) é injetada
 * via `options.reason`. Sem injeção, caímos em respostas padrão mapeadas por
 * intenção (§B.3), o que já cobre os casos determinísticos (emergência, fora
 * de escopo, pedido explícito de humano, recebimento de mídia).
 *
 * Todas as chamadas de banco respeitam RLS via `withClinicContext`.
 */

import { withClinicContext } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { redact as piiRedact, hasCriticalHit } from '../../lib/pii-redactor.js';
import { eventBus } from '../../events/event-bus.js';
import {
  classifyIntent,
  type AuroraIntent,
  type IntentClassification,
  type IntentLlmJudge,
} from './intent/intent-classifier.js';
import {
  runInboundGuardrails,
  runOutboundGuardrails,
  type DiagnosisLlmJudge,
  type PrescriptionLlmJudge,
} from './guardrails/index.js';
import { AuroraMsg, renderAuroraMessage, type AuroraMessageCode, type AuroraMessageVars } from './messages.js';
import { getBreakerState } from '../../lib/circuit-breaker.js';
import {
  executeAuroraTool,
  AURORA_TOOL_DEFINITIONS,
  type AuroraToolContext,
  type AuroraToolDefinition,
  type AuroraToolResult,
} from './tools/index.js';
import type {
  ConversationMessage,
  MessageContentType,
  MessageSenderType,
} from './types.js';

/* ── Tipos públicos ──────────────────────────────────────────────────────── */

/**
 * Callback do "reasoning loop" — a integração real com Anthropic acontece
 * em Phase 3. Aqui apenas definimos a interface.
 *
 * O callback recebe o contexto já redigido + tools disponíveis + executor
 * (uma função que roda uma tool por nome) e devolve o TEXTO final a enviar.
 * Se retornar `null`, o service cai no fallback padrão por intenção.
 */
export interface AuroraReasonInput {
  redactedNewMessage:   string;
  redactedHistory:      Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  intent:               IntentClassification;
  toolDefinitions:      AuroraToolDefinition[];
  /** Executa uma tool pelo nome; dispatch + validação + RLS ficam no service. */
  runTool:              (name: string, input: unknown) => Promise<AuroraToolResult<unknown>>;
  /** Variáveis pré-computadas para `renderAuroraMessage`. */
  auroraVars:           AuroraMessageVars;
}

export interface AuroraReasonOutput {
  text:  string;
  /** Quantidade estimada de tokens in/out — opcional; só para métricas. */
  tokensIn?:  number;
  tokensOut?: number;
  /** Estado do breaker do provider. */
  breakerState?: 'closed' | 'half-open' | 'open';
  /** Modelo usado (ex.: 'claude-haiku-4-5-20251001' ou 'ollama-llama3'). */
  model?: string;
}

export type AuroraReasonFn = (input: AuroraReasonInput) => Promise<AuroraReasonOutput | null>;

export interface HandleMessageInput {
  messageId:      string;
  conversationId: string;
  clinicId:       string;
  /** UserID sintético da Aurora (em shared.users, role='ai_agent'). */
  auroraUserId:   string;
}

export interface HandleMessageOptions {
  /** Judge para classificação de intenção (zona ambígua). */
  intentJudge?:       IntentLlmJudge;
  /** Judge para guardrail de diagnóstico (score 0.4-0.7). */
  diagnosisJudge?:    DiagnosisLlmJudge;
  /** Judge para guardrail de prescrição (match só em regex genérico). */
  prescriptionJudge?: PrescriptionLlmJudge;
  /** Loop de tool-use. Phase 3 injeta integração Anthropic real. */
  reason?:            AuroraReasonFn;
  /** Variáveis para interpolação em renderAuroraMessage (clinic name, etc.). */
  auroraVars?:        AuroraMessageVars;
  /** Se true, sinaliza que foi rate-limitado upstream — devolve B.3.9. */
  throttled?:         boolean;
}

export type HandleMessageStatus =
  | 'replied'            // Aurora gerou resposta e persistiu.
  | 'blocked_guardrail'  // Resposta foi a mensagem padrão por guardrail hit.
  | 'transferred'        // Conversa foi transferida para humano.
  | 'throttled'          // Rate limit — resposta foi B.3.9.
  | 'error';

export interface HandleMessageResult {
  status:             HandleMessageStatus;
  intent:             AuroraIntent;
  replyCode:          AuroraMessageCode | null;  // null quando texto veio do LLM
  replyText:          string;
  guardrailHit:       'diagnosis' | 'prescription' | 'promise' | null;
  outboundGuardrailHit: 'prescription' | 'promise' | 'pii' | null;
  transferredToHuman: boolean;
  /** ID da mensagem persistida em omni.messages. */
  assistantMessageId: string | null;
  latencyMs:          number;
}

/* ── Contexto interno ────────────────────────────────────────────────────── */

interface LoadedContext {
  history:       ConversationMessage[];
  /** A mensagem mais nova — a que a Aurora vai responder. */
  newest:        ConversationMessage;
  contactId:     string;
  patientId:     string | null;
}

/* ── Pipeline ────────────────────────────────────────────────────────────── */

export async function handleMessage(
  input:   HandleMessageInput,
  options: HandleMessageOptions = {},
): Promise<HandleMessageResult> {
  const startedAt = Date.now();
  const auroraVars: AuroraMessageVars = options.auroraVars ?? {};

  // 8a. loadContext
  const ctx = await loadContext(input);

  // Throttle upstream — resposta imediata de erro técnico, sem raciocínio.
  if (options.throttled) {
    const replyText = renderAuroraMessage(AuroraMsg.technicalError, auroraVars);
    const msgId = await persistAssistantMessage(input, replyText);
    await publishMessageHandled(input, {
      intent:        'fora_de_escopo',
      status:        'throttled',
      guardrailHit:  null,
      latencyMs:     Date.now() - startedAt,
      breakerState:  null,
      model:         null,
    });
    return {
      status:             'throttled',
      intent:             'fora_de_escopo',
      replyCode:          AuroraMsg.technicalError,
      replyText,
      guardrailHit:       null,
      outboundGuardrailHit: null,
      transferredToHuman: false,
      assistantMessageId: msgId,
      latencyMs:          Date.now() - startedAt,
    };
  }

  // 8b. piiRedactor — aplica APENAS à mensagem nova. Histórico é redigido em 8e
  // (conforme entra no prompt). Fazemos aqui para que guardrails possam operar
  // sobre o texto cru (precisam reconhecer termos clínicos reais, sem tokens).
  const rawText = ctx.newest.content ?? '';
  const redacted = piiRedact(rawText, 'strict');

  // 8c. classifyIntent — roda sobre o TEXTO CRU (regex precisam de acentos,
  // pontuação, palavras). PII redactor é só para o LLM.
  const intent = await classifyIntent(
    { text: rawText, contentType: ctx.newest.contentType },
    options.intentJudge ? { judge: options.intentJudge } : {},
  );

  // Emergência → B.3.13 + transferência urgente, pulando tudo.
  if (intent.intent === 'emergencia_medica') {
    return await finalizeEmergency(input, intent, auroraVars, startedAt);
  }

  // Compartilhamento de mídia → B.3.16 + transferência normal.
  if (intent.intent === 'compartilhar_documento') {
    return await finalizeMediaReceived(input, intent, auroraVars, startedAt);
  }

  // 8d. guardrails de ENTRADA — diagnóstico → prescrição → promessa.
  // Roda sobre o TEXTO CRU (regex são literais do anexo).
  const inbound = await runInboundGuardrails(rawText, {
    ...(options.diagnosisJudge    ? { diagnosisJudge:    options.diagnosisJudge    } : {}),
    ...(options.prescriptionJudge ? { prescriptionJudge: options.prescriptionJudge } : {}),
  });

  if (inbound.blocked) {
    return await finalizeGuardrailBlock(input, intent, inbound, auroraVars, startedAt);
  }

  // 8e. tool-use loop via callback injetada.
  // Sem callback: usa fallback determinístico por intenção (§B.3).
  const reasonFn = options.reason;
  let reasonOutput: AuroraReasonOutput | null = null;
  let reasonErrored = false;

  if (reasonFn) {
    try {
      reasonOutput = await reasonFn({
        redactedNewMessage: redacted.text,
        redactedHistory:    redactHistoryForPrompt(ctx.history),
        intent,
        toolDefinitions:    AURORA_TOOL_DEFINITIONS,
        runTool:            (name, rawInput) => executeAuroraTool(name, rawInput, buildToolContext(input, ctx)),
        auroraVars,
      });
    } catch (err) {
      reasonErrored = true;
      logger.warn(
        { err, messageId: input.messageId, conversationId: input.conversationId },
        'aurora.reason callback failed',
      );
    }
  }

  // Fallback quando não há reasoner OU ele devolveu null/erro.
  if (!reasonOutput) {
    return await finalizeFallbackByIntent(
      input,
      intent,
      auroraVars,
      startedAt,
      reasonErrored ? 'reason_error' : reasonFn ? 'reason_null' : 'no_reason_fn',
    );
  }

  // 8f. guardrails de SAÍDA — prescrição → promessa → PII.
  const outboundResult = await applyOutboundGuardrails(reasonOutput.text, input, intent, auroraVars, startedAt);
  if (outboundResult) return outboundResult;

  // Texto limpo — persiste e retorna.
  const assistantMessageId = await persistAssistantMessage(input, reasonOutput.text);

  await publishMessageHandled(input, {
    intent:        intent.intent,
    status:        'replied',
    guardrailHit:  null,
    latencyMs:     Date.now() - startedAt,
    breakerState:  reasonOutput.breakerState ?? null,
    model:         reasonOutput.model ?? null,
    ...(reasonOutput.tokensIn  !== undefined ? { tokensIn:  reasonOutput.tokensIn  } : {}),
    ...(reasonOutput.tokensOut !== undefined ? { tokensOut: reasonOutput.tokensOut } : {}),
  });

  return {
    status:               'replied',
    intent:               intent.intent,
    replyCode:            null,
    replyText:            reasonOutput.text,
    guardrailHit:         null,
    outboundGuardrailHit: null,
    transferredToHuman:   false,
    assistantMessageId,
    latencyMs:            Date.now() - startedAt,
  };
}

/* ── Passos auxiliares ───────────────────────────────────────────────────── */

async function loadContext(input: HandleMessageInput): Promise<LoadedContext> {
  return withClinicContext(input.clinicId, async (client) => {
    const convRow = await client.query<{
      contact_id: string | null;
    }>(
      `SELECT contact_id FROM omni.conversations WHERE id = $1 AND clinic_id = $2`,
      [input.conversationId, input.clinicId],
    );
    if (!convRow.rows[0]) {
      throw new Error('conversation_not_found');
    }
    const contactId = convRow.rows[0].contact_id ?? '';

    const patientRow = await client.query<{ patient_id: string | null }>(
      `SELECT patient_id FROM omni.contacts WHERE id = $1 AND clinic_id = $2`,
      [contactId, input.clinicId],
    );
    const patientId = patientRow.rows[0]?.patient_id ?? null;

    const rows = await client.query<{
      id:           string;
      sender_type:  MessageSenderType;
      content_type: MessageContentType;
      content:      string | null;
      created_at:   string;
    }>(
      `SELECT id, sender_type, content_type, content, created_at
         FROM omni.messages
        WHERE conversation_id = $1
          AND clinic_id       = $2
          AND is_internal_note = FALSE
        ORDER BY created_at DESC
        LIMIT 20`,
      [input.conversationId, input.clinicId],
    );

    const asc = [...rows.rows].reverse();
    const history: ConversationMessage[] = asc.map((r) => ({
      id:          r.id,
      senderType:  r.sender_type,
      contentType: r.content_type,
      content:     r.content,
      createdAt:   new Date(r.created_at),
    }));

    const newest = history.find((m) => m.id === input.messageId) ?? history[history.length - 1];
    if (!newest) {
      throw new Error('target_message_not_found');
    }

    return { history, newest, contactId, patientId };
  });
}

function buildToolContext(input: HandleMessageInput, ctx: LoadedContext): AuroraToolContext {
  return {
    clinicId:       input.clinicId,
    conversationId: input.conversationId,
    contactId:      ctx.contactId,
    auroraUserId:   input.auroraUserId,
    ...(ctx.patientId ? { patientId: ctx.patientId } : {}),
  };
}

/**
 * Converte histórico para o formato do prompt Anthropic, aplicando PII redactor
 * linha a linha sobre o conteúdo DO PACIENTE. Mensagens da Aurora mesmo já
 * passaram pela validação de saída quando foram geradas; logamos só se o
 * histórico tiver hit crítico (indica regressão pré-guardrail).
 */
function redactHistoryForPrompt(
  history: ConversationMessage[],
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  return history
    .filter((m) => m.content !== null)
    .map((m) => {
      const role: 'user' | 'assistant' | 'system' =
        m.senderType === 'ai_agent' ? 'assistant'
        : m.senderType === 'system' ? 'system'
        : 'user';
      const content = m.senderType === 'patient'
        ? piiRedact(m.content ?? '', 'strict').text
        : (m.content ?? '');
      return { role, content };
    });
}

/* ── Finalizadores ───────────────────────────────────────────────────────── */

async function finalizeEmergency(
  input:      HandleMessageInput,
  intent:     IntentClassification,
  auroraVars: AuroraMessageVars,
  startedAt:  number,
): Promise<HandleMessageResult> {
  const replyText = renderAuroraMessage(AuroraMsg.emergency, auroraVars);
  const assistantMessageId = await persistAssistantMessage(input, replyText);

  await transferConversationToHuman(input, 'emergencia_medica', 'urgent');
  await publishMessageHandled(input, {
    intent:        'emergencia_medica',
    status:        'transferred',
    guardrailHit:  null,
    latencyMs:     Date.now() - startedAt,
    breakerState:  null,
    model:         null,
  });

  return {
    status:               'transferred',
    intent:               intent.intent,
    replyCode:            AuroraMsg.emergency,
    replyText,
    guardrailHit:         null,
    outboundGuardrailHit: null,
    transferredToHuman:   true,
    assistantMessageId,
    latencyMs:            Date.now() - startedAt,
  };
}

async function finalizeMediaReceived(
  input:      HandleMessageInput,
  intent:     IntentClassification,
  auroraVars: AuroraMessageVars,
  startedAt:  number,
): Promise<HandleMessageResult> {
  const replyText = renderAuroraMessage(AuroraMsg.mediaReceived, auroraVars);
  const assistantMessageId = await persistAssistantMessage(input, replyText);

  await transferConversationToHuman(input, 'pedido_do_paciente', 'normal');
  await publishMessageHandled(input, {
    intent:        'compartilhar_documento',
    status:        'transferred',
    guardrailHit:  null,
    latencyMs:     Date.now() - startedAt,
    breakerState:  null,
    model:         null,
  });

  return {
    status:               'transferred',
    intent:               intent.intent,
    replyCode:            AuroraMsg.mediaReceived,
    replyText,
    guardrailHit:         null,
    outboundGuardrailHit: null,
    transferredToHuman:   true,
    assistantMessageId,
    latencyMs:            Date.now() - startedAt,
  };
}

async function finalizeGuardrailBlock(
  input:      HandleMessageInput,
  intent:     IntentClassification,
  inbound:    Extract<Awaited<ReturnType<typeof runInboundGuardrails>>, { blocked: true }>,
  auroraVars: AuroraMessageVars,
  startedAt:  number,
): Promise<HandleMessageResult> {
  const replyText          = renderAuroraMessage(inbound.replyCode, auroraVars);
  const assistantMessageId = await persistAssistantMessage(input, replyText);
  let transferredToHuman   = false;

  if (inbound.requiresTransfer) {
    const reason =
      inbound.type === 'diagnosis' && inbound.detail.type === 'diagnosis' && inbound.detail.result.oncologicalHit
        ? 'guardrail_oncologico'
        : inbound.type === 'prescription'
          ? 'guardrail_prescricao'
          : 'aurora_nao_conseguiu';
    await transferConversationToHuman(input, reason, inbound.transferPriority ?? 'high');
    transferredToHuman = true;
  }

  await publishGuardrailBlock(input, {
    direction: 'inbound',
    type:      inbound.type,
    intent:    intent.intent,
    action:    transferredToHuman ? 'transfer' : 'block',
  });
  await publishMessageHandled(input, {
    intent:        intent.intent,
    status:        transferredToHuman ? 'transferred' : 'blocked_guardrail',
    guardrailHit:  inbound.type,
    latencyMs:     Date.now() - startedAt,
    breakerState:  null,
    model:         null,
  });

  return {
    status:               transferredToHuman ? 'transferred' : 'blocked_guardrail',
    intent:               intent.intent,
    replyCode:            inbound.replyCode,
    replyText,
    guardrailHit:         inbound.type,
    outboundGuardrailHit: null,
    transferredToHuman,
    assistantMessageId,
    latencyMs:            Date.now() - startedAt,
  };
}

/**
 * Fallback determinístico quando não há reasoner injetado (Phase 2) ou ele
 * falhou. Usa a tabela §B.3 + transferência humana para intenções que
 * exigem ação além de texto.
 */
async function finalizeFallbackByIntent(
  input:         HandleMessageInput,
  intent:        IntentClassification,
  auroraVars:    AuroraMessageVars,
  startedAt:     number,
  fallbackReason: 'no_reason_fn' | 'reason_null' | 'reason_error',
): Promise<HandleMessageResult> {
  const map: Record<AuroraIntent, { code: AuroraMessageCode; transfer: boolean; priority?: 'normal' | 'high' | 'urgent' }> = {
    agendar_consulta:            { code: AuroraMsg.transferToHuman,    transfer: true,  priority: 'normal' },
    reagendar_consulta:          { code: AuroraMsg.transferToHuman,    transfer: true,  priority: 'normal' },
    cancelar_consulta:           { code: AuroraMsg.transferToHuman,    transfer: true,  priority: 'normal' },
    confirmar_presenca:          { code: AuroraMsg.transferToHuman,    transfer: true,  priority: 'normal' },
    consultar_horarios:          { code: AuroraMsg.transferToHuman,    transfer: true,  priority: 'normal' },
    consultar_servicos_e_precos: { code: AuroraMsg.transferToHuman,    transfer: true,  priority: 'normal' },
    obter_endereco_clinica:      { code: AuroraMsg.transferToHuman,    transfer: true,  priority: 'normal' },
    solicitar_atendimento_humano:{ code: AuroraMsg.transferToHuman,    transfer: true,  priority: 'normal' },
    compartilhar_documento:      { code: AuroraMsg.mediaReceived,      transfer: true,  priority: 'normal' },
    emergencia_medica:           { code: AuroraMsg.emergency,          transfer: true,  priority: 'urgent' },
    fora_de_escopo:              { code: AuroraMsg.outOfScope,         transfer: false },
  };

  const decision  = map[intent.intent];
  const replyText = renderAuroraMessage(decision.code, auroraVars);
  const msgId     = await persistAssistantMessage(input, replyText);
  let transferred = false;

  if (decision.transfer) {
    const reason =
      intent.intent === 'solicitar_atendimento_humano' ? 'pedido_do_paciente'
      : intent.intent === 'emergencia_medica'          ? 'emergencia_medica'
      : intent.intent === 'compartilhar_documento'     ? 'pedido_do_paciente'
      : 'aurora_nao_conseguiu';
    await transferConversationToHuman(input, reason, decision.priority ?? 'normal');
    transferred = true;
  }

  await publishMessageHandled(input, {
    intent:        intent.intent,
    status:        transferred ? 'transferred' : 'replied',
    guardrailHit:  null,
    latencyMs:     Date.now() - startedAt,
    breakerState:  null,
    model:         null,
    note:          fallbackReason,
  });

  return {
    status:               transferred ? 'transferred' : 'replied',
    intent:               intent.intent,
    replyCode:            decision.code,
    replyText,
    guardrailHit:         null,
    outboundGuardrailHit: null,
    transferredToHuman:   transferred,
    assistantMessageId:   msgId,
    latencyMs:            Date.now() - startedAt,
  };
}

/**
 * Aplica guardrails de saída. Se QUALQUER um bloquear e a Aurora não regenerou
 * a tempo, cai em fallback B.3.12 (prescrição) ou B.3.14 (promessa). Nesta
 * versão NÃO regeneramos — a regeneração com instrução adicional exige o
 * reasoner, que é injetado em Phase 3. O service já suporta a decisão, só
 * não exerce a chamada secundária: a responsabilidade do regenerate recai
 * sobre o reasoner em Phase 3 (ele loga `outbound_hit` e tenta 1 vez mais,
 * chamando `runOutboundGuardrails` novamente antes de devolver o texto ao
 * service).
 *
 * Retorno `null` = texto passou, pode seguir para persistência.
 */
async function applyOutboundGuardrails(
  text:       string,
  input:      HandleMessageInput,
  intent:     IntentClassification,
  auroraVars: AuroraMessageVars,
  startedAt:  number,
): Promise<HandleMessageResult | null> {
  const outbound = runOutboundGuardrails(text);

  if (!outbound.safe) {
    const fallbackCode: AuroraMessageCode =
      outbound.firstHit === 'prescription' ? AuroraMsg.prescriptionRefusal
      : AuroraMsg.promiseRefusal;
    const replyText          = renderAuroraMessage(fallbackCode, auroraVars);
    const assistantMessageId = await persistAssistantMessage(input, replyText);

    // Prescrição na saída escala para humano (§B.5.2). Promessa não.
    let transferred = false;
    if (outbound.firstHit === 'prescription') {
      await transferConversationToHuman(input, 'guardrail_prescricao', 'high');
      transferred = true;
    }

    await publishGuardrailBlock(input, {
      direction: 'outbound',
      type:      outbound.firstHit ?? 'prescription',
      intent:    intent.intent,
      action:    transferred ? 'transfer' : 'block',
    });
    await publishMessageHandled(input, {
      intent:        intent.intent,
      status:        transferred ? 'transferred' : 'blocked_guardrail',
      guardrailHit:  outbound.firstHit ?? null,
      latencyMs:     Date.now() - startedAt,
      breakerState:  null,
      model:         null,
    });

    return {
      status:               transferred ? 'transferred' : 'blocked_guardrail',
      intent:               intent.intent,
      replyCode:            fallbackCode,
      replyText,
      guardrailHit:         null,
      outboundGuardrailHit: outbound.firstHit,
      transferredToHuman:   transferred,
      assistantMessageId,
      latencyMs:            Date.now() - startedAt,
    };
  }

  // Validação PII de saída (§B.4.2) — determinística. Hit crítico = descarte.
  const outboundPii = piiRedact(text, 'strict');
  if (hasCriticalHit(outboundPii.hits)) {
    const replyText          = renderAuroraMessage(AuroraMsg.technicalError, auroraVars);
    const assistantMessageId = await persistAssistantMessage(input, replyText);

    await publishGuardrailBlock(input, {
      direction: 'outbound',
      type:      'pii',
      intent:    intent.intent,
      action:    'block',
    });
    await publishMessageHandled(input, {
      intent:        intent.intent,
      status:        'blocked_guardrail',
      guardrailHit:  null,
      latencyMs:     Date.now() - startedAt,
      breakerState:  null,
      model:         null,
    });

    return {
      status:               'blocked_guardrail',
      intent:               intent.intent,
      replyCode:            AuroraMsg.technicalError,
      replyText,
      guardrailHit:         null,
      outboundGuardrailHit: 'pii',
      transferredToHuman:   false,
      assistantMessageId,
      latencyMs:            Date.now() - startedAt,
    };
  }

  return null;
}

/* ── Persistência + auditoria ────────────────────────────────────────────── */

async function persistAssistantMessage(
  input: HandleMessageInput,
  text:  string,
): Promise<string> {
  return withClinicContext(input.clinicId, async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO omni.messages
         (clinic_id, conversation_id,
          sender_type, sender_agent_id,
          content_type, content,
          status, metadata)
       VALUES ($1, $2,
               'ai_agent', $3,
               'text',     $4,
               'pending',  $5::jsonb)
       RETURNING id`,
      [
        input.clinicId,
        input.conversationId,
        input.auroraUserId,
        text,
        JSON.stringify({ in_reply_to: input.messageId, agent: 'aurora' }),
      ],
    );
    return r.rows[0]!.id;
  });
}

async function transferConversationToHuman(
  input:    HandleMessageInput,
  reason:   string,
  priority: 'normal' | 'high' | 'urgent',
): Promise<void> {
  await withClinicContext(input.clinicId, async (client) => {
    await client.query(
      `UPDATE omni.conversations
          SET assigned_to = NULL,
              priority    = $3,
              metadata    = COALESCE(metadata, '{}'::jsonb)
                            || jsonb_build_object(
                                 'aurora_state',
                                 COALESCE(metadata -> 'aurora_state', '{}'::jsonb)
                                 || jsonb_build_object(
                                      'handler',            'human',
                                      'transferred_at',     NOW(),
                                      'transferred_reason', $4::text
                                    )
                               ),
              updated_at  = NOW()
        WHERE id = $1 AND clinic_id = $2`,
      [input.conversationId, input.clinicId, priority, reason],
    );
  });

  await eventBus.publish(
    'aurora.transfer_to_human',
    input.clinicId,
    input.conversationId,
    { reason, priority, conversationId: input.conversationId },
  ).catch(() => undefined);
}

interface MessageHandledPayload {
  intent:       AuroraIntent;
  status:       HandleMessageStatus;
  guardrailHit: 'diagnosis' | 'prescription' | 'promise' | null;
  latencyMs:    number;
  breakerState: string | null;
  model:        string | null;
  tokensIn?:    number;
  tokensOut?:   number;
  note?:        string;
}

async function publishMessageHandled(
  input:   HandleMessageInput,
  payload: MessageHandledPayload,
): Promise<void> {
  await eventBus.publish(
    'aurora.message_handled',
    input.clinicId,
    input.conversationId,
    {
      messageId:      input.messageId,
      conversationId: input.conversationId,
      intent:         payload.intent,
      status:         payload.status,
      guardrailHit:   payload.guardrailHit,
      tokensIn:       payload.tokensIn ?? null,
      tokensOut:      payload.tokensOut ?? null,
      breakerState:   payload.breakerState ?? getBreakerState('anthropic'),
      model:          payload.model,
      latencyMs:      payload.latencyMs,
      note:           payload.note ?? null,
    },
  ).catch(() => undefined);
}

interface GuardrailBlockPayload {
  direction: 'inbound' | 'outbound';
  type:      'diagnosis' | 'prescription' | 'promise' | 'pii';
  intent:    AuroraIntent;
  action:    'block' | 'regenerate' | 'transfer';
}

async function publishGuardrailBlock(
  input:   HandleMessageInput,
  payload: GuardrailBlockPayload,
): Promise<void> {
  await eventBus.publish(
    'aurora.guardrail_block',
    input.clinicId,
    input.conversationId,
    {
      messageId:      input.messageId,
      conversationId: input.conversationId,
      direction:      payload.direction,
      type:           payload.type,
      intent:         payload.intent,
      action:         payload.action,
      breakerState:   getBreakerState('anthropic'),
    },
  ).catch(() => undefined);
}

/* ── Exports ─────────────────────────────────────────────────────────────── */

export { classifyIntent } from './intent/intent-classifier.js';
export { runInboundGuardrails, runOutboundGuardrails } from './guardrails/index.js';

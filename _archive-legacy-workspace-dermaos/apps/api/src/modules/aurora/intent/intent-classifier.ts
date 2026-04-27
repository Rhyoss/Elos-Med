/**
 * Classificador de intenções — Anexo B §B.1.
 *
 * Taxonomia fechada de 11 intenções + default. Qualquer mensagem é mapeada
 * para exatamente uma intenção. Confiança < 0.6 → `fora_de_escopo`.
 *
 * Arquitetura em duas camadas:
 *   1. Camada lexical (sempre): regex/keyword → score ∈ [0,1].
 *   2. Camada LLM judge (sob demanda): Haiku 4.5 com tool-call retornando
 *      `{ intent, confidence }`. Ativada quando o score lexical é ambíguo
 *      (top-1 < 0.7 OU top-1 e top-2 muito próximos).
 *
 * Emergência médica é um OVERRIDE — sempre checada primeiro; se qualquer
 * gatilho casa, confiança = 1.0 e nenhum outro classificador roda.
 */

import type { MessageContentType } from '../types.js';

export const AURORA_INTENTS = [
  'emergencia_medica',
  'agendar_consulta',
  'reagendar_consulta',
  'cancelar_consulta',
  'confirmar_presenca',
  'consultar_horarios',
  'consultar_servicos_e_precos',
  'obter_endereco_clinica',
  'solicitar_atendimento_humano',
  'compartilhar_documento',
  'fora_de_escopo',
] as const;

export type AuroraIntent = (typeof AURORA_INTENTS)[number];

export interface IntentClassification {
  intent:      AuroraIntent;
  confidence:  number;     // ∈ [0,1]
  source:      'emergency_override' | 'lexical' | 'llm_judge' | 'default' | 'media_rule';
  topCandidates?: Array<{ intent: AuroraIntent; score: number }>;
}

export interface IntentLlmJudgeInput {
  text:    string;
  /** Top candidatos lexicais (para o judge ponderar). */
  hints:   Array<{ intent: AuroraIntent; score: number }>;
}

export interface IntentLlmJudgeOutput {
  intent:     AuroraIntent;
  confidence: number;
}

/** Callback externa que chama Anthropic/Ollama via circuit breaker. Injetada pelo AuroraService. */
export type IntentLlmJudge = (input: IntentLlmJudgeInput) => Promise<IntentLlmJudgeOutput | null>;

/* ── Normalização ────────────────────────────────────────────────────────── */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/* ── Regex por intenção (case-insensitive APÓS normalização) ─────────────── */

/**
 * Emergência — override absoluto. Qualquer hit dispara confiança máxima.
 * Anexo B §B.1 coluna "Exemplos de gatilho": passar mal, sangue, sufoco,
 * inconsciência, queimadura grave, reação alérgica.
 */
const EMERGENCY_RE: RegExp[] = [
  /\bestou\s+passando\s+mal\b/,
  /\bme\s+sinto\s+muito\s+mal\b/,
  /\bmuito\s+sangue\b/,
  /\bestou\s+sangrando\s+muito\b/,
  /\bnao\s+consigo\s+respirar\b/,
  /\bfalta\s+de\s+ar\b/,
  /\bperdi\s+a\s+consciencia\b/,
  /\bdesmaiei\b/,
  /\bqueimadura\s+grave\b/,
  /\breacao\s+alergica\b/,
  /\banafilaxia\b/,
  /\bconvuls\w+\b/,
];

/**
 * Conjunto de regex por intenção. Cada hit contribui para o score dessa intenção.
 * Score = min(1, matches * 0.35) — 3 hits já saturam a 1.0.
 */
const INTENT_REGEXES: Record<Exclude<AuroraIntent, 'emergencia_medica' | 'fora_de_escopo' | 'compartilhar_documento'>, RegExp[]> = {
  agendar_consulta: [
    /\bquero\s+(marcar|agendar)\b/,
    /\bgostaria\s+de\s+(marcar|agendar)\b/,
    /\bqueria\s+(marcar|agendar)\b/,
    /\bmarcar\s+(uma\s+)?consulta\b/,
    /\bagendar\s+(uma\s+)?consulta\b/,
    /\btem\s+horario\b/,
    /\bprecisa\w*\s+(marcar|de)\s+(uma\s+)?consulta\b/,
    /\bprimeira\s+consulta\b/,
    /\bconsulta\s+com\s+(a|o)\s+(dra?|doutora?)\b/,
  ],
  reagendar_consulta: [
    /\bremarcar\b/,
    /\breagendar\b/,
    /\b(posso\s+)?(mudar|trocar|passar)\s+(para|pra)\s+outro\s+dia\b/,
    /\bprecis\w+\s+(remarcar|reagendar|mudar)\s+(minha\s+)?consulta\b/,
    /\badiar\s+(minha\s+)?consulta\b/,
  ],
  cancelar_consulta: [
    /\bcancelar\b/,
    /\bdesmarcar\b/,
    /\bnao\s+vou\s+poder\s+ir\b/,
    /\bnao\s+poderei\s+ir\b/,
    /\bnao\s+conseguirei\s+ir\b/,
  ],
  confirmar_presenca: [
    /^\s*confirmo\s*$/,
    /^\s*confirma\s*$/,
    /^\s*sim\s*$/,
    /^\s*estarei\s+la\b/,
    /\bposso\s+confirmar\b/,
  ],
  consultar_horarios: [
    /\bque\s+dias?\s+(tem|temos)\s+vaga\b/,
    /\b(qual|quais)\s+(o\s+)?horari\w+\s+de\s+atendimento\b/,
    /\bhorario\s+de\s+(funcionamento|atendimento)\b/,
    /\batende\s+(sabado|domingo|feriado)\b/,
    /\bfuncion\w+\s+(sabado|domingo|de\s+\w+\s+a\s+\w+)\b/,
    /\bque\s+horas?\s+(abre|fecha)\b/,
  ],
  consultar_servicos_e_precos: [
    /\bfazem\s+(laser|botox|preenchimento|peeling|microagulhamento|drenagem|limpeza\s+de\s+pele)\b/,
    /\bfazem\s+\w+\s*\?/,
    /\bquanto\s+custa\b/,
    /\b(preco|valor)\s+d\w+\s+\w+/,
    /\btem\s+(laser|botox|preenchimento|peeling|microagulhamento)\b/,
    /\boferece\w*\s+(laser|botox|preenchimento|peeling|microagulhamento)\b/,
    /\bprocedimento\s+de\s+\w+/,
    /\btratamento\s+para\b/,
  ],
  obter_endereco_clinica: [
    /\bonde\s+fica\b/,
    /\bendereco\s+d\w+\s+(clinica|consultorio)\b/,
    /\bcomo\s+chego\b/,
    /\btem\s+estacionamento\b/,
    /\bfica\s+em\s+(que|qual)\s+(rua|bairro|cidade)\b/,
    /\blocalizacao\b/,
  ],
  solicitar_atendimento_humano: [
    /\bquero\s+(falar|conversar)\s+com\s+(uma\s+)?(pessoa|atendente|humano)\b/,
    /\b(falar|conversar)\s+com\s+(o\s+|a\s+)?(atendente|recepcao|equipe|secretaria)\b/,
    /^\s*humano\s*$/,
    /^\s*atendente\s*$/,
    /\bnao\s+estou\s+entendendo\b/,
    /\bvoce\s+nao\s+esta\s+me\s+entendendo\b/,
    /\bchame\s+(uma\s+)?pessoa\b/,
  ],
};

/* ── Resultado lexical ───────────────────────────────────────────────────── */

function scoreLexical(normalizedText: string): Array<{ intent: AuroraIntent; score: number; matches: number }> {
  const out: Array<{ intent: AuroraIntent; score: number; matches: number }> = [];
  for (const [intent, regexes] of Object.entries(INTENT_REGEXES) as [AuroraIntent, RegExp[]][]) {
    let matches = 0;
    for (const re of regexes) {
      if (re.test(normalizedText)) matches++;
    }
    if (matches > 0) {
      out.push({ intent, matches, score: Math.min(1, matches * 0.35) });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

function isEmergency(normalizedText: string): boolean {
  return EMERGENCY_RE.some((re) => re.test(normalizedText));
}

/* ── API pública ─────────────────────────────────────────────────────────── */

export const CONFIDENCE_THRESHOLD = 0.6;
export const AMBIGUITY_MARGIN     = 0.2; // se top1 - top2 < margin → consultar judge

export interface ClassifyIntentInput {
  text:        string;
  contentType: MessageContentType;
}

export interface ClassifyIntentOptions {
  /** Callback do LLM judge. Se omitido, a classificação usa apenas lexical. */
  judge?: IntentLlmJudge;
}

/**
 * Classifica a intenção da mensagem do paciente.
 *
 * Ordem de decisão:
 *   1. Se `contentType != 'text'` → `compartilhar_documento` (regra determinística §B.1).
 *   2. Se qualquer gatilho de emergência casa → `emergencia_medica` (override).
 *   3. Camada lexical gera candidatos. Se top-1 ≥ 0.7 E margem suficiente → retorna top-1.
 *   4. Caso ambíguo E `judge` fornecido → LLM judge.
 *   5. Se judge retorna algo com confidence ≥ 0.6 → usa esse resultado.
 *   6. Caso contrário → `fora_de_escopo` com confidence do melhor lexical.
 */
export async function classifyIntent(
  input:   ClassifyIntentInput,
  options: ClassifyIntentOptions = {},
): Promise<IntentClassification> {
  // Regra 1 — conteúdo não-texto é sempre mídia
  if (input.contentType !== 'text') {
    return {
      intent:     'compartilhar_documento',
      confidence: 1,
      source:     'media_rule',
    };
  }

  const n = normalize(input.text);

  // Regra 2 — emergência override
  if (isEmergency(n)) {
    return {
      intent:     'emergencia_medica',
      confidence: 1,
      source:     'emergency_override',
    };
  }

  // Regra 3 — lexical
  const lexical = scoreLexical(n);
  const topCandidates = lexical.slice(0, 3).map((r) => ({ intent: r.intent, score: r.score }));
  const top = lexical[0];

  if (top && top.score >= 0.7) {
    const second = lexical[1]?.score ?? 0;
    if (top.score - second >= AMBIGUITY_MARGIN) {
      return {
        intent:        top.intent,
        confidence:    top.score,
        source:        'lexical',
        topCandidates,
      };
    }
  }

  // Regra 4 — LLM judge se fornecido e caso ambíguo
  if (options.judge) {
    try {
      const verdict = await options.judge({ text: input.text, hints: topCandidates });
      if (verdict && verdict.confidence >= CONFIDENCE_THRESHOLD) {
        return {
          intent:        verdict.intent,
          confidence:    verdict.confidence,
          source:        'llm_judge',
          topCandidates,
        };
      }
    } catch {
      // Judge indisponível: fail-safe → não assume nenhuma intenção específica,
      // cai no default abaixo (fora_de_escopo). Guardrail de diagnóstico tem
      // fail-safe próprio (assume positivo) em outro ponto do pipeline.
    }
  }

  // Regra 5 — default com confiança explícita baixa
  return {
    intent:        top && top.score >= CONFIDENCE_THRESHOLD ? top.intent : 'fora_de_escopo',
    confidence:    top?.score ?? 0,
    source:        top && top.score >= CONFIDENCE_THRESHOLD ? 'lexical' : 'default',
    topCandidates,
  };
}

/** Exposto para testes unitários do componente lexical. */
export const __internals = {
  normalize,
  scoreLexical,
  isEmergency,
  EMERGENCY_RE,
  INTENT_REGEXES,
};

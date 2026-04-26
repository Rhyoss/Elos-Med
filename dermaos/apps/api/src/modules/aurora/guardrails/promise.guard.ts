/**
 * Guardrail de PROMESSA DE RESULTADO — Anexo B §B.5.3.
 *
 * Impede que a Aurora prometa cura, eficácia, prazo de recuperação ou
 * resultado garantido.
 *
 * 100% LEXICAL (sem LLM judge) — §B.5.3 é explícito: "Apenas lexical —
 * alta precisão, baixo custo". Metas: precisão ≥ 0.95, recall ≥ 0.99 na
 * entrada; recall de saída = 1.00.
 *
 * Duas blacklists distintas:
 *   • ENTRADA:  perguntas do paciente ("vai funcionar?", "em quanto tempo cura?")
 *   • SAÍDA:    termos que a Aurora NÃO pode dizer ("cura", "garantia", "100%"…)
 *
 * Output validator regenera UMA vez com instrução adicional; duas falhas
 * seguidas → fallback B.3.14.
 */

export interface PromiseGuardResult {
  hit:             boolean;
  matchedPatterns: string[];   // nomes simbólicos — nunca o texto original
}

/* ── Normalização ────────────────────────────────────────────────────────── */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/* ── Regex de ENTRADA — paciente perguntando — §B.5.3 ────────────────────── */

/**
 * Match em qualquer regex → bloqueio direto. Precisão é prioridade;
 * padrões são deliberadamente conservadores.
 */
const INBOUND_RE: Array<{ name: string; re: RegExp }> = [
  { name: 'vai_funcionar',            re: /\bvai\s+(funcionar|dar\s+certo|resolver|curar)\b/ },
  { name: 'em_quanto_tempo',          re: /\bem\s+quanto\s+tempo\s+(fico|some|melhora|cura)\b/ },
  { name: 'garantia_word',            re: /\bgaranti(a|do|do\s+que)\b/ },
  { name: 'quando_curado',            re: /\bquando\s+(fico\s+curado|some|melhora|sara)\b/ },
  { name: 'sera_que_resolve',         re: /\b(e|sera)\s+que\s+resolve\b/ },
  { name: 'cura_word',                re: /\bcura\b/ },
];

/* ── Regex de SAÍDA — Aurora não pode dizer — §B.5.3 ─────────────────────── */

/**
 * Lista negra LITERAL do anexo. Regex são determinísticas; match implica
 * descarte obrigatório da resposta gerada. Ver §B.5.3 "Validador de saída".
 */
const OUTBOUND_RE: Array<{ name: string; re: RegExp }> = [
  { name: 'cura_forms',               re: /\bcura(do|da|r|ra|rao)?\b/ },
  { name: 'garantia_forms',           re: /\bgaranti(a|do|da|mos)\b/ },
  { name: 'cem_por_cento_numeric',    re: /\b100\s*%/ },
  { name: 'cem_por_cento_spelled',    re: /\bcem\s+por\s+cento\b/ },
  { name: 'milagre_forms',            re: /\bmilagr(e|oso|osa)\b/ },
  { name: 'sem_duvida',               re: /\bsem\s+duvida\b/ },
  { name: 'com_certeza_resultado',    re: /\bcom\s+certeza\s+(vai|funciona|resolve)\b/ },
  { name: 'resolve_definitivamente',  re: /\bresolve\s+definitivamente\b/ },
  { name: 'sempre_funciona',          re: /\bsempre\s+funciona\b/ },
  { name: 'sempre_da_certo',          re: /\bsempre\s+da\s+certo\b/ },
  { name: 'voce_vai_ficar_curado',    re: /\bvoce\s+vai\s+ficar\s+(curado|perfeit)/ },
  { name: 'prazo_concreto_cura',      re: /\b(em|no)\s+\d+\s+(dias?|semanas?|meses?)\s+(some|melhora|cura|resolve)\b/ },
];

/* ── Match helper ────────────────────────────────────────────────────────── */

function matchAll(
  normalizedText: string,
  patterns: Array<{ name: string; re: RegExp }>,
): string[] {
  const hits: string[] = [];
  for (const { name, re } of patterns) {
    if (re.test(normalizedText)) hits.push(name);
  }
  return hits;
}

/* ── API pública — ENTRADA ───────────────────────────────────────────────── */

/**
 * Valida mensagem do paciente. Match em qualquer regex → bloqueio.
 * Resposta padrão quando hit: B.3.14.
 */
export function checkPromise(text: string): PromiseGuardResult {
  const n = normalize(text);
  const matchedPatterns = matchAll(n, INBOUND_RE);
  return {
    hit: matchedPatterns.length > 0,
    matchedPatterns,
  };
}

/* ── API pública — SAÍDA ─────────────────────────────────────────────────── */

/**
 * Valida resposta gerada pela Aurora contra a blacklist de saída.
 * Recall-alvo = 1.00 (determinístico).
 */
export function checkPromiseOutbound(text: string): PromiseGuardResult {
  const n = normalize(text);
  const matchedPatterns = matchAll(n, OUTBOUND_RE);
  return {
    hit: matchedPatterns.length > 0,
    matchedPatterns,
  };
}

/**
 * Instrução adicional injetada no regenerate (§B.5.3).
 * Literal do anexo — NÃO modificar sem revisão DPO + RT.
 */
export const PROMISE_REGENERATE_INSTRUCTION =
  "Use linguagem cautelosa. Não prometa resultado, prazo ou cura. " +
  "Use frases como 'varia de paciente para paciente', " +
  "'a dermatologista vai avaliar', 'depende do caso'.";

/** Exposto para testes unitários. */
export const __internals = {
  normalize,
  matchAll,
  INBOUND_RE,
  OUTBOUND_RE,
};

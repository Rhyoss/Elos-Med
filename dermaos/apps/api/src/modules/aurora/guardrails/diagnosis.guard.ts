/**
 * Guardrail de DIAGNÓSTICO — Anexo B §B.5.1.
 *
 * Impede que a Aurora ofereça avaliação clínica, opinião sobre sintoma ou
 * interpretação de imagem/exame. Classificador em camadas:
 *   (1) Lexical — soma de matches normalizada → score ∈ [0,1].
 *   (2) Se score ≥ 0.4, chama LLM judge (Haiku 4.5, temperature 0, max 8 tok).
 *
 * Threshold de bloqueio: `score_lexical ≥ 0.7` OU `judge == 'SIM'`.
 *
 * Política assimétrica: prefere falso-positivo a falso-negativo. Se o LLM
 * judge está indisponível (breaker `open`) e o lexical já ≥ 0.4: assume
 * positivo (fail-safe — §B.5.1 coluna "Fail-safe").
 *
 * Oncológico: se a mensagem contém termos como `câncer`, `melanoma`, `maligno`,
 * `tumor`, `pinta que mudou`, `ferida que não cicatriza`, dispara transferência
 * humana com `priority='high'` e `motivo='guardrail_oncologico'`.
 */

export interface DiagnosisGuardResult {
  hit:            boolean;
  score:          number;
  judge:          'SIM' | 'NAO' | 'UNAVAILABLE' | 'SKIPPED';
  oncologicalHit: boolean;
  matchedPatterns: string[];   // nomes simbólicos — nunca o texto original
}

export interface DiagnosisLlmJudgeInput {
  text: string;
}

export type DiagnosisLlmJudge = (input: DiagnosisLlmJudgeInput) => Promise<'SIM' | 'NAO' | null>;

export interface DiagnosisGuardOptions {
  /** Callback opcional do LLM judge. Sem ele, decisão é puramente lexical. */
  judge?: DiagnosisLlmJudge;
}

/* ── Normalização ────────────────────────────────────────────────────────── */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/* ── Regex literais — §B.5.1 ─────────────────────────────────────────────── */

/**
 * Regex LITERAIS do anexo. Normalização de acentos aplicada no texto antes
 * de testar, portanto todos os padrões usam formas sem acento.
 *
 * Nome simbólico → regex. O nome é o que entra nos logs — nunca o texto.
 */
const DIAGNOSIS_RE: Array<{ name: string; re: RegExp }> = [
  { name: 'is_cancer_or_serious',      re: /\b(e|seria)\s+(cancer|maligno|grave|serio)\b/ },
  { name: 'i_have_something',          re: /\beu\s+tenho\s+(algo|alguma\s+coisa|cancer|cancro)\b/ },
  { name: 'what_is_this',              re: /\bo\s+que\s+(e|pode\s+ser)\s+(isso|isto|essa|esse)\b/ },
  { name: 'this_symptom',              re: /\b(esse|essa)\s+sintoma\b/ },
  { name: 'symptoms_word',             re: /\bsintomas?\b/ },
  { name: 'skin_findings',             re: /\b(coceira|mancha|man[çc]a|ferida|caroco|caroço|lesao|lezao|verruga|nodulo)\b/ },
  { name: 'mole_changes',              re: /\bpinta\s+que\s+(mudou|cresceu|sangrou|coca|coça)\b/ },
  { name: 'is_it_normal_or_worry',     re: /\b(e\s+normal|preciso\s+me\s+preocupar)\b/ },
];

/**
 * Termos oncológicos — qualquer hit aqui escala para humano com priority='high'.
 * Conjunto separado porque a ação excede o bloqueio normal (ver §B.5.1 célula
 * "Ação ao bloquear" item c).
 */
const ONCOLOGICAL_RE: RegExp[] = [
  /\bcancer\b/,
  /\bcancro\b/,
  /\bmelanoma\b/,
  /\bmaligno\b/,
  /\btumor\b/,
  /\bpinta\s+que\s+mudou\b/,
  /\bferida\s+que\s+nao\s+cicatriza\b/,
];

/* ── Scoring ─────────────────────────────────────────────────────────────── */

const LEXICAL_BLOCK_THRESHOLD = 0.7;
const JUDGE_TRIGGER_THRESHOLD = 0.4;

function scoreLexical(normalizedText: string): { score: number; matches: string[] } {
  const matches: string[] = [];
  for (const { name, re } of DIAGNOSIS_RE) {
    if (re.test(normalizedText)) matches.push(name);
  }
  // Cada match contribui ~0.25; 3 matches saturam em 0.75 (≥ threshold).
  const score = Math.min(1, matches.length * 0.25);
  return { score, matches };
}

function isOncological(normalizedText: string): boolean {
  return ONCOLOGICAL_RE.some((re) => re.test(normalizedText));
}

/* ── API pública ─────────────────────────────────────────────────────────── */

export async function checkDiagnosis(
  text:    string,
  options: DiagnosisGuardOptions = {},
): Promise<DiagnosisGuardResult> {
  const n = normalize(text);
  const { score, matches } = scoreLexical(n);
  const oncologicalHit = isOncological(n);

  // Oncológico SEMPRE bloqueia — independe de score.
  if (oncologicalHit) {
    return {
      hit:             true,
      score,
      judge:           'SKIPPED',
      oncologicalHit:  true,
      matchedPatterns: matches,
    };
  }

  // Lexical forte bloqueia direto.
  if (score >= LEXICAL_BLOCK_THRESHOLD) {
    return {
      hit:             true,
      score,
      judge:           'SKIPPED',
      oncologicalHit:  false,
      matchedPatterns: matches,
    };
  }

  // Abaixo do threshold de judge — passa limpo.
  if (score < JUDGE_TRIGGER_THRESHOLD) {
    return {
      hit:             false,
      score,
      judge:           'SKIPPED',
      oncologicalHit:  false,
      matchedPatterns: matches,
    };
  }

  // Zona cinzenta: consulta judge.
  if (!options.judge) {
    // Sem judge — política §B.5.1 é fail-safe "positivo" quando judge está
    // indisponível. Aqui judge nem foi fornecido, tratamos como unavailable
    // e bloqueamos por segurança (prefere FP a FN — dano clínico-legal).
    return {
      hit:             true,
      score,
      judge:           'UNAVAILABLE',
      oncologicalHit:  false,
      matchedPatterns: matches,
    };
  }

  let verdict: 'SIM' | 'NAO' | null = null;
  try {
    verdict = await options.judge({ text });
  } catch {
    verdict = null;
  }

  if (verdict === null) {
    // Judge falhou — fail-safe positivo.
    return {
      hit:             true,
      score,
      judge:           'UNAVAILABLE',
      oncologicalHit:  false,
      matchedPatterns: matches,
    };
  }

  return {
    hit:             verdict === 'SIM',
    score,
    judge:           verdict,
    oncologicalHit:  false,
    matchedPatterns: matches,
  };
}

/** Exposto para testes unitários. */
export const __internals = {
  normalize,
  scoreLexical,
  isOncological,
  DIAGNOSIS_RE,
  ONCOLOGICAL_RE,
  LEXICAL_BLOCK_THRESHOLD,
  JUDGE_TRIGGER_THRESHOLD,
};

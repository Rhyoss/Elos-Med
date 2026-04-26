/**
 * Guardrail de PRESCRIÇÃO — Anexo B §B.5.2.
 *
 * Impede que a Aurora recomende, mencione ou comente sobre medicamentos,
 * princípios ativos, dosagens, posologias ou tratamentos.
 *
 * Decisão em duas categorias:
 *   (A) Match em princípio ativo OU em regex de dosagem/posologia
 *       → bloqueio DIRETO, sem LLM judge.
 *   (B) Match apenas em regex genérico (ex.: "qual remédio?")
 *       → consulta LLM judge (Haiku 4.5, temperature 0).
 *
 * Validador de saída usa a MESMA blacklist de princípios ativos — é
 * determinístico (recall-alvo de saída = 1.00 §B.5.2).
 *
 * Metas §B.5.2: precisão ≥ 0.90, recall ≥ 0.98 na entrada;
 *               recall de saída = 1.00.
 */

export type PrescriptionCategory =
  | 'active_ingredient'   // Medicamento/ingrediente explícito → bloqueio direto
  | 'dosage'              // Dose/posologia explícita → bloqueio direto
  | 'generic';            // Pergunta genérica → consulta judge

export interface PrescriptionGuardResult {
  hit:             boolean;
  category:        PrescriptionCategory | 'none';
  judge:           'SIM' | 'NAO' | 'UNAVAILABLE' | 'SKIPPED';
  matchedPatterns: string[];   // nomes simbólicos — nunca o texto original
}

export interface PrescriptionLlmJudgeInput {
  text: string;
}

export type PrescriptionLlmJudge =
  (input: PrescriptionLlmJudgeInput) => Promise<'SIM' | 'NAO' | null>;

export interface PrescriptionGuardOptions {
  /** Callback opcional do LLM judge. Sem ele, decisão é puramente lexical. */
  judge?: PrescriptionLlmJudge;
}

/* ── Normalização ────────────────────────────────────────────────────────── */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/* ── Blacklist de princípios ativos — §B.5.2 ─────────────────────────────── */

/**
 * Lista negra LITERAL do anexo (~50 princípios ativos comuns em derma).
 * Todas as formas já estão SEM acento (normalização aplicada antes do test).
 *
 * Nome simbólico = o ingrediente em si, em forma canônica. É o que aparece
 * em logs — nunca o texto original do usuário.
 */
const ACTIVE_INGREDIENT_RE: Array<{ name: string; re: RegExp }> = [
  { name: 'isotretinoina',      re: /\bisotretinoina\b/ },
  { name: 'tretinoina',         re: /\btretinoina\b/ },
  { name: 'adapaleno',          re: /\badapaleno\b/ },
  { name: 'clindamicina',       re: /\bclindamicina\b/ },
  { name: 'minociclina',        re: /\bminociclina\b/ },
  { name: 'doxiciclina',        re: /\bdoxiciclina\b/ },
  { name: 'metronidazol',       re: /\bmetronidazol\b/ },
  { name: 'hidrocortisona',     re: /\bhidrocortisona\b/ },
  { name: 'betametasona',       re: /\bbetametasona\b/ },
  { name: 'dexametasona',       re: /\bdexametasona\b/ },
  { name: 'clobetasol',         re: /\bclobetasol\b/ },
  { name: 'mometasona',         re: /\bmometasona\b/ },
  { name: 'tacrolimus',         re: /\btacrolimus\b/ },
  { name: 'pimecrolimus',       re: /\bpimecrolimus\b/ },
  { name: 'metotrexato',        re: /\bmetotrexato\b/ },
  { name: 'ciclosporina',       re: /\bciclosporina\b/ },
  { name: 'dapsona',            re: /\bdapsona\b/ },
  { name: 'terbinafina',        re: /\bterbinafina\b/ },
  { name: 'griseofulvina',      re: /\bgriseofulvina\b/ },
  { name: 'aciclovir',          re: /\baciclovir\b/ },
  { name: 'valaciclovir',       re: /\bvalaciclovir\b/ },
  { name: 'permetrina',         re: /\bpermetrina\b/ },
  { name: 'ivermectina',        re: /\bivermectina\b/ },
  { name: 'cetoconazol',        re: /\bcetoconazol\b/ },
  { name: 'fluconazol',         re: /\bfluconazol\b/ },
  { name: 'azitromicina',       re: /\bazitromicina\b/ },
  { name: 'cefalexina',         re: /\bcefalexina\b/ },
  { name: 'prednisona',         re: /\bprednisona\b/ },
  { name: 'prednisolona',       re: /\bprednisolona\b/ },
  { name: 'finasterida',        re: /\bfinasterida\b/ },
  { name: 'dutasterida',        re: /\bdutasterida\b/ },
  { name: 'minoxidil',          re: /\bminoxidil\b/ },
  { name: 'bimatoprosta',       re: /\bbimatoprosta\b/ },
  { name: 'acido_salicilico',   re: /\bacido\s+salicilico\b/ },
  { name: 'acido_azelaico',     re: /\bacido\s+azelaico\b/ },
  { name: 'acido_kojico',       re: /\bacido\s+koji?co\b/ },
  { name: 'acido_hialuronico',  re: /\bacido\s+hialuronico\b/ },
  { name: 'acido_glicolico',    re: /\bacido\s+glicolico\b/ },
  { name: 'acido_retinoico',    re: /\bacido\s+retinoico\b/ },
  { name: 'peeling_quimico',    re: /\bpeeling\s+(quimico|de\s+\w+)\b/ },
  { name: 'botox',              re: /\bbotox\b/ },
  { name: 'toxina_botulinica',  re: /\btoxina\s+botulinica\b/ },
  { name: 'preenchimento',      re: /\bpreenchimento\s+\w+/ },
];

/* ── Regex de dosagem/posologia — §B.5.2 ─────────────────────────────────── */

/**
 * Regex que capturam perguntas explícitas sobre dose, posologia ou frequência.
 * Hit em QUALQUER uma destas também dispara bloqueio direto.
 */
const DOSAGE_RE: Array<{ name: string; re: RegExp }> = [
  { name: 'dosagem_word',        re: /\bdosagem\b/ },
  { name: 'quantos_mg_unit',     re: /\bquantos?\s+(mg|comprimidos?|gotas?|aplicacoes?)\b/ },
  { name: 'quantas_vezes_ao_dia',re: /\bquantas?\s+vezes?\s+(ao\s+dia|por\s+dia)\b/ },
];

/* ── Regex genéricos — passam pelo LLM judge ─────────────────────────────── */

/**
 * Regex que indicam interesse em medicamento SEM mencionar ingrediente
 * específico. Sozinhos não bloqueiam — consultam judge.
 */
const GENERIC_RE: Array<{ name: string; re: RegExp }> = [
  { name: 'qual_remedio',       re: /\bqual\s+(remedio|medicamento|pomada|creme|antibiotico|corticoide)\b/ },
  { name: 'posso_tomar_usar',   re: /\bposso\s+(tomar|usar|passar|aplicar)\b/ },
];

/* ── Scoring ─────────────────────────────────────────────────────────────── */

function matchBlacklist(
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

export async function checkPrescription(
  text:    string,
  options: PrescriptionGuardOptions = {},
): Promise<PrescriptionGuardResult> {
  const n = normalize(text);

  const ingredientHits = matchBlacklist(n, ACTIVE_INGREDIENT_RE);
  if (ingredientHits.length > 0) {
    return {
      hit:             true,
      category:        'active_ingredient',
      judge:           'SKIPPED',
      matchedPatterns: ingredientHits,
    };
  }

  const dosageHits = matchBlacklist(n, DOSAGE_RE);
  if (dosageHits.length > 0) {
    return {
      hit:             true,
      category:        'dosage',
      judge:           'SKIPPED',
      matchedPatterns: dosageHits,
    };
  }

  const genericHits = matchBlacklist(n, GENERIC_RE);
  if (genericHits.length === 0) {
    return {
      hit:             false,
      category:        'none',
      judge:           'SKIPPED',
      matchedPatterns: [],
    };
  }

  // Zona cinzenta: só genérico — consulta judge.
  if (!options.judge) {
    // Sem judge fornecido — fail-safe positivo (prefere FP a FN em contexto
    // clínico-legal, alinhado à política geral §B.5).
    return {
      hit:             true,
      category:        'generic',
      judge:           'UNAVAILABLE',
      matchedPatterns: genericHits,
    };
  }

  let verdict: 'SIM' | 'NAO' | null = null;
  try {
    verdict = await options.judge({ text });
  } catch {
    verdict = null;
  }

  if (verdict === null) {
    return {
      hit:             true,
      category:        'generic',
      judge:           'UNAVAILABLE',
      matchedPatterns: genericHits,
    };
  }

  return {
    hit:             verdict === 'SIM',
    category:        'generic',
    judge:           verdict,
    matchedPatterns: genericHits,
  };
}

/* ── API pública — SAÍDA (validador determinístico) ──────────────────────── */

export interface PrescriptionOutboundResult {
  hit:             boolean;
  matchedPatterns: string[];
}

/**
 * Aplica a MESMA blacklist de princípios ativos ao texto gerado pela Aurora.
 * Recall-alvo de saída = 1.00 (§B.5.2): qualquer match descarta a resposta.
 *
 * Regex de dosagem genérica NÃO é aplicada na saída — a mensagem da Aurora
 * não faria perguntas ao paciente, então "dosagem" por si só é neutro.
 * O que se quer impedir é a Aurora NOMEAR um princípio ativo.
 */
export function checkPrescriptionOutbound(text: string): PrescriptionOutboundResult {
  const n = normalize(text);
  const matchedPatterns = matchBlacklist(n, ACTIVE_INGREDIENT_RE);
  return {
    hit: matchedPatterns.length > 0,
    matchedPatterns,
  };
}

/**
 * Instrução adicional injetada no regenerate (§B.5.2).
 * Literal do anexo — NÃO modificar sem revisão DPO + RT.
 */
export const PRESCRIPTION_REGENERATE_INSTRUCTION =
  "NUNCA mencione nomes de medicamentos, princípios ativos ou dosagens. " +
  "Reescreva substituindo por 'esse tratamento'.";

/** Exposto para testes unitários. */
export const __internals = {
  normalize,
  matchBlacklist,
  ACTIVE_INGREDIENT_RE,
  DOSAGE_RE,
  GENERIC_RE,
};

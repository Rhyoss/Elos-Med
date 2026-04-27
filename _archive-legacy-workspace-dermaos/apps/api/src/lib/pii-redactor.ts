/**
 * PII Redactor — Anexo B §B.4
 *
 * Substitui dados pessoais e sensíveis por tokens ANTES de qualquer chamada a
 * provedor externo de LLM (Anthropic/Ollama). Também é usado na validação de
 * saída (§B.4.2): se a Aurora gerar texto contendo CPF/RG/CNS/cartão, a
 * resposta é descartada.
 *
 * Modos:
 *   - strict  (padrão Aurora): aplica todas as categorias.
 *   - lenient (reservado): apenas CPF, cartão, CNS.
 *
 * Garantias:
 *   - Nunca retorna nem expõe o texto original.
 *   - `hits` é o payload seguro para log (quantas ocorrências por categoria).
 *   - Todas as regex são resistentes a acentos e variações comuns.
 */

export type RedactorMode = 'strict' | 'lenient';

export type PiiCategory =
  | 'cpf'
  | 'rg'
  | 'cnh'
  | 'cns'
  | 'address'
  | 'card'
  | 'bank'
  | 'phone'
  | 'email';

export interface RedactionResult {
  text:        string;
  hits:        Record<PiiCategory, number>;
  originalLen: number;
  redactedLen: number;
}

/* ── Regex ───────────────────────────────────────────────────────────────── */

// CPF: 000.000.000-00 ou 00000000000 (exatamente 11 dígitos agrupados)
const CPF_RE =
  /(?<![\d\.])(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})(?![\d\.])/g;

// RG: padrões comuns — 00.000.000-0, 0.000.000, etc. (tolerante a dígito X)
const RG_RE =
  /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]\b/g;

// CNH: UF-prefixada (XX-99999999) ou 11 dígitos numéricos usado em campo CNH explícito
const CNH_RE =
  /\b[A-Z]{2}-?\d{8,9}\b/g;

// CNS: 15 dígitos (cartão SUS)
const CNS_RE =
  /\b\d{15}\b/g;

// E-mail
const EMAIL_RE =
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;

// Telefone BR: (11) 91234-5678, 11912345678, +55 11 91234-5678, etc.
// Exige 10 a 13 dígitos totais para evitar colidir com CPF/CNS já capturados antes.
const PHONE_RE =
  /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;

// Endereço: captura "Rua/Av/Al/Trav/Rod/Pça ... N ###"
const ADDRESS_RE =
  /\b(?:rua|av(?:enida)?|alameda|travessa|rodovia|estrada|pra[çc]a|rod\.?|av\.?|r\.?)\s+[A-Za-zÀ-ÿ0-9'.\s-]{2,80}?,?\s*(?:n[º°oº]?\.?\s*)?\d{1,6}\b/gi;

// Agência/conta bancária: "ag 1234", "agência 1234-5", "conta 12345-6"
const BANK_RE =
  /\b(?:ag(?:[eê]ncia|\.?)|conta|cc|c\/c)\s*[:\-]?\s*\d{3,6}(?:[-./]?\d{1,6})*\b/gi;

// Cartão: 13-19 dígitos contíguos ou com separadores (espaço/hífen a cada 4)
const CARD_RE =
  /\b(?:\d[ -]?){13,19}\b/g;

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function onlyDigits(s: string): string {
  return s.replace(/\D+/g, '');
}

/** Algoritmo de Luhn — valida número de cartão antes de marcar hit. */
function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum   = 0;
  let alt   = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (Number.isNaN(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function emptyHits(): Record<PiiCategory, number> {
  return {
    cpf: 0, rg: 0, cnh: 0, cns: 0,
    address: 0, card: 0, bank: 0,
    phone: 0, email: 0,
  };
}

function redactPattern(
  text: string,
  re: RegExp,
  token: string,
  onMatch?: (m: string) => boolean,
): { text: string; count: number } {
  let count = 0;
  const out = text.replace(re, (match) => {
    if (onMatch && !onMatch(match)) return match;
    count++;
    return token;
  });
  return { text: out, count };
}

/* ── API pública ─────────────────────────────────────────────────────────── */

export function redact(text: string, mode: RedactorMode = 'strict'): RedactionResult {
  const original = text ?? '';
  const hits = emptyHits();
  let working = original;

  // 1. Cartão (PRIMEIRO — é o mais genérico: 13-19 dígitos com/sem separador.
  //    Valida Luhn para evitar falso-positivo sobre CPF/CNS/telefone/etc.)
  {
    const { text: t, count } = redactPattern(
      working, CARD_RE, '<CARD_REDACTED>',
      (m) => luhnValid(onlyDigits(m)),
    );
    working = t;
    hits.card = count;
  }

  // 2. CPF
  {
    const { text: t, count } = redactPattern(working, CPF_RE, '<CPF_REDACTED>');
    working = t;
    hits.cpf = count;
  }

  // 3. CNS (15 dígitos)
  {
    const { text: t, count } = redactPattern(working, CNS_RE, '<CNS_REDACTED>');
    working = t;
    hits.cns = count;
  }

  if (mode === 'strict') {
    // 4. E-mail (antes de phone, para não conflitar com numeração)
    {
      const { text: t, count } = redactPattern(working, EMAIL_RE, '<EMAIL_REDACTED>');
      working = t;
      hits.email = count;
    }

    // 5. Endereço (antes de RG/CNH/phone — número do endereço pode parecer RG)
    {
      const { text: t, count } = redactPattern(working, ADDRESS_RE, '<ADDRESS_REDACTED>');
      working = t;
      hits.address = count;
    }

    // 6. CNH (UF-prefix)
    {
      const { text: t, count } = redactPattern(working, CNH_RE, '<DOC_REDACTED>');
      working = t;
      hits.cnh = count;
    }

    // 7. RG
    {
      const { text: t, count } = redactPattern(working, RG_RE, '<DOC_REDACTED>');
      working = t;
      hits.rg = count;
    }

    // 8. Dados bancários
    {
      const { text: t, count } = redactPattern(working, BANK_RE, '<BANK_REDACTED>');
      working = t;
      hits.bank = count;
    }

    // 9. Telefone (por último — o mais permissivo dos numéricos)
    {
      const { text: t, count } = redactPattern(working, PHONE_RE, '<PHONE_REDACTED>');
      working = t;
      hits.phone = count;
    }
  }

  return {
    text:        working,
    hits,
    originalLen: original.length,
    redactedLen: working.length,
  };
}

/**
 * Categorias críticas para validação de saída da Aurora (§B.4.2).
 * Se houver qualquer hit nestas categorias na resposta gerada, a resposta é descartada.
 */
export const CRITICAL_OUTBOUND_CATEGORIES: ReadonlyArray<PiiCategory> = [
  'cpf', 'rg', 'cnh', 'cns', 'card',
];

export function hasCriticalHit(hits: Record<PiiCategory, number>): boolean {
  return CRITICAL_OUTBOUND_CATEGORIES.some((k) => (hits[k] ?? 0) > 0);
}

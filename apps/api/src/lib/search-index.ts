import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * SEC-13 — blind index para buscas em colunas cifradas.
 *
 * O nome do paciente é cifrado com AES-256-GCM em `name_encrypted`. Para
 * permitir buscas (ILIKE / equality) sem expor o plaintext em `name_search`,
 * geramos um conjunto de tokens HMAC-SHA256 de:
 *   - nome inteiro normalizado (busca por igualdade)
 *   - cada palavra normalizada
 *   - cada trigrama normalizado (busca por substring)
 *
 * O resultado vai para `name_search` (text[]). A app gera tokens da query
 * com a mesma função e usa `name_search && $tokens` (overlap operator) para
 * filtrar — sem nunca expor nomes em texto plano.
 *
 * Chave HMAC: `SEARCH_INDEX_KEY` (32 bytes hex). Diferente da chave de
 * cifragem para evitar comprometimento cruzado. Trunca o HMAC a 16 bytes
 * (base64url ~ 22 chars) — suficiente para a maioria dos índices.
 */

const KEY = Buffer.from(env.SEARCH_INDEX_KEY, 'hex');

/** Normaliza para tokenização: NFD, sem acentos, lowercase, sem chars não alfanum. */
export function normalizeForIndex(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hmac(value: string): string {
  return crypto.createHmac('sha256', KEY).update(value).digest('base64url').slice(0, 22);
}

/**
 * Gera tokens de busca para o nome dado:
 *   - nome inteiro
 *   - palavras (≥ 2 chars)
 *   - trigramas (≥ 3 chars)
 */
export function buildNameSearchTokens(name: string): string[] {
  const norm = normalizeForIndex(name);
  if (!norm) return [];

  const tokens = new Set<string>();
  tokens.add(hmac(`full:${norm}`));

  for (const word of norm.split(' ')) {
    if (word.length >= 2) tokens.add(hmac(`word:${word}`));
  }

  for (const word of norm.split(' ')) {
    if (word.length < 3) continue;
    for (let i = 0; i <= word.length - 3; i++) {
      tokens.add(hmac(`tri:${word.slice(i, i + 3)}`));
    }
  }

  return Array.from(tokens);
}

/**
 * Tokens para a QUERY de busca. Mesma função; uso separado deixa o intent
 * explícito no caller.
 */
export function buildSearchQueryTokens(query: string): string[] {
  return buildNameSearchTokens(query);
}

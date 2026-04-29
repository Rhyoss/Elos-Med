-- ============================================================================
-- SEC-13 — name_search vira blind-index (text[])
-- ----------------------------------------------------------------------------
-- Antes: `name_search` armazenava o nome em texto plano lowercased — o que
--          anulava o benefício da cifragem em `name_encrypted` para qualquer
--          dump do banco.
-- Depois: `name_search` armazena tokens HMAC-SHA256 (chave SEARCH_INDEX_KEY).
--          Buscas usam `name_search && $tokens` (overlap operator). Sem a
--          chave HMAC, um dump não revela nada sobre os nomes.
--
-- Migration plan:
--   1. Cria nova coluna `name_search_tokens text[]`.
--   2. Backfill é feito pela aplicação (a chave HMAC vive no app, não no DB).
--      Após deploy, rodar `pnpm tsx src/scripts/rebuild-name-tokens.ts`.
--   3. A coluna velha `name_search` é DROPADA pelo deploy seguinte (não
--      neste init script — para permitir rollback).
-- ============================================================================

ALTER TABLE shared.patients
  ADD COLUMN IF NOT EXISTS name_search_tokens TEXT[] NOT NULL DEFAULT '{}';

-- GIN index para `&&` (overlap), `@>` (contains) e `<@` (contained_by).
CREATE INDEX IF NOT EXISTS idx_patients_name_search_tokens
  ON shared.patients USING gin (name_search_tokens);

COMMENT ON COLUMN shared.patients.name_search_tokens IS
  'SEC-13: blind index HMAC-SHA256 (lib/search-index.ts) — não conter plaintext';

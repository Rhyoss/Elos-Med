-- ============================================================================
-- 061_fix_legacy_cipher_names.sql
-- ============================================================================
-- Deprecated no-op.
--
-- A estratégia correta é manter `shared.patients.name` criptografado pela API
-- (`aes-256-gcm`, formato `iv:authTag:ciphertext`) e expor nomes reais apenas
-- depois de `decrypt()` no serviço autorizado.
--
-- A versão anterior deste arquivo recuperava nomes para texto claro usando
-- `name_search`. Isso conflita com o contrato de segurança atual e não deve
-- mais ser executado.
--
-- Para corrigir seed/imports legados, execute:
--   pnpm --filter @dermaos/api patient-phi:encrypt-legacy
-- ============================================================================

BEGIN;

DO $$
DECLARE
  cipher_like_count int;
BEGIN
  SELECT COUNT(*) INTO cipher_like_count
  FROM shared.patients
  WHERE name ~ '^[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$';

  RAISE NOTICE '[061] no-op: % cipher-like patient names found; leaving encrypted PHI untouched.', cipher_like_count;
END $$;

COMMIT;

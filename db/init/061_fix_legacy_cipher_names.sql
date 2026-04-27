-- ============================================================================
-- 061_fix_legacy_cipher_names.sql
-- ============================================================================
-- Recovers `name` for rows that ended up with raw AES-GCM cipher text in
-- `shared.patients.name` (format: `{IV-base64}:{ciphertext-base64}:{tag-base64}`).
--
-- Causa raiz: durante seeds/imports anteriores, alguns registros tiveram o
-- nome gravado já encriptado pelo `EncryptionService.encrypt()` mas a app não
-- aplica `decrypt()` consistentemente em queries de listagem (patients.list).
-- Resultado: a UI mostrava `ApkN6DlNJPtMwHRl:4znDsn…:jCOFzRGv…` em vez do
-- nome real.
--
-- Fix: para cada linha cuja `name` casa o padrão de cipher AES-GCM, usar
-- `INITCAP(name_search)` para reconstruir um nome legível. `name_search` é a
-- versão lowercased/normalized do nome em claro mantida para busca, então é a
-- única fonte fidedigna disponível em SQL puro (sem chave de criptografia).
--
-- Esta migration é idempotente: pode rodar quantas vezes for necessário; só
-- altera linhas que ainda batem o padrão cipher.
-- ============================================================================

BEGIN;

-- Diagnóstico: quantas linhas serão afetadas?
DO $$
DECLARE
  affected_count int;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM shared.patients
  WHERE name ~ '^[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$'
    AND name_search IS NOT NULL
    AND name_search <> '';

  RAISE NOTICE '[061] % patient rows have cipher names — recovering from name_search', affected_count;
END $$;

-- Recovery: name = title-cased name_search
UPDATE shared.patients
SET    name = INITCAP(name_search)
WHERE  name ~ '^[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$'
  AND  name_search IS NOT NULL
  AND  name_search <> '';

-- Sanity: rows que sobraram (provavelmente sem name_search = casos atípicos)
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM shared.patients
  WHERE name ~ '^[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$';

  IF remaining > 0 THEN
    RAISE WARNING '[061] % patient rows STILL have cipher names (no name_search). Manual review needed.', remaining;
  ELSE
    RAISE NOTICE '[061] All cipher names recovered successfully.';
  END IF;
END $$;

COMMIT;

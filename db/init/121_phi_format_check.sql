-- ============================================================================
-- 121_phi_format_check.sql
-- ============================================================================
-- Defesa em profundidade contra regressão do bug "Nome indisponível":
-- nomes de pacientes em plaintext entrando em colunas que a API espera
-- decifrar via AES-256-GCM (formato `iv:authTag:ciphertext`).
--
-- Histórico: o seed/import legado gravou nomes em plaintext; o serviço
-- chamava `decryptOptional()` que falhava silenciosamente e caía no
-- fallback "Nome indisponível", mascarando o problema. O reparo de dados
-- já foi feito via `pnpm --filter @dermaos/api patient-phi:encrypt-legacy`.
-- Este CHECK garante que o problema não pode reaparecer: qualquer
-- INSERT/UPDATE com nome plaintext é rejeitado pelo banco.
-- ============================================================================

BEGIN;

-- Sanity guard: aborta a migração se ainda restar plaintext.
-- Evita que a constraint seja criada num estado inconsistente.
DO $$
DECLARE
  bad_count int;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM shared.patients
  WHERE name IS NOT NULL
    AND name !~ '^[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$';

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      '[121] % patient names ainda em plaintext. Rode `pnpm --filter @dermaos/api patient-phi:encrypt-legacy` antes desta migração.',
      bad_count;
  END IF;
END $$;

ALTER TABLE shared.patients
  DROP CONSTRAINT IF EXISTS patients_name_cipher_format_chk;

ALTER TABLE shared.patients
  ADD CONSTRAINT patients_name_cipher_format_chk
  CHECK (
    name IS NULL
    OR name ~ '^[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$'
  );

COMMENT ON CONSTRAINT patients_name_cipher_format_chk ON shared.patients IS
  'PHI cipher-format guard: name deve ser NULL ou AES-256-GCM no formato iv:authTag:ciphertext (base64url). Plaintext é rejeitado para evitar regressão de "Nome indisponível".';

COMMIT;

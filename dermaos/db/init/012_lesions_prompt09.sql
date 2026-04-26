-- ============================================================================
-- DermaOS — Prompt 09: Imagens Clínicas, Lesões e Body Map
-- Extensão das tabelas clinical.lesions / clinical.lesion_images com
--   * status enum (active/monitoring/resolved) + soft-delete
--   * audit trail (updated_by, deleted_by, status_reason)
--   * processing_status para imagens assíncronas via BullMQ
-- ============================================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE clinical.lesion_status AS ENUM ('active', 'monitoring', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE clinical.image_processing_status AS ENUM (
    'pending',
    'processing',
    'ready',
    'processing_failed',
    'unprocessable'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── clinical.lesions: status, audit, soft-delete ────────────────────────────

ALTER TABLE clinical.lesions
  ADD COLUMN IF NOT EXISTS status             clinical.lesion_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason      TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by  UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by         UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by         UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason    TEXT;

-- Sincroniza is_active com status para rows legadas
UPDATE clinical.lesions
   SET status = CASE WHEN is_active THEN 'active'::clinical.lesion_status
                     ELSE 'resolved'::clinical.lesion_status END
 WHERE status IS NULL OR (is_active = TRUE  AND status = 'resolved')
                      OR (is_active = FALSE AND status = 'active');

-- Índices para filtros comuns no frontend
CREATE INDEX IF NOT EXISTS idx_lesions_clinic_patient_status
  ON clinical.lesions (clinic_id, patient_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lesions_deleted_at
  ON clinical.lesions (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ─── clinical.lesion_images: processamento assíncrono ────────────────────────

ALTER TABLE clinical.lesion_images
  ADD COLUMN IF NOT EXISTS processing_status   clinical.image_processing_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processing_error    TEXT,
  ADD COLUMN IF NOT EXISTS processed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS file_size_bytes     INTEGER,
  ADD COLUMN IF NOT EXISTS mime_type           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS original_filename   TEXT,
  ADD COLUMN IF NOT EXISTS medium_url          TEXT,
  ADD COLUMN IF NOT EXISTS width_px            INTEGER,
  ADD COLUMN IF NOT EXISTS height_px           INTEGER,
  ADD COLUMN IF NOT EXISTS is_corrupted        BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_lesion_images_processing
  ON clinical.lesion_images (clinic_id, processing_status)
  WHERE processing_status IN ('pending', 'processing', 'processing_failed');

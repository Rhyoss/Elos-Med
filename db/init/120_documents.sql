-- ============================================================================
-- DermaOS — Módulo Documentos Clínicos e Termos de Consentimento
-- Tabelas: clinical.documents, clinical.consent_terms
-- Suporta: receitas, termos, atestados, declarações, solicitações,
--          orientações pós-procedimento, documentos anexados.
-- Versionamento imutável pós-assinatura, vínculo polimórfico (encounter /
-- procedure / prescription / lesion), auditoria via RLS + GUC.
-- ============================================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE clinical.document_type AS ENUM (
    'prescricao',
    'termo_consentimento',
    'atestado',
    'declaracao',
    'solicitacao',
    'orientacao_pos_procedimento',
    'laudo',
    'anexo'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE clinical.document_status AS ENUM (
    'rascunho',
    'emitido',
    'assinado',
    'revogado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE clinical.consent_status AS ENUM (
    'pendente',
    'assinado',
    'revogado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── clinical.documents ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinical.documents (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID          NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id        UUID          NOT NULL REFERENCES shared.patients (id) ON DELETE RESTRICT,

  -- Vínculos opcionais
  encounter_id      UUID          REFERENCES clinical.encounters (id) ON DELETE SET NULL,
  procedure_id      UUID          REFERENCES clinical.protocol_sessions (id) ON DELETE SET NULL,
  prescription_id   UUID          REFERENCES clinical.prescriptions (id) ON DELETE SET NULL,

  type              clinical.document_type   NOT NULL,
  status            clinical.document_status NOT NULL DEFAULT 'rascunho',

  title             TEXT          NOT NULL,
  content_html      TEXT,                               -- conteúdo editável (rascunho / preview)
  template_id       UUID,                               -- referência a automations.templates

  -- PDF
  pdf_storage_key   TEXT,
  pdf_generated_at  TIMESTAMPTZ,

  -- Versioning: imutável após assinatura — novas edições sobem version e recriam registro
  version           INT           NOT NULL DEFAULT 1,
  previous_version_id UUID        REFERENCES clinical.documents (id) ON DELETE SET NULL,

  -- Assinatura
  signed_at         TIMESTAMPTZ,
  signed_by         UUID          REFERENCES shared.users (id) ON DELETE SET NULL,
  signature_hash    TEXT,

  -- Revogação (requer motivo)
  revoked_at        TIMESTAMPTZ,
  revoked_by        UUID          REFERENCES shared.users (id) ON DELETE SET NULL,
  revocation_reason TEXT,

  -- Audit
  created_by        UUID          REFERENCES shared.users (id) ON DELETE SET NULL,
  updated_by        UUID          REFERENCES shared.users (id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índices para listagens por paciente, clínica, tipo
CREATE INDEX IF NOT EXISTS idx_documents_clinic_patient
  ON clinical.documents (clinic_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_clinic_type_status
  ON clinical.documents (clinic_id, type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_encounter
  ON clinical.documents (encounter_id)
  WHERE encounter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_prescription
  ON clinical.documents (prescription_id)
  WHERE prescription_id IS NOT NULL;

-- ─── clinical.consent_terms ──────────────────────────────────────────────────
-- Registro dedicado de termos de consentimento — permite rastrear
-- quais procedimentos / fotos estão cobertos por consentimento assinado.

CREATE TABLE IF NOT EXISTS clinical.consent_terms (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID          NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id        UUID          NOT NULL REFERENCES shared.patients (id) ON DELETE RESTRICT,

  -- Documento gerado (se houver PDF associado)
  document_id       UUID          REFERENCES clinical.documents (id) ON DELETE SET NULL,

  -- Vínculos ao que é consentido
  procedure_id      UUID          REFERENCES clinical.protocol_sessions (id) ON DELETE SET NULL,
  lesion_photo_id   UUID          REFERENCES clinical.lesion_images (id) ON DELETE SET NULL,

  status            clinical.consent_status NOT NULL DEFAULT 'pendente',
  description       TEXT,                               -- texto do termo

  signed_at         TIMESTAMPTZ,
  signed_by_patient BOOLEAN       NOT NULL DEFAULT FALSE,  -- paciente assinou presencialmente
  patient_signature TEXT,                                   -- hash/desenho de assinatura

  revoked_at        TIMESTAMPTZ,
  revocation_reason TEXT,

  created_by        UUID          REFERENCES shared.users (id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_terms_clinic_patient
  ON clinical.consent_terms (clinic_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_terms_procedure
  ON clinical.consent_terms (procedure_id)
  WHERE procedure_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consent_terms_document
  ON clinical.consent_terms (document_id)
  WHERE document_id IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE clinical.documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.consent_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.documents    FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical.consent_terms FORCE ROW LEVEL SECURITY;

-- Policy: leitura e escrita restritas à clínica da sessão
CREATE POLICY documents_clinic_isolation
  ON clinical.documents
  USING (clinic_id = current_setting('app.current_clinic_id')::uuid)
  WITH CHECK (clinic_id = current_setting('app.current_clinic_id')::uuid);

CREATE POLICY consent_terms_clinic_isolation
  ON clinical.consent_terms
  USING (clinic_id = current_setting('app.current_clinic_id')::uuid)
  WITH CHECK (clinic_id = current_setting('app.current_clinic_id')::uuid);

-- Exceção para dermaos_authn (funções SECURITY DEFINER que não têm GUC)
CREATE POLICY documents_authn_bypass
  ON clinical.documents
  TO dermaos_authn
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY consent_terms_authn_bypass
  ON clinical.consent_terms
  TO dermaos_authn
  USING (TRUE)
  WITH CHECK (TRUE);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION clinical.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON clinical.documents
    FOR EACH ROW EXECUTE FUNCTION clinical.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_consent_terms_updated_at
    BEFORE UPDATE ON clinical.consent_terms
    FOR EACH ROW EXECUTE FUNCTION clinical.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

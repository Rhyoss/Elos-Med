-- ============================================================================
-- DermaOS — Clinical Schema Tables
-- Prontuário eletrônico: encounters, prescriptions, lesions, protocols,
-- biopsies e sinais vitais. Dados PHI criptografados na camada de aplicação.
-- ============================================================================

-- ─── ENUMs ──────────────────────────────────────────────────────────────────

CREATE TYPE clinical.encounter_type AS ENUM (
  'clinical',
  'aesthetic',
  'followup',
  'emergency',
  'telemedicine'
);

CREATE TYPE clinical.encounter_status AS ENUM (
  'rascunho',
  'revisao',
  'assinado',
  'corrigido'
);

CREATE TYPE clinical.prescription_type AS ENUM (
  'topica',
  'sistemica',
  'manipulada',
  'cosmeceutica'
);

CREATE TYPE clinical.prescription_status AS ENUM (
  'rascunho',
  'emitida',
  'enviada_digital',
  'impressa',
  'expirada'
);

CREATE TYPE clinical.protocol_type AS ENUM (
  'fototerapia',
  'laser_fracionado',
  'peeling',
  'injetavel',
  'microagulhamento',
  'outro'
);

CREATE TYPE clinical.protocol_status AS ENUM (
  'ativo',
  'pausado',
  'concluido',
  'cancelado'
);

CREATE TYPE clinical.biopsy_type AS ENUM (
  'punch',
  'shave',
  'excisional',
  'incisional'
);

CREATE TYPE clinical.biopsy_status AS ENUM (
  'coletada',
  'enviada_lab',
  'resultado_recebido',
  'resultado_comunicado'
);

-- ─── clinical.encounters ─────────────────────────────────────────────────────
-- Consulta/atendimento clínico. Campos SOAP criptografados AES-256 na app.

CREATE TABLE clinical.encounters (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id        UUID        NOT NULL REFERENCES shared.patients (id) ON DELETE RESTRICT,
  provider_id       UUID        NOT NULL REFERENCES shared.users (id) ON DELETE RESTRICT,
  appointment_id    UUID        REFERENCES shared.appointments (id) ON DELETE SET NULL,
  type              clinical.encounter_type   NOT NULL DEFAULT 'clinical',
  status            clinical.encounter_status NOT NULL DEFAULT 'rascunho',
  -- Campos SOAP — armazenados cifrados na app, texto cru no banco para performance
  chief_complaint   TEXT,
  subjective        TEXT,
  objective         TEXT,
  assessment        TEXT,
  plan              TEXT,
  -- Estrutura adicional
  diagnoses         TEXT[]      NOT NULL DEFAULT '{}',     -- códigos CID-10
  structured_data   JSONB       NOT NULL DEFAULT '{}',     -- achados dermatológicos estruturados
  attachments       JSONB       NOT NULL DEFAULT '[]',     -- [{url, type, label}]
  -- Assinatura digital
  signed_at         TIMESTAMPTZ,
  signed_by         UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  signature_hash    TEXT,                                  -- hash SHA-256 do conteúdo no momento da assinatura
  -- Auditoria
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        REFERENCES shared.users (id) ON DELETE SET NULL
);

CREATE INDEX idx_encounters_clinic_patient   ON clinical.encounters (clinic_id, patient_id);
CREATE INDEX idx_encounters_clinic_provider  ON clinical.encounters (clinic_id, provider_id);
CREATE INDEX idx_encounters_appointment_id   ON clinical.encounters (appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX idx_encounters_clinic_status    ON clinical.encounters (clinic_id, status);
CREATE INDEX idx_encounters_clinic_created   ON clinical.encounters (clinic_id, created_at DESC);

-- ─── clinical.prescriptions ──────────────────────────────────────────────────

CREATE TABLE clinical.prescriptions (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id             UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  encounter_id          UUID        NOT NULL REFERENCES clinical.encounters (id) ON DELETE RESTRICT,
  patient_id            UUID        NOT NULL REFERENCES shared.patients (id) ON DELETE RESTRICT,
  prescriber_id         UUID        NOT NULL REFERENCES shared.users (id) ON DELETE RESTRICT,
  type                  clinical.prescription_type   NOT NULL,
  status                clinical.prescription_status NOT NULL DEFAULT 'rascunho',
  -- Itens prescritos: estrutura varia conforme tipo (tópico, sistêmico, manipulado)
  items                 JSONB       NOT NULL DEFAULT '[]',
  notes                 TEXT,
  valid_until           DATE,
  prescription_number   TEXT,                              -- número sequencial por clínica
  pdf_url               TEXT,                              -- URL no MinIO após geração
  digital_signature     TEXT,
  delivery_method       TEXT,                              -- 'email' | 'whatsapp' | 'impressa'
  delivered_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID        REFERENCES shared.users (id) ON DELETE SET NULL
);

CREATE INDEX idx_prescriptions_clinic_patient  ON clinical.prescriptions (clinic_id, patient_id);
CREATE INDEX idx_prescriptions_encounter_id    ON clinical.prescriptions (encounter_id);
CREATE INDEX idx_prescriptions_clinic_status   ON clinical.prescriptions (clinic_id, status);

-- ─── clinical.lesions ────────────────────────────────────────────────────────

CREATE TABLE clinical.lesions (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id        UUID        NOT NULL REFERENCES shared.patients (id) ON DELETE RESTRICT,
  location_body_map TEXT        NOT NULL,                  -- chave no mapa corporal: 'face_cheek_left'
  location_notes    TEXT,
  morphology        TEXT[]      NOT NULL DEFAULT '{}',     -- ['mancha','placa','vesícula']
  color             TEXT[]      NOT NULL DEFAULT '{}',
  size_mm           DECIMAL(6, 2),
  description       TEXT,
  first_noted_at    DATE,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        REFERENCES shared.users (id) ON DELETE SET NULL
);

CREATE INDEX idx_lesions_clinic_patient  ON clinical.lesions (clinic_id, patient_id);
CREATE INDEX idx_lesions_active          ON clinical.lesions (clinic_id, patient_id) WHERE is_active = TRUE;

-- ─── clinical.lesion_images ──────────────────────────────────────────────────
-- Registro imutável: fotos clínicas e dermatoscópicas das lesões

CREATE TABLE clinical.lesion_images (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  lesion_id     UUID        NOT NULL REFERENCES clinical.lesions (id) ON DELETE RESTRICT,
  encounter_id  UUID        REFERENCES clinical.encounters (id) ON DELETE SET NULL,
  captured_by   UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  image_url     TEXT        NOT NULL,                      -- storage key no MinIO
  thumbnail_url TEXT,
  equipment     VARCHAR(100),                              -- 'DermLite DL4', 'iPhone 15 Pro'
  capture_type  VARCHAR(50),                               -- 'dermoscopy', 'macro', 'clinical'
  magnification TEXT,
  metadata      JSONB       NOT NULL DEFAULT '{}',         -- EXIF, calibração de cor
  alt_text      TEXT,                                      -- acessibilidade WCAG
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Sem updated_at: imagens são imutáveis após upload
);

CREATE INDEX idx_lesion_images_lesion_id    ON clinical.lesion_images (lesion_id);
CREATE INDEX idx_lesion_images_encounter_id ON clinical.lesion_images (encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX idx_lesion_images_captured_at  ON clinical.lesion_images (clinic_id, captured_at DESC);

-- ─── clinical.protocols ──────────────────────────────────────────────────────

CREATE TABLE clinical.protocols (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id        UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id       UUID        NOT NULL REFERENCES shared.patients (id) ON DELETE RESTRICT,
  provider_id      UUID        NOT NULL REFERENCES shared.users (id) ON DELETE RESTRICT,
  type             clinical.protocol_type   NOT NULL,
  status           clinical.protocol_status NOT NULL DEFAULT 'ativo',
  name             TEXT        NOT NULL,
  description      TEXT,
  total_sessions   INT         NOT NULL DEFAULT 1,
  sessions_done    INT         NOT NULL DEFAULT 0,
  interval_days    INT,                                    -- dias recomendados entre sessões
  started_at       DATE,
  expected_end_date DATE,
  ended_at         DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID        REFERENCES shared.users (id) ON DELETE SET NULL,

  CONSTRAINT chk_protocol_sessions CHECK (sessions_done >= 0 AND total_sessions > 0 AND sessions_done <= total_sessions)
);

CREATE INDEX idx_protocols_clinic_patient ON clinical.protocols (clinic_id, patient_id);
CREATE INDEX idx_protocols_clinic_status  ON clinical.protocols (clinic_id, status);
CREATE INDEX idx_protocols_active         ON clinical.protocols (clinic_id) WHERE status = 'ativo';

-- ─── clinical.protocol_sessions ──────────────────────────────────────────────

CREATE TABLE clinical.protocol_sessions (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  protocol_id       UUID        NOT NULL REFERENCES clinical.protocols (id) ON DELETE RESTRICT,
  appointment_id    UUID        REFERENCES shared.appointments (id) ON DELETE SET NULL,
  performed_by      UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  session_number    INT         NOT NULL,
  performed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_min      INT,
  observations      TEXT,
  parameters        JSONB       NOT NULL DEFAULT '{}',     -- configurações do equipamento, energia, passes
  outcome           TEXT,
  next_session_notes TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_protocol_session UNIQUE (protocol_id, session_number)
);

CREATE INDEX idx_protocol_sessions_protocol_id    ON clinical.protocol_sessions (protocol_id);
CREATE INDEX idx_protocol_sessions_appointment_id ON clinical.protocol_sessions (appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX idx_protocol_sessions_clinic         ON clinical.protocol_sessions (clinic_id, performed_at DESC);

-- ─── clinical.biopsies ───────────────────────────────────────────────────────

CREATE TABLE clinical.biopsies (
  id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id                UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id               UUID        NOT NULL REFERENCES shared.patients (id) ON DELETE RESTRICT,
  encounter_id             UUID        REFERENCES clinical.encounters (id) ON DELETE SET NULL,
  lesion_id                UUID        REFERENCES clinical.lesions (id) ON DELETE SET NULL,
  performed_by             UUID        NOT NULL REFERENCES shared.users (id) ON DELETE RESTRICT,
  type                     clinical.biopsy_type   NOT NULL,
  status                   clinical.biopsy_status NOT NULL DEFAULT 'coletada',
  location_description     TEXT,
  site_code                TEXT,                           -- código de sítio anatômico
  sample_count             INT         NOT NULL DEFAULT 1,
  collected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lab_name                 TEXT,
  lab_request_number       TEXT,
  sent_to_lab_at           TIMESTAMPTZ,
  result_received_at       TIMESTAMPTZ,
  result_text              TEXT,
  result_cid               TEXT,                           -- CID-10 do laudo histopatológico
  result_pdf_url           TEXT,
  result_communicated_at   TIMESTAMPTZ,
  communicated_by          UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID        REFERENCES shared.users (id) ON DELETE SET NULL
);

CREATE INDEX idx_biopsies_clinic_patient ON clinical.biopsies (clinic_id, patient_id);
CREATE INDEX idx_biopsies_clinic_status  ON clinical.biopsies (clinic_id, status);
CREATE INDEX idx_biopsies_pending        ON clinical.biopsies (clinic_id)
  WHERE status NOT IN ('resultado_comunicado');

-- ─── clinical.vital_signs ────────────────────────────────────────────────────
-- Registro imutável: cada aferição é um novo registro

CREATE TABLE clinical.vital_signs (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id          UUID        NOT NULL REFERENCES shared.patients (id) ON DELETE RESTRICT,
  encounter_id        UUID        REFERENCES clinical.encounters (id) ON DELETE SET NULL,
  recorded_by         UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  weight_kg           DECIMAL(5, 2),
  height_cm           DECIMAL(5, 1),
  -- BMI computado automaticamente, guardado para evitar recálculo
  bmi                 DECIMAL(4, 1) GENERATED ALWAYS AS (
                        CASE
                          WHEN weight_kg IS NOT NULL AND height_cm IS NOT NULL AND height_cm > 0
                          THEN ROUND((weight_kg / ((height_cm / 100.0) * (height_cm / 100.0)))::NUMERIC, 1)
                        END
                      ) STORED,
  blood_pressure_sys  SMALLINT,
  blood_pressure_dia  SMALLINT,
  heart_rate          SMALLINT,
  temperature_c       DECIMAL(4, 1),
  oxygen_saturation   SMALLINT,
  notes               TEXT,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Sem updated_at: sinais vitais são imutáveis, corrija com novo registro
);

CREATE INDEX idx_vital_signs_clinic_patient ON clinical.vital_signs (clinic_id, patient_id);
CREATE INDEX idx_vital_signs_encounter_id   ON clinical.vital_signs (encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX idx_vital_signs_clinic_recorded ON clinical.vital_signs (clinic_id, recorded_at DESC);

-- ─── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE clinical.encounters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.prescriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.lesions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.lesion_images    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.protocols        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.protocol_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.biopsies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.vital_signs      ENABLE ROW LEVEL SECURITY;

ALTER TABLE clinical.encounters       FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical.prescriptions    FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical.lesions          FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical.lesion_images    FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical.protocols        FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical.protocol_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical.biopsies         FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical.vital_signs      FORCE ROW LEVEL SECURITY;

-- encounters
CREATE POLICY encounters_isolation_app ON clinical.encounters
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY encounters_isolation_readonly ON clinical.encounters
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY encounters_worker_all ON clinical.encounters
  FOR ALL TO dermaos_worker USING (true);

-- prescriptions
CREATE POLICY prescriptions_isolation_app ON clinical.prescriptions
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY prescriptions_isolation_readonly ON clinical.prescriptions
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY prescriptions_worker_all ON clinical.prescriptions
  FOR ALL TO dermaos_worker USING (true);

-- lesions
CREATE POLICY lesions_isolation_app ON clinical.lesions
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY lesions_isolation_readonly ON clinical.lesions
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY lesions_worker_all ON clinical.lesions
  FOR ALL TO dermaos_worker USING (true);

-- lesion_images
CREATE POLICY lesion_images_isolation_app ON clinical.lesion_images
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY lesion_images_isolation_readonly ON clinical.lesion_images
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY lesion_images_worker_all ON clinical.lesion_images
  FOR ALL TO dermaos_worker USING (true);

-- protocols
CREATE POLICY protocols_isolation_app ON clinical.protocols
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY protocols_isolation_readonly ON clinical.protocols
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY protocols_worker_all ON clinical.protocols
  FOR ALL TO dermaos_worker USING (true);

-- protocol_sessions
CREATE POLICY protocol_sessions_isolation_app ON clinical.protocol_sessions
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY protocol_sessions_isolation_readonly ON clinical.protocol_sessions
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY protocol_sessions_worker_all ON clinical.protocol_sessions
  FOR ALL TO dermaos_worker USING (true);

-- biopsies
CREATE POLICY biopsies_isolation_app ON clinical.biopsies
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY biopsies_isolation_readonly ON clinical.biopsies
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY biopsies_worker_all ON clinical.biopsies
  FOR ALL TO dermaos_worker USING (true);

-- vital_signs
CREATE POLICY vital_signs_isolation_app ON clinical.vital_signs
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY vital_signs_isolation_readonly ON clinical.vital_signs
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY vital_signs_worker_all ON clinical.vital_signs
  FOR ALL TO dermaos_worker USING (true);

-- ─── Grants ──────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA clinical TO dermaos_app;
GRANT SELECT ON ALL TABLES IN SCHEMA clinical TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA clinical TO dermaos_worker;
GRANT ALL ON ALL TABLES IN SCHEMA clinical TO dermaos_admin;

-- ─── Triggers updated_at ─────────────────────────────────────────────────────
-- lesion_images e vital_signs são append-only, portanto sem trigger de updated_at

CREATE TRIGGER trg_encounters_updated_at
  BEFORE UPDATE ON clinical.encounters
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_prescriptions_updated_at
  BEFORE UPDATE ON clinical.prescriptions
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_lesions_updated_at
  BEFORE UPDATE ON clinical.lesions
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_protocols_updated_at
  BEFORE UPDATE ON clinical.protocols
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_protocol_sessions_updated_at
  BEFORE UPDATE ON clinical.protocol_sessions
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_biopsies_updated_at
  BEFORE UPDATE ON clinical.biopsies
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

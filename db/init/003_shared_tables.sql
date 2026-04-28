-- ============================================================================
-- DermaOS — Shared Tables
-- Tabelas base compartilhadas por todos os módulos
-- Multi-tenancy via clinic_id em todas as tabelas + RLS
-- ============================================================================

-- ─── ENUMs ──────────────────────────────────────────────────────────────────

CREATE TYPE shared.clinic_plan AS ENUM (
  'trial',
  'starter',
  'professional',
  'enterprise'
);

CREATE TYPE shared.user_role AS ENUM (
  'owner',
  'admin',
  'dermatologist',
  'nurse',
  'receptionist',
  'financial',
  'readonly'
);

CREATE TYPE shared.patient_status AS ENUM (
  'active',
  'inactive',
  'blocked',
  'deceased',
  'transferred',
  'merged'
);

CREATE TYPE shared.appointment_status AS ENUM (
  'scheduled',
  'confirmed',
  'waiting',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'rescheduled'
);

CREATE TYPE shared.appointment_source AS ENUM (
  'manual',
  'online_booking',
  'whatsapp',
  'phone',
  'walk_in',
  'referral'
);

CREATE TYPE shared.gender_type AS ENUM (
  'male',
  'female',
  'non_binary',
  'prefer_not_to_say',
  'other'
);

-- ─── shared.clinics ──────────────────────────────────────────────────────────

CREATE TABLE shared.clinics (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,              -- subdomínio: clinica.dermaos.com.br
  cnpj                  TEXT UNIQUE,                       -- armazenado sem formatação
  logo_url              TEXT,
  address               JSONB NOT NULL DEFAULT '{}',       -- {street, number, complement, district, city, state, zip}
  phone                 TEXT,
  email                 TEXT,
  timezone              TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  business_hours        JSONB NOT NULL DEFAULT '{}',       -- {mon: {open: "08:00", close: "18:00"}, ...}
  appointment_config    JSONB NOT NULL DEFAULT '{}',       -- {default_duration: 30, buffer_time: 10, ...}
  cnes                  TEXT,                              -- Cadastro Nacional de Estabelecimentos de Saúde
  crf                   TEXT,                              -- Conselho Regional de Farmácia
  afe                   TEXT,                              -- Autorização de Funcionamento de Empresa (ANVISA)
  plan                  shared.clinic_plan NOT NULL DEFAULT 'trial',
  plan_limits           JSONB NOT NULL DEFAULT '{}',       -- {max_patients: 500, max_users: 5, ...}
  trial_ends_at         TIMESTAMPTZ,
  subscription_id       TEXT,                              -- ID externo do gateway de pagamento
  ai_config             JSONB NOT NULL DEFAULT '{}',       -- {ollama_model: "llama3.1:8b", features: [...]}
  is_active             BOOLEAN NOT NULL DEFAULT true,
  onboarded_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinics_slug    ON shared.clinics (slug);
CREATE INDEX idx_clinics_cnpj    ON shared.clinics (cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX idx_clinics_plan    ON shared.clinics (plan);
CREATE INDEX idx_clinics_active  ON shared.clinics (is_active) WHERE is_active = true;

COMMENT ON TABLE  shared.clinics IS 'Tenant raiz — cada clínica é um tenant isolado';
COMMENT ON COLUMN shared.clinics.slug IS 'Identificador único URL-safe usado como subdomínio';
COMMENT ON COLUMN shared.clinics.ai_config IS 'Configuração de IA por clínica: modelos, features habilitadas';

-- ─── shared.users ─────────────────────────────────────────────────────────────

CREATE TABLE shared.users (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id               UUID NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  name                    TEXT NOT NULL,
  email                   TEXT NOT NULL,
  password_hash           TEXT NOT NULL,                    -- argon2id
  role                    shared.user_role NOT NULL DEFAULT 'readonly',
  crm                     TEXT,                             -- apenas para dermatologistas
  specialty               TEXT,
  avatar_url              TEXT,
  phone                   TEXT,
  permissions             JSONB NOT NULL DEFAULT '[]',      -- permissões extras além do role
  preferences             JSONB NOT NULL DEFAULT '{}',      -- UI preferences: theme, language, etc.
  schedule_config         JSONB NOT NULL DEFAULT '{}',      -- {working_hours, appointment_types, break_times}
  is_active               BOOLEAN NOT NULL DEFAULT true,
  is_email_verified       BOOLEAN NOT NULL DEFAULT false,
  mfa_enabled             BOOLEAN NOT NULL DEFAULT false,
  mfa_secret              TEXT,                             -- TOTP secret (criptografado AES-256 na app)
  failed_login_attempts   INT NOT NULL DEFAULT 0,
  locked_until            TIMESTAMPTZ,
  last_login_at           TIMESTAMPTZ,
  last_login_ip           INET,
  password_changed_at     TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by              UUID REFERENCES shared.users (id) ON DELETE SET NULL,

  CONSTRAINT uq_users_email_clinic UNIQUE (clinic_id, email)
);

CREATE INDEX idx_users_clinic_id   ON shared.users (clinic_id);
CREATE INDEX idx_users_email       ON shared.users (email);
CREATE INDEX idx_users_role        ON shared.users (clinic_id, role);
CREATE INDEX idx_users_active      ON shared.users (clinic_id, is_active) WHERE is_active = true;
CREATE INDEX idx_users_crm         ON shared.users (clinic_id, crm) WHERE crm IS NOT NULL;

COMMENT ON COLUMN shared.users.mfa_secret     IS 'TOTP secret — criptografado AES-256 antes de armazenar';
COMMENT ON COLUMN shared.users.permissions    IS 'Array de permissões granulares adicionais ao role padrão';
COMMENT ON COLUMN shared.users.schedule_config IS 'Configuração de agenda individual do profissional';

-- ─── shared.patients ──────────────────────────────────────────────────────────

CREATE TABLE shared.patients (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id                   UUID NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  -- Dados PHI criptografados AES-256 na camada de aplicação
  name                        TEXT NOT NULL,                -- criptografado
  name_search                 TEXT NOT NULL,                -- lowercase sem acentos para busca (não-PHI)
  cpf_hash                    TEXT,                         -- SHA-256 para lookup sem descriptografar
  cpf_encrypted               TEXT,                         -- AES-256
  birth_date                  DATE,
  gender                      shared.gender_type,
  photo_url                   TEXT,
  email_encrypted             TEXT,                         -- AES-256
  phone_encrypted             TEXT,                         -- AES-256
  phone_secondary_encrypted   TEXT,                         -- AES-256
  address                     JSONB,                        -- criptografado como string JSON
  blood_type                  VARCHAR(3),                   -- ex: "A+", "O-"
  allergies                   TEXT[] NOT NULL DEFAULT '{}', -- lista de alergias
  chronic_conditions          TEXT[] NOT NULL DEFAULT '{}', -- condições crônicas
  active_medications          TEXT[] NOT NULL DEFAULT '{}', -- medicamentos em uso
  -- Origem e marketing
  source_channel              TEXT,                         -- whatsapp, google, referral, walk_in
  source_campaign             TEXT,                         -- UTM campaign ou código de referência
  referred_by                 UUID REFERENCES shared.patients (id) ON DELETE SET NULL,
  -- Portal do paciente
  portal_enabled              BOOLEAN NOT NULL DEFAULT false,
  portal_email                TEXT,
  portal_password_hash        TEXT,                         -- argon2id — separado do email_encrypted
  -- Status e métricas
  status                      shared.patient_status NOT NULL DEFAULT 'active',
  total_visits                INT NOT NULL DEFAULT 0,
  last_visit_at               TIMESTAMPTZ,
  first_visit_at              TIMESTAMPTZ,
  total_revenue               DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ltv_calculated              BOOLEAN NOT NULL DEFAULT false,
  -- Auditoria
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                  UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  deleted_at                  TIMESTAMPTZ,                  -- soft delete LGPD
  deletion_reason             TEXT
);

CREATE INDEX idx_patients_clinic_id     ON shared.patients (clinic_id);
CREATE INDEX idx_patients_name_search   ON shared.patients USING gin (name_search gin_trgm_ops);
CREATE INDEX idx_patients_cpf_hash      ON shared.patients (clinic_id, cpf_hash) WHERE cpf_hash IS NOT NULL;
CREATE INDEX idx_patients_status        ON shared.patients (clinic_id, status);
CREATE INDEX idx_patients_active        ON shared.patients (clinic_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_source        ON shared.patients (clinic_id, source_channel);
CREATE INDEX idx_patients_last_visit    ON shared.patients (clinic_id, last_visit_at DESC NULLS LAST);
CREATE INDEX idx_patients_birth_date    ON shared.patients (birth_date) WHERE birth_date IS NOT NULL;

COMMENT ON TABLE  shared.patients IS 'Dados de pacientes — PHI criptografado AES-256 na aplicação';
COMMENT ON COLUMN shared.patients.name          IS 'Nome criptografado AES-256';
COMMENT ON COLUMN shared.patients.name_search   IS 'Nome em minúsculas sem acentos — usado para busca, não é PHI direto';
COMMENT ON COLUMN shared.patients.cpf_hash      IS 'SHA-256 do CPF normalizado — lookup sem expor dado';
COMMENT ON COLUMN shared.patients.deleted_at    IS 'Soft delete conforme LGPD art. 16 — retenção mínima obrigatória';

-- ─── shared.services ─────────────────────────────────────────────────────────
-- Catálogo de serviços/procedimentos oferecidos pela clínica

CREATE TABLE shared.services (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT,                                   -- ex: "Consulta", "Procedimento Estético"
  duration_min      INT NOT NULL DEFAULT 30,
  price             DECIMAL(10, 2),
  allow_online      BOOLEAN NOT NULL DEFAULT true,          -- disponível no agendamento online
  requires_provider BOOLEAN NOT NULL DEFAULT true,
  color             VARCHAR(7),                             -- hex para calendário
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_services_name_clinic UNIQUE (clinic_id, name)
);

CREATE INDEX idx_services_clinic_id ON shared.services (clinic_id);
CREATE INDEX idx_services_active    ON shared.services (clinic_id, is_active) WHERE is_active = true;
CREATE INDEX idx_services_category  ON shared.services (clinic_id, category);

-- ─── shared.appointments ─────────────────────────────────────────────────────

CREATE TABLE shared.appointments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id          UUID NOT NULL REFERENCES shared.patients (id) ON DELETE RESTRICT,
  provider_id         UUID NOT NULL REFERENCES shared.users (id) ON DELETE RESTRICT,
  service_id          UUID REFERENCES shared.services (id) ON DELETE SET NULL,
  type                VARCHAR(100) NOT NULL DEFAULT 'consultation',
  scheduled_at        TIMESTAMPTZ NOT NULL,
  duration_min        INT NOT NULL DEFAULT 30,
  room                TEXT,
  status              shared.appointment_status NOT NULL DEFAULT 'scheduled',
  status_history      JSONB NOT NULL DEFAULT '[]',          -- [{status, changed_at, changed_by, reason}]
  source              shared.appointment_source NOT NULL DEFAULT 'manual',
  conversation_id     UUID,                                 -- FK para omni.conversations (criado depois)
  protocol_id         UUID,                                 -- FK para clinical.protocols (criado depois)
  price               DECIMAL(10, 2),
  payment_status      VARCHAR(30) DEFAULT 'pending',        -- pending, paid, partial, refunded
  invoice_id          UUID,                                 -- FK para financial.invoices (criado depois)
  reminder_sent_24h   BOOLEAN NOT NULL DEFAULT false,
  reminder_sent_2h    BOOLEAN NOT NULL DEFAULT false,
  confirmed_at        TIMESTAMPTZ,
  confirmed_via       TEXT,                                 -- whatsapp, email, phone, app
  patient_notes       TEXT,                                 -- observações do paciente ao agendar
  internal_notes      TEXT,                                 -- anotações internas (não visíveis ao paciente)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT
);

CREATE INDEX idx_appointments_clinic_id     ON shared.appointments (clinic_id);
CREATE INDEX idx_appointments_patient_id    ON shared.appointments (clinic_id, patient_id);
CREATE INDEX idx_appointments_provider_id   ON shared.appointments (clinic_id, provider_id);
CREATE INDEX idx_appointments_scheduled_at  ON shared.appointments (clinic_id, scheduled_at);
CREATE INDEX idx_appointments_status        ON shared.appointments (clinic_id, status);
CREATE INDEX idx_appointments_date_range    ON shared.appointments (clinic_id, scheduled_at)
  WHERE status NOT IN ('cancelled', 'no_show');
CREATE INDEX idx_appointments_reminders     ON shared.appointments (clinic_id, scheduled_at)
  WHERE status = 'confirmed' AND reminder_sent_24h = false;
CREATE INDEX idx_appointments_payment       ON shared.appointments (clinic_id, payment_status)
  WHERE payment_status != 'paid';

COMMENT ON COLUMN shared.appointments.status_history IS 'Histórico de mudanças de status com timestamp e responsável';
COMMENT ON COLUMN shared.appointments.conversation_id IS 'Referência para conversa omnichannel que originou o agendamento';

-- ─── Trigger: updated_at automático ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION shared.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clinics_updated_at
  BEFORE UPDATE ON shared.clinics
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON shared.users
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON shared.patients
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON shared.services
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON shared.appointments
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

-- ============================================================================
-- DermaOS — Omni Schema Tables
-- Omnichannel: contatos, canais, conversas, mensagens, IA, automações
-- ============================================================================

-- ─── ENUMs ──────────────────────────────────────────────────────────────────

CREATE TYPE omni.contact_type AS ENUM (
  'patient',
  'lead',
  'anonymous',
  'bot'
);

CREATE TYPE omni.contact_status AS ENUM (
  'active',
  'inactive',
  'blocked',
  'opted_out'
);

CREATE TYPE omni.channel_type AS ENUM (
  'whatsapp',
  'instagram',
  'email',
  'sms',
  'webchat',
  'phone'
);

CREATE TYPE omni.conversation_status AS ENUM (
  'open',
  'pending',
  'resolved',
  'spam',
  'archived'
);

CREATE TYPE omni.conversation_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

CREATE TYPE omni.message_sender_type AS ENUM (
  'patient',
  'user',
  'ai_agent',
  'system'
);

CREATE TYPE omni.message_content_type AS ENUM (
  'text',
  'image',
  'audio',
  'video',
  'document',
  'location',
  'template',
  'interactive'
);

CREATE TYPE omni.message_status AS ENUM (
  'pending',
  'sent',
  'delivered',
  'read',
  'failed'
);

CREATE TYPE omni.ai_agent_type AS ENUM (
  'receptionist',
  'scheduler',
  'follow_up',
  'support',
  'custom'
);

CREATE TYPE omni.template_category AS ENUM (
  'authentication',
  'marketing',
  'utility'
);

CREATE TYPE omni.automation_trigger AS ENUM (
  'appointment_confirmed',
  'appointment_cancelled',
  'appointment_reminder_24h',
  'appointment_reminder_2h',
  'post_visit',
  'birthday',
  'lead_captured',
  'no_show',
  'manual'
);

CREATE TYPE omni.campaign_status AS ENUM (
  'draft',
  'scheduled',
  'running',
  'paused',
  'completed',
  'cancelled'
);

CREATE TYPE omni.call_direction AS ENUM (
  'inbound',
  'outbound'
);

CREATE TYPE omni.call_status AS ENUM (
  'completed',
  'missed',
  'voicemail',
  'busy',
  'failed',
  'no_answer'
);

CREATE TYPE omni.call_handler AS ENUM (
  'user',
  'ai_agent',
  'ivr',
  'voicemail'
);

-- ─── omni.contacts ───────────────────────────────────────────────────────────
-- Leads e contatos — patient_id é NULL enquanto ainda é lead

CREATE TABLE omni.contacts (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id        UUID        REFERENCES shared.patients (id) ON DELETE SET NULL,
  type              omni.contact_type   NOT NULL DEFAULT 'lead',
  status            omni.contact_status NOT NULL DEFAULT 'active',
  name              TEXT        NOT NULL,
  phone             TEXT,
  email             TEXT,
  external_ids      JSONB       NOT NULL DEFAULT '{}',     -- {whatsapp_id, instagram_id}
  tags              TEXT[]      NOT NULL DEFAULT '{}',
  opted_in_at       TIMESTAMPTZ,
  opted_out_at      TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        REFERENCES shared.users (id) ON DELETE SET NULL,

  CONSTRAINT uq_contact_phone_clinic UNIQUE (clinic_id, phone)
);

CREATE INDEX idx_contacts_clinic_patient ON omni.contacts (clinic_id, patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_contacts_clinic_phone   ON omni.contacts (clinic_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_contacts_clinic_status  ON omni.contacts (clinic_id, status);
CREATE INDEX idx_contacts_name_search    ON omni.contacts USING gin (name gin_trgm_ops);

-- ─── omni.channels ───────────────────────────────────────────────────────────
-- ai_agent_id sem FK inicialmente — constraint adicionada após omni.ai_agents ser criada

CREATE TABLE omni.channels (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  type        omni.channel_type NOT NULL,
  name        TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  config      JSONB       NOT NULL DEFAULT '{}',           -- credenciais/tokens cifrados na app
  ai_agent_id UUID,                                        -- FK adicionada abaixo após ai_agents
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_channel_name_clinic UNIQUE (clinic_id, name)
);

CREATE INDEX idx_channels_clinic_type   ON omni.channels (clinic_id, type);
CREATE INDEX idx_channels_clinic_active ON omni.channels (clinic_id) WHERE is_active = TRUE;

-- ─── omni.ai_agents ──────────────────────────────────────────────────────────

CREATE TABLE omni.ai_agents (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id      UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  channel_id     UUID        REFERENCES omni.channels (id) ON DELETE SET NULL,
  type           omni.ai_agent_type NOT NULL DEFAULT 'receptionist',
  name           TEXT        NOT NULL,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  model          TEXT        NOT NULL DEFAULT 'llama3.1:8b',
  system_prompt  TEXT,
  temperature    DECIMAL(3, 2) NOT NULL DEFAULT 0.70,
  max_tokens     INT         NOT NULL DEFAULT 1000,
  tools_enabled  TEXT[]      NOT NULL DEFAULT '{}',
  config         JSONB       NOT NULL DEFAULT '{}',        -- {escalation_rules, sla_minutes, ...}
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID        REFERENCES shared.users (id) ON DELETE SET NULL
);

CREATE INDEX idx_ai_agents_clinic_id ON omni.ai_agents (clinic_id);
CREATE INDEX idx_ai_agents_active    ON omni.ai_agents (clinic_id) WHERE is_active = TRUE;

-- Agora que omni.ai_agents existe, adiciona a FK em omni.channels
ALTER TABLE omni.channels
  ADD CONSTRAINT fk_channels_ai_agent
  FOREIGN KEY (ai_agent_id) REFERENCES omni.ai_agents (id) ON DELETE SET NULL;

-- ─── omni.ai_knowledge_base ──────────────────────────────────────────────────

CREATE TABLE omni.ai_knowledge_base (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  ai_agent_id UUID        NOT NULL REFERENCES omni.ai_agents (id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  embedding   VECTOR(1536),                                -- embedding gerado por Ollama/Claude
  metadata    JSONB       NOT NULL DEFAULT '{}',           -- {source, category, tags}
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_kb_clinic_id  ON omni.ai_knowledge_base (clinic_id);
CREATE INDEX idx_ai_kb_agent_id   ON omni.ai_knowledge_base (ai_agent_id);
CREATE INDEX idx_ai_kb_active     ON omni.ai_knowledge_base (ai_agent_id) WHERE is_active = TRUE;
-- Índice vetorial para busca semântica (ivfflat — requer pelo menos 1000 linhas para eficiência)
CREATE INDEX idx_ai_kb_embedding  ON omni.ai_knowledge_base
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── omni.conversations ──────────────────────────────────────────────────────

CREATE TABLE omni.conversations (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id             UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  contact_id            UUID        NOT NULL REFERENCES omni.contacts (id) ON DELETE RESTRICT,
  channel_id            UUID        NOT NULL REFERENCES omni.channels (id) ON DELETE RESTRICT,
  assigned_to           UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  status                omni.conversation_status   NOT NULL DEFAULT 'open',
  priority              omni.conversation_priority NOT NULL DEFAULT 'normal',
  subject               TEXT,
  last_message_at       TIMESTAMPTZ,
  last_message_preview  TEXT,
  unread_count          INT         NOT NULL DEFAULT 0,
  tags                  TEXT[]      NOT NULL DEFAULT '{}',
  metadata              JSONB       NOT NULL DEFAULT '{}',
  resolved_at           TIMESTAMPTZ,
  resolved_by           UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_clinic_status ON omni.conversations (clinic_id, status);
CREATE INDEX idx_conversations_contact_id    ON omni.conversations (clinic_id, contact_id);
CREATE INDEX idx_conversations_assigned_to   ON omni.conversations (clinic_id, assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_conversations_open_recent   ON omni.conversations (clinic_id, last_message_at DESC) WHERE status = 'open';
CREATE INDEX idx_conversations_channel_id    ON omni.conversations (channel_id);

-- ─── omni.messages ───────────────────────────────────────────────────────────

CREATE TABLE omni.messages (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  conversation_id     UUID        NOT NULL REFERENCES omni.conversations (id) ON DELETE CASCADE,
  sender_type         omni.message_sender_type  NOT NULL,
  sender_user_id      UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  sender_agent_id     UUID        REFERENCES omni.ai_agents (id) ON DELETE SET NULL,
  content_type        omni.message_content_type NOT NULL DEFAULT 'text',
  content             TEXT,
  media_url           TEXT,
  media_metadata      JSONB       NOT NULL DEFAULT '{}',
  status              omni.message_status NOT NULL DEFAULT 'pending',
  external_message_id TEXT,                                -- ID do provedor (Meta, Twilio, etc.)
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  is_internal_note    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_recent ON omni.messages (conversation_id, created_at DESC);
CREATE INDEX idx_messages_external_id         ON omni.messages (external_message_id) WHERE external_message_id IS NOT NULL;
CREATE INDEX idx_messages_clinic_status       ON omni.messages (clinic_id, status) WHERE status != 'read';

-- ─── omni.templates ──────────────────────────────────────────────────────────

CREATE TABLE omni.templates (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  channel_id  UUID        REFERENCES omni.channels (id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  category    omni.template_category NOT NULL,
  language    VARCHAR(10) NOT NULL DEFAULT 'pt_BR',
  subject     TEXT,                                        -- usado em templates de email
  body        TEXT        NOT NULL,
  variables   TEXT[]      NOT NULL DEFAULT '{}',           -- ['{{patient_name}}', '{{date}}']
  external_id TEXT,                                        -- ID aprovado no Meta/WhatsApp Business
  is_approved BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        REFERENCES shared.users (id) ON DELETE SET NULL,

  CONSTRAINT uq_template_name_clinic UNIQUE (clinic_id, name)
);

CREATE INDEX idx_templates_clinic_category ON omni.templates (clinic_id, category);
CREATE INDEX idx_templates_clinic_active   ON omni.templates (clinic_id) WHERE is_active = TRUE;

-- ─── omni.automations ────────────────────────────────────────────────────────

CREATE TABLE omni.automations (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id      UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  name           TEXT        NOT NULL,
  trigger        omni.automation_trigger NOT NULL,
  trigger_config JSONB       NOT NULL DEFAULT '{}',        -- {delay_minutes: 30, conditions: [...]}
  actions        JSONB       NOT NULL DEFAULT '[]',        -- [{type:'send_message', template_id, ...}]
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  run_count      INT         NOT NULL DEFAULT 0,
  last_run_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID        REFERENCES shared.users (id) ON DELETE SET NULL
);

CREATE INDEX idx_automations_clinic_id      ON omni.automations (clinic_id);
CREATE INDEX idx_automations_active_trigger ON omni.automations (clinic_id, trigger) WHERE is_active = TRUE;

-- ─── omni.campaigns ──────────────────────────────────────────────────────────

CREATE TABLE omni.campaigns (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  name              TEXT        NOT NULL,
  status            omni.campaign_status NOT NULL DEFAULT 'draft',
  template_id       UUID        REFERENCES omni.templates (id) ON DELETE SET NULL,
  channel_id        UUID        REFERENCES omni.channels (id) ON DELETE SET NULL,
  target_filters    JSONB       NOT NULL DEFAULT '{}',     -- filtros de segmento de pacientes
  scheduled_at      TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  total_recipients  INT         NOT NULL DEFAULT 0,
  sent_count        INT         NOT NULL DEFAULT 0,
  delivered_count   INT         NOT NULL DEFAULT 0,
  read_count        INT         NOT NULL DEFAULT 0,
  failed_count      INT         NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        REFERENCES shared.users (id) ON DELETE SET NULL
);

CREATE INDEX idx_campaigns_clinic_status    ON omni.campaigns (clinic_id, status);
CREATE INDEX idx_campaigns_scheduled        ON omni.campaigns (scheduled_at) WHERE status = 'scheduled';

-- ─── omni.call_logs ──────────────────────────────────────────────────────────
-- Registro imutável de chamadas telefônicas (IA e humanas)

CREATE TABLE omni.call_logs (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id        UUID        REFERENCES shared.patients (id) ON DELETE SET NULL,
  user_id           UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  conversation_id   UUID        REFERENCES omni.conversations (id) ON DELETE SET NULL,
  direction         omni.call_direction NOT NULL,
  status            omni.call_status   NOT NULL,
  handler           omni.call_handler  NOT NULL DEFAULT 'user',
  from_number       TEXT,
  to_number         TEXT,
  duration_seconds  INT,
  recording_url     TEXT,
  transcript        TEXT,
  ai_summary        TEXT,
  started_at        TIMESTAMPTZ NOT NULL,
  answered_at       TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Sem updated_at: registros de chamada são imutáveis
);

CREATE INDEX idx_call_logs_clinic_id     ON omni.call_logs (clinic_id);
CREATE INDEX idx_call_logs_clinic_patient ON omni.call_logs (clinic_id, patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_call_logs_clinic_started ON omni.call_logs (clinic_id, started_at DESC);

-- ─── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE omni.contacts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni.channels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni.ai_agents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni.ai_knowledge_base  ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni.conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni.messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni.templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni.automations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni.campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni.call_logs          ENABLE ROW LEVEL SECURITY;

ALTER TABLE omni.contacts           FORCE ROW LEVEL SECURITY;
ALTER TABLE omni.channels           FORCE ROW LEVEL SECURITY;
ALTER TABLE omni.ai_agents          FORCE ROW LEVEL SECURITY;
ALTER TABLE omni.ai_knowledge_base  FORCE ROW LEVEL SECURITY;
ALTER TABLE omni.conversations      FORCE ROW LEVEL SECURITY;
ALTER TABLE omni.messages           FORCE ROW LEVEL SECURITY;
ALTER TABLE omni.templates          FORCE ROW LEVEL SECURITY;
ALTER TABLE omni.automations        FORCE ROW LEVEL SECURITY;
ALTER TABLE omni.campaigns          FORCE ROW LEVEL SECURITY;
ALTER TABLE omni.call_logs          FORCE ROW LEVEL SECURITY;

-- contacts
CREATE POLICY contacts_isolation_app ON omni.contacts
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY contacts_isolation_readonly ON omni.contacts
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY contacts_worker_all ON omni.contacts
  FOR ALL TO dermaos_worker USING (true);

-- channels
CREATE POLICY channels_isolation_app ON omni.channels
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY channels_isolation_readonly ON omni.channels
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY channels_worker_all ON omni.channels
  FOR ALL TO dermaos_worker USING (true);

-- ai_agents
CREATE POLICY ai_agents_isolation_app ON omni.ai_agents
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY ai_agents_isolation_readonly ON omni.ai_agents
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY ai_agents_worker_all ON omni.ai_agents
  FOR ALL TO dermaos_worker USING (true);

-- ai_knowledge_base
CREATE POLICY ai_knowledge_base_isolation_app ON omni.ai_knowledge_base
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY ai_knowledge_base_isolation_readonly ON omni.ai_knowledge_base
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY ai_knowledge_base_worker_all ON omni.ai_knowledge_base
  FOR ALL TO dermaos_worker USING (true);

-- conversations
CREATE POLICY conversations_isolation_app ON omni.conversations
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY conversations_isolation_readonly ON omni.conversations
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY conversations_worker_all ON omni.conversations
  FOR ALL TO dermaos_worker USING (true);

-- messages
CREATE POLICY messages_isolation_app ON omni.messages
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY messages_isolation_readonly ON omni.messages
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY messages_worker_all ON omni.messages
  FOR ALL TO dermaos_worker USING (true);

-- templates
CREATE POLICY templates_isolation_app ON omni.templates
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY templates_isolation_readonly ON omni.templates
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY templates_worker_all ON omni.templates
  FOR ALL TO dermaos_worker USING (true);

-- automations
CREATE POLICY automations_isolation_app ON omni.automations
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY automations_isolation_readonly ON omni.automations
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY automations_worker_all ON omni.automations
  FOR ALL TO dermaos_worker USING (true);

-- campaigns
CREATE POLICY campaigns_isolation_app ON omni.campaigns
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY campaigns_isolation_readonly ON omni.campaigns
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY campaigns_worker_all ON omni.campaigns
  FOR ALL TO dermaos_worker USING (true);

-- call_logs
CREATE POLICY call_logs_isolation_app ON omni.call_logs
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY call_logs_isolation_readonly ON omni.call_logs
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY call_logs_worker_all ON omni.call_logs
  FOR ALL TO dermaos_worker USING (true);

-- ─── Grants ──────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA omni TO dermaos_app;
GRANT SELECT ON ALL TABLES IN SCHEMA omni TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA omni TO dermaos_worker;
GRANT ALL ON ALL TABLES IN SCHEMA omni TO dermaos_admin;

-- ─── Triggers updated_at ─────────────────────────────────────────────────────
-- call_logs é append-only, portanto sem trigger de updated_at

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON omni.contacts
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_channels_updated_at
  BEFORE UPDATE ON omni.channels
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_ai_agents_updated_at
  BEFORE UPDATE ON omni.ai_agents
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_ai_knowledge_base_updated_at
  BEFORE UPDATE ON omni.ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON omni.conversations
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON omni.messages
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON omni.templates
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_automations_updated_at
  BEFORE UPDATE ON omni.automations
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON omni.campaigns
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

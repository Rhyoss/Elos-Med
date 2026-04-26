-- ============================================================================
-- DermaOS — Scheduling Holds (Aurora / Prompt-Mestre §A.2.3)
--
-- Reserva tentativa de slot com TTL curto, usada pela Aurora enquanto aguarda
-- confirmação do paciente no WhatsApp. Não cria Appointment; apenas bloqueia
-- o par (clinic_id, provider_id, scheduled_at) contra concorrência.
-- ============================================================================

CREATE TABLE shared.scheduling_holds (
  hold_token       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id        UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  provider_id      UUID        NOT NULL REFERENCES shared.users    (id) ON DELETE RESTRICT,
  conversation_id  UUID        NOT NULL,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_min     INT         NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_holds_provider_slot UNIQUE (clinic_id, provider_id, scheduled_at)
);

CREATE INDEX idx_holds_expires_at ON shared.scheduling_holds (expires_at);

COMMENT ON TABLE  shared.scheduling_holds IS
  'Reservas tentativas (TTL curto) para agendamentos em negociação — Aurora WhatsApp';
COMMENT ON COLUMN shared.scheduling_holds.hold_token IS
  'Token idempotente da reserva; usado para confirmar (confirmHeldSlot) ou liberar (releaseHold)';
COMMENT ON COLUMN shared.scheduling_holds.expires_at IS
  'Após expires_at o hold é considerado inválido; job periódico limpa linhas com expires_at < NOW()';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE shared.scheduling_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.scheduling_holds FORCE  ROW LEVEL SECURITY;

CREATE POLICY holds_isolation_app ON shared.scheduling_holds
  FOR ALL TO dermaos_app
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY holds_isolation_readonly ON shared.scheduling_holds
  FOR SELECT TO dermaos_readonly
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY holds_worker_all ON shared.scheduling_holds
  FOR ALL TO dermaos_worker
  USING (true);

-- dermaos_admin usa BYPASSRLS (definido em 004_rls_policies.sql)

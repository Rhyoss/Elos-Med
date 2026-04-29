-- ============================================================================
-- DermaOS — Audit Tables
-- Trilha de auditoria conforme LGPD: quem fez o quê, quando e de onde
-- ============================================================================

-- ─── audit.domain_events ─────────────────────────────────────────────────────
-- Eventos de domínio imutáveis — nunca fazer UPDATE ou DELETE nesta tabela

CREATE TABLE audit.domain_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL,                        -- denormalizado (sem FK para performance)
  aggregate_type  TEXT NOT NULL,                        -- ex: "patient", "appointment", "user"
  aggregate_id    UUID NOT NULL,                        -- ID da entidade modificada
  event_type      TEXT NOT NULL,                        -- ex: "patient.created", "appointment.cancelled"
  event_version   INT NOT NULL DEFAULT 1,
  payload         JSONB NOT NULL DEFAULT '{}',          -- dados do evento (sem PHI direto)
  metadata        JSONB NOT NULL DEFAULT '{}',          -- {user_id, ip, user_agent, session_id}
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_aggregate_type CHECK (aggregate_type ~ '^[a-z_]+$'),
  CONSTRAINT chk_event_type     CHECK (event_type ~ '^[a-z_]+\.[a-z_]+$')
);

-- Índices otimizados para queries de auditoria
CREATE INDEX idx_domain_events_clinic_id      ON audit.domain_events (clinic_id, occurred_at DESC);
CREATE INDEX idx_domain_events_aggregate      ON audit.domain_events (clinic_id, aggregate_type, aggregate_id);
CREATE INDEX idx_domain_events_event_type     ON audit.domain_events (clinic_id, event_type, occurred_at DESC);
CREATE INDEX idx_domain_events_occurred_at    ON audit.domain_events (occurred_at DESC);

-- Partition por mês para manter performance em alto volume (opcional — habilitar se > 10M eventos/mês)
-- CREATE TABLE audit.domain_events PARTITION BY RANGE (occurred_at);

COMMENT ON TABLE  audit.domain_events IS 'Event log imutável — NUNCA fazer UPDATE/DELETE';
COMMENT ON COLUMN audit.domain_events.payload  IS 'Dados do evento sem PHI — referências por ID apenas';
COMMENT ON COLUMN audit.domain_events.metadata IS 'Contexto de execução: usuário, IP, sessão';

-- ─── audit.access_log ────────────────────────────────────────────────────────
-- Quem acessou qual recurso PHI, quando e de onde (LGPD art. 37)

CREATE TABLE audit.access_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL,
  user_id         UUID,                                 -- NULL se acesso anônimo/sistema
  resource_type   TEXT NOT NULL,                        -- ex: "patient_record", "clinical_image"
  resource_id     UUID NOT NULL,
  action          TEXT NOT NULL,                        -- read | create | update | delete | export | share
  ip_address      INET,
  user_agent      TEXT,
  session_id      TEXT,
  request_path    TEXT,
  response_status INT,
  duration_ms     INT,                                  -- tempo de resposta da operação
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_access_action CHECK (
    action IN ('read', 'create', 'update', 'delete', 'export', 'share', 'print', 'download')
  )
);

CREATE INDEX idx_access_log_clinic_user    ON audit.access_log (clinic_id, user_id, accessed_at DESC);
CREATE INDEX idx_access_log_resource       ON audit.access_log (clinic_id, resource_type, resource_id);
CREATE INDEX idx_access_log_accessed_at    ON audit.access_log (accessed_at DESC);
CREATE INDEX idx_access_log_suspicious     ON audit.access_log (clinic_id, user_id, action)
  WHERE action IN ('export', 'download', 'print');

COMMENT ON TABLE audit.access_log IS 'Log de acesso a dados PHI conforme LGPD art. 37';

-- ─── Restrições de imutabilidade ─────────────────────────────────────────────
-- Impede UPDATE/DELETE nos logs de auditoria

CREATE OR REPLACE RULE no_update_domain_events AS
  ON UPDATE TO audit.domain_events DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_domain_events AS
  ON DELETE TO audit.domain_events DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_update_access_log AS
  ON UPDATE TO audit.access_log DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_access_log AS
  ON DELETE TO audit.access_log DO INSTEAD NOTHING;

-- ─── Permissões de auditoria ─────────────────────────────────────────────────

GRANT INSERT ON audit.domain_events TO dermaos_app, dermaos_worker;
GRANT INSERT ON audit.access_log    TO dermaos_app, dermaos_worker;

-- Somente dermaos_admin e dermaos_readonly podem ler logs (DPO, compliance)
GRANT SELECT ON audit.domain_events TO dermaos_readonly, dermaos_admin;
GRANT SELECT ON audit.access_log    TO dermaos_readonly, dermaos_admin;

-- RLS nos logs de auditoria (tenant isolation)
ALTER TABLE audit.domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.access_log    ENABLE ROW LEVEL SECURITY;

-- FORCE garante que ninguém (nem o owner) escapa das policies, exceto roles
-- com BYPASSRLS — i.e., apenas dermaos_authn (funções SD) e dermaos_admin
-- (manutenção operacional explícita) conseguem escrever sem clinic_id setado.
ALTER TABLE audit.domain_events FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.access_log    FORCE ROW LEVEL SECURITY;

-- ── SELECT: leitor BI vê apenas o tenant do GUC ────────────────────────────
CREATE POLICY audit_events_isolation ON audit.domain_events
  FOR SELECT TO dermaos_readonly
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY audit_access_isolation ON audit.access_log
  FOR SELECT TO dermaos_readonly
  USING (clinic_id = shared.current_clinic_id());

-- ── INSERT: clinic_id da linha PRECISA bater com o GUC da sessão ───────────
-- Sem isso, app/worker poderiam logar audits forjando clinic_id (CWE-639).
-- Como `withClinicContext` (em apps/api/src/db/client.ts) sempre faz
-- `SET LOCAL app.current_clinic_id = $clinicId`, e o eventBus.publish
-- abre seu próprio scope quando ALS está vazio (setImmediate, worker), o
-- check funciona em todos os caminhos legítimos.
CREATE POLICY audit_events_insert ON audit.domain_events
  FOR INSERT TO dermaos_app, dermaos_worker
  WITH CHECK (clinic_id = shared.current_clinic_id());

CREATE POLICY audit_access_insert ON audit.access_log
  FOR INSERT TO dermaos_app, dermaos_worker
  WITH CHECK (clinic_id = shared.current_clinic_id());

-- ── INSERT: dermaos_authn (funções SD pré-tenant) inserem audits de login ──
-- Funções SD owned por dermaos_authn (BYPASSRLS) podem precisar escrever
-- audits do fluxo de login — autenticação acontece antes de o GUC estar
-- setado. Tratamos como caminho de exceção bem documentado.
CREATE POLICY audit_events_insert_authn ON audit.domain_events
  FOR INSERT TO dermaos_authn
  WITH CHECK (true);

CREATE POLICY audit_access_insert_authn ON audit.access_log
  FOR INSERT TO dermaos_authn
  WITH CHECK (true);

GRANT INSERT ON audit.domain_events TO dermaos_authn;
GRANT INSERT ON audit.access_log    TO dermaos_authn;

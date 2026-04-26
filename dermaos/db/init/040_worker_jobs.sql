-- ============================================================================
-- DermaOS — Migration 040: Worker Jobs Infrastructure
-- Tables: omni.automation_queue, shared.sync_state, shared.admin_notifications
-- Enhancement: analytics.supply_forecasts (stockout_date, confidence_interval,
--              generated_at)
-- ============================================================================

BEGIN;

-- ─── omni.automation_queue ───────────────────────────────────────────────────
-- Input queue for automation triggers. The API inserts a row when a triggering
-- event fires; the automation-queue worker polls this table (SELECT FOR UPDATE
-- SKIP LOCKED) and processes each pending item.
-- Distinct from automation_execution_log which tracks BullMQ-dispatched jobs.

CREATE TABLE IF NOT EXISTS omni.automation_queue (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  automation_id UUID        NOT NULL REFERENCES omni.automations (id) ON DELETE CASCADE,
  trigger       omni.automation_trigger NOT NULL,
  entity_id     UUID        NOT NULL,
  entity_type   TEXT        NOT NULL
                CHECK (entity_type IN ('appointment','patient','encounter','invoice','lead')),
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','done','skipped','failed')),
  retry_count   INT         NOT NULL DEFAULT 0,
  skip_reason   TEXT,
  error_message TEXT,
  duration_ms   INT,
  processed_at  TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index for the polling query (only pending rows matter for latency).
CREATE INDEX IF NOT EXISTS idx_automation_queue_pending
  ON omni.automation_queue (clinic_id, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_automation_queue_status
  ON omni.automation_queue (clinic_id, status, created_at DESC);

-- Prevent duplicate triggers for the same automation+entity on the same day
-- while a processing attempt is live.
CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_queue_daily_live
  ON omni.automation_queue (clinic_id, automation_id, entity_id, DATE(scheduled_for))
  WHERE status IN ('pending', 'processing');

ALTER TABLE omni.automation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni.automation_queue FORCE  ROW LEVEL SECURITY;

CREATE POLICY automation_queue_app    ON omni.automation_queue
  FOR ALL TO dermaos_app    USING (clinic_id = shared.current_clinic_id());
CREATE POLICY automation_queue_worker ON omni.automation_queue
  FOR ALL TO dermaos_worker USING (true);

GRANT SELECT, INSERT, UPDATE ON omni.automation_queue TO dermaos_app;
GRANT SELECT, INSERT, UPDATE ON omni.automation_queue TO dermaos_worker;
GRANT ALL                    ON omni.automation_queue TO dermaos_admin;

-- ─── shared.sync_state ───────────────────────────────────────────────────────
-- Tracks the last successful sync timestamp per (clinic, collection) pair.
-- Used by search-sync worker to perform incremental synchronisation.

CREATE TABLE IF NOT EXISTS shared.sync_state (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE CASCADE,
  collection   TEXT        NOT NULL,    -- 'patients' | 'appointments' | 'products' | ...
  last_sync_at TIMESTAMPTZ,             -- NULL = never synced (full sync required)
  docs_synced  INT         NOT NULL DEFAULT 0,
  last_error   TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_sync_state UNIQUE (clinic_id, collection)
);

ALTER TABLE shared.sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.sync_state FORCE  ROW LEVEL SECURITY;

CREATE POLICY sync_state_worker ON shared.sync_state FOR ALL TO dermaos_worker USING (true);
CREATE POLICY sync_state_app    ON shared.sync_state
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());

GRANT SELECT, INSERT, UPDATE ON shared.sync_state TO dermaos_app;
GRANT SELECT, INSERT, UPDATE ON shared.sync_state TO dermaos_worker;
GRANT ALL                    ON shared.sync_state TO dermaos_admin;

-- ─── shared.admin_notifications ──────────────────────────────────────────────
-- DLQ alerts, job timeouts, and other system events that require admin attention.
-- Inserted by the worker; read and acknowledged via the admin UI.

CREATE TABLE IF NOT EXISTS shared.admin_notifications (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            TEXT        NOT NULL,   -- 'dlq_job_failed' | 'job_timeout' | ...
  job_name        TEXT,
  job_id          TEXT,
  clinic_id       UUID        REFERENCES shared.clinics (id) ON DELETE SET NULL,
  severity        TEXT        NOT NULL DEFAULT 'error'
                  CHECK (severity IN ('info','warning','error','critical')),
  message         TEXT        NOT NULL,
  payload         JSONB       NOT NULL DEFAULT '{}',
  acknowledged_by UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notif_unacked
  ON shared.admin_notifications (created_at DESC)
  WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notif_job
  ON shared.admin_notifications (job_name, created_at DESC);

-- No RLS — visible to all admins across tenants. Roles restrict at app layer.
GRANT SELECT, INSERT        ON shared.admin_notifications TO dermaos_worker;
GRANT SELECT, UPDATE        ON shared.admin_notifications TO dermaos_app;
GRANT ALL                   ON shared.admin_notifications TO dermaos_admin;

-- ─── analytics.supply_forecasts: extend for AI service response fields ────────

ALTER TABLE analytics.supply_forecasts
  ADD COLUMN IF NOT EXISTS stockout_date       DATE,
  ADD COLUMN IF NOT EXISTS confidence_interval JSONB,        -- {"lower": X, "upper": Y}
  ADD COLUMN IF NOT EXISTS generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN analytics.supply_forecasts.stockout_date
  IS 'Estimated date when stock reaches zero based on predicted consumption rate';
COMMENT ON COLUMN analytics.supply_forecasts.confidence_interval
  IS 'Prediction confidence interval: {"lower": numeric, "upper": numeric}';
COMMENT ON COLUMN analytics.supply_forecasts.generated_at
  IS 'Timestamp when the AI service generated this forecast';

COMMIT;

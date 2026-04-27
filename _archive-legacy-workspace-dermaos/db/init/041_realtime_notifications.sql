-- ─── Migration 041: Real-time notifications & critical alerts ─────────────────
-- Tables:
--   shared.notifications      — user-level notifications (biopsy, stock, lead, purchase)
--   shared.critical_alerts    — clinic-level critical alerts (adverse reaction, expired lot)
--   shared.notification_prefs — per-user sound/notification preferences
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── shared.notifications ────────────────────────────────────────────────────

CREATE TABLE shared.notifications (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID        NOT NULL REFERENCES shared.clinics(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES shared.users(id)   ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,                   -- biopsy_result | stock_critical | lead_high_score | purchase_approval | general
  title           VARCHAR(200) NOT NULL,
  message         VARCHAR(500) NOT NULL,
  entity_type     VARCHAR(50),                            -- encounter | product | contact | purchase_order
  entity_id       UUID,
  priority        VARCHAR(20) NOT NULL DEFAULT 'normal',  -- low | normal | high
  is_read         BOOLEAN     NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,                            -- set when client sends notification:ack
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread
  ON shared.notifications (user_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX idx_notifications_user_all
  ON shared.notifications (user_id, created_at DESC);

CREATE INDEX idx_notifications_clinic
  ON shared.notifications (clinic_id, created_at DESC);

-- RLS: users can only read their own notifications
ALTER TABLE shared.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_user_isolation ON shared.notifications
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- ─── shared.critical_alerts ──────────────────────────────────────────────────

CREATE TABLE shared.critical_alerts (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID        NOT NULL REFERENCES shared.clinics(id) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,                   -- adverse_reaction | expired_lot_detected
  title           VARCHAR(200) NOT NULL,
  message         TEXT        NOT NULL,
  severity        VARCHAR(20) NOT NULL DEFAULT 'critical',
  entity_type     VARCHAR(50),
  entity_id       UUID,
  emit_count      SMALLINT    NOT NULL DEFAULT 0,
  last_emitted_at TIMESTAMPTZ,
  ack_user_id     UUID        REFERENCES shared.users(id) ON DELETE SET NULL,
  ack_at          TIMESTAMPTZ,
  escalated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_critical_alerts_clinic_unacked
  ON shared.critical_alerts (clinic_id, created_at DESC)
  WHERE ack_at IS NULL;

CREATE INDEX idx_critical_alerts_clinic_all
  ON shared.critical_alerts (clinic_id, created_at DESC);

COMMENT ON COLUMN shared.critical_alerts.emit_count IS 'Number of times this alert has been emitted via WebSocket (max 3 before escalation)';
COMMENT ON COLUMN shared.critical_alerts.escalated_at IS 'Timestamp when alert was escalated to admin via email/SMS after 3 failed ack attempts';

-- ─── shared.notification_prefs ───────────────────────────────────────────────

CREATE TABLE shared.notification_prefs (
  user_id             UUID    PRIMARY KEY REFERENCES shared.users(id) ON DELETE CASCADE,
  sound_enabled       BOOLEAN NOT NULL DEFAULT true,   -- play sound on new inbox message
  browser_push        BOOLEAN NOT NULL DEFAULT false,  -- browser push notifications
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shared.notification_prefs (user_id)
SELECT id FROM shared.users
ON CONFLICT (user_id) DO NOTHING;

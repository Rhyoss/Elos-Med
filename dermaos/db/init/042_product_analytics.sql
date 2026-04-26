-- Migration 042: Product Analytics Events
-- Stores sanitised front-end telemetry events.
-- Append-only (no UPDATE/DELETE on application rows).
-- Retention policy: events older than 90 days are purged by a scheduled job.

-- ─── Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics.product_events (
    id         UUID        NOT NULL DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL,
    user_id    UUID        NOT NULL,
    event_type TEXT        NOT NULL,
    properties JSONB       NOT NULL DEFAULT '{}',
    event_ts   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_product_events PRIMARY KEY (id)
);

-- ─── Indexes ───────────────────────────────────────────────────────────────

-- Primary query pattern: analytics dashboards filtering by tenant + type + time
CREATE INDEX IF NOT EXISTS idx_product_events_tenant_type_ts
    ON analytics.product_events (tenant_id, event_type, event_ts DESC);

-- Retention sweep: delete rows older than 90 days efficiently
CREATE INDEX IF NOT EXISTS idx_product_events_created_at
    ON analytics.product_events (created_at);

-- ─── Row-level security ────────────────────────────────────────────────────

ALTER TABLE analytics.product_events ENABLE ROW LEVEL SECURITY;

-- Clinics can only read their own events
CREATE POLICY product_events_tenant_isolation
    ON analytics.product_events
    FOR SELECT
    USING (tenant_id = shared.current_clinic_id());

-- Only the application role may insert (no direct updates/deletes by app)
CREATE POLICY product_events_insert
    ON analytics.product_events
    FOR INSERT
    WITH CHECK (tenant_id = shared.current_clinic_id());

-- ─── Comments ──────────────────────────────────────────────────────────────

COMMENT ON TABLE  analytics.product_events              IS 'Sanitised product telemetry events. Append-only. 90-day retention.';
COMMENT ON COLUMN analytics.product_events.event_type   IS 'Whitelisted event type (page_view, feature_used, error_occurred, etc.)';
COMMENT ON COLUMN analytics.product_events.properties   IS 'Sanitised event properties — no PII, no search terms, paths normalised.';
COMMENT ON COLUMN analytics.product_events.event_ts     IS 'Client-reported event timestamp (ISO 8601, timezone aware).';

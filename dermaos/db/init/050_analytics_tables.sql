-- ============================================================================
-- DermaOS — Analytics Schema Tables
-- KPIs, cohorts, forecasting, lead scoring e materialized views
-- Tabelas populadas pelo worker (dermaos_worker) — app só lê
-- ============================================================================

-- ─── analytics.kpi_snapshots ─────────────────────────────────────────────────
-- Snapshot diário/semanal/mensal de KPIs da clínica, calculado pelo worker

CREATE TABLE analytics.kpi_snapshots (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id              UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  snapshot_date          DATE        NOT NULL,
  period_type            TEXT        NOT NULL DEFAULT 'daily',  -- 'daily','weekly','monthly'
  revenue_total          DECIMAL(12, 2) NOT NULL DEFAULT 0,
  revenue_by_category    JSONB       NOT NULL DEFAULT '{}',     -- {consulta: 0, estetico: 0, ...}
  appointments_total     INT         NOT NULL DEFAULT 0,
  appointments_by_status JSONB       NOT NULL DEFAULT '{}',     -- {completed: 0, no_show: 0, ...}
  new_patients           INT         NOT NULL DEFAULT 0,
  active_patients        INT         NOT NULL DEFAULT 0,
  nps_score              DECIMAL(5, 2),
  avg_ticket             DECIMAL(10, 2),
  cancellation_rate      DECIMAL(5, 4),
  computed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_kpi_snapshot UNIQUE (clinic_id, snapshot_date, period_type)
);

CREATE INDEX idx_kpi_snapshots_clinic_date ON analytics.kpi_snapshots (clinic_id, snapshot_date DESC);

-- ─── analytics.patient_cohorts ───────────────────────────────────────────────
-- Análise de retenção por coorte mensal (calculado mensalmente pelo worker)

CREATE TABLE analytics.patient_cohorts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  cohort_month  DATE        NOT NULL,                       -- primeiro dia do mês da coorte
  cohort_size   INT         NOT NULL DEFAULT 0,
  retained_m1   INT         NOT NULL DEFAULT 0,
  retained_m3   INT         NOT NULL DEFAULT 0,
  retained_m6   INT         NOT NULL DEFAULT 0,
  retained_m12  INT         NOT NULL DEFAULT 0,
  avg_ltv       DECIMAL(12, 2) NOT NULL DEFAULT 0,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_patient_cohort UNIQUE (clinic_id, cohort_month)
);

CREATE INDEX idx_patient_cohorts_clinic_month ON analytics.patient_cohorts (clinic_id, cohort_month DESC);

-- ─── analytics.supply_forecasts ──────────────────────────────────────────────
-- Previsão de consumo de insumos por produto (modelo de série temporal)

CREATE TABLE analytics.supply_forecasts (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id               UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  product_id              UUID        NOT NULL REFERENCES supply.products (id) ON DELETE CASCADE,
  forecast_date           DATE        NOT NULL,
  predicted_consumption   DECIMAL(10, 3) NOT NULL DEFAULT 0,
  predicted_reorder_date  DATE,
  confidence_score        DECIMAL(5, 4),
  model_version           TEXT,
  computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_supply_forecast UNIQUE (clinic_id, product_id, forecast_date)
);

CREATE INDEX idx_supply_forecasts_clinic_date ON analytics.supply_forecasts (clinic_id, forecast_date);
CREATE INDEX idx_supply_forecasts_product_id  ON analytics.supply_forecasts (clinic_id, product_id);

-- ─── analytics.lead_scores ───────────────────────────────────────────────────
-- Score de churn risk e upsell por paciente (recalculado semanalmente)

CREATE TABLE analytics.lead_scores (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id        UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id       UUID        NOT NULL REFERENCES shared.patients (id) ON DELETE CASCADE,
  churn_risk_score DECIMAL(5, 4) NOT NULL DEFAULT 0,       -- 0.0 = baixo risco, 1.0 = alto risco
  upsell_score     DECIMAL(5, 4) NOT NULL DEFAULT 0,
  ltv_predicted    DECIMAL(12, 2) NOT NULL DEFAULT 0,
  days_since_visit INT,
  visit_frequency  DECIMAL(6, 3),                          -- visitas por mês nos últimos 12 meses
  features         JSONB       NOT NULL DEFAULT '{}',       -- vetor de features usado pelo modelo
  model_version    TEXT,
  scored_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_lead_score UNIQUE (clinic_id, patient_id)
);

CREATE INDEX idx_lead_scores_clinic_id    ON analytics.lead_scores (clinic_id);
CREATE INDEX idx_lead_scores_churn_risk   ON analytics.lead_scores (clinic_id, churn_risk_score DESC);
CREATE INDEX idx_lead_scores_upsell       ON analytics.lead_scores (clinic_id, upsell_score DESC);

-- ─── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE analytics.kpi_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.patient_cohorts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.supply_forecasts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.lead_scores       ENABLE ROW LEVEL SECURITY;

ALTER TABLE analytics.kpi_snapshots     FORCE ROW LEVEL SECURITY;
ALTER TABLE analytics.patient_cohorts   FORCE ROW LEVEL SECURITY;
ALTER TABLE analytics.supply_forecasts  FORCE ROW LEVEL SECURITY;
ALTER TABLE analytics.lead_scores       FORCE ROW LEVEL SECURITY;

-- kpi_snapshots
CREATE POLICY kpi_snapshots_isolation_app ON analytics.kpi_snapshots
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY kpi_snapshots_isolation_readonly ON analytics.kpi_snapshots
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY kpi_snapshots_worker_all ON analytics.kpi_snapshots
  FOR ALL TO dermaos_worker USING (true);

-- patient_cohorts
CREATE POLICY patient_cohorts_isolation_app ON analytics.patient_cohorts
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY patient_cohorts_isolation_readonly ON analytics.patient_cohorts
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY patient_cohorts_worker_all ON analytics.patient_cohorts
  FOR ALL TO dermaos_worker USING (true);

-- supply_forecasts
CREATE POLICY supply_forecasts_isolation_app ON analytics.supply_forecasts
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY supply_forecasts_isolation_readonly ON analytics.supply_forecasts
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY supply_forecasts_worker_all ON analytics.supply_forecasts
  FOR ALL TO dermaos_worker USING (true);

-- lead_scores
CREATE POLICY lead_scores_isolation_app ON analytics.lead_scores
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY lead_scores_isolation_readonly ON analytics.lead_scores
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY lead_scores_worker_all ON analytics.lead_scores
  FOR ALL TO dermaos_worker USING (true);

-- ─── Grants nas tabelas base ─────────────────────────────────────────────────
-- App e readonly só leem — worker é responsável por popular via jobs agendados

GRANT SELECT ON analytics.kpi_snapshots, analytics.patient_cohorts,
               analytics.supply_forecasts, analytics.lead_scores
  TO dermaos_app, dermaos_readonly;

GRANT SELECT, INSERT, UPDATE ON analytics.kpi_snapshots, analytics.patient_cohorts,
               analytics.supply_forecasts, analytics.lead_scores
  TO dermaos_worker;

GRANT ALL ON ALL TABLES IN SCHEMA analytics TO dermaos_admin;

-- ─── Materialized Views ──────────────────────────────────────────────────────
-- RLS não se aplica a materialized views no PostgreSQL.
-- Isolamento por tenant é responsabilidade da camada de aplicação (filtrar por clinic_id).
-- Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY por dermaos_worker em job agendado.

CREATE MATERIALIZED VIEW analytics.mv_daily_revenue AS
  SELECT
    i.clinic_id,
    DATE(p.received_at)           AS day,
    SUM(p.amount)                 AS revenue,
    COUNT(DISTINCT p.id)          AS payment_count,
    COUNT(DISTINCT i.patient_id)  AS patient_count
  FROM financial.payments p
  JOIN financial.invoices i ON i.id = p.invoice_id
  WHERE p.status = 'aprovado'
    AND p.received_at IS NOT NULL
  GROUP BY i.clinic_id, DATE(p.received_at);

CREATE UNIQUE INDEX uix_mv_daily_revenue ON analytics.mv_daily_revenue (clinic_id, day);

CREATE MATERIALIZED VIEW analytics.mv_appointment_metrics AS
  SELECT
    clinic_id,
    DATE(scheduled_at)                                         AS day,
    COUNT(*)                                                   AS total,
    COUNT(*) FILTER (WHERE status = 'completed')               AS completed,
    COUNT(*) FILTER (WHERE status = 'cancelled')               AS cancelled,
    COUNT(*) FILTER (WHERE status = 'no_show')                 AS no_show,
    AVG(duration_min)                                          AS avg_duration_min
  FROM shared.appointments
  GROUP BY clinic_id, DATE(scheduled_at);

CREATE UNIQUE INDEX uix_mv_appointment_metrics ON analytics.mv_appointment_metrics (clinic_id, day);

CREATE MATERIALIZED VIEW analytics.mv_supply_consumption AS
  SELECT
    clinic_id,
    product_id,
    DATE(performed_at)  AS day,
    SUM(quantity)       AS quantity_consumed,
    COUNT(*)            AS movement_count
  FROM supply.inventory_movements
  WHERE type IN ('saida', 'uso_paciente')
  GROUP BY clinic_id, product_id, DATE(performed_at);

CREATE UNIQUE INDEX uix_mv_supply_consumption ON analytics.mv_supply_consumption (clinic_id, product_id, day);

-- Grants nas materialized views — somente SELECT, refresh é feito pelo worker via SQL direto
GRANT SELECT ON analytics.mv_daily_revenue, analytics.mv_appointment_metrics,
               analytics.mv_supply_consumption
  TO dermaos_app, dermaos_readonly, dermaos_worker;

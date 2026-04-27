-- ============================================================================
-- DermaOS — Dashboard Indexes
-- Índices otimizados para queries dos dashboards contextuais (médico/recepção/admin).
-- Foco: agregações por período + filtros (clinic_id, provider_id, status, scheduled_at).
-- Todos com IF NOT EXISTS — idempotente para re-execução.
-- ============================================================================

-- ─── Appointments ────────────────────────────────────────────────────────────
-- Agenda do dia / range admin
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date_status
  ON shared.appointments (clinic_id, scheduled_at, status);

-- Agenda do médico (provider específico)
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_provider_date
  ON shared.appointments (clinic_id, provider_id, scheduled_at);

-- Confirmações pendentes (recepção)
CREATE INDEX IF NOT EXISTS idx_appointments_pending_confirm
  ON shared.appointments (clinic_id, scheduled_at)
  WHERE status = 'scheduled' AND confirmed_at IS NULL;

-- Fila de espera (recepção em tempo real)
CREATE INDEX IF NOT EXISTS idx_appointments_wait_queue
  ON shared.appointments (clinic_id, status, scheduled_at)
  WHERE status IN ('waiting','in_progress');

-- ─── Patients ────────────────────────────────────────────────────────────────
-- Aniversariantes (timezone-aware): index funcional sobre month/day
CREATE INDEX IF NOT EXISTS idx_patients_birth_month_day
  ON shared.patients (clinic_id,
                      EXTRACT(MONTH FROM birth_date),
                      EXTRACT(DAY FROM birth_date))
  WHERE deleted_at IS NULL AND birth_date IS NOT NULL;

-- Novos pacientes por período (admin KPI)
CREATE INDEX IF NOT EXISTS idx_patients_clinic_created
  ON shared.patients (clinic_id, created_at)
  WHERE deleted_at IS NULL;

-- ─── Payments (admin KPI revenue + daily series) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_clinic_received_at
  ON financial.payments (clinic_id, received_at)
  WHERE status = 'aprovado' AND payment_type = 'pagamento' AND deleted_at IS NULL;

-- ─── Invoices (recepção alerts + admin overdue) ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_amount_due
  ON financial.invoices (clinic_id, amount_due)
  WHERE deleted_at IS NULL
    AND amount_due > 0
    AND status NOT IN ('paga','cancelada','estornada','rascunho');

CREATE INDEX IF NOT EXISTS idx_invoices_clinic_paid_at
  ON financial.invoices (clinic_id, paid_at)
  WHERE status = 'paga' AND appointment_id IS NOT NULL;

-- ─── Biopsies (médico — pendentes do provider; admin — total clínica) ────────
CREATE INDEX IF NOT EXISTS idx_biopsies_clinic_status
  ON clinical.biopsies (clinic_id, status, performed_by, collected_at);

-- ─── Protocols (médico — sessões ativas) ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_protocols_clinic_provider_status
  ON clinical.protocols (clinic_id, provider_id, status);

-- ─── Protocol sessions (médico — stats do mês) ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_protocol_sessions_clinic_performed
  ON clinical.protocol_sessions (clinic_id, performed_by, performed_at);

-- ─── Inventory lots (admin alerts: stock crítico) ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_lots_product_active
  ON supply.inventory_lots (product_id, quantity_current)
  WHERE quantity_current > 0 AND is_quarantined = false;

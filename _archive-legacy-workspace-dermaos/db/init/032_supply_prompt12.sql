-- ============================================================================
-- DermaOS — DermSupply Prompt 12
-- Lotes com status, movimentações imutáveis com reason/justificativa,
-- rastreabilidade de transferência, idempotência de alertas de estoque.
-- ============================================================================

-- ─── ENUMs novos ─────────────────────────────────────────────────────────────

CREATE TYPE supply.lot_status AS ENUM (
  'active',
  'consumed',
  'quarantined',
  'expired'
);

CREATE TYPE supply.expiry_alert_level AS ENUM (
  'none',
  'warning',
  'critical'
);

-- Motivo granular da movimentação.
-- Tipo (supply.movement_type) continua sendo entrada/saida/ajuste/transferencia/etc.
-- Reason categoriza o contexto de negócio — constraints por tipo garantem coerência.
CREATE TYPE supply.movement_reason AS ENUM (
  'procedimento',
  'venda',
  'perda',
  'descarte_vencido',
  'contagem',
  'correcao',
  'recebimento',
  'transferencia_entrada',
  'transferencia_saida',
  'inventario_inicial',
  'outro'
);

-- ─── inventory_lots: status, alerta e timestamp de última checagem ───────────

ALTER TABLE supply.inventory_lots
  ADD COLUMN IF NOT EXISTS status              supply.lot_status         NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS expiry_alert_level  supply.expiry_alert_level NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS days_to_expiry      INT,
  ADD COLUMN IF NOT EXISTS last_alert_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ;

-- Backfill: consumido se saldo zero; quarentena se flag antiga; ativo caso contrário.
-- A coluna is_quarantined é mantida por compatibilidade com 030_supply_tables.sql.
UPDATE supply.inventory_lots
   SET status = CASE
                  WHEN quantity_current <= 0 THEN 'consumed'::supply.lot_status
                  WHEN is_quarantined         THEN 'quarantined'::supply.lot_status
                  ELSE 'active'::supply.lot_status
                END
 WHERE status = 'active';

-- Índice FEFO otimizado: lote disponível por validade.
-- Substitui idx_inventory_lots_available (do 030) com mesma intenção mas
-- usando a nova coluna status (mais expressiva que is_quarantined isoladamente).
DROP INDEX IF EXISTS supply.idx_inventory_lots_available;

CREATE INDEX IF NOT EXISTS idx_inventory_lots_fefo
  ON supply.inventory_lots (clinic_id, product_id, expiry_date NULLS LAST, received_at)
  WHERE status = 'active' AND quantity_current > 0;

CREATE INDEX IF NOT EXISTS idx_inventory_lots_alert_sweep
  ON supply.inventory_lots (clinic_id, expiry_date)
  WHERE status = 'active' AND expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_lots_status
  ON supply.inventory_lots (clinic_id, product_id, status);

-- ─── inventory_movements: reason, justificativa, transferência, rastreio ────

ALTER TABLE supply.inventory_movements
  ADD COLUMN IF NOT EXISTS reason                   supply.movement_reason NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS justification            TEXT,
  ADD COLUMN IF NOT EXISTS from_storage_location_id UUID REFERENCES supply.storage_locations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_storage_location_id   UUID REFERENCES supply.storage_locations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS encounter_id             UUID REFERENCES clinical.encounters (id)     ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_id               UUID,                           -- FK lógico; financial.invoices pode não existir em todos ambientes
  ADD COLUMN IF NOT EXISTS transfer_pair_id         UUID,                           -- agrupa as duas pernas de uma transferência
  ADD COLUMN IF NOT EXISTS ip_origin                INET,
  ADD COLUMN IF NOT EXISTS accept_expired           BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_reason
  ON supply.inventory_movements (clinic_id, reason);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_transfer
  ON supply.inventory_movements (transfer_pair_id)
  WHERE transfer_pair_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_encounter
  ON supply.inventory_movements (encounter_id)
  WHERE encounter_id IS NOT NULL;

-- Constraints de coerência entre type × reason × justificativa × transferência.
-- Regra: ajuste/perda/descarte_vencido exigem justificativa mínima de 10 chars.
--        transferencia exige from/to_storage_location_id preenchidos e distintos.
-- NOT VALID: a validação passa a vigorar apenas para novas linhas. Linhas
-- pré-existentes (que podem ter reason='outro' ou transfer_pair_id NULL
-- por serem anteriores a esta migração) continuam aceitas.

ALTER TABLE supply.inventory_movements
  ADD CONSTRAINT chk_movement_reason_by_type CHECK (
    (type = 'saida'            AND reason IN ('procedimento','venda','perda','descarte_vencido','outro'))
    OR (type = 'uso_paciente'  AND reason IN ('procedimento','outro'))
    OR (type = 'entrada'       AND reason IN ('recebimento','transferencia_entrada','inventario_inicial','outro'))
    OR (type = 'ajuste'        AND reason IN ('contagem','correcao','outro'))
    OR (type = 'perda'         AND reason IN ('perda','outro'))
    OR (type = 'vencimento'    AND reason IN ('descarte_vencido','outro'))
    OR (type = 'transferencia' AND reason IN ('transferencia_entrada','transferencia_saida','outro'))
  ) NOT VALID;

ALTER TABLE supply.inventory_movements
  ADD CONSTRAINT chk_movement_justification CHECK (
    CASE
      WHEN type IN ('ajuste','perda','vencimento')                           THEN
        justification IS NOT NULL AND char_length(justification) BETWEEN 10 AND 500
      WHEN type = 'saida' AND reason IN ('perda','descarte_vencido')         THEN
        justification IS NOT NULL AND char_length(justification) BETWEEN 10 AND 500
      ELSE TRUE
    END
  ) NOT VALID;

ALTER TABLE supply.inventory_movements
  ADD CONSTRAINT chk_movement_transfer_locations CHECK (
    CASE
      WHEN type = 'transferencia' THEN
        from_storage_location_id IS NOT NULL
        AND to_storage_location_id   IS NOT NULL
        AND from_storage_location_id <> to_storage_location_id
      ELSE TRUE
    END
  ) NOT VALID;

ALTER TABLE supply.inventory_movements
  ADD CONSTRAINT chk_movement_transfer_pair CHECK (
    CASE
      WHEN type = 'transferencia' THEN transfer_pair_id IS NOT NULL
      ELSE TRUE
    END
  ) NOT VALID;

-- ─── Imutabilidade de inventory_movements ───────────────────────────────────
-- Mesma estratégia de audit.domain_events: nenhuma linha pode ser alterada
-- ou deletada após insert. Correções são feitas via nova movimentação de ajuste.

CREATE OR REPLACE FUNCTION supply.inventory_movements_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'supply.inventory_movements é append-only: UPDATE não permitido. Registre uma nova movimentação de ajuste.'
      USING ERRCODE = 'check_violation';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'supply.inventory_movements é append-only: DELETE não permitido.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_movements_immutable ON supply.inventory_movements;

CREATE TRIGGER trg_inventory_movements_immutable
  BEFORE UPDATE OR DELETE ON supply.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION supply.inventory_movements_immutable();

-- ─── supply.alert_emissions_log ──────────────────────────────────────────────
-- Idempotência dos alertas emitidos pelo worker diário.
-- emission_key = '{alert_type}:{entity_id}:{YYYY-MM-DD}' (timezone da clínica)

CREATE TABLE IF NOT EXISTS supply.alert_emissions_log (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id     UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE CASCADE,
  alert_type    TEXT        NOT NULL CHECK (alert_type IN ('lot_expiring','low_stock','critical_stock','rupture')),
  entity_type   TEXT        NOT NULL CHECK (entity_type IN ('lot','product')),
  entity_id     UUID        NOT NULL,
  emission_key  TEXT        NOT NULL,
  payload       JSONB       NOT NULL DEFAULT '{}',
  emitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_alert_emission UNIQUE (clinic_id, emission_key)
);

CREATE INDEX IF NOT EXISTS idx_alert_emissions_clinic_date
  ON supply.alert_emissions_log (clinic_id, emitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_emissions_entity
  ON supply.alert_emissions_log (clinic_id, entity_type, entity_id);

ALTER TABLE supply.alert_emissions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.alert_emissions_log FORCE  ROW LEVEL SECURITY;

CREATE POLICY alert_emissions_app ON supply.alert_emissions_log
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());

CREATE POLICY alert_emissions_readonly ON supply.alert_emissions_log
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());

-- Worker precisa escrever cross-clinic na varredura diária
CREATE POLICY alert_emissions_worker ON supply.alert_emissions_log
  FOR ALL TO dermaos_worker USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON supply.alert_emissions_log TO dermaos_app;
GRANT SELECT                          ON supply.alert_emissions_log TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON supply.alert_emissions_log TO dermaos_worker;
GRANT ALL                             ON supply.alert_emissions_log TO dermaos_admin;

-- ─── Função utilitária: selectLotFEFO (read-only) ───────────────────────────
-- Retorna a decomposição FEFO para atender uma quantidade solicitada.
-- Usada pelo backend como "sugestão" para saídas — não reserva nem debita.
-- Devolve linhas na ordem de consumo (menor validade primeiro).

CREATE OR REPLACE FUNCTION supply.select_lot_fefo(
  p_clinic_id  UUID,
  p_product_id UUID,
  p_quantity   DECIMAL
)
RETURNS TABLE (
  lot_id             UUID,
  lot_number         TEXT,
  expiry_date        DATE,
  quantity_available DECIMAL,
  quantity_from_lot  DECIMAL,
  is_insufficient    BOOLEAN
) AS $$
DECLARE
  remaining DECIMAL := p_quantity;
  rec       RECORD;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'p_quantity deve ser > 0';
  END IF;

  FOR rec IN
    SELECT id, inventory_lots.lot_number, inventory_lots.expiry_date, quantity_current
      FROM supply.inventory_lots
     WHERE clinic_id        = p_clinic_id
       AND product_id       = p_product_id
       AND status           = 'active'
       AND quantity_current > 0
     ORDER BY inventory_lots.expiry_date ASC NULLS LAST, received_at ASC
  LOOP
    EXIT WHEN remaining <= 0;
    lot_id             := rec.id;
    lot_number         := rec.lot_number;
    expiry_date        := rec.expiry_date;
    quantity_available := rec.quantity_current;
    quantity_from_lot  := LEAST(rec.quantity_current, remaining);
    is_insufficient    := FALSE;
    remaining          := remaining - quantity_from_lot;
    RETURN NEXT;
  END LOOP;

  -- Se sobrou demanda, devolve linha-sentinela com insufficient=true
  IF remaining > 0 THEN
    lot_id             := NULL;
    lot_number         := NULL;
    expiry_date        := NULL;
    quantity_available := remaining;      -- quantidade ainda faltante
    quantity_from_lot  := 0;
    is_insufficient    := TRUE;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION supply.select_lot_fefo(UUID, UUID, DECIMAL) IS
  'FEFO read-only: retorna lotes ordenados por validade para atender a quantidade solicitada. Última linha com is_insufficient=true sinaliza saldo parcial.';

-- ─── Comentários documentando intenção ──────────────────────────────────────

COMMENT ON COLUMN supply.inventory_lots.status              IS 'active | consumed | quarantined | expired — recalculado por worker diário e por movimentações';
COMMENT ON COLUMN supply.inventory_lots.expiry_alert_level  IS 'Nível do alerta de validade (none/warning/critical) recalculado diariamente';
COMMENT ON COLUMN supply.inventory_lots.days_to_expiry      IS 'Dias até vencimento, recalculado pelo worker diário no timezone da clínica';

COMMENT ON COLUMN supply.inventory_movements.reason              IS 'Categorização de negócio; constraint chk_movement_reason_by_type garante coerência com type';
COMMENT ON COLUMN supply.inventory_movements.justification       IS 'Obrigatória para ajuste/perda/descarte_vencido (min 10, max 500 chars)';
COMMENT ON COLUMN supply.inventory_movements.transfer_pair_id    IS 'Agrupa as duas pernas (saída + entrada) de uma transferência entre locais';
COMMENT ON COLUMN supply.inventory_movements.ip_origin           IS 'IP de origem do request para auditoria';
COMMENT ON COLUMN supply.inventory_movements.accept_expired      IS 'Flag explícita que permite entrada de lote já vencido (justificado)';

COMMENT ON TABLE  supply.alert_emissions_log IS 'Log idempotente de alertas emitidos pelo worker (emission_key único por clinic_id)';

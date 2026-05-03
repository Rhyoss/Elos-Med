/**
 * Processor `supply-stock-daily` — Prompt 12.C.
 *
 * Varre diariamente todos os lotes e produtos de cada clínica e:
 *   1. Recalcula `days_to_expiry` e `expiry_alert_level` de cada lote ativo,
 *      usando o timezone da clínica para definir "hoje".
 *   2. Marca lotes vencidos (expiry_date < hoje_local) como status='expired'.
 *   3. Emite alertas idempotentes para:
 *        - `lot_expiring`     — lotes com expiry_alert_level ∈ (warning, critical)
 *        - `rupture`          — produto com qty_total = 0
 *        - `critical_stock`   — 0 < qty < min_stock
 *        - `low_stock`        — qty entre min_stock e reorder_point
 *      Cada emissão faz INSERT em `supply.alert_emissions_log` com
 *      emission_key `{alert_type}:{entity_id}:{YYYY-MM-DD local}`. O UNIQUE
 *      constraint em (clinic_id, emission_key) garante idempotência por dia.
 *   4. Publica cada alerta novo no canal Redis `supply:realtime` para que a
 *      API relaye para `emitToClinic('stock.*', payload)`.
 *
 * Batching: produtos/lotes são processados em chunks de 500 para não segurar
 * a connection por muito tempo.
 *
 * Retry/DLQ: herda da configuração da queue em apps/api/src/jobs/queues.ts —
 * 3 tentativas com backoff exponencial, depois permanece em removeOnFail.
 */

import type { Job } from 'bullmq';
import type { Pool, PoolClient } from 'pg';
import type pino from 'pino';
import type Redis from 'ioredis';
import {
  EXPIRY_WARNING_DAYS,
  EXPIRY_CRITICAL_DAYS,
  buildAlertEmissionKey,
  type AlertType,
} from '@dermaos/shared';

const REALTIME_CHANNEL = 'supply:realtime';
const LOT_BATCH_SIZE   = 500;

export interface SupplyAlertsDeps {
  db:     Pool;
  redis:  Redis;
  logger: pino.Logger;
}

interface ClinicRow {
  id:       string;
  timezone: string;
}

interface LotScanRow {
  id:          string;
  product_id:  string;
  lot_number:  string;
  expiry_date: string | null;
  quantity_current: string;
  storage_location_id: string | null;
}

interface ProductSummaryRow {
  id:            string;
  name:          string;
  min_stock:     string;
  reorder_point: string | null;
  qty_total:     string;
}

type AlertEventName =
  | 'stock.lot_expiring'
  | 'stock.low_alert'
  | 'stock.critical_alert'
  | 'stock.rupture';

const ALERT_EVENT_BY_TYPE: Record<AlertType, AlertEventName> = {
  lot_expiring:   'stock.lot_expiring',
  low_stock:      'stock.low_alert',
  critical_stock: 'stock.critical_alert',
  rupture:        'stock.rupture',
};

/* ── Entrypoint da queue ─────────────────────────────────────────────────── */

export function buildSupplyAlertsProcessor(deps: SupplyAlertsDeps) {
  return async function process(_job: Job): Promise<void> {
    const log = deps.logger;
    const started = Date.now();

    const clinics = await deps.db.query<ClinicRow>(
      `SELECT id, COALESCE(timezone, 'America/Sao_Paulo') AS timezone
         FROM shared.clinics
        WHERE is_active = TRUE`,
    );

    let totalAlerts = 0;
    let totalLotsUpdated = 0;

    for (const clinic of clinics.rows) {
      try {
        const result = await processClinic(deps, clinic);
        totalAlerts      += result.emittedCount;
        totalLotsUpdated += result.updatedLots;
      } catch (err) {
        log.error({ err, clinicId: clinic.id }, 'supply-alerts: clinic failed');
        // Continua para próxima clínica — falha em uma não deve derrubar o batch
      }
    }

    log.info(
      { clinics: clinics.rows.length, totalAlerts, totalLotsUpdated, ms: Date.now() - started },
      'supply-alerts: daily sweep complete',
    );
  };
}

/* ── Processamento por clínica ───────────────────────────────────────────── */

async function processClinic(
  deps:   SupplyAlertsDeps,
  clinic: ClinicRow,
): Promise<{ emittedCount: number; updatedLots: number }> {
  const today = getLocalDateString(clinic.timezone); // YYYY-MM-DD no TZ da clínica

  const updatedLots   = await recalcLots(deps.db, clinic.id, today);
  const expiringLots  = await emitLotExpiringAlerts(deps, clinic.id, today);
  const productAlerts = await emitProductAlerts(deps, clinic.id, today);

  return {
    emittedCount: expiringLots + productAlerts,
    updatedLots,
  };
}

/* ── 1) Recalcular days_to_expiry, alert_level e expirar lotes vencidos ──── */

async function recalcLots(db: Pool, clinicId: string, todayYmd: string): Promise<number> {
  // Atualização vetorizada em batches de LOT_BATCH_SIZE lotes via CTE.
  // Critério:
  //   - days_to_expiry = expiry_date - today (NULL se sem validade)
  //   - expiry_alert_level = critical se <=30 E ainda não vencido
  //                          warning  se <=60 E ainda não vencido
  //                          none caso contrário
  //   - status → 'expired' se days_to_expiry < 0
  //
  // Usamos uma transação com SET LOCAL para preservar RLS do dermaos_worker
  // (worker policy permite cross-clinic, mas ainda preferimos escopo).

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_clinic_id', $1, true)`, [clinicId]);

    let affectedTotal = 0;
    // Loop em batches — evita travar a tabela inteira numa UPDATE massiva.
    /* eslint-disable no-constant-condition */
    while (true) {
      const r = await client.query<{ id: string }>(
        `WITH to_update AS (
           SELECT id FROM supply.inventory_lots
            WHERE clinic_id = $1
              AND status = 'active'
              AND deleted_at IS NULL
              AND (last_alert_check_at IS NULL OR last_alert_check_at::date < $2::date)
            LIMIT ${LOT_BATCH_SIZE}
            FOR UPDATE SKIP LOCKED
         )
         UPDATE supply.inventory_lots il
            SET days_to_expiry = CASE
                  WHEN il.expiry_date IS NULL THEN NULL
                  ELSE (il.expiry_date - $2::date)
                END,
                expiry_alert_level = CASE
                  WHEN il.expiry_date IS NULL                           THEN 'none'::supply.expiry_alert_level
                  WHEN (il.expiry_date - $2::date) < 0                   THEN 'critical'::supply.expiry_alert_level
                  WHEN (il.expiry_date - $2::date) <= ${EXPIRY_CRITICAL_DAYS} THEN 'critical'::supply.expiry_alert_level
                  WHEN (il.expiry_date - $2::date) <= ${EXPIRY_WARNING_DAYS}  THEN 'warning'::supply.expiry_alert_level
                  ELSE 'none'::supply.expiry_alert_level
                END,
                status = CASE
                  WHEN il.expiry_date IS NOT NULL
                   AND (il.expiry_date - $2::date) < 0
                  THEN 'expired'::supply.lot_status
                  ELSE il.status
                END,
                last_alert_check_at = NOW()
           FROM to_update tu
          WHERE il.id = tu.id
       RETURNING il.id`,
        [clinicId, todayYmd],
      );
      affectedTotal += r.rowCount ?? 0;
      if ((r.rowCount ?? 0) < LOT_BATCH_SIZE) break;
    }

    await client.query('COMMIT');
    return affectedTotal;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/* ── 2) Emitir alertas de lotes com expiry_alert_level != none ───────────── */

async function emitLotExpiringAlerts(
  deps:     SupplyAlertsDeps,
  clinicId: string,
  todayYmd: string,
): Promise<number> {
  let emitted = 0;
  let offset = 0;

  /* eslint-disable no-constant-condition */
  while (true) {
    const batch = await withClinicTx(deps.db, clinicId, async (c) => {
      const r = await c.query<LotScanRow & {
        product_name: string;
        storage_location_name: string | null;
        expiry_alert_level: string;
      }>(
        `SELECT il.id, il.product_id, il.lot_number, il.expiry_date,
                il.quantity_current::text AS quantity_current,
                il.storage_location_id,
                il.expiry_alert_level::text AS expiry_alert_level,
                p.name  AS product_name,
                sl.name AS storage_location_name
           FROM supply.inventory_lots il
           JOIN supply.products p ON p.id = il.product_id
      LEFT JOIN supply.storage_locations sl ON sl.id = il.storage_location_id
          WHERE il.clinic_id = $1
            AND il.status = 'active'
            AND il.deleted_at IS NULL
            AND il.expiry_alert_level <> 'none'
            AND il.quantity_current > 0
          ORDER BY il.id
          LIMIT $2 OFFSET $3`,
        [clinicId, LOT_BATCH_SIZE, offset],
      );
      return r.rows;
    });

    if (batch.length === 0) break;

    for (const lot of batch) {
      const inserted = await insertAlertIfNew(
        deps, clinicId,
        'lot_expiring', 'lot', lot.id, todayYmd,
        {
          product_id:            lot.product_id,
          product_name:          lot.product_name,
          lot_id:                lot.id,
          lot_number:            lot.lot_number,
          expiry_date:           lot.expiry_date,
          expiry_alert_level:    lot.expiry_alert_level,
          qty_remaining:         Number(lot.quantity_current),
          storage_location_id:   lot.storage_location_id,
          storage_location_name: lot.storage_location_name,
        },
      );
      if (inserted) emitted += 1;
    }

    if (batch.length < LOT_BATCH_SIZE) break;
    offset += batch.length;
  }

  return emitted;
}

/* ── 3) Emitir alertas por produto (rupture / critical / low) ────────────── */

async function emitProductAlerts(
  deps:     SupplyAlertsDeps,
  clinicId: string,
  todayYmd: string,
): Promise<number> {
  let emitted = 0;
  let offset  = 0;

  /* eslint-disable no-constant-condition */
  while (true) {
    const batch = await withClinicTx(deps.db, clinicId, async (c) => {
      const r = await c.query<ProductSummaryRow>(
        `SELECT p.id, p.name,
                p.min_stock::text     AS min_stock,
                p.reorder_point::text AS reorder_point,
                COALESCE((SELECT SUM(il.quantity_current)
                            FROM supply.inventory_lots il
                           WHERE il.clinic_id = p.clinic_id
                             AND il.product_id = p.id
                             AND il.status = 'active'
                             AND il.deleted_at IS NULL), 0)::text AS qty_total
           FROM supply.products p
          WHERE p.clinic_id = $1
            AND p.is_active = TRUE
            AND p.deleted_at IS NULL
          ORDER BY p.id
          LIMIT $2 OFFSET $3`,
        [clinicId, LOT_BATCH_SIZE, offset],
      );
      return r.rows;
    });

    if (batch.length === 0) break;

    for (const prod of batch) {
      const qty           = Number(prod.qty_total);
      const minStock      = Number(prod.min_stock);
      const reorderPoint  = prod.reorder_point == null ? null : Number(prod.reorder_point);

      // Prioridade: rupture > critical > low — só emite o mais grave.
      let alertType: AlertType | null = null;
      if (qty === 0) {
        alertType = 'rupture';
      } else if (minStock > 0 && qty < minStock) {
        alertType = 'critical_stock';
      } else if (
        reorderPoint != null
        && qty >= minStock
        && qty <= reorderPoint
      ) {
        alertType = 'low_stock';
      }
      if (!alertType) continue;

      const inserted = await insertAlertIfNew(
        deps, clinicId, alertType, 'product', prod.id, todayYmd,
        {
          product_id:    prod.id,
          product_name:  prod.name,
          qty_total:     qty,
          min_stock:     minStock,
          reorder_point: reorderPoint,
        },
      );
      if (inserted) emitted += 1;
    }

    if (batch.length < LOT_BATCH_SIZE) break;
    offset += batch.length;
  }

  return emitted;
}

/* ── Idempotência: INSERT … ON CONFLICT DO NOTHING + publish no Redis ───── */

async function insertAlertIfNew(
  deps:       SupplyAlertsDeps,
  clinicId:   string,
  alertType:  AlertType,
  entityType: 'lot' | 'product',
  entityId:   string,
  todayYmd:   string,
  payload:    Record<string, unknown>,
): Promise<boolean> {
  const emissionKey = buildAlertEmissionKey(alertType, entityId, todayYmd);

  const r = await deps.db.query<{ id: string }>(
    `INSERT INTO supply.alert_emissions_log
       (clinic_id, alert_type, entity_type, entity_id, emission_key, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (clinic_id, emission_key) DO NOTHING
     RETURNING id`,
    [clinicId, alertType, entityType, entityId, emissionKey, JSON.stringify(payload)],
  );

  if (r.rowCount === 0) {
    return false; // já emitido hoje — idempotente, não re-emite
  }

  // Publica no canal Redis — API Socket gateway relaya para a sala da clínica.
  const event = ALERT_EVENT_BY_TYPE[alertType];
  await deps.redis.publish(
    REALTIME_CHANNEL,
    JSON.stringify({
      clinicId,
      event,
      payload: { alertType, entityType, entityId, ...payload, todayYmd },
    }),
  ).catch((err: unknown) => {
    deps.logger.warn({ err, clinicId, alertType, entityId }, 'supply-alerts: publish failed');
  });

  return true;
}

/* ── Utilitários ─────────────────────────────────────────────────────────── */

async function withClinicTx<T>(
  db:       Pool,
  clinicId: string,
  cb:       (c: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_clinic_id', $1, true)`, [clinicId]);
    const out = await cb(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

function getLocalDateString(timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    return fmt.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

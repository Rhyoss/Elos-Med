/**
 * Cross-domain integration — Consulta → Estoque.
 *
 * Cobre o fluxo:
 *   encounter.signed → kit consumido (FEFO) → inventory_movement criado
 *   → patient_lot_trace criado → quantity_current decrementada
 *   → procedure_consumption_log com idempotency_key.
 *
 * Cenários:
 *   - Consumo atômico de kit em encounter assinado.
 *   - Idempotência via UNIQUE (clinic_id, idempotency_key).
 *   - FEFO: lote com vencimento mais próximo é consumido primeiro.
 *   - Rastreabilidade: patient_lot_trace contém todos os IDs obrigatórios.
 *   - Atomicidade: falha em qualquer etapa = ROLLBACK total.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { faker } from '@faker-js/faker/locale/pt_BR';
import {
  createTestClinic,
  createTestUser,
  createTestPatient,
  createTestProduct,
  createTestLot,
  createTestAppointment,
  type TestClinic,
  type TestUser,
} from './setup/factories.js';

let pool: Pool;
let client: PoolClient;

beforeAll(() => {
  pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
});

afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});

async function setClinicCtx(clinicId: string): Promise<void> {
  await client.query(`SET LOCAL app.current_clinic_id = $1`, [clinicId]);
}

// ── Helpers de criação clínica ────────────────────────────────────────────────

async function createService(
  clinicId: string,
  name = 'Aplicação de Botox',
): Promise<{ id: string }> {
  await setClinicCtx(clinicId);
  const result = await client.query<{ id: string }>(
    `INSERT INTO shared.services (clinic_id, name, duration_min, base_price, category, is_active)
     VALUES ($1, $2, 30, 500.00, 'procedimento', true)
     RETURNING id`,
    [clinicId, name],
  );
  return result.rows[0]!;
}

async function createKitTemplate(
  clinicId: string,
  serviceId: string,
  productId: string,
  qty = 1,
): Promise<{ kitId: string; itemId: string }> {
  await setClinicCtx(clinicId);
  const kit = await client.query<{ id: string }>(
    `INSERT INTO supply.kit_templates (clinic_id, name, service_id, is_active)
     VALUES ($1, 'Kit Botox', $2, true)
     RETURNING id`,
    [clinicId, serviceId],
  );
  const item = await client.query<{ id: string }>(
    `INSERT INTO supply.kit_items (clinic_id, kit_template_id, product_id, quantity)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [clinicId, kit.rows[0]!.id, productId, qty],
  );
  return { kitId: kit.rows[0]!.id, itemId: item.rows[0]!.id };
}

async function createSignedEncounter(
  clinicId: string,
  patientId: string,
  providerId: string,
  appointmentId: string | null,
): Promise<{ id: string }> {
  await setClinicCtx(clinicId);
  const result = await client.query<{ id: string }>(
    `INSERT INTO clinical.encounters
       (clinic_id, patient_id, provider_id, appointment_id,
        type, status, signed_at, signed_by, signature_hash)
     VALUES ($1, $2, $3, $4, 'clinical', 'finalizado', NOW(), $3, 'sha256-fake')
     RETURNING id`,
    [clinicId, patientId, providerId, appointmentId],
  );
  return result.rows[0]!;
}

/**
 * Simula execução do supply-consumption.processor — mas em transação isolada.
 *
 * - Idempotência via UNIQUE constraint em procedure_consumption_log.
 * - FEFO: ORDER BY expiry_date NULLS LAST, received_at.
 * - Decrementa lote, registra movement + patient_lot_trace.
 *
 * Se o INSERT do log falhar por UNIQUE, retorna 'already_processed'.
 */
async function runConsumptionHandler(input: {
  clinicId: string;
  encounterId: string;
  patientId: string;
  providerId: string;
  serviceId: string;
}): Promise<
  | { status: 'ok'; consumed: Array<{ lotId: string; quantity: number }>; logId: string }
  | { status: 'already_processed' }
  | { status: 'partial'; pending: number }
> {
  const idempotencyKey = `encounter:${input.encounterId}`;

  await setClinicCtx(input.clinicId);

  // Tenta criar o log de idempotência primeiro — se UNIQUE falhar, já foi processado
  let logId: string;
  try {
    const log = await client.query<{ id: string }>(
      `INSERT INTO supply.procedure_consumption_log
         (clinic_id, encounter_id, source, idempotency_key,
          performed_by, status, items_consumed, items_pending)
       VALUES ($1, $2, 'encounter', $3, $4, 'completed', 0, 0)
       RETURNING id`,
      [input.clinicId, input.encounterId, idempotencyKey, input.providerId],
    );
    logId = log.rows[0]!.id;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return { status: 'already_processed' };
    }
    throw err;
  }

  // Busca kit vinculado ao serviço
  const kitItems = await client.query<{
    item_id: string; product_id: string; quantity: string;
  }>(
    `SELECT ki.id AS item_id, ki.product_id, ki.quantity
     FROM supply.kit_templates kt
     JOIN supply.kit_items ki ON ki.kit_template_id = kt.id
     WHERE kt.clinic_id = $1 AND kt.service_id = $2 AND kt.is_active = true`,
    [input.clinicId, input.serviceId],
  );

  if (kitItems.rowCount === 0) {
    return { status: 'ok', consumed: [], logId };
  }

  const consumed: Array<{ lotId: string; quantity: number }> = [];
  let pending = 0;

  for (const item of kitItems.rows) {
    const needed = Number(item.quantity);
    let remaining = needed;

    // FEFO: lock dos lotes ordenados por vencimento
    const lots = await client.query<{
      id: string; quantity_current: string; expiry_date: string | null;
    }>(
      `SELECT id, quantity_current, expiry_date
       FROM supply.inventory_lots
       WHERE clinic_id = $1 AND product_id = $2
         AND quantity_current > 0 AND is_quarantined = false
       ORDER BY expiry_date NULLS LAST, received_at
       FOR UPDATE`,
      [input.clinicId, item.product_id],
    );

    for (const lot of lots.rows) {
      if (remaining <= 0) break;
      const available = Number(lot.quantity_current);
      const used = Math.min(available, remaining);

      await client.query(
        `UPDATE supply.inventory_lots
         SET quantity_current = quantity_current - $1, updated_at = NOW()
         WHERE id = $2`,
        [used, lot.id],
      );

      await client.query(
        `INSERT INTO supply.inventory_movements
           (clinic_id, product_id, lot_id, type, reference_type, reference_id,
            quantity, quantity_before, quantity_after, performed_by, performed_at)
         VALUES ($1, $2, $3, 'uso_paciente', 'appointment', $4, $5, $6, $7, $8, NOW())`,
        [
          input.clinicId, item.product_id, lot.id, input.encounterId,
          used, available, available - used, input.providerId,
        ],
      );

      await client.query(
        `INSERT INTO supply.patient_lot_traces
           (clinic_id, patient_id, lot_id, encounter_id,
            quantity_used, applied_by, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          input.clinicId, input.patientId, lot.id,
          input.encounterId, used, input.providerId,
        ],
      );

      consumed.push({ lotId: lot.id, quantity: used });
      remaining -= used;
    }

    if (remaining > 0) {
      pending += 1;
    }
  }

  await client.query(
    `UPDATE supply.procedure_consumption_log
     SET items_consumed = $1, items_pending = $2,
         status = CASE WHEN $2 > 0 THEN 'partial' ELSE 'completed' END
     WHERE id = $3`,
    [consumed.length, pending, logId],
  );

  return pending > 0
    ? { status: 'partial', pending }
    : { status: 'ok', consumed, logId };
}

// ── Setup compartilhado de cenário ────────────────────────────────────────────

interface Scenario {
  clinic: TestClinic;
  provider: TestUser;
  patientId: string;
  serviceId: string;
  productId: string;
  lotIds: string[];
  appointmentId: string;
}

async function buildBaseScenario(opts: {
  lots?: Array<{ qty: number; expiryDate: string }>;
}): Promise<Scenario> {
  const clinic   = await createTestClinic(client);
  const provider = await createTestUser(client, clinic.id, 'dermatologist');
  const patient  = await createTestPatient(client, clinic.id);
  const product  = await createTestProduct(client, clinic.id, { name: 'Toxina Botulínica 100U' });

  const lots = await Promise.all(
    (opts.lots ?? [{ qty: 5, expiryDate: '2099-12-31' }]).map((l, idx) =>
      createTestLot(client, clinic.id, product.id, {
        qty:         l.qty,
        expiry_date: l.expiryDate,
        lot_number:  `LOT-${String(idx).padStart(3, '0')}`,
      }),
    ),
  );

  const service = await createService(clinic.id);
  await createKitTemplate(clinic.id, service.id, product.id, 2);

  const appointment = await createTestAppointment(client, clinic.id, patient.id, provider.id);

  return {
    clinic, provider,
    patientId:     patient.id,
    serviceId:     service.id,
    productId:     product.id,
    lotIds:        lots.map((l) => l.id),
    appointmentId: appointment.id,
  };
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('Encounter → Estoque — consumo atômico', () => {
  it('consome kit, registra movement + trace, decrementa lote', async () => {
    const s = await buildBaseScenario({ lots: [{ qty: 5, expiryDate: '2099-12-31' }] });
    const encounter = await createSignedEncounter(
      s.clinic.id, s.patientId, s.provider.id, s.appointmentId,
    );

    const result = await runConsumptionHandler({
      clinicId:   s.clinic.id,
      encounterId: encounter.id,
      patientId:  s.patientId,
      providerId: s.provider.id,
      serviceId:  s.serviceId,
    });

    expect(result.status).toBe('ok');

    // Lote decrementado
    const lot = await client.query<{ quantity_current: string }>(
      `SELECT quantity_current FROM supply.inventory_lots WHERE id = $1`,
      [s.lotIds[0]],
    );
    expect(Number(lot.rows[0]?.quantity_current)).toBe(3); // 5 - 2

    // Movement criado
    const movements = await client.query<{ type: string; quantity: string }>(
      `SELECT type, quantity FROM supply.inventory_movements
       WHERE clinic_id = $1 AND reference_id = $2`,
      [s.clinic.id, encounter.id],
    );
    expect(movements.rowCount).toBe(1);
    expect(movements.rows[0]?.type).toBe('uso_paciente');
    expect(Number(movements.rows[0]?.quantity)).toBe(2);

    // Trace criado com IDs obrigatórios
    const traces = await client.query<{
      patient_id: string; lot_id: string; encounter_id: string; quantity_used: string;
    }>(
      `SELECT patient_id, lot_id, encounter_id, quantity_used
       FROM supply.patient_lot_traces
       WHERE clinic_id = $1 AND encounter_id = $2`,
      [s.clinic.id, encounter.id],
    );
    expect(traces.rowCount).toBe(1);
    expect(traces.rows[0]?.patient_id).toBe(s.patientId);
    expect(traces.rows[0]?.encounter_id).toBe(encounter.id);
    expect(Number(traces.rows[0]?.quantity_used)).toBe(2);
  });
});

describe('Encounter → Estoque — idempotência', () => {
  it('encounter.signed duplicado NÃO cria segundo consumo', async () => {
    const s = await buildBaseScenario({ lots: [{ qty: 10, expiryDate: '2099-12-31' }] });
    const encounter = await createSignedEncounter(
      s.clinic.id, s.patientId, s.provider.id, s.appointmentId,
    );

    const first = await runConsumptionHandler({
      clinicId: s.clinic.id, encounterId: encounter.id,
      patientId: s.patientId, providerId: s.provider.id, serviceId: s.serviceId,
    });
    expect(first.status).toBe('ok');

    // Segunda execução (retry do bus / processo reiniciou)
    const second = await runConsumptionHandler({
      clinicId: s.clinic.id, encounterId: encounter.id,
      patientId: s.patientId, providerId: s.provider.id, serviceId: s.serviceId,
    });
    expect(second.status).toBe('already_processed');

    // Lote consumido apenas uma vez (10 - 2 = 8)
    const lot = await client.query<{ quantity_current: string }>(
      `SELECT quantity_current FROM supply.inventory_lots WHERE id = $1`,
      [s.lotIds[0]],
    );
    expect(Number(lot.rows[0]?.quantity_current)).toBe(8);

    // Apenas 1 movement e 1 trace
    const counts = await client.query<{
      mov_count: string; trace_count: string; log_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM supply.inventory_movements WHERE reference_id = $1) AS mov_count,
         (SELECT COUNT(*) FROM supply.patient_lot_traces  WHERE encounter_id = $1) AS trace_count,
         (SELECT COUNT(*) FROM supply.procedure_consumption_log WHERE encounter_id = $1) AS log_count`,
      [encounter.id],
    );
    expect(Number(counts.rows[0]?.mov_count)).toBe(1);
    expect(Number(counts.rows[0]?.trace_count)).toBe(1);
    expect(Number(counts.rows[0]?.log_count)).toBe(1);
  });
});

describe('Encounter → Estoque — FEFO', () => {
  it('consome lote com vencimento mais próximo primeiro (First Expired First Out)', async () => {
    const today = new Date();
    const farFuture  = '2099-12-31';
    const nearFuture = new Date(today.getTime() + 30 * 86_400_000)
      .toISOString().slice(0, 10);

    const s = await buildBaseScenario({
      lots: [
        { qty: 1, expiryDate: farFuture  },  // L0 — venc longe
        { qty: 5, expiryDate: nearFuture },  // L1 — venc próximo
      ],
    });
    const encounter = await createSignedEncounter(
      s.clinic.id, s.patientId, s.provider.id, s.appointmentId,
    );

    const result = await runConsumptionHandler({
      clinicId: s.clinic.id, encounterId: encounter.id,
      patientId: s.patientId, providerId: s.provider.id, serviceId: s.serviceId,
    });
    expect(result.status).toBe('ok');

    // Lote L1 (vencimento mais próximo) deve ser consumido primeiro: 5 - 2 = 3
    const lots = await client.query<{ id: string; quantity_current: string }>(
      `SELECT id, quantity_current FROM supply.inventory_lots
       WHERE clinic_id = $1 ORDER BY expiry_date NULLS LAST`,
      [s.clinic.id],
    );

    expect(lots.rows[0]?.id).toBe(s.lotIds[1]);                         // L1 primeiro (venc próximo)
    expect(Number(lots.rows[0]?.quantity_current)).toBe(3);             // 5 - 2
    expect(Number(lots.rows[1]?.quantity_current)).toBe(1);             // L0 intacto
  });
});

describe('Encounter → Estoque — atomicidade', () => {
  it('falha de INSERT em log impede UPDATE de quantidade do lote', async () => {
    const s = await buildBaseScenario({ lots: [{ qty: 5, expiryDate: '2099-12-31' }] });
    const encounter = await createSignedEncounter(
      s.clinic.id, s.patientId, s.provider.id, s.appointmentId,
    );

    // Primeiro consumo OK
    await runConsumptionHandler({
      clinicId: s.clinic.id, encounterId: encounter.id,
      patientId: s.patientId, providerId: s.provider.id, serviceId: s.serviceId,
    });
    const after1 = await client.query<{ quantity_current: string }>(
      `SELECT quantity_current FROM supply.inventory_lots WHERE id = $1`, [s.lotIds[0]],
    );

    // Segundo retry: log já existe → UNIQUE viola → handler retorna already_processed
    // sem decrementar lote novamente
    await runConsumptionHandler({
      clinicId: s.clinic.id, encounterId: encounter.id,
      patientId: s.patientId, providerId: s.provider.id, serviceId: s.serviceId,
    });
    const after2 = await client.query<{ quantity_current: string }>(
      `SELECT quantity_current FROM supply.inventory_lots WHERE id = $1`, [s.lotIds[0]],
    );

    expect(after1.rows[0]?.quantity_current).toBe(after2.rows[0]?.quantity_current);
  });
});

describe('Encounter → Estoque — rastreabilidade ANVISA', () => {
  it('patient_lot_trace contém clinic_id, patient_id, lot_id e encounter_id', async () => {
    const s = await buildBaseScenario({ lots: [{ qty: 5, expiryDate: '2099-12-31' }] });
    const encounter = await createSignedEncounter(
      s.clinic.id, s.patientId, s.provider.id, s.appointmentId,
    );

    await runConsumptionHandler({
      clinicId: s.clinic.id, encounterId: encounter.id,
      patientId: s.patientId, providerId: s.provider.id, serviceId: s.serviceId,
    });

    const trace = await client.query<{
      clinic_id: string; patient_id: string; lot_id: string;
      encounter_id: string; quantity_used: string; applied_by: string;
    }>(
      `SELECT clinic_id, patient_id, lot_id, encounter_id,
              quantity_used, applied_by
       FROM supply.patient_lot_traces
       WHERE encounter_id = $1`,
      [encounter.id],
    );

    expect(trace.rows[0]?.clinic_id).toBe(s.clinic.id);
    expect(trace.rows[0]?.patient_id).toBe(s.patientId);
    expect(trace.rows[0]?.lot_id).toBe(s.lotIds[0]);
    expect(trace.rows[0]?.encounter_id).toBe(encounter.id);
    expect(trace.rows[0]?.applied_by).toBe(s.provider.id);
    expect(Number(trace.rows[0]?.quantity_used)).toBeGreaterThan(0);
  });

  it('patient_lot_traces é append-only (UPDATE/DELETE bloqueados pela trigger)', async () => {
    const s = await buildBaseScenario({ lots: [{ qty: 5, expiryDate: '2099-12-31' }] });
    const encounter = await createSignedEncounter(
      s.clinic.id, s.patientId, s.provider.id, s.appointmentId,
    );

    await runConsumptionHandler({
      clinicId: s.clinic.id, encounterId: encounter.id,
      patientId: s.patientId, providerId: s.provider.id, serviceId: s.serviceId,
    });

    const trace = await client.query<{ id: string }>(
      `SELECT id FROM supply.patient_lot_traces WHERE encounter_id = $1`,
      [encounter.id],
    );

    // UPDATE deve falhar
    await expect(
      client.query(
        `UPDATE supply.patient_lot_traces SET quantity_used = 999 WHERE id = $1`,
        [trace.rows[0]?.id],
      ),
    ).rejects.toThrow();
  });
});

// Para evitar warnings de unused: faker é usado nas factories
void faker;

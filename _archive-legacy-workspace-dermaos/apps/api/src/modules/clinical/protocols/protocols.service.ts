import { TRPCError } from '@trpc/server';
import type { PoolClient } from 'pg';
import { db, withClinicContext } from '../../../db/client.js';
import { eventBus } from '../../../events/event-bus.js';
import { emitToClinic } from '../../../lib/socket.js';
import { logger } from '../../../lib/logger.js';
import type {
  CreateProtocolInput,
  UpdateProtocolInput,
  CancelProtocolInput,
  PauseProtocolInput,
  RegisterSessionInput,
  CorrectSessionInput,
  ListProtocolsQuery,
  ProtocolType,
  ProtocolStatus,
  ProtocolProductLink,
  AdverseEvent,
  AdverseSeverity,
  SessionProductConsumption,
} from '@dermaos/shared';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

interface ProtocolRow {
  id:                    string;
  clinic_id:             string;
  patient_id:            string;
  provider_id:           string;
  type:                  ProtocolType;
  status:                ProtocolStatus;
  name:                  string;
  description:           string | null;
  total_sessions:        number;
  sessions_done:         number;
  interval_days:         number | null;
  started_at:            string | null;
  expected_end_date:     string | null;
  ended_at:              string | null;
  parameters_schema:     Record<string, unknown>;
  product_links:         ProtocolProductLink[];
  notes:                 string | null;
  cancellation_reason:   string | null;
  cancelled_at:          string | null;
  cancelled_by:          string | null;
  created_at:            string;
  updated_at:            string;
  created_by:            string | null;
  updated_by:            string | null;
}

interface ProtocolSessionRow {
  id:                   string;
  clinic_id:            string;
  protocol_id:          string;
  appointment_id:       string | null;
  performed_by:         string | null;
  session_number:       number;
  performed_at:         string;
  duration_min:         number | null;
  observations:         string | null;
  parameters:           Record<string, unknown>;
  outcome:              string | null;
  next_session_notes:   string | null;
  patient_response:     string | null;
  adverse_events:       AdverseEvent[];
  adverse_severity_max: AdverseSeverity;
  flag_medical_review:  boolean;
  pre_image_ids:        string[];
  post_image_ids:       string[];
  products_consumed:    SessionProductConsumption[];
  insufficient_stock:   boolean;
  scheduled_next_at:    string | null;
  version:              number;
  original_session_id:  string | null;
  edit_justification:   string | null;
  created_by:           string | null;
  created_at:           string;
  updated_at:           string;
}

export interface ProtocolPublic {
  id:                   string;
  clinicId:             string;
  patientId:            string;
  providerId:           string;
  type:                 ProtocolType;
  status:               ProtocolStatus;
  name:                 string;
  description:          string | null;
  totalSessions:        number;
  sessionsDone:         number;
  intervalDays:         number | null;
  startedAt:            Date | null;
  expectedEndDate:      Date | null;
  endedAt:              Date | null;
  parametersSchema:     Record<string, unknown>;
  productLinks:         ProtocolProductLink[];
  notes:                string | null;
  cancellationReason:   string | null;
  cancelledAt:          Date | null;
  cancelledBy:          string | null;
  createdAt:            Date;
  updatedAt:            Date;
  createdBy:            string | null;
  updatedBy:            string | null;
}

export interface ProtocolSessionPublic {
  id:                   string;
  clinicId:             string;
  protocolId:           string;
  appointmentId:        string | null;
  performedBy:          string | null;
  sessionNumber:        number;
  performedAt:          Date;
  durationMin:          number | null;
  observations:         string | null;
  parameters:           Record<string, unknown>;
  outcome:              string | null;
  nextSessionNotes:     string | null;
  patientResponse:      string | null;
  adverseEvents:        AdverseEvent[];
  adverseSeverityMax:   AdverseSeverity;
  flagMedicalReview:    boolean;
  preImageIds:          string[];
  postImageIds:         string[];
  productsConsumed:     SessionProductConsumption[];
  insufficientStock:    boolean;
  scheduledNextAt:      Date | null;
  version:              number;
  originalSessionId:    string | null;
  editJustification:    string | null;
  createdBy:            string | null;
  createdAt:            Date;
  updatedAt:            Date;
}

/* ── Mappers ─────────────────────────────────────────────────────────────── */

function mapProtocol(row: ProtocolRow): ProtocolPublic {
  return {
    id:                 row.id,
    clinicId:           row.clinic_id,
    patientId:          row.patient_id,
    providerId:         row.provider_id,
    type:               row.type,
    status:             row.status,
    name:               row.name,
    description:        row.description,
    totalSessions:      row.total_sessions,
    sessionsDone:       row.sessions_done,
    intervalDays:       row.interval_days,
    startedAt:          row.started_at ? new Date(row.started_at) : null,
    expectedEndDate:    row.expected_end_date ? new Date(row.expected_end_date) : null,
    endedAt:            row.ended_at ? new Date(row.ended_at) : null,
    parametersSchema:   row.parameters_schema ?? {},
    productLinks:       Array.isArray(row.product_links) ? row.product_links : [],
    notes:              row.notes,
    cancellationReason: row.cancellation_reason,
    cancelledAt:        row.cancelled_at ? new Date(row.cancelled_at) : null,
    cancelledBy:        row.cancelled_by,
    createdAt:          new Date(row.created_at),
    updatedAt:          new Date(row.updated_at),
    createdBy:          row.created_by,
    updatedBy:          row.updated_by,
  };
}

function mapSession(row: ProtocolSessionRow): ProtocolSessionPublic {
  return {
    id:                 row.id,
    clinicId:           row.clinic_id,
    protocolId:         row.protocol_id,
    appointmentId:      row.appointment_id,
    performedBy:        row.performed_by,
    sessionNumber:      row.session_number,
    performedAt:        new Date(row.performed_at),
    durationMin:        row.duration_min,
    observations:       row.observations,
    parameters:         row.parameters ?? {},
    outcome:            row.outcome,
    nextSessionNotes:   row.next_session_notes,
    patientResponse:    row.patient_response,
    adverseEvents:      Array.isArray(row.adverse_events) ? row.adverse_events : [],
    adverseSeverityMax: row.adverse_severity_max,
    flagMedicalReview:  row.flag_medical_review,
    preImageIds:        Array.isArray(row.pre_image_ids) ? row.pre_image_ids : [],
    postImageIds:       Array.isArray(row.post_image_ids) ? row.post_image_ids : [],
    productsConsumed:   Array.isArray(row.products_consumed) ? row.products_consumed : [],
    insufficientStock:  row.insufficient_stock,
    scheduledNextAt:    row.scheduled_next_at ? new Date(row.scheduled_next_at) : null,
    version:            row.version,
    originalSessionId:  row.original_session_id,
    editJustification:  row.edit_justification,
    createdBy:          row.created_by,
    createdAt:          new Date(row.created_at),
    updatedAt:          new Date(row.updated_at),
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

async function fetchProtocol(
  client: PoolClient | typeof db,
  id: string,
  clinicId: string,
): Promise<ProtocolRow> {
  const res = await client.query<ProtocolRow>(
    `SELECT * FROM clinical.protocols WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId],
  );
  if (!res.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Protocolo não encontrado' });
  }
  return res.rows[0];
}

async function fetchSession(
  client: PoolClient | typeof db,
  id: string,
  clinicId: string,
): Promise<ProtocolSessionRow> {
  const res = await client.query<ProtocolSessionRow>(
    `SELECT * FROM clinical.protocol_sessions WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId],
  );
  if (!res.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Sessão não encontrada' });
  }
  return res.rows[0];
}

async function assertPatientInClinic(
  client: PoolClient | typeof db,
  clinicId: string,
  patientId: string,
): Promise<void> {
  const res = await client.query(
    `SELECT 1 FROM shared.patients WHERE id = $1 AND clinic_id = $2`,
    [patientId, clinicId],
  );
  if (res.rowCount === 0) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado' });
  }
}

const SEVERITY_RANK: Record<AdverseSeverity, number> = {
  none: 0, leve: 1, moderado: 2, grave: 3,
};

function maxSeverity(events: AdverseEvent[]): AdverseSeverity {
  let max: AdverseSeverity = 'none';
  for (const e of events) {
    if (SEVERITY_RANK[e.severity] > SEVERITY_RANK[max]) max = e.severity;
  }
  return max;
}

function computeExpectedEndDate(
  startedAt: Date | null,
  totalSessions: number,
  intervalDays: number,
): Date | null {
  if (!startedAt) return null;
  const d = new Date(startedAt);
  d.setDate(d.getDate() + intervalDays * Math.max(0, totalSessions - 1));
  return d;
}

/* ── Protocolo: CRUD ─────────────────────────────────────────────────────── */

export async function createProtocol(
  input:    CreateProtocolInput,
  clinicId: string,
  userId:   string,
): Promise<ProtocolPublic> {
  return withClinicContext(clinicId, async (client) => {
    await assertPatientInClinic(client, clinicId, input.patientId);

    const startedAt = input.startedAt ?? null;
    const expected  = computeExpectedEndDate(startedAt, input.totalSessions, input.intervalDays);

    const res = await client.query<ProtocolRow>(
      `INSERT INTO clinical.protocols
         (clinic_id, patient_id, provider_id, type, status,
          name, description, total_sessions, sessions_done, interval_days,
          started_at, expected_end_date, parameters_schema, product_links,
          notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4::clinical.protocol_type, 'ativo',
               $5, $6, $7, 0, $8,
               $9, $10, $11::jsonb, $12::jsonb,
               $13, $14, $14)
       RETURNING *`,
      [
        clinicId,
        input.patientId,
        input.providerId,
        input.type,
        input.name,
        input.description ?? null,
        input.totalSessions,
        input.intervalDays,
        startedAt,
        expected,
        JSON.stringify(input.parametersSchema ?? {}),
        JSON.stringify(input.productLinks ?? []),
        input.notes ?? null,
        userId,
      ],
    );
    const protocol = mapProtocol(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'protocol.created',
        clinicId,
        protocol.id,
        { protocolId: protocol.id, patientId: protocol.patientId, type: protocol.type },
        { userId },
      );
      emitToClinic(clinicId, 'protocol.updated', {
        protocolId: protocol.id,
        patientId:  protocol.patientId,
        status:     protocol.status,
      });
    });

    return protocol;
  });
}

export async function updateProtocol(
  input:    UpdateProtocolInput,
  clinicId: string,
  userId:   string,
): Promise<ProtocolPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchProtocol(client, input.id, clinicId);

    if (current.status === 'cancelado' || current.status === 'concluido') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Protocolo finalizado/cancelado não pode ser editado.',
      });
    }

    const data = input.data;
    const set: string[] = [];
    const values: unknown[] = [input.id, clinicId];
    let idx = 3;

    if (data.name !== undefined)           { set.push(`name = $${idx++}`);           values.push(data.name); }
    if (data.description !== undefined)    { set.push(`description = $${idx++}`);    values.push(data.description); }
    if (data.totalSessions !== undefined)  { set.push(`total_sessions = $${idx++}`); values.push(data.totalSessions); }
    if (data.intervalDays !== undefined)   { set.push(`interval_days = $${idx++}`);  values.push(data.intervalDays); }
    if (data.parametersSchema !== undefined) {
      set.push(`parameters_schema = $${idx++}::jsonb`);
      values.push(JSON.stringify(data.parametersSchema));
    }
    if (data.productLinks !== undefined) {
      set.push(`product_links = $${idx++}::jsonb`);
      values.push(JSON.stringify(data.productLinks));
    }
    if (data.notes !== undefined) { set.push(`notes = $${idx++}`); values.push(data.notes); }

    // Recalcula expected_end_date se totalSessions ou intervalDays mudou
    const newTotal    = data.totalSessions ?? current.total_sessions;
    const newInterval = data.intervalDays  ?? current.interval_days ?? 0;
    if ((data.totalSessions !== undefined || data.intervalDays !== undefined) && current.started_at) {
      const expected = computeExpectedEndDate(new Date(current.started_at), newTotal, newInterval);
      set.push(`expected_end_date = $${idx++}`);
      values.push(expected);
    }

    if (set.length === 0) return mapProtocol(current);

    set.push(`updated_at = NOW()`);
    set.push(`updated_by = $${idx++}`);
    values.push(userId);

    const res = await client.query<ProtocolRow>(
      `UPDATE clinical.protocols SET ${set.join(', ')}
        WHERE id = $1 AND clinic_id = $2 RETURNING *`,
      values,
    );
    const protocol = mapProtocol(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'protocol.updated',
        clinicId,
        protocol.id,
        { protocolId: protocol.id, patientId: protocol.patientId },
        { userId },
      );
    });

    return protocol;
  });
}

export async function cancelProtocol(
  input:    CancelProtocolInput,
  clinicId: string,
  userId:   string,
): Promise<ProtocolPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchProtocol(client, input.id, clinicId);
    if (current.status === 'cancelado') {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Protocolo já está cancelado.' });
    }
    if (current.status === 'concluido') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Protocolo concluído não pode ser cancelado.' });
    }

    const res = await client.query<ProtocolRow>(
      `UPDATE clinical.protocols
          SET status = 'cancelado',
              cancelled_at = NOW(),
              cancelled_by = $3,
              cancellation_reason = $4,
              ended_at = CURRENT_DATE,
              updated_at = NOW(),
              updated_by = $3
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      [input.id, clinicId, userId, input.reason],
    );
    const protocol = mapProtocol(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'protocol.cancelled',
        clinicId,
        protocol.id,
        { protocolId: protocol.id, reason: input.reason },
        { userId },
      );
      emitToClinic(clinicId, 'protocol.updated', {
        protocolId: protocol.id,
        patientId:  protocol.patientId,
        status:     protocol.status,
      });
    });

    return protocol;
  });
}

export async function pauseProtocol(
  input:    PauseProtocolInput,
  clinicId: string,
  userId:   string,
): Promise<ProtocolPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchProtocol(client, input.id, clinicId);
    if (current.status !== 'ativo') {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Apenas protocolos ativos podem ser pausados.' });
    }

    const res = await client.query<ProtocolRow>(
      `UPDATE clinical.protocols
          SET status = 'pausado',
              notes = COALESCE(notes, '') || E'\n[pausa] ' || $3,
              updated_at = NOW(),
              updated_by = $4
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      [input.id, clinicId, input.reason, userId],
    );
    const protocol = mapProtocol(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'protocol.paused',
        clinicId,
        protocol.id,
        { protocolId: protocol.id, reason: input.reason },
        { userId },
      );
    });

    return protocol;
  });
}

export async function resumeProtocol(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<ProtocolPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchProtocol(client, id, clinicId);
    if (current.status !== 'pausado') {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Apenas protocolos pausados podem ser retomados.' });
    }

    const res = await client.query<ProtocolRow>(
      `UPDATE clinical.protocols
          SET status = 'ativo', updated_at = NOW(), updated_by = $3
        WHERE id = $1 AND clinic_id = $2 RETURNING *`,
      [id, clinicId, userId],
    );
    const protocol = mapProtocol(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'protocol.resumed',
        clinicId,
        protocol.id,
        { protocolId: protocol.id },
        { userId },
      );
    });

    return protocol;
  });
}

/* ── Protocolo: Queries ──────────────────────────────────────────────────── */

export async function getProtocolById(id: string, clinicId: string): Promise<ProtocolPublic> {
  const row = await fetchProtocol(db, id, clinicId);
  return mapProtocol(row);
}

export async function listProtocolsByPatient(
  params:   ListProtocolsQuery,
  clinicId: string,
): Promise<ProtocolPublic[]> {
  const where: string[] = ['clinic_id = $1', 'patient_id = $2'];
  const values: unknown[] = [clinicId, params.patientId];
  let idx = 3;

  if (params.status) {
    where.push(`status = $${idx++}::clinical.protocol_status`);
    values.push(params.status);
  }

  const res = await db.query<ProtocolRow>(
    `SELECT * FROM clinical.protocols
      WHERE ${where.join(' AND ')}
      ORDER BY started_at DESC NULLS LAST, created_at DESC`,
    values,
  );
  return res.rows.map(mapProtocol);
}

export async function listActiveProtocols(clinicId: string): Promise<ProtocolPublic[]> {
  const res = await db.query<ProtocolRow>(
    `SELECT * FROM clinical.protocols
      WHERE clinic_id = $1 AND status IN ('ativo','pausado')
      ORDER BY started_at DESC NULLS LAST, created_at DESC`,
    [clinicId],
  );
  return res.rows.map(mapProtocol);
}

/* ── Sessões: consumo de estoque (FEFO por lote) ─────────────────────────── */

interface LotPick {
  lotId:    string;
  quantity: number;
}

async function pickLotsAndDebit(
  client: PoolClient,
  clinicId: string,
  productId: string,
  quantity: number,
  preferredLotId: string | undefined,
  reference: { type: 'protocol_session'; id: string },
  performedBy: string,
): Promise<{ picks: LotPick[]; insufficient: boolean }> {
  // 1) Se o usuário indicou o lote, tenta usá-lo primeiro
  const picks: LotPick[] = [];
  let remaining = quantity;

  const preferredRes = preferredLotId
    ? await client.query<{ id: string; quantity_current: string }>(
        `SELECT id, quantity_current
           FROM supply.inventory_lots
          WHERE id = $1 AND clinic_id = $2 AND product_id = $3
            AND is_quarantined = FALSE
            AND quantity_current > 0
          FOR UPDATE`,
        [preferredLotId, clinicId, productId],
      )
    : { rows: [] as { id: string; quantity_current: string }[] };

  for (const lot of preferredRes.rows) {
    if (remaining <= 0) break;
    const available = Number(lot.quantity_current);
    const take = Math.min(available, remaining);
    if (take > 0) {
      picks.push({ lotId: lot.id, quantity: take });
      remaining -= take;
    }
  }

  // 2) FEFO — First Expired First Out
  if (remaining > 0) {
    const fefo = await client.query<{ id: string; quantity_current: string }>(
      `SELECT id, quantity_current
         FROM supply.inventory_lots
        WHERE clinic_id = $1 AND product_id = $2
          AND is_quarantined = FALSE
          AND quantity_current > 0
          ${preferredLotId ? 'AND id <> $3' : ''}
        ORDER BY expiry_date NULLS LAST, received_at ASC
        FOR UPDATE`,
      preferredLotId ? [clinicId, productId, preferredLotId] : [clinicId, productId],
    );
    for (const lot of fefo.rows) {
      if (remaining <= 0) break;
      const available = Number(lot.quantity_current);
      const take = Math.min(available, remaining);
      if (take > 0) {
        picks.push({ lotId: lot.id, quantity: take });
        remaining -= take;
      }
    }
  }

  const insufficient = remaining > 0;

  // 3) Debita cada lote e grava movimentação
  for (const pick of picks) {
    const before = await client.query<{ quantity_current: string }>(
      `SELECT quantity_current FROM supply.inventory_lots WHERE id = $1`,
      [pick.lotId],
    );
    const qtyBefore = Number(before.rows[0]?.quantity_current ?? 0);
    const qtyAfter  = qtyBefore - pick.quantity;

    await client.query(
      `UPDATE supply.inventory_lots
          SET quantity_current = $2, updated_at = NOW()
        WHERE id = $1`,
      [pick.lotId, qtyAfter],
    );

    await client.query(
      `INSERT INTO supply.inventory_movements
         (clinic_id, product_id, lot_id, type, reference_type, reference_id,
          quantity, quantity_before, quantity_after, performed_by, performed_at)
       VALUES ($1, $2, $3, 'uso_paciente', $4::supply.movement_reference_type, $5,
               $6, $7, $8, $9, NOW())`,
      [
        clinicId, productId, pick.lotId,
        reference.type, reference.id,
        pick.quantity, qtyBefore, qtyAfter, performedBy,
      ],
    );

    setImmediate(() => {
      void eventBus.publish(
        'inventory.movement_recorded',
        clinicId,
        pick.lotId,
        {
          productId,
          lotId:      pick.lotId,
          quantity:   pick.quantity,
          type:       'uso_paciente',
          referenceType: reference.type,
          referenceId:   reference.id,
        },
        { userId: performedBy },
      );
      void eventBus.publish(
        'inventory.lot_traced',
        clinicId,
        pick.lotId,
        { lotId: pick.lotId, productId, referenceId: reference.id },
        { userId: performedBy },
      );
    });
  }

  return { picks, insufficient };
}

/* ── Sessões ─────────────────────────────────────────────────────────────── */

export async function registerSession(
  input:    RegisterSessionInput,
  clinicId: string,
  userId:   string,
): Promise<ProtocolSessionPublic> {
  return withClinicContext(clinicId, async (client) => {
    const protocol = await fetchProtocol(client, input.protocolId, clinicId);

    if (protocol.status !== 'ativo') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Protocolo está ${protocol.status}. Retome-o antes de registrar a sessão.`,
      });
    }
    if (protocol.sessions_done >= protocol.total_sessions) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Todas as sessões deste protocolo já foram concluídas.',
      });
    }

    const nextNumber = protocol.sessions_done + 1;
    const performedAt = input.performedAt ?? new Date();
    const severityMax = maxSeverity(input.adverseEvents);
    const flagReview  = severityMax === 'grave';

    // Consumo de estoque por lote (FEFO), com flag de 'insufficient_stock' se necessário
    let insufficientStock = false;
    const consumedWithLots: SessionProductConsumption[] = [];

    // cria a sessão primeiro (precisamos do id p/ reference_id)
    const insertSession = await client.query<ProtocolSessionRow>(
      `INSERT INTO clinical.protocol_sessions
         (clinic_id, protocol_id, appointment_id, performed_by, session_number,
          performed_at, duration_min, observations, parameters, outcome,
          next_session_notes, patient_response, adverse_events, adverse_severity_max,
          flag_medical_review, pre_image_ids, post_image_ids, products_consumed,
          insufficient_stock, scheduled_next_at, created_by)
       VALUES ($1, $2, $3, $4, $5,
               $6, $7, $8, $9::jsonb, $10,
               $11, $12, $13::jsonb, $14::clinical.adverse_event_severity,
               $15, $16::uuid[], $17::uuid[], $18::jsonb,
               FALSE, NULL, $4)
       RETURNING *`,
      [
        clinicId,
        input.protocolId,
        input.appointmentId ?? null,
        userId,
        nextNumber,
        performedAt,
        input.durationMin ?? null,
        input.observations ?? null,
        JSON.stringify(input.parameters ?? {}),
        input.outcome ?? null,
        input.nextSessionNotes ?? null,
        input.patientResponse ?? null,
        JSON.stringify(input.adverseEvents ?? []),
        severityMax,
        flagReview,
        input.preImageIds ?? [],
        input.postImageIds ?? [],
        JSON.stringify([]),
      ],
    );
    const sessionId = insertSession.rows[0]!.id;

    // Processa consumos após ter o session.id (para rastreabilidade)
    for (const c of input.productsConsumed) {
      try {
        const { picks, insufficient } = await pickLotsAndDebit(
          client,
          clinicId,
          c.productId,
          c.quantity,
          c.lotId,
          { type: 'protocol_session', id: sessionId },
          userId,
        );
        if (insufficient) insufficientStock = true;
        consumedWithLots.push({
          productId: c.productId,
          quantity:  picks.reduce((sum, p) => sum + p.quantity, 0),
          lotId:     picks[0]?.lotId ?? c.lotId,
          notes:     c.notes,
        });
      } catch (err) {
        logger.warn({ err, productId: c.productId }, 'Stock debit failed during session');
        insufficientStock = true;
        consumedWithLots.push(c);
      }
    }

    // Calcula data sugerida da próxima sessão
    const scheduledNextAt = protocol.interval_days
      ? new Date(performedAt.getTime() + protocol.interval_days * 24 * 60 * 60 * 1000)
      : null;

    // Atualiza a sessão com consumo/flag de estoque/próxima data
    const sessionRes = await client.query<ProtocolSessionRow>(
      `UPDATE clinical.protocol_sessions
          SET products_consumed = $3::jsonb,
              insufficient_stock = $4,
              scheduled_next_at = $5,
              updated_at = NOW()
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      [sessionId, clinicId, JSON.stringify(consumedWithLots), insufficientStock, scheduledNextAt],
    );
    const session = mapSession(sessionRes.rows[0]!);

    // Atualiza o protocolo: incrementa sessions_done, fecha se chegou ao total
    const becameCompleted = nextNumber >= protocol.total_sessions;
    await client.query(
      `UPDATE clinical.protocols
          SET sessions_done = sessions_done + 1,
              status = CASE WHEN $3 THEN 'concluido'::clinical.protocol_status ELSE status END,
              ended_at = CASE WHEN $3 THEN CURRENT_DATE ELSE ended_at END,
              updated_at = NOW(),
              updated_by = $4
        WHERE id = $1 AND clinic_id = $2`,
      [input.protocolId, clinicId, becameCompleted, userId],
    );

    setImmediate(() => {
      void eventBus.publish(
        'protocol.session_completed',
        clinicId,
        input.protocolId,
        {
          protocolId:    input.protocolId,
          sessionId:     session.id,
          sessionNumber: session.sessionNumber,
          patientId:     protocol.patient_id,
          flagMedicalReview: flagReview,
        },
        { userId },
      );
      if (flagReview) {
        void eventBus.publish(
          'protocol.session_flagged_review',
          clinicId,
          session.id,
          {
            protocolId: input.protocolId,
            sessionId:  session.id,
            severity:   severityMax,
          },
          { userId },
        );
      }
      if (becameCompleted) {
        void eventBus.publish(
          'protocol.completed',
          clinicId,
          input.protocolId,
          { protocolId: input.protocolId, patientId: protocol.patient_id },
          { userId },
        );
      }
      emitToClinic(clinicId, 'protocol.session_recorded', {
        protocolId:    input.protocolId,
        sessionId:     session.id,
        sessionNumber: session.sessionNumber,
        flagMedicalReview: flagReview,
        insufficientStock,
      });
    });

    return session;
  });
}

export async function correctSession(
  input:    CorrectSessionInput,
  clinicId: string,
  userId:   string,
): Promise<ProtocolSessionPublic> {
  return withClinicContext(clinicId, async (client) => {
    const original = await fetchSession(client, input.sessionId, clinicId);

    const c = input.correction;
    const adverse = (c.adverseEvents ?? original.adverse_events) as AdverseEvent[];
    const severityMax = maxSeverity(adverse);
    const flagReview  = severityMax === 'grave';

    // Snapshot antes-da-edição no audit log (via domain event)
    const snapshot = { ...mapSession(original) };

    const res = await client.query<ProtocolSessionRow>(
      `UPDATE clinical.protocol_sessions
          SET performed_at        = COALESCE($3, performed_at),
              duration_min        = COALESCE($4, duration_min),
              observations        = COALESCE($5, observations),
              parameters          = COALESCE($6::jsonb, parameters),
              outcome             = COALESCE($7, outcome),
              next_session_notes  = COALESCE($8, next_session_notes),
              patient_response    = COALESCE($9, patient_response),
              adverse_events      = $10::jsonb,
              adverse_severity_max = $11::clinical.adverse_event_severity,
              flag_medical_review = $12,
              pre_image_ids       = COALESCE($13::uuid[], pre_image_ids),
              post_image_ids      = COALESCE($14::uuid[], post_image_ids),
              products_consumed   = COALESCE($15::jsonb, products_consumed),
              version             = version + 1,
              edit_justification  = $16,
              updated_at          = NOW()
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      [
        input.sessionId,
        clinicId,
        c.performedAt ?? null,
        c.durationMin ?? null,
        c.observations ?? null,
        c.parameters ? JSON.stringify(c.parameters) : null,
        c.outcome ?? null,
        c.nextSessionNotes ?? null,
        c.patientResponse ?? null,
        JSON.stringify(adverse),
        severityMax,
        flagReview,
        c.preImageIds ?? null,
        c.postImageIds ?? null,
        c.productsConsumed ? JSON.stringify(c.productsConsumed) : null,
        input.justification,
      ],
    );
    const session = mapSession(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'protocol.session_corrected',
        clinicId,
        session.id,
        {
          sessionId:     session.id,
          protocolId:    session.protocolId,
          justification: input.justification,
          previous:      snapshot,
        },
        { userId },
      );
      if (flagReview) {
        void eventBus.publish(
          'protocol.session_flagged_review',
          clinicId,
          session.id,
          { sessionId: session.id, protocolId: session.protocolId, severity: severityMax },
          { userId },
        );
      }
    });

    return session;
  });
}

export async function suggestNextSession(
  protocolId: string,
  clinicId:   string,
): Promise<{ suggestedAt: Date | null }> {
  const protocol = await getProtocolById(protocolId, clinicId);
  if (protocol.status !== 'ativo' || protocol.sessionsDone >= protocol.totalSessions) {
    return { suggestedAt: null };
  }

  const lastRes = await db.query<{ performed_at: string }>(
    `SELECT performed_at FROM clinical.protocol_sessions
      WHERE protocol_id = $1 AND clinic_id = $2
      ORDER BY session_number DESC LIMIT 1`,
    [protocolId, clinicId],
  );
  const last = lastRes.rows[0]?.performed_at
    ? new Date(lastRes.rows[0].performed_at)
    : protocol.startedAt ?? new Date();

  if (!protocol.intervalDays) return { suggestedAt: null };
  const suggested = new Date(last.getTime() + protocol.intervalDays * 24 * 60 * 60 * 1000);
  return { suggestedAt: suggested };
}

export async function listProtocolSessions(
  protocolId: string,
  clinicId:   string,
): Promise<ProtocolSessionPublic[]> {
  const res = await db.query<ProtocolSessionRow>(
    `SELECT * FROM clinical.protocol_sessions
      WHERE protocol_id = $1 AND clinic_id = $2
      ORDER BY session_number ASC`,
    [protocolId, clinicId],
  );
  return res.rows.map(mapSession);
}

export async function getProtocolSessionById(
  sessionId: string,
  clinicId:  string,
): Promise<ProtocolSessionPublic> {
  const row = await fetchSession(db, sessionId, clinicId);
  return mapSession(row);
}

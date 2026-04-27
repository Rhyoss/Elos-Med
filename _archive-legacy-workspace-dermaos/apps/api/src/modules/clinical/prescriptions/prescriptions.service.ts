import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import type { PoolClient } from 'pg';
import { db, withClinicContext } from '../../../db/client.js';
import { eventBus } from '../../../events/event-bus.js';
import { emitToClinic } from '../../../lib/socket.js';
import { logger } from '../../../lib/logger.js';
import { decryptOptional } from '../../../lib/crypto.js';
import type {
  CreatePrescriptionInput,
  UpdatePrescriptionInput,
  CancelPrescriptionInput,
  SendPrescriptionInput,
  ListPrescriptionsQuery,
  PrescriptionItem,
  PrescriptionStatus,
  PrescriptionType,
  PrescriptionDeliveryStatus,
} from '@dermaos/shared';
import { sanitizeItemText } from './prescriptions.sanitize.js';

/* ── Tipos ───────────────────────────────────────────────────────────────── */

interface PrescriptionRow {
  id:                    string;
  clinic_id:             string;
  encounter_id:          string | null;
  patient_id:            string;
  prescriber_id:         string;
  type:                  PrescriptionType;
  status:                PrescriptionStatus;
  items:                 PrescriptionItem[];
  notes:                 string | null;
  valid_until:           string | null;
  prescription_number:   string | null;
  pdf_url:               string | null;
  pdf_storage_key:       string | null;
  pdf_generated_at:      string | null;
  digital_signature:     string | null;
  delivery_method:       string | null;
  delivered_at:          string | null;
  delivery_status:       PrescriptionDeliveryStatus;
  delivery_payload:      Record<string, unknown>;
  version:               number;
  duplicated_from:       string | null;
  signed_at:             string | null;
  signed_by:             string | null;
  signature_hash:        string | null;
  cancelled_at:          string | null;
  cancelled_by:          string | null;
  cancellation_reason:   string | null;
  created_at:            string;
  updated_at:            string;
  created_by:            string | null;
  updated_by:            string | null;
}

export interface PrescriptionPublic {
  id:                  string;
  clinicId:            string;
  encounterId:         string | null;
  patientId:           string;
  prescriberId:        string;
  type:                PrescriptionType;
  status:              PrescriptionStatus;
  items:               PrescriptionItem[];
  notes:               string | null;
  validUntil:          Date | null;
  prescriptionNumber:  string | null;
  pdfStorageKey:       string | null;
  pdfGeneratedAt:      Date | null;
  deliveryStatus:      PrescriptionDeliveryStatus;
  deliveryMethod:      string | null;
  deliveredAt:         Date | null;
  version:             number;
  duplicatedFrom:      string | null;
  signedAt:            Date | null;
  signedBy:            string | null;
  signatureHash:       string | null;
  cancelledAt:         Date | null;
  cancelledBy:         string | null;
  cancellationReason:  string | null;
  createdAt:           Date;
  updatedAt:           Date;
  createdBy:           string | null;
  updatedBy:           string | null;
}

export interface PrescriptionSummary {
  id:                string;
  patientId:         string;
  prescriberId:      string;
  type:              PrescriptionType;
  status:            PrescriptionStatus;
  itemCount:         number;
  prescriptionNumber: string | null;
  deliveryStatus:    PrescriptionDeliveryStatus;
  signedAt:          Date | null;
  createdAt:         Date;
  updatedAt:         Date;
}

export interface PaginatedPrescriptions {
  data:       PrescriptionSummary[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function mapRow(row: PrescriptionRow): PrescriptionPublic {
  return {
    id:                 row.id,
    clinicId:           row.clinic_id,
    encounterId:        row.encounter_id,
    patientId:          row.patient_id,
    prescriberId:       row.prescriber_id,
    type:               row.type,
    status:             row.status,
    items:              Array.isArray(row.items) ? row.items : [],
    notes:              row.notes,
    validUntil:         row.valid_until ? new Date(row.valid_until) : null,
    prescriptionNumber: row.prescription_number,
    pdfStorageKey:      row.pdf_storage_key ?? row.pdf_url,
    pdfGeneratedAt:     row.pdf_generated_at ? new Date(row.pdf_generated_at) : null,
    deliveryStatus:     row.delivery_status,
    deliveryMethod:     row.delivery_method,
    deliveredAt:        row.delivered_at ? new Date(row.delivered_at) : null,
    version:            row.version,
    duplicatedFrom:     row.duplicated_from,
    signedAt:           row.signed_at ? new Date(row.signed_at) : null,
    signedBy:           row.signed_by,
    signatureHash:      row.signature_hash,
    cancelledAt:        row.cancelled_at ? new Date(row.cancelled_at) : null,
    cancelledBy:        row.cancelled_by,
    cancellationReason: row.cancellation_reason,
    createdAt:          new Date(row.created_at),
    updatedAt:          new Date(row.updated_at),
    createdBy:          row.created_by,
    updatedBy:          row.updated_by,
  };
}

function mapSummary(row: PrescriptionRow): PrescriptionSummary {
  return {
    id:                row.id,
    patientId:         row.patient_id,
    prescriberId:      row.prescriber_id,
    type:              row.type,
    status:            row.status,
    itemCount:         Array.isArray(row.items) ? row.items.length : 0,
    prescriptionNumber: row.prescription_number,
    deliveryStatus:    row.delivery_status,
    signedAt:          row.signed_at ? new Date(row.signed_at) : null,
    createdAt:         new Date(row.created_at),
    updatedAt:         new Date(row.updated_at),
  };
}

function assertNotSigned(row: PrescriptionRow): void {
  if (row.status === 'assinada' || row.status === 'enviada_digital' || row.signed_at) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Prescrição assinada é imutável. Duplique para criar uma nova versão.',
    });
  }
  if (row.status === 'cancelada') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Prescrição cancelada não pode ser editada.',
    });
  }
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

async function fetchById(
  client: PoolClient | typeof db,
  id: string,
  clinicId: string,
): Promise<PrescriptionRow> {
  const res = await client.query<PrescriptionRow>(
    `SELECT * FROM clinical.prescriptions WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId],
  );
  if (!res.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Prescrição não encontrada' });
  }
  return res.rows[0];
}

async function nextPrescriptionNumber(
  client: PoolClient,
  clinicId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RX-${year}-`;
  const res = await client.query<{ last: string | null }>(
    `SELECT MAX(prescription_number) AS last
       FROM clinical.prescriptions
      WHERE clinic_id = $1
        AND prescription_number LIKE $2`,
    [clinicId, `${prefix}%`],
  );
  const last = res.rows[0]?.last;
  let seq = 1;
  if (last) {
    const parsed = parseInt(last.slice(prefix.length), 10);
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

/* ── Sanitização de itens ────────────────────────────────────────────────── */

function sanitizeItems(items: PrescriptionItem[]): PrescriptionItem[] {
  return items.map((item) => {
    const clone: Record<string, unknown> = { ...item };
    for (const [k, v] of Object.entries(clone)) {
      if (typeof v === 'string') {
        clone[k] = sanitizeItemText(v);
      }
    }
    if (item.type === 'manipulada' && Array.isArray((item as { components?: unknown }).components)) {
      clone.components = (item.components as { substance: string; concentration: string }[]).map((c) => ({
        substance:     sanitizeItemText(c.substance),
        concentration: sanitizeItemText(c.concentration),
      }));
    }
    return clone as PrescriptionItem;
  });
}

/* ── CRUD ────────────────────────────────────────────────────────────────── */

export async function createPrescription(
  input:    CreatePrescriptionInput,
  clinicId: string,
  userId:   string,
): Promise<PrescriptionPublic> {
  return withClinicContext(clinicId, async (client) => {
    await assertPatientInClinic(client, clinicId, input.patientId);

    const items = sanitizeItems(input.items);
    const notes = input.notes ? sanitizeItemText(input.notes) : null;

    const result = await client.query<PrescriptionRow>(
      `INSERT INTO clinical.prescriptions
         (clinic_id, encounter_id, patient_id, prescriber_id,
          type, status, items, notes, valid_until,
          version, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5::clinical.prescription_type,
               'rascunho', $6::jsonb, $7, $8, 1, $9, $9)
       RETURNING *`,
      [
        clinicId,
        input.encounterId ?? null,
        input.patientId,
        userId,
        input.type,
        JSON.stringify(items),
        notes,
        input.validUntil ?? null,
        userId,
      ],
    );

    const prescription = mapRow(result.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'prescription.created',
        clinicId,
        prescription.id,
        {
          prescriptionId: prescription.id,
          patientId:      prescription.patientId,
          prescriberId:   prescription.prescriberId,
          type:           prescription.type,
        },
        { userId },
      );
      emitToClinic(clinicId, 'prescription.updated', {
        prescriptionId: prescription.id,
        patientId:      prescription.patientId,
        status:         prescription.status,
      });
    });

    return prescription;
  });
}

export async function updatePrescription(
  input:    UpdatePrescriptionInput,
  clinicId: string,
  userId:   string,
): Promise<PrescriptionPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchById(client, input.id, clinicId);
    assertNotSigned(current);

    const setClauses: string[] = [];
    const values: unknown[]    = [input.id, clinicId];
    let idx = 3;

    if (input.items !== undefined) {
      const items = sanitizeItems(input.items);
      // Todos os itens devem corresponder ao tipo declarado da prescrição
      for (const [i, item] of items.entries()) {
        if (item.type !== current.type) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Item ${i + 1} não corresponde ao tipo da prescrição (${current.type}).`,
          });
        }
      }
      setClauses.push(`items = $${idx++}::jsonb`);
      values.push(JSON.stringify(items));
    }
    if (input.notes !== undefined) {
      setClauses.push(`notes = $${idx++}`);
      values.push(input.notes === null ? null : sanitizeItemText(input.notes));
    }
    if (input.validUntil !== undefined) {
      setClauses.push(`valid_until = $${idx++}`);
      values.push(input.validUntil);
    }

    if (setClauses.length === 0) {
      return mapRow(current);
    }

    setClauses.push(`updated_at = NOW()`);
    setClauses.push(`updated_by = $${idx++}`);
    values.push(userId);

    const result = await client.query<PrescriptionRow>(
      `UPDATE clinical.prescriptions
          SET ${setClauses.join(', ')}
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      values,
    );
    const prescription = mapRow(result.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'prescription.updated',
        clinicId,
        prescription.id,
        { prescriptionId: prescription.id, patientId: prescription.patientId },
        { userId },
      );
      emitToClinic(clinicId, 'prescription.updated', {
        prescriptionId: prescription.id,
        patientId:      prescription.patientId,
        status:         prescription.status,
      });
    });

    return prescription;
  });
}

export async function signPrescription(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<PrescriptionPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchById(client, id, clinicId);

    if (current.status === 'assinada' || current.signed_at) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Prescrição já está assinada.',
      });
    }
    if (current.status === 'cancelada') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Prescrição cancelada não pode ser assinada.' });
    }
    if (!Array.isArray(current.items) || current.items.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Adicione ao menos um item antes de assinar.' });
    }

    const signedAt = new Date();
    const number   = current.prescription_number ?? await nextPrescriptionNumber(client, clinicId);

    const hashInput = JSON.stringify({
      id:           current.id,
      type:         current.type,
      items:        current.items,
      notes:        current.notes,
      validUntil:   current.valid_until,
      prescriberId: userId,
      signedAt:     signedAt.toISOString(),
    });
    const signatureHash = crypto.createHash('sha256').update(hashInput).digest('hex');

    const result = await client.query<PrescriptionRow>(
      `UPDATE clinical.prescriptions
          SET status = 'assinada',
              signed_at = $3,
              signed_by = $4,
              signature_hash = $5,
              prescription_number = COALESCE(prescription_number, $6),
              prescriber_id = $4,
              updated_at = NOW(),
              updated_by = $4
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      [id, clinicId, signedAt, userId, signatureHash, number],
    );
    const prescription = mapRow(result.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'prescription.signed',
        clinicId,
        prescription.id,
        {
          prescriptionId:     prescription.id,
          patientId:          prescription.patientId,
          prescriberId:       prescription.prescriberId,
          prescriptionNumber: prescription.prescriptionNumber,
        },
        { userId },
      );
      void eventBus.publish(
        'prescription.issued',
        clinicId,
        prescription.id,
        {
          prescriptionId:     prescription.id,
          patientId:          prescription.patientId,
          prescriberId:       prescription.prescriberId,
        },
        { userId },
      );
      emitToClinic(clinicId, 'prescription.updated', {
        prescriptionId: prescription.id,
        patientId:      prescription.patientId,
        status:         prescription.status,
      });
    });

    return prescription;
  });
}

export async function cancelPrescription(
  input:    CancelPrescriptionInput,
  clinicId: string,
  userId:   string,
): Promise<PrescriptionPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchById(client, input.id, clinicId);

    if (current.status === 'cancelada') {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Prescrição já está cancelada.' });
    }

    const result = await client.query<PrescriptionRow>(
      `UPDATE clinical.prescriptions
          SET status = 'cancelada',
              cancelled_at = NOW(),
              cancelled_by = $3,
              cancellation_reason = $4,
              updated_at = NOW(),
              updated_by = $3
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      [input.id, clinicId, userId, input.reason],
    );
    const prescription = mapRow(result.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'prescription.cancelled',
        clinicId,
        prescription.id,
        { prescriptionId: prescription.id, reason: input.reason },
        { userId },
      );
      emitToClinic(clinicId, 'prescription.updated', {
        prescriptionId: prescription.id,
        patientId:      prescription.patientId,
        status:         prescription.status,
      });
    });

    return prescription;
  });
}

export async function duplicatePrescription(
  sourceId: string,
  clinicId: string,
  userId:   string,
): Promise<PrescriptionPublic> {
  return withClinicContext(clinicId, async (client) => {
    const source = await fetchById(client, sourceId, clinicId);

    const result = await client.query<PrescriptionRow>(
      `INSERT INTO clinical.prescriptions
         (clinic_id, encounter_id, patient_id, prescriber_id, type, status,
          items, notes, valid_until, version, duplicated_from, created_by, updated_by)
       VALUES ($1, NULL, $2, $3, $4::clinical.prescription_type, 'rascunho',
               $5::jsonb, $6, NULL, 1, $7, $3, $3)
       RETURNING *`,
      [
        clinicId,
        source.patient_id,
        userId,
        source.type,
        JSON.stringify(source.items ?? []),
        source.notes,
        source.id,
      ],
    );
    const prescription = mapRow(result.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'prescription.duplicated',
        clinicId,
        prescription.id,
        {
          prescriptionId: prescription.id,
          duplicatedFrom: source.id,
          patientId:      prescription.patientId,
        },
        { userId },
      );
      emitToClinic(clinicId, 'prescription.updated', {
        prescriptionId: prescription.id,
        patientId:      prescription.patientId,
        status:         prescription.status,
      });
    });

    return prescription;
  });
}

/* ── Envio digital (mock) ─────────────────────────────────────────────── */

export async function sendPrescription(
  input:    SendPrescriptionInput,
  clinicId: string,
  userId:   string,
): Promise<{ prescription: PrescriptionPublic; deliveryId: string }> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchById(client, input.id, clinicId);

    if (current.status !== 'assinada' && current.status !== 'enviada_digital') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Assine a prescrição antes de enviá-la.',
      });
    }
    if (current.status === 'cancelada') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Prescrição cancelada não pode ser enviada.' });
    }

    const deliveryResult = await client.query<{ id: string }>(
      `INSERT INTO clinical.prescription_deliveries
         (clinic_id, prescription_id, provider_name, status, channel, recipient, payload, performed_by)
       VALUES ($1, $2, 'mock', 'sent_mock', $3, $4, $5::jsonb, $6)
       RETURNING id`,
      [
        clinicId,
        input.id,
        input.channel,
        input.recipient ?? null,
        JSON.stringify({ mock: true, sentAt: new Date().toISOString() }),
        userId,
      ],
    );
    const deliveryId = deliveryResult.rows[0]!.id;

    const updated = await client.query<PrescriptionRow>(
      `UPDATE clinical.prescriptions
          SET status = 'enviada_digital',
              delivery_status = 'sent_mock',
              delivery_method = $3,
              delivered_at = NOW(),
              delivery_payload = delivery_payload || jsonb_build_object(
                'lastDeliveryId', $4::text,
                'lastChannel',    $3::text,
                'lastSentAt',     NOW()::text
              ),
              updated_at = NOW(),
              updated_by = $5
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      [input.id, clinicId, input.channel, deliveryId, userId],
    );
    const prescription = mapRow(updated.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'prescription.sent',
        clinicId,
        prescription.id,
        {
          prescriptionId: prescription.id,
          deliveryId,
          channel:        input.channel,
          patientId:      prescription.patientId,
        },
        { userId },
      );
      emitToClinic(clinicId, 'prescription.updated', {
        prescriptionId: prescription.id,
        patientId:      prescription.patientId,
        status:         prescription.status,
      });
    });

    logger.info(
      { prescriptionId: prescription.id, deliveryId, channel: input.channel },
      'Prescription sent via mock provider',
    );

    return { prescription, deliveryId };
  });
}

/* ── Queries ─────────────────────────────────────────────────────────────── */

export async function getPrescriptionById(
  id:       string,
  clinicId: string,
): Promise<PrescriptionPublic> {
  const row = await fetchById(db, id, clinicId);
  return mapRow(row);
}

export async function listPrescriptionsByPatient(
  params:   ListPrescriptionsQuery,
  clinicId: string,
): Promise<PaginatedPrescriptions> {
  const where: string[] = ['clinic_id = $1', 'patient_id = $2'];
  const values: unknown[] = [clinicId, params.patientId];
  let idx = 3;

  if (params.status) { where.push(`status = $${idx++}::clinical.prescription_status`); values.push(params.status); }
  if (params.type)   { where.push(`type = $${idx++}::clinical.prescription_type`);     values.push(params.type); }

  const offset = (params.page - 1) * params.pageSize;

  const [countRes, dataRes] = await Promise.all([
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM clinical.prescriptions WHERE ${where.join(' AND ')}`,
      values,
    ),
    db.query<PrescriptionRow>(
      `SELECT * FROM clinical.prescriptions
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.pageSize, offset],
    ),
  ]);

  const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

  return {
    data:       dataRes.rows.map(mapSummary),
    total,
    page:       params.page,
    pageSize:   params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export interface PrescriberInfo {
  id:        string;
  name:      string;
  crm:       string | null;
  specialty: string | null;
}

export async function loadPrescriberInfo(
  userId: string,
  clinicId: string,
): Promise<PrescriberInfo> {
  const res = await db.query<{
    id: string; name: string; crm: string | null; specialty: string | null;
  }>(
    `SELECT id, name, crm, specialty
       FROM shared.users
      WHERE id = $1 AND clinic_id = $2`,
    [userId, clinicId],
  );
  const row = res.rows[0];
  if (!row) {
    return { id: userId, name: 'Profissional', crm: null, specialty: null };
  }
  return {
    id:        row.id,
    name:      row.name,
    crm:       row.crm,
    specialty: row.specialty,
  };
}

export interface PatientInfo {
  id:         string;
  name:       string;
  birthDate:  Date | null;
}

export async function loadPatientInfo(
  patientId: string,
  clinicId: string,
): Promise<PatientInfo> {
  const res = await db.query<{ id: string; name: string; birth_date: string | null }>(
    `SELECT id, name, birth_date FROM shared.patients
      WHERE id = $1 AND clinic_id = $2`,
    [patientId, clinicId],
  );
  const row = res.rows[0];
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado' });
  }
  return {
    id:        row.id,
    name:      decryptOptional(row.name) ?? 'Paciente',
    birthDate: row.birth_date ? new Date(row.birth_date) : null,
  };
}

export interface DeliveryHistoryEntry {
  id:           string;
  providerName: string;
  status:       PrescriptionDeliveryStatus;
  channel:      string | null;
  recipient:    string | null;
  performedAt:  Date;
  performedBy:  string | null;
  errorMessage: string | null;
}

export async function listDeliveryHistory(
  prescriptionId: string,
  clinicId: string,
): Promise<DeliveryHistoryEntry[]> {
  const res = await db.query<{
    id: string; provider_name: string; status: PrescriptionDeliveryStatus;
    channel: string | null; recipient: string | null; performed_at: string;
    performed_by: string | null; error_message: string | null;
  }>(
    `SELECT id, provider_name, status, channel, recipient, performed_at, performed_by, error_message
       FROM clinical.prescription_deliveries
      WHERE prescription_id = $1 AND clinic_id = $2
      ORDER BY performed_at DESC`,
    [prescriptionId, clinicId],
  );
  return res.rows.map((r) => ({
    id:           r.id,
    providerName: r.provider_name,
    status:       r.status,
    channel:      r.channel,
    recipient:    r.recipient,
    performedAt:  new Date(r.performed_at),
    performedBy:  r.performed_by,
    errorMessage: r.error_message,
  }));
}

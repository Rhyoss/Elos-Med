import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import type { PoolClient } from 'pg';
import { db, withClinicContext } from '../../../db/client.js';
import { logger } from '../../../lib/logger.js';
import { encrypt, encryptOptional, decryptOptional } from '../../../lib/crypto.js';
import { eventBus } from '../../../events/event-bus.js';
import { emitToClinic } from '../../../lib/socket.js';
import type {
  UpdateEncounterInput,
  AutoSaveEncounterInput,
  CorrectEncounterInput,
  EncounterDiagnosisInput,
  VitalSignsInput,
  EncounterListByPatientQuery,
  NextAppointmentHint,
} from '@dermaos/shared';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface EncounterRow {
  id:               string;
  clinic_id:        string;
  patient_id:       string;
  provider_id:      string;
  appointment_id:   string | null;
  type:             string;
  status:           string;
  chief_complaint:  string | null;
  subjective:       string | null;
  objective:        string | null;
  assessment:       string | null;
  plan:             string | null;
  diagnoses:        string[];
  structured_data:  Record<string, unknown>;
  attachments:      Array<{ url: string; type: string; label?: string }>;
  signed_at:        string | null;
  signed_by:        string | null;
  signature_hash:   string | null;
  created_at:       string;
  updated_at:       string;
  created_by:       string | null;
}

interface VitalSignRow {
  id:                 string;
  encounter_id:       string | null;
  weight_kg:          string | null;
  height_cm:          string | null;
  bmi:                string | null;
  blood_pressure_sys: number | null;
  blood_pressure_dia: number | null;
  heart_rate:         number | null;
  temperature_c:      string | null;
  oxygen_saturation:  number | null;
  notes:              string | null;
  recorded_at:        string;
}

export interface EncounterDiagnosis {
  code:        string;
  description: string;
  isPrimary:   boolean;
  aiGenerated: boolean;
  confidence?: number;
}

export interface EncounterVitalSigns {
  id:               string;
  bloodPressureSys: number | null;
  bloodPressureDia: number | null;
  heartRate:        number | null;
  temperatureC:     number | null;
  oxygenSaturation: number | null;
  weightKg:         number | null;
  heightCm:         number | null;
  bmi:              number | null;
  notes:            string | null;
  recordedAt:       Date;
}

export interface EncounterPublic {
  id:              string;
  clinicId:        string;
  patientId:       string;
  providerId:      string;
  appointmentId:   string | null;
  type:            string;
  status:          string;
  chiefComplaint:  string | null;
  subjective:      string | null;
  objective:       string | null;
  assessment:      string | null;
  plan:            string | null;
  internalNotes:   string | null;
  diagnoses:       EncounterDiagnosis[];
  nextAppointment: NextAppointmentHint | null;
  vitalSigns:      EncounterVitalSigns | null;
  attachments:     Array<{ url: string; type: string; label?: string }>;
  signedAt:        Date | null;
  signedBy:        string | null;
  signatureHash:   string | null;
  createdAt:       Date;
  updatedAt:       Date;
}

export interface EncounterSummary {
  id:             string;
  patientId:      string;
  providerId:     string;
  type:           string;
  status:         string;
  chiefComplaint: string | null;
  diagnoses:      EncounterDiagnosis[];
  signedAt:       Date | null;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface PaginatedEncounters {
  data:       EncounterSummary[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

interface StructuredDataShape {
  diagnoses?:        EncounterDiagnosisInput[];
  nextAppointment?:  NextAppointmentHint;
  internalNotes?:    string;
  [key: string]:     unknown;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function mapDiagnoses(structured: StructuredDataShape): EncounterDiagnosis[] {
  const raw = structured.diagnoses;
  if (!Array.isArray(raw)) return [];
  return raw.map((d) => ({
    code:        d.code,
    description: d.description,
    isPrimary:   d.isPrimary ?? false,
    aiGenerated: d.aiGenerated ?? false,
    confidence:  d.confidence,
  }));
}

function mapNextAppointment(structured: StructuredDataShape): NextAppointmentHint | null {
  const raw = structured.nextAppointment;
  if (!raw || typeof raw !== 'object') return null;
  return {
    enabled:      raw.enabled ?? false,
    intervalDays: raw.intervalDays,
    notes:        raw.notes,
  };
}

function mapVitalSignsRow(row: VitalSignRow): EncounterVitalSigns {
  return {
    id:               row.id,
    bloodPressureSys: row.blood_pressure_sys,
    bloodPressureDia: row.blood_pressure_dia,
    heartRate:        row.heart_rate,
    temperatureC:     row.temperature_c != null ? parseFloat(row.temperature_c) : null,
    oxygenSaturation: row.oxygen_saturation,
    weightKg:         row.weight_kg != null ? parseFloat(row.weight_kg) : null,
    heightCm:         row.height_cm != null ? parseFloat(row.height_cm) : null,
    bmi:              row.bmi != null ? parseFloat(row.bmi) : null,
    notes:            row.notes,
    recordedAt:       new Date(row.recorded_at),
  };
}

function mapRowToPublic(row: EncounterRow, vitalSigns: EncounterVitalSigns | null): EncounterPublic {
  const structured = (row.structured_data ?? {}) as StructuredDataShape;
  return {
    id:              row.id,
    clinicId:        row.clinic_id,
    patientId:       row.patient_id,
    providerId:      row.provider_id,
    appointmentId:   row.appointment_id,
    type:            row.type,
    status:          row.status,
    chiefComplaint:  decryptOptional(row.chief_complaint),
    subjective:      decryptOptional(row.subjective),
    objective:       decryptOptional(row.objective),
    assessment:      decryptOptional(row.assessment),
    plan:            decryptOptional(row.plan),
    internalNotes:   typeof structured.internalNotes === 'string' ? decryptOptional(structured.internalNotes) : null,
    diagnoses:       mapDiagnoses(structured),
    nextAppointment: mapNextAppointment(structured),
    vitalSigns,
    attachments:     Array.isArray(row.attachments) ? row.attachments : [],
    signedAt:        row.signed_at ? new Date(row.signed_at) : null,
    signedBy:        row.signed_by,
    signatureHash:   row.signature_hash,
    createdAt:       new Date(row.created_at),
    updatedAt:       new Date(row.updated_at),
  };
}

function mapRowToSummary(row: EncounterRow): EncounterSummary {
  const structured = (row.structured_data ?? {}) as StructuredDataShape;
  return {
    id:             row.id,
    patientId:      row.patient_id,
    providerId:     row.provider_id,
    type:           row.type,
    status:         row.status,
    chiefComplaint: decryptOptional(row.chief_complaint),
    diagnoses:      mapDiagnoses(structured),
    signedAt:       row.signed_at ? new Date(row.signed_at) : null,
    createdAt:      new Date(row.created_at),
    updatedAt:      new Date(row.updated_at),
  };
}

function computeSignatureHash(params: {
  encounterId: string;
  providerId:  string;
  subjective:  string | null;
  objective:   string | null;
  assessment:  string | null;
  plan:        string | null;
  diagnoses:   EncounterDiagnosis[];
  signedAt:    Date;
}): string {
  const payload = JSON.stringify({
    encounterId: params.encounterId,
    providerId:  params.providerId,
    subjective:  params.subjective ?? '',
    objective:   params.objective ?? '',
    assessment:  params.assessment ?? '',
    plan:        params.plan ?? '',
    diagnoses:   params.diagnoses.map((d) => ({ code: d.code, primary: d.isPrimary })),
    signedAt:    params.signedAt.toISOString(),
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function loadLatestVitalSigns(
  client: PoolClient | typeof db,
  encounterId: string,
  clinicId: string,
): Promise<EncounterVitalSigns | null> {
  const result = await client.query<VitalSignRow>(
    `SELECT id, encounter_id, weight_kg, height_cm, bmi, blood_pressure_sys,
            blood_pressure_dia, heart_rate, temperature_c, oxygen_saturation,
            notes, recorded_at
     FROM clinical.vital_signs
     WHERE encounter_id = $1 AND clinic_id = $2
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [encounterId, clinicId],
  );
  const row = result.rows[0];
  return row ? mapVitalSignsRow(row) : null;
}

async function fetchRowById(
  client: PoolClient,
  id: string,
  clinicId: string,
): Promise<EncounterRow> {
  const result = await client.query<EncounterRow>(
    `SELECT * FROM clinical.encounters
     WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Atendimento não encontrado' });
  }
  return row;
}

function assertEditable(row: EncounterRow): void {
  if (row.status === 'assinado') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Este prontuário foi assinado. Para alterá-lo, gere uma correção.',
    });
  }
}

function hasAnyFieldToWrite(input: Partial<UpdateEncounterInput & AutoSaveEncounterInput>): boolean {
  return (
    input.chiefComplaint !== undefined ||
    input.subjective     !== undefined ||
    input.objective      !== undefined ||
    input.assessment     !== undefined ||
    input.plan           !== undefined ||
    input.internalNotes  !== undefined ||
    input.diagnoses      !== undefined ||
    input.structuredData !== undefined ||
    input.vitalSigns     !== undefined ||
    ('nextAppointment' in input && input.nextAppointment !== undefined)
  );
}

/**
 * Aplica update genérico (create+update+autoSave compartilham esta lógica de escrita).
 * Retorna a row atualizada dentro da transação.
 */
async function applyEncounterUpdate(
  client: PoolClient,
  id: string,
  clinicId: string,
  current: EncounterRow,
  input: Partial<UpdateEncounterInput & AutoSaveEncounterInput>,
): Promise<EncounterRow> {
  const structuredCurrent = (current.structured_data ?? {}) as StructuredDataShape;
  const structuredNext: StructuredDataShape = { ...structuredCurrent };

  // diagnoses / nextAppointment / internalNotes são embutidos em structured_data (sem migration extra)
  if (input.diagnoses !== undefined) {
    structuredNext.diagnoses = input.diagnoses;
  }
  if (input.structuredData !== undefined) {
    for (const [k, v] of Object.entries(input.structuredData)) {
      if (k !== 'diagnoses' && k !== 'nextAppointment' && k !== 'internalNotes') {
        structuredNext[k] = v;
      }
    }
  }
  if ('nextAppointment' in input && input.nextAppointment !== undefined) {
    structuredNext.nextAppointment = input.nextAppointment;
  }
  if (input.internalNotes !== undefined) {
    structuredNext.internalNotes = input.internalNotes.length > 0
      ? encrypt(input.internalNotes)
      : undefined;
  }

  const setClauses: string[] = [];
  const values: unknown[]    = [id, clinicId];
  let   idx                  = 3;

  function addField(clause: string, value: unknown) {
    setClauses.push(`${clause} = $${idx++}`);
    values.push(value);
  }

  if (input.chiefComplaint !== undefined) addField('chief_complaint', encryptOptional(input.chiefComplaint));
  if (input.subjective     !== undefined) addField('subjective',      encryptOptional(input.subjective));
  if (input.objective      !== undefined) addField('objective',       encryptOptional(input.objective));
  if (input.assessment     !== undefined) addField('assessment',      encryptOptional(input.assessment));
  if (input.plan           !== undefined) addField('plan',            encryptOptional(input.plan));

  // diagnoses[] no banco (redundante com structured_data.diagnoses, usado para índice e busca)
  if (input.diagnoses !== undefined) {
    setClauses.push(`diagnoses = $${idx++}::text[]`);
    values.push(input.diagnoses.map((d) => d.code));
  }

  // structured_data sempre reescrito quando há mudança
  const structuredChanged =
    input.diagnoses !== undefined ||
    input.structuredData !== undefined ||
    input.internalNotes !== undefined ||
    ('nextAppointment' in input && input.nextAppointment !== undefined);
  if (structuredChanged) {
    addField('structured_data', JSON.stringify(structuredNext));
  }

  if (setClauses.length === 0) {
    return current;
  }

  setClauses.push('updated_at = NOW()');

  const result = await client.query<EncounterRow>(
    `UPDATE clinical.encounters SET ${setClauses.join(', ')}
     WHERE id = $1 AND clinic_id = $2
     RETURNING *`,
    values,
  );
  return result.rows[0]!;
}

async function upsertVitalSigns(
  client: PoolClient,
  encounterId: string,
  clinicId: string,
  patientId: string,
  userId: string,
  vs: VitalSignsInput,
): Promise<void> {
  // Sinais vitais são append-only. Fazemos INSERT de novo registro cada vez que
  // mudam (o leitor sempre pega o mais recente). Para evitar registros vazios
  // em auto-saves sem vitais, só inserimos se ao menos um campo foi fornecido.
  const hasAny =
    vs.bloodPressureSys !== undefined || vs.bloodPressureDia !== undefined ||
    vs.heartRate        !== undefined || vs.temperatureC     !== undefined ||
    vs.oxygenSaturation !== undefined || vs.weightKg         !== undefined ||
    vs.heightCm         !== undefined || (vs.notes && vs.notes.length > 0);

  if (!hasAny) return;

  // Upsert por encounter: atualizamos a medição mais recente do encontro ao
  // invés de empilhar N registros durante a digitação. Se já existir uma linha,
  // ela é atualizada; caso contrário, uma nova é criada.
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM clinical.vital_signs
     WHERE encounter_id = $1 AND clinic_id = $2
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [encounterId, clinicId],
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE clinical.vital_signs
       SET blood_pressure_sys = $3, blood_pressure_dia = $4,
           heart_rate = $5, temperature_c = $6, oxygen_saturation = $7,
           weight_kg = $8, height_cm = $9, notes = $10,
           recorded_at = NOW()
       WHERE id = $1 AND clinic_id = $2`,
      [
        existing.rows[0].id, clinicId,
        vs.bloodPressureSys ?? null, vs.bloodPressureDia ?? null,
        vs.heartRate ?? null, vs.temperatureC ?? null, vs.oxygenSaturation ?? null,
        vs.weightKg ?? null, vs.heightCm ?? null, vs.notes ?? null,
      ],
    );
    return;
  }

  await client.query(
    `INSERT INTO clinical.vital_signs
       (clinic_id, patient_id, encounter_id, recorded_by,
        blood_pressure_sys, blood_pressure_dia, heart_rate, temperature_c,
        oxygen_saturation, weight_kg, height_cm, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      clinicId, patientId, encounterId, userId,
      vs.bloodPressureSys ?? null, vs.bloodPressureDia ?? null,
      vs.heartRate ?? null, vs.temperatureC ?? null,
      vs.oxygenSaturation ?? null, vs.weightKg ?? null,
      vs.heightCm ?? null, vs.notes ?? null,
    ],
  );
}

/* ── Service functions ───────────────────────────────────────────────────── */

/**
 * Cria um encounter a partir de um appointment. O appointment é movido para
 * 'in_progress'. Idempotente: se já existe um encounter em rascunho para o
 * appointment, ele é retornado.
 */
export async function createEncounterFromAppointment(
  appointmentId: string,
  clinicId:      string,
  userId:        string,
): Promise<EncounterPublic> {
  return withClinicContext(clinicId, async (client) => {
    const appointment = await client.query<{
      id: string; patient_id: string; provider_id: string; status: string; type: string;
    }>(
      `SELECT id, patient_id, provider_id, status, type
       FROM shared.appointments
       WHERE id = $1 AND clinic_id = $2`,
      [appointmentId, clinicId],
    );
    if (!appointment.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado' });
    }

    const existing = await client.query<EncounterRow>(
      `SELECT * FROM clinical.encounters
       WHERE appointment_id = $1 AND clinic_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [appointmentId, clinicId],
    );

    let row: EncounterRow;
    if (existing.rows[0] && existing.rows[0].status !== 'corrigido') {
      row = existing.rows[0];
    } else {
      const apt = appointment.rows[0];
      const inserted = await client.query<EncounterRow>(
        `INSERT INTO clinical.encounters
           (clinic_id, patient_id, provider_id, appointment_id, type, status, created_by)
         VALUES ($1, $2, $3, $4, 'clinical', 'rascunho', $5)
         RETURNING *`,
        [clinicId, apt.patient_id, apt.provider_id, apt.id, userId],
      );
      row = inserted.rows[0]!;
    }

    if (appointment.rows[0].status !== 'in_progress') {
      await client.query(
        `UPDATE shared.appointments
         SET status = 'in_progress',
             status_history = status_history || jsonb_build_object(
               'status', 'in_progress',
               'changed_at', NOW(),
               'changed_by', $3::text,
               'reason', 'Atendimento iniciado'
             )::jsonb,
             updated_at = NOW()
         WHERE id = $1 AND clinic_id = $2`,
        [appointmentId, clinicId, userId],
      );
    }

    const vitalSigns = await loadLatestVitalSigns(client, row.id, clinicId);
    const encounter  = mapRowToPublic(row, vitalSigns);

    setImmediate(() => {
      void eventBus.publish(
        'encounter.started',
        clinicId,
        encounter.id,
        {
          encounterId:  encounter.id,
          appointmentId: appointmentId,
          patientId:    encounter.patientId,
          providerId:   encounter.providerId,
        },
        { userId },
      );
      emitToClinic(clinicId, 'encounter.updated', {
        encounterId: encounter.id,
        status:      encounter.status,
      });
    });

    return encounter;
  });
}

export async function updateEncounter(
  id:       string,
  data:     UpdateEncounterInput,
  clinicId: string,
  userId:   string,
): Promise<EncounterPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchRowById(client, id, clinicId);
    assertEditable(current);

    const updated = await applyEncounterUpdate(client, id, clinicId, current, data);

    if (data.vitalSigns) {
      await upsertVitalSigns(client, id, clinicId, current.patient_id, userId, data.vitalSigns);
    }

    const vitalSigns = await loadLatestVitalSigns(client, id, clinicId);
    const encounter  = mapRowToPublic(updated, vitalSigns);

    setImmediate(() => {
      emitToClinic(clinicId, 'encounter.updated', {
        encounterId: encounter.id,
        status:      encounter.status,
      });
    });

    return encounter;
  });
}

export interface AutoSaveResult {
  savedAt: Date;
  status:  string;
}

/**
 * Endpoint otimizado para saves frequentes (debounced no frontend).
 * Não valida obrigatoriedade — apenas persiste rascunho. Retorna timestamp
 * para o indicador visual no cliente.
 */
export async function autoSaveEncounter(
  id:       string,
  data:     AutoSaveEncounterInput,
  clinicId: string,
  userId:   string,
): Promise<AutoSaveResult> {
  if (!hasAnyFieldToWrite(data)) {
    const result = await db.query<{ updated_at: string; status: string }>(
      `SELECT updated_at, status FROM clinical.encounters
       WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId],
    );
    if (!result.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Atendimento não encontrado' });
    }
    return { savedAt: new Date(result.rows[0].updated_at), status: result.rows[0].status };
  }

  return withClinicContext(clinicId, async (client) => {
    const current = await fetchRowById(client, id, clinicId);
    assertEditable(current);

    const updated = await applyEncounterUpdate(client, id, clinicId, current, data);

    if (data.vitalSigns) {
      await upsertVitalSigns(client, id, clinicId, current.patient_id, userId, data.vitalSigns);
    }

    return { savedAt: new Date(updated.updated_at), status: updated.status };
  });
}

export async function signEncounter(
  id:         string,
  providerId: string,
  clinicId:   string,
  userId:     string,
): Promise<EncounterPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchRowById(client, id, clinicId);

    if (current.status === 'assinado') {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Atendimento já está assinado' });
    }

    // Validações clínicas obrigatórias na assinatura
    const assessment = decryptOptional(current.assessment);
    const plan       = decryptOptional(current.plan);
    const structured = (current.structured_data ?? {}) as StructuredDataShape;
    const diagnoses  = Array.isArray(structured.diagnoses) ? structured.diagnoses : [];

    if (!assessment || assessment.trim().length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Avaliação é obrigatória para assinatura' });
    }
    if (!plan || plan.trim().length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Plano é obrigatório para assinatura' });
    }
    if (diagnoses.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Adicione ao menos um diagnóstico CID antes de assinar' });
    }

    const signedAt      = new Date();
    const signatureHash = computeSignatureHash({
      encounterId: current.id,
      providerId,
      subjective:  decryptOptional(current.subjective),
      objective:   decryptOptional(current.objective),
      assessment,
      plan,
      diagnoses:   mapDiagnoses(structured),
      signedAt,
    });

    const updated = await client.query<EncounterRow>(
      `UPDATE clinical.encounters
       SET status = 'assinado',
           signed_at = $3,
           signed_by = $4,
           signature_hash = $5,
           updated_at = NOW()
       WHERE id = $1 AND clinic_id = $2
       RETURNING *`,
      [id, clinicId, signedAt, providerId, signatureHash],
    );

    // Finaliza o appointment vinculado, se houver
    if (current.appointment_id) {
      await client.query(
        `UPDATE shared.appointments
         SET status = 'completed',
             status_history = status_history || jsonb_build_object(
               'status', 'completed',
               'changed_at', NOW(),
               'changed_by', $3::text,
               'reason', 'Prontuário assinado'
             )::jsonb,
             updated_at = NOW()
         WHERE id = $1 AND clinic_id = $2`,
        [current.appointment_id, clinicId, userId],
      );
    }

    const vitalSigns = await loadLatestVitalSigns(client, id, clinicId);
    const encounter  = mapRowToPublic(updated.rows[0]!, vitalSigns);

    // Resolve serviceId do appointment vinculado (para consumo automático do kit)
    let signedServiceId: string | null = null;
    if (current.appointment_id) {
      const apptR = await client.query<{ service_id: string | null }>(
        `SELECT service_id FROM shared.appointments WHERE id = $1 AND clinic_id = $2`,
        [current.appointment_id, clinicId],
      );
      signedServiceId = apptR.rows[0]?.service_id ?? null;
    }

    setImmediate(() => {
      void eventBus.publish(
        'encounter.signed',
        clinicId,
        encounter.id,
        {
          encounterId: encounter.id,
          patientId:   encounter.patientId,
          providerId:  encounter.providerId,
          serviceId:   signedServiceId,
        },
        { userId },
      );
      if (current.appointment_id) {
        void eventBus.publish(
          'appointment.completed',
          clinicId,
          current.appointment_id,
          {
            appointmentId: current.appointment_id,
            patientId:     encounter.patientId,
            providerId:    encounter.providerId,
          },
          { userId },
        );
      }
      emitToClinic(clinicId, 'encounter.updated', {
        encounterId: encounter.id,
        status:      encounter.status,
      });
    });

    return encounter;
  });
}

export async function correctEncounter(
  input:    CorrectEncounterInput,
  clinicId: string,
  userId:   string,
): Promise<EncounterPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchRowById(client, input.id, clinicId);

    if (current.status !== 'assinado') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Apenas prontuários assinados podem ser corrigidos',
      });
    }

    // Preserva versão original como attachment (snapshot imutável) antes de sobrescrever.
    const snapshot = {
      url:   `snapshot://encounter/${current.id}/${current.updated_at}`,
      type:  'correction_snapshot',
      label: `Versão assinada em ${current.signed_at}`,
      payload: {
        chiefComplaint: current.chief_complaint,
        subjective:     current.subjective,
        objective:      current.objective,
        assessment:     current.assessment,
        plan:           current.plan,
        diagnoses:      current.diagnoses,
        structuredData: current.structured_data,
        signedAt:       current.signed_at,
        signedBy:       current.signed_by,
        signatureHash:  current.signature_hash,
      },
      justification: input.justification,
      correctedAt:   new Date().toISOString(),
      correctedBy:   userId,
    };

    const nextAttachments = [...(current.attachments ?? []), snapshot];

    const updated = await applyEncounterUpdate(client, input.id, clinicId, current, input.correction);

    await client.query(
      `UPDATE clinical.encounters
       SET status = 'corrigido',
           attachments = $3::jsonb,
           updated_at = NOW()
       WHERE id = $1 AND clinic_id = $2`,
      [input.id, clinicId, JSON.stringify(nextAttachments)],
    );

    const finalRow = await fetchRowById(client, input.id, clinicId);
    void updated;
    const vitalSigns = await loadLatestVitalSigns(client, input.id, clinicId);
    const encounter  = mapRowToPublic(finalRow, vitalSigns);

    setImmediate(() => {
      emitToClinic(clinicId, 'encounter.updated', {
        encounterId: encounter.id,
        status:      encounter.status,
      });
    });

    return encounter;
  });
}

export async function getEncounterById(
  id:       string,
  clinicId: string,
): Promise<EncounterPublic> {
  const row = await db.query<EncounterRow>(
    `SELECT * FROM clinical.encounters
     WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId],
  );
  if (!row.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Atendimento não encontrado' });
  }
  const vitalSigns = await loadLatestVitalSigns(db, id, clinicId);
  return mapRowToPublic(row.rows[0], vitalSigns);
}

export async function listEncountersByPatient(
  params:   EncounterListByPatientQuery,
  clinicId: string,
): Promise<PaginatedEncounters> {
  const offset = (params.page - 1) * params.pageSize;

  const [countResult, dataResult] = await Promise.all([
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM clinical.encounters
       WHERE clinic_id = $1 AND patient_id = $2`,
      [clinicId, params.patientId],
    ),
    db.query<EncounterRow>(
      `SELECT * FROM clinical.encounters
       WHERE clinic_id = $1 AND patient_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [clinicId, params.patientId, params.pageSize, offset],
    ),
  ]);

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  return {
    data:       dataResult.rows.map(mapRowToSummary),
    total,
    page:       params.page,
    pageSize:   params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}

/* ── CID-10 autocomplete ────────────────────────────────────────────────── */

export interface Cid10Entry {
  code:        string;
  description: string;
  category:    string | null;
}

export async function searchCid10(query: string, limit = 15): Promise<Cid10Entry[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  try {
    const result = await db.query<{ code: string; description: string; category: string | null }>(
      `SELECT code, description, category
       FROM clinical.cid10_codes
       WHERE search_text ILIKE $1
       ORDER BY
         CASE WHEN LOWER(code) = $2 THEN 0
              WHEN LOWER(code) LIKE $3 THEN 1
              ELSE 2 END,
         code
       LIMIT $4`,
      [`%${q}%`, q, `${q}%`, limit],
    );
    return result.rows;
  } catch (err) {
    logger.warn({ err }, 'CID-10 search failed');
    return [];
  }
}

import { TRPCError } from '@trpc/server';
import type { PoolClient } from 'pg';
import { db, withClinicContext } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { decryptOptional } from '../../lib/crypto.js';
import { eventBus } from '../../events/event-bus.js';
import { emitToClinic } from '../../lib/socket.js';
import {
  scheduleConfigSchema,
  type DayKey,
  type ScheduleConfig,
  type CreateAppointmentInput,
  type ConfirmInput,
  type CancelInput,
  type RescheduleInput,
} from './scheduling.schema.js';

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface SlotWindow {
  start:     Date;
  end:       Date;
  available: boolean;
}

export interface AppointmentRow {
  id:                  string;
  clinic_id:           string;
  patient_id:          string;
  provider_id:         string;
  service_id:          string | null;
  type:                string;
  scheduled_at:        string;
  duration_min:        number;
  room:                string | null;
  status:              string;
  status_history:      Array<{ status: string; changed_at: string; changed_by: string | null; reason?: string; via?: string }>;
  source:              string;
  conversation_id:     string | null;
  price:               string | null;
  patient_notes:       string | null;
  internal_notes:      string | null;
  confirmed_at:        string | null;
  confirmed_via:       string | null;
  cancelled_at:        string | null;
  cancellation_reason: string | null;
  created_at:          string;
  updated_at:          string;
  created_by:          string | null;
}

export interface AppointmentPublic {
  id:              string;
  patientId:       string;
  providerId:      string;
  serviceId:       string | null;
  type:            string;
  scheduledAt:     Date;
  durationMin:     number;
  endsAt:          Date;
  room:            string | null;
  status:          string;
  statusHistory:   AppointmentRow['status_history'];
  source:          string;
  conversationId:  string | null;
  price:           number | null;
  patientNotes:    string | null;
  internalNotes:   string | null;
  confirmedAt:     Date | null;
  confirmedVia:    string | null;
  cancelledAt:     Date | null;
  cancellationReason: string | null;
  createdAt:       Date;
  updatedAt:       Date;
}

export interface AgendaAppointmentCard extends AppointmentPublic {
  patient: {
    id:           string;
    name:         string;
    photoUrl:     string | null;
    age:          number | null;
    allergiesSummary: string;
    allergiesCount:   number;
  };
  provider: {
    id:   string;
    name: string;
  };
  service: {
    id:   string;
    name: string;
  } | null;
}

export interface WaitQueueEntry {
  appointmentId:  string;
  patientId:      string;
  patientName:    string;
  patientPhotoUrl: string | null;
  scheduledAt:    Date;
  checkedInAt:    Date;
  waitingMinutes: number;
  providerId:     string;
  providerName:   string;
  serviceName:    string | null;
  status:         string;
}

/* ── Constants ───────────────────────────────────────────────────────────── */

const ACTIVE_STATUSES = ['scheduled', 'confirmed', 'waiting', 'in_progress'];

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function dayKeyOf(date: Date): DayKey {
  return DAY_KEYS[date.getDay()]!;
}

function parseHhmmOn(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const result = new Date(date);
  result.setHours(h ?? 0, m ?? 0, 0, 0);
  return result;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function parseScheduleConfig(raw: unknown): ScheduleConfig {
  const parsed = scheduleConfigSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  // Fallback: agenda padrão 08:00–18:00 Seg a Sex, almoço 12:00–13:00
  return {
    slotSizeMin: 15,
    bufferMin:   0,
    workingHours: {
      mon: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      tue: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      wed: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      thu: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      fri: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
    },
  };
}

function mapRow(row: AppointmentRow): AppointmentPublic {
  const scheduledAt = new Date(row.scheduled_at);
  return {
    id:              row.id,
    patientId:       row.patient_id,
    providerId:      row.provider_id,
    serviceId:       row.service_id,
    type:            row.type,
    scheduledAt,
    durationMin:     row.duration_min,
    endsAt:          addMinutes(scheduledAt, row.duration_min),
    room:            row.room,
    status:          row.status,
    statusHistory:   row.status_history ?? [],
    source:          row.source,
    conversationId:  row.conversation_id,
    price:           row.price ? parseFloat(row.price) : null,
    patientNotes:    row.patient_notes,
    internalNotes:   row.internal_notes,
    confirmedAt:     row.confirmed_at ? new Date(row.confirmed_at) : null,
    confirmedVia:    row.confirmed_via,
    cancelledAt:     row.cancelled_at ? new Date(row.cancelled_at) : null,
    cancellationReason: row.cancellation_reason,
    createdAt:       new Date(row.created_at),
    updatedAt:       new Date(row.updated_at),
  };
}

function allergiesSummary(allergies: string[]): { summary: string; count: number } {
  const count = allergies?.length ?? 0;
  if (count === 0) return { summary: '', count: 0 };
  const shown = allergies.slice(0, 2).join(', ');
  const rest  = count - 2;
  return { summary: rest > 0 ? `${shown} +${rest}` : shown, count };
}

function calcAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

/* ── Availability & slot calculation ─────────────────────────────────────── */

async function fetchProviderConfig(
  client: PoolClient,
  providerId: string,
  clinicId: string,
): Promise<ScheduleConfig> {
  const result = await client.query<{ schedule_config: unknown }>(
    `SELECT schedule_config
       FROM shared.users
      WHERE id = $1 AND clinic_id = $2 AND is_active = true`,
    [providerId, clinicId],
  );
  if (!result.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Profissional não encontrado' });
  }
  return parseScheduleConfig(result.rows[0].schedule_config);
}

async function fetchActiveAppointments(
  client: PoolClient,
  providerId: string,
  clinicId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Array<{ start: Date; end: Date }>> {
  const result = await client.query<{ scheduled_at: string; duration_min: number }>(
    `SELECT scheduled_at, duration_min
       FROM shared.appointments
      WHERE clinic_id = $1
        AND provider_id = $2
        AND scheduled_at >= $3
        AND scheduled_at <  $4
        AND status = ANY($5::shared.appointment_status[])`,
    [clinicId, providerId, rangeStart, rangeEnd, ACTIVE_STATUSES],
  );
  return result.rows.map((r) => {
    const start = new Date(r.scheduled_at);
    return { start, end: addMinutes(start, r.duration_min) };
  });
}

export async function getAvailableSlots(
  providerId: string,
  date:       Date,
  durationMin: number,
  clinicId:   string,
): Promise<SlotWindow[]> {
  return withClinicContext(clinicId, async (client) => {
    const config = await fetchProviderConfig(client, providerId, clinicId);
    const day    = config.workingHours[dayKeyOf(date)];

    if (!day) {
      return [];
    }

    const dayStart = parseHhmmOn(date, day.start);
    const dayEnd   = parseHhmmOn(date, day.end);
    const breaks   = (day.breaks ?? []).map((b) => ({
      start: parseHhmmOn(date, b.start),
      end:   parseHhmmOn(date, b.end),
    }));

    // Busca janela do dia inteiro para detectar conflitos que atravessam fronteiras
    const existing = await fetchActiveAppointments(
      client,
      providerId,
      clinicId,
      startOfDay(date),
      endOfDay(date),
    );

    const slots: SlotWindow[] = [];
    const slotStep = config.slotSizeMin;
    let cursor = new Date(dayStart);

    while (addMinutes(cursor, durationMin) <= dayEnd) {
      const start = new Date(cursor);
      const end   = addMinutes(cursor, durationMin);

      const inBreak     = breaks.some((b) => rangesOverlap(start, end, b.start, b.end));
      const inBooking   = existing.some((a) => rangesOverlap(start, end, a.start, a.end));
      const inThePast   = end <= new Date();

      slots.push({ start, end, available: !inBreak && !inBooking && !inThePast });

      cursor = addMinutes(cursor, slotStep);
    }

    return slots;
  });
}

/* ── Create with optimistic lock ─────────────────────────────────────────── */

export async function createAppointment(
  input:    CreateAppointmentInput,
  clinicId: string,
  userId:   string,
): Promise<AppointmentPublic> {
  return withClinicContext(clinicId, async (client) => {
    const start = new Date(input.scheduledAt);
    const end   = addMinutes(start, input.durationMin);

    // Pega lock advisor para evitar que múltiplas criações concorrentes no mesmo
    // par (provider, janela) escapem do check. Hash chave estável → bigint 64bit.
    const lockKeyText = `${clinicId}:${input.providerId}:${start.toISOString()}`;
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [lockKeyText],
    );

    // Conflito com outro agendamento do mesmo médico
    const providerConflict = await client.query<{ id: string }>(
      `SELECT id
         FROM shared.appointments
        WHERE clinic_id   = $1
          AND provider_id = $2
          AND status = ANY($3::shared.appointment_status[])
          AND tstzrange(scheduled_at, scheduled_at + (duration_min || ' minutes')::interval, '[)')
              && tstzrange($4::timestamptz, $5::timestamptz, '[)')
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [clinicId, input.providerId, ACTIVE_STATUSES, start, end],
    );
    if (providerConflict.rows[0]) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Horário indisponível — selecione outro',
      });
    }

    // Conflito com outro agendamento do paciente
    const patientConflict = await client.query<{ id: string }>(
      `SELECT id
         FROM shared.appointments
        WHERE clinic_id  = $1
          AND patient_id = $2
          AND status = ANY($3::shared.appointment_status[])
          AND tstzrange(scheduled_at, scheduled_at + (duration_min || ' minutes')::interval, '[)')
              && tstzrange($4::timestamptz, $5::timestamptz, '[)')
        LIMIT 1`,
      [clinicId, input.patientId, ACTIVE_STATUSES, start, end],
    );
    if (patientConflict.rows[0]) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Paciente já possui agendamento neste horário',
      });
    }

    // Walk-in pula validação de schedule (paciente apareceu sem agendamento prévio).
    // Para os demais sources, valida sobreposição com expediente/break configurado.
    if (input.source !== 'walk_in') {
      const config = await fetchProviderConfig(client, input.providerId, clinicId);
      const day    = config.workingHours[dayKeyOf(start)];
      if (!day) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Profissional não atende neste dia da semana',
        });
      }
      const dayStart = parseHhmmOn(start, day.start);
      const dayEnd   = parseHhmmOn(start, day.end);
      if (start < dayStart || end > dayEnd) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Horário fora do expediente do profissional',
        });
      }
      for (const br of day.breaks ?? []) {
        const bStart = parseHhmmOn(start, br.start);
        const bEnd   = parseHhmmOn(start, br.end);
        if (rangesOverlap(start, end, bStart, bEnd)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Horário conflita com intervalo do profissional',
          });
        }
      }
    }

    const historyEntry = {
      status:     'scheduled',
      changed_at: new Date().toISOString(),
      changed_by: userId,
    };

    // Normaliza source — 'aura_ai' não existe no enum; mapeia para 'manual' e preserva conversationId
    const dbSource = input.source === 'aura_ai' ? 'manual' : input.source;

    const result = await client.query<AppointmentRow>(
      `INSERT INTO shared.appointments (
         clinic_id, patient_id, provider_id, service_id,
         type, scheduled_at, duration_min, room,
         status, status_history, source, conversation_id,
         price, patient_notes, internal_notes,
         created_by
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8,
         'scheduled', $9::jsonb, $10::shared.appointment_source, $11,
         $12, $13, $14,
         $15
       )
       RETURNING *`,
      [
        clinicId, input.patientId, input.providerId, input.serviceId ?? null,
        input.type, start, input.durationMin, input.room ?? null,
        JSON.stringify([historyEntry]), dbSource, input.conversationId ?? null,
        input.price ?? null, input.patientNotes ?? null, input.internalNotes ?? null,
        userId,
      ],
    );

    const appointment = mapRow(result.rows[0]!);

    setImmediate(() => {
      void eventBus.publish(
        'appointment.scheduled',
        clinicId,
        appointment.id,
        {
          appointmentId: appointment.id,
          patientId:     appointment.patientId,
          providerId:    appointment.providerId,
          scheduledAt:   appointment.scheduledAt.toISOString(),
          source:        input.source,
        },
        { userId },
      );
      emitToClinic(clinicId, 'appointment.created', {
        appointmentId: appointment.id,
        providerId:    appointment.providerId,
        scheduledAt:   appointment.scheduledAt.toISOString(),
      });
    });

    return appointment;
  });
}

/* ── Status transitions ──────────────────────────────────────────────────── */

async function transition(
  id:         string,
  clinicId:   string,
  userId:     string,
  targetStatus: string,
  extra: {
    columns?: Record<string, unknown>;
    allowedFrom?: string[];
    reason?: string;
    via?: string;
  } = {},
): Promise<AppointmentPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await client.query<AppointmentRow>(
      `SELECT * FROM shared.appointments WHERE id = $1 AND clinic_id = $2 FOR UPDATE`,
      [id, clinicId],
    );
    if (!current.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado' });
    }
    const row = current.rows[0];

    if (extra.allowedFrom && !extra.allowedFrom.includes(row.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Transição inválida: ${row.status} → ${targetStatus}`,
      });
    }

    const historyEntry: Record<string, unknown> = {
      status:     targetStatus,
      changed_at: new Date().toISOString(),
      changed_by: userId,
    };
    if (extra.reason) historyEntry.reason = extra.reason;
    if (extra.via)    historyEntry.via    = extra.via;

    const extraCols = extra.columns ?? {};
    const assignments: string[] = [
      `status = $3::shared.appointment_status`,
      `status_history = COALESCE(status_history, '[]'::jsonb) || $4::jsonb`,
    ];
    const values: unknown[] = [id, clinicId, targetStatus, JSON.stringify([historyEntry])];
    let idx = 5;
    for (const [col, val] of Object.entries(extraCols)) {
      assignments.push(`${col} = $${idx++}`);
      values.push(val);
    }

    const result = await client.query<AppointmentRow>(
      `UPDATE shared.appointments
          SET ${assignments.join(', ')}
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      values,
    );

    return mapRow(result.rows[0]!);
  });
}

export async function confirmAppointment(
  input:    ConfirmInput,
  clinicId: string,
  userId:   string,
): Promise<AppointmentPublic> {
  const appointment = await transition(input.id, clinicId, userId, 'confirmed', {
    allowedFrom: ['scheduled'],
    via:         input.via,
    columns: {
      confirmed_at:  new Date(),
      confirmed_via: input.via,
    },
  });

  setImmediate(() => {
    void eventBus.publish(
      'appointment.confirmed',
      clinicId,
      appointment.id,
      { appointmentId: appointment.id, via: input.via },
      { userId },
    );
    emitToClinic(clinicId, 'appointment.updated', {
      appointmentId: appointment.id,
      status:        appointment.status,
    });
  });
  return appointment;
}

export async function checkInAppointment(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<AppointmentPublic> {
  const appointment = await transition(id, clinicId, userId, 'waiting', {
    allowedFrom: ['scheduled', 'confirmed'],
  });

  setImmediate(() => {
    emitToClinic(clinicId, 'appointment.checked_in', {
      appointmentId: appointment.id,
      checkedInAt:   new Date().toISOString(),
      providerId:    appointment.providerId,
    });
    emitToClinic(clinicId, 'appointment.updated', {
      appointmentId: appointment.id,
      status:        appointment.status,
    });
  });
  return appointment;
}

export async function startAppointment(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<AppointmentPublic> {
  const appointment = await transition(id, clinicId, userId, 'in_progress', {
    allowedFrom: ['waiting', 'confirmed', 'scheduled'],
  });

  setImmediate(() => {
    void eventBus.publish(
      'encounter.started',
      clinicId,
      appointment.id,
      { appointmentId: appointment.id, patientId: appointment.patientId, providerId: appointment.providerId },
      { userId },
    );
    emitToClinic(clinicId, 'appointment.updated', {
      appointmentId: appointment.id,
      status:        appointment.status,
    });
  });
  return appointment;
}

export async function completeAppointment(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<AppointmentPublic> {
  const appointment = await transition(id, clinicId, userId, 'completed', {
    allowedFrom: ['in_progress', 'waiting', 'confirmed', 'scheduled'],
  });

  setImmediate(() => {
    void eventBus.publish(
      'appointment.completed',
      clinicId,
      appointment.id,
      { appointmentId: appointment.id, patientId: appointment.patientId, providerId: appointment.providerId },
      { userId },
    );
    emitToClinic(clinicId, 'appointment.updated', {
      appointmentId: appointment.id,
      status:        appointment.status,
    });
  });
  return appointment;
}

export async function cancelAppointment(
  input:    CancelInput,
  clinicId: string,
  userId:   string,
): Promise<AppointmentPublic> {
  const appointment = await transition(input.id, clinicId, userId, 'cancelled', {
    allowedFrom: ['scheduled', 'confirmed', 'waiting'],
    reason:      input.reason,
    columns: {
      cancelled_at:        new Date(),
      cancellation_reason: input.reason,
    },
  });

  setImmediate(() => {
    void eventBus.publish(
      'appointment.cancelled',
      clinicId,
      appointment.id,
      { appointmentId: appointment.id, reason: input.reason, cancelledBy: userId },
      { userId },
    );
    emitToClinic(clinicId, 'appointment.updated', {
      appointmentId: appointment.id,
      status:        appointment.status,
    });
  });
  return appointment;
}

export async function markNoShow(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<AppointmentPublic> {
  const appointment = await transition(id, clinicId, userId, 'no_show', {
    allowedFrom: ['scheduled', 'confirmed', 'waiting'],
  });

  setImmediate(() => {
    void eventBus.publish(
      'appointment.no_show',
      clinicId,
      appointment.id,
      { appointmentId: appointment.id, patientId: appointment.patientId },
      { userId },
    );
    emitToClinic(clinicId, 'appointment.updated', {
      appointmentId: appointment.id,
      status:        appointment.status,
    });
  });
  return appointment;
}

export async function rescheduleAppointment(
  input:    RescheduleInput,
  clinicId: string,
  userId:   string,
): Promise<{ cancelled: AppointmentPublic; created: AppointmentPublic }> {
  // Busca o atual para criar um novo com os mesmos metadados
  const existing = await db.query<AppointmentRow>(
    `SELECT * FROM shared.appointments WHERE id = $1 AND clinic_id = $2`,
    [input.id, clinicId],
  );
  if (!existing.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Agendamento não encontrado' });
  }
  const src = existing.rows[0];

  const cancelled = await transition(input.id, clinicId, userId, 'rescheduled', {
    allowedFrom: ['scheduled', 'confirmed', 'waiting'],
    reason:      input.reason ?? 'Remarcado pelo usuário',
    columns: {
      cancelled_at:        new Date(),
      cancellation_reason: input.reason ?? 'Remarcado pelo usuário',
    },
  });

  const created = await createAppointment(
    {
      patientId:      src.patient_id,
      providerId:     src.provider_id,
      serviceId:      src.service_id ?? undefined,
      type:           src.type,
      scheduledAt:    input.newScheduledAt,
      durationMin:    input.newDurationMin ?? src.duration_min,
      room:           src.room ?? undefined,
      source:         (src.source as CreateAppointmentInput['source']) ?? 'manual',
      conversationId: src.conversation_id ?? undefined,
      price:          src.price ? parseFloat(src.price) : undefined,
      internalNotes:  `Remarcado de ${new Date(src.scheduled_at).toISOString()}`,
    },
    clinicId,
    userId,
  );

  setImmediate(() => {
    void eventBus.publish(
      'appointment.rescheduled',
      clinicId,
      created.id,
      {
        previousId: cancelled.id,
        newId:      created.id,
        patientId:  created.patientId,
        providerId: created.providerId,
      },
      { userId },
    );
  });

  return { cancelled, created };
}

/* ── Agenda queries ──────────────────────────────────────────────────────── */

interface AgendaQueryRow extends AppointmentRow {
  patient_name:        string | null;
  patient_photo_url:   string | null;
  patient_birth_date:  string | null;
  patient_allergies:   string[];
  provider_name:       string | null;
  service_name:        string | null;
}

async function fetchAgendaRange(
  clinicId:  string,
  rangeStart: Date,
  rangeEnd:  Date,
  providerId: string | undefined,
): Promise<AgendaAppointmentCard[]> {
  const params: unknown[] = [clinicId, rangeStart, rangeEnd];
  let providerFilter = '';
  if (providerId) {
    params.push(providerId);
    providerFilter = `AND a.provider_id = $${params.length}`;
  }

  const result = await db.query<AgendaQueryRow>(
    `SELECT a.*,
            p.name       AS patient_name,
            p.photo_url  AS patient_photo_url,
            p.birth_date AS patient_birth_date,
            p.allergies  AS patient_allergies,
            u.name       AS provider_name,
            s.name       AS service_name
       FROM shared.appointments a
       JOIN shared.patients p ON p.id = a.patient_id
       JOIN shared.users    u ON u.id = a.provider_id
       LEFT JOIN shared.services s ON s.id = a.service_id
      WHERE a.clinic_id    = $1
        AND a.scheduled_at >= $2
        AND a.scheduled_at <  $3
        ${providerFilter}
      ORDER BY a.scheduled_at ASC`,
    params,
  );

  return result.rows.map((row) => {
    const base = mapRow(row);
    const rawName = decryptOptional(row.patient_name) ?? row.patient_name ?? 'Paciente';
    const birthDate = row.patient_birth_date ? new Date(row.patient_birth_date) : null;
    const { summary, count } = allergiesSummary(row.patient_allergies ?? []);
    return {
      ...base,
      patient: {
        id:       row.patient_id,
        name:     rawName,
        photoUrl: row.patient_photo_url,
        age:      calcAge(birthDate),
        allergiesSummary: summary,
        allergiesCount:   count,
      },
      provider: {
        id:   row.provider_id,
        name: row.provider_name ?? 'Profissional',
      },
      service: row.service_id
        ? { id: row.service_id, name: row.service_name ?? 'Serviço' }
        : null,
    };
  });
}

export async function getAgendaDay(
  clinicId:   string,
  date:       Date,
  providerId: string | undefined,
): Promise<AgendaAppointmentCard[]> {
  return fetchAgendaRange(clinicId, startOfDay(date), addMinutes(endOfDay(date), 1), providerId);
}

export async function getAgendaWeek(
  clinicId:   string,
  startDate:  Date,
  providerId: string | undefined,
): Promise<AgendaAppointmentCard[]> {
  const start = startOfDay(startDate);
  const end   = addMinutes(start, 7 * 24 * 60);
  return fetchAgendaRange(clinicId, start, end, providerId);
}

/* ── Wait queue ──────────────────────────────────────────────────────────── */

export async function getWaitQueue(clinicId: string): Promise<WaitQueueEntry[]> {
  const result = await db.query<AgendaQueryRow>(
    `SELECT a.*,
            p.name       AS patient_name,
            p.photo_url  AS patient_photo_url,
            p.birth_date AS patient_birth_date,
            p.allergies  AS patient_allergies,
            u.name       AS provider_name,
            s.name       AS service_name
       FROM shared.appointments a
       JOIN shared.patients p ON p.id = a.patient_id
       JOIN shared.users    u ON u.id = a.provider_id
       LEFT JOIN shared.services s ON s.id = a.service_id
      WHERE a.clinic_id = $1
        AND a.status IN ('waiting', 'in_progress')
      ORDER BY
        CASE a.status WHEN 'in_progress' THEN 0 ELSE 1 END,
        (
          SELECT MAX((h->>'changed_at')::timestamptz)
            FROM jsonb_array_elements(a.status_history) AS h
           WHERE h->>'status' = 'waiting'
        ) ASC NULLS LAST,
        a.scheduled_at ASC`,
    [clinicId],
  );

  const now = Date.now();

  return result.rows.map((row) => {
    const rawName = decryptOptional(row.patient_name) ?? row.patient_name ?? 'Paciente';
    // Determina hora de check-in a partir do status_history
    const history = row.status_history ?? [];
    const checkInEntry = [...history].reverse().find((h) => h.status === 'waiting');
    const checkedInAt  = checkInEntry
      ? new Date(checkInEntry.changed_at)
      : new Date(row.scheduled_at);
    const waitingMinutes = Math.max(
      0,
      Math.floor((now - checkedInAt.getTime()) / 60_000),
    );
    return {
      appointmentId:  row.id,
      patientId:      row.patient_id,
      patientName:    rawName,
      patientPhotoUrl: row.patient_photo_url,
      scheduledAt:    new Date(row.scheduled_at),
      checkedInAt,
      waitingMinutes,
      providerId:     row.provider_id,
      providerName:   row.provider_name ?? 'Profissional',
      serviceName:    row.service_name,
      status:         row.status,
    };
  });
}

/* ── Patient picker data ─────────────────────────────────────────────────── */

export interface ProviderSummary {
  id:    string;
  name:  string;
  role:  string;
  crm:   string | null;
}

export async function listProviders(clinicId: string): Promise<ProviderSummary[]> {
  const result = await db.query<{ id: string; name: string; role: string; crm: string | null }>(
    `SELECT id, name, role, crm
       FROM shared.users
      WHERE clinic_id = $1 AND is_active = true
        AND role IN ('dermatologist', 'nurse')
      ORDER BY name ASC`,
    [clinicId],
  );
  return result.rows;
}

export interface ServiceSummary {
  id:          string;
  name:        string;
  durationMin: number;
  price:       number | null;
  category:    string | null;
  color:       string | null;
}

export async function listServices(clinicId: string): Promise<ServiceSummary[]> {
  const result = await db.query<{
    id: string; name: string; duration_min: number; price: string | null;
    category: string | null; color: string | null;
  }>(
    `SELECT id, name, duration_min, price, category, color
       FROM shared.services
      WHERE clinic_id = $1 AND is_active = true
      ORDER BY name ASC`,
    [clinicId],
  );
  return result.rows.map((r) => ({
    id:          r.id,
    name:        r.name,
    durationMin: r.duration_min,
    price:       r.price ? parseFloat(r.price) : null,
    category:    r.category,
    color:       r.color,
  }));
}

/* ── Scheduling holds (Aurora — Anexo A §A.2.2 / §A.2.3) ─────────────────── */

const HOLD_TTL_DEFAULT_S = 180;
const HOLD_TTL_MAX_S     = 600;

export interface ReserveTentativeSlotInput {
  providerId:     string;
  scheduledAt:    Date;
  durationMin:    number;
  clinicId:       string;
  conversationId: string;
  ttlSeconds:     number;
}

export interface ReserveTentativeSlotResult {
  holdToken: string;
  expiresAt: Date;
}

export interface ConfirmHeldSlotInput {
  holdToken:      string;
  clinicId:       string;
  patientId:      string;
  serviceId:      string;
  conversationId: string;
}

export class SchedulingHoldConflictError extends Error {
  constructor(message = 'Horário indisponível — selecione outro') {
    super(message);
    this.name = 'SchedulingHoldConflictError';
  }
}

export class SchedulingHoldExpiredError extends Error {
  constructor(message = 'Reserva tentativa expirada') {
    super(message);
    this.name = 'SchedulingHoldExpiredError';
  }
}

export class SchedulingHoldNotFoundError extends Error {
  constructor(message = 'Reserva tentativa não encontrada') {
    super(message);
    this.name = 'SchedulingHoldNotFoundError';
  }
}

/**
 * Reserva tentativa (TTL curto) sem criar Appointment.
 * Idempotente por (clinic_id, provider_id, scheduled_at). Não persiste PHI.
 */
export async function reserveTentativeSlot(
  input: ReserveTentativeSlotInput,
): Promise<ReserveTentativeSlotResult> {
  const ttl = Math.min(
    Math.max(1, Math.trunc(input.ttlSeconds || HOLD_TTL_DEFAULT_S)),
    HOLD_TTL_MAX_S,
  );
  const scheduledAt = input.scheduledAt;
  const end         = addMinutes(scheduledAt, input.durationMin);

  return withClinicContext(input.clinicId, async (client) => {
    // Serializa tentativas concorrentes no mesmo par (provider, slot)
    const lockKeyText = `${input.clinicId}:${input.providerId}:${scheduledAt.toISOString()}`;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKeyText]);

    // Conflito com appointment já existente
    const appointmentConflict = await client.query<{ id: string }>(
      `SELECT id
         FROM shared.appointments
        WHERE clinic_id   = $1
          AND provider_id = $2
          AND status = ANY($3::shared.appointment_status[])
          AND tstzrange(scheduled_at, scheduled_at + (duration_min || ' minutes')::interval, '[)')
              && tstzrange($4::timestamptz, $5::timestamptz, '[)')
        LIMIT 1`,
      [input.clinicId, input.providerId, ACTIVE_STATUSES, scheduledAt, end],
    );
    if (appointmentConflict.rows[0]) {
      throw new SchedulingHoldConflictError();
    }

    // Limpa hold expirado no mesmo slot (unique constraint impede duplicata)
    await client.query(
      `DELETE FROM shared.scheduling_holds
        WHERE clinic_id   = $1
          AND provider_id = $2
          AND scheduled_at = $3
          AND expires_at  <= NOW()`,
      [input.clinicId, input.providerId, scheduledAt],
    );

    const insert = await client.query<{ hold_token: string; expires_at: string }>(
      `INSERT INTO shared.scheduling_holds (
         clinic_id, provider_id, conversation_id,
         scheduled_at, duration_min, expires_at
       ) VALUES (
         $1, $2, $3,
         $4, $5, NOW() + ($6 || ' seconds')::interval
       )
       ON CONFLICT (clinic_id, provider_id, scheduled_at) DO NOTHING
       RETURNING hold_token, expires_at`,
      [
        input.clinicId, input.providerId, input.conversationId,
        scheduledAt, input.durationMin, String(ttl),
      ],
    );

    if (!insert.rows[0]) {
      // Já existe hold ativo (não expirado) para este slot
      throw new SchedulingHoldConflictError();
    }

    return {
      holdToken: insert.rows[0].hold_token,
      expiresAt: new Date(insert.rows[0].expires_at),
    };
  });
}

/**
 * Confirma um hold em Appointment definitivo. Atomicamente:
 *   1. SELECT FOR UPDATE no hold; valida expires_at > now()
 *   2. pg_advisory_xact_lock(clinic_id, provider_id, scheduled_at)
 *   3. revalida ausência de conflito em shared.appointments
 *   4. INSERT shared.appointments (source='whatsapp', conversation_id, status='scheduled')
 *   5. DELETE do hold
 *   6. Emite audit.domain_events `appointment.created_via_aurora`
 */
export async function confirmHeldSlot(
  input: ConfirmHeldSlotInput,
): Promise<AppointmentPublic> {
  const appointment = await withClinicContext(input.clinicId, async (client) => {
    // 1. Lock + validação do hold
    const held = await client.query<{
      clinic_id: string;
      provider_id: string;
      scheduled_at: string;
      duration_min: number;
      expires_at: string;
    }>(
      `SELECT clinic_id, provider_id, scheduled_at, duration_min, expires_at
         FROM shared.scheduling_holds
        WHERE hold_token = $1 AND clinic_id = $2
        FOR UPDATE`,
      [input.holdToken, input.clinicId],
    );
    if (!held.rows[0]) {
      throw new SchedulingHoldNotFoundError();
    }
    const hold = held.rows[0];
    if (new Date(hold.expires_at) <= new Date()) {
      throw new SchedulingHoldExpiredError();
    }

    const scheduledAt = new Date(hold.scheduled_at);
    const endsAt      = addMinutes(scheduledAt, hold.duration_min);

    // 2. Advisory lock no par (provider, slot) — mesmo esquema de createAppointment
    const lockKeyText = `${hold.clinic_id}:${hold.provider_id}:${scheduledAt.toISOString()}`;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKeyText]);

    // 3. Revalida ausência de conflito em appointments
    const conflict = await client.query<{ id: string }>(
      `SELECT id
         FROM shared.appointments
        WHERE clinic_id   = $1
          AND provider_id = $2
          AND status = ANY($3::shared.appointment_status[])
          AND tstzrange(scheduled_at, scheduled_at + (duration_min || ' minutes')::interval, '[)')
              && tstzrange($4::timestamptz, $5::timestamptz, '[)')
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [hold.clinic_id, hold.provider_id, ACTIVE_STATUSES, scheduledAt, endsAt],
    );
    if (conflict.rows[0]) {
      throw new SchedulingHoldConflictError();
    }

    // 4. INSERT appointment (source whatsapp, origem na conversation da Aurora)
    const historyEntry = {
      status:     'scheduled',
      changed_at: new Date().toISOString(),
      changed_by: null,
      via:        'aurora',
    };
    const result = await client.query<AppointmentRow>(
      `INSERT INTO shared.appointments (
         clinic_id, patient_id, provider_id, service_id,
         type, scheduled_at, duration_min,
         status, status_history, source, conversation_id,
         created_by
       ) VALUES (
         $1, $2, $3, $4,
         'consultation', $5, $6,
         'scheduled', $7::jsonb, 'whatsapp', $8,
         NULL
       )
       RETURNING *`,
      [
        hold.clinic_id, input.patientId, hold.provider_id, input.serviceId,
        scheduledAt, hold.duration_min,
        JSON.stringify([historyEntry]), input.conversationId,
      ],
    );

    // 5. DELETE do hold consumido
    await client.query(
      `DELETE FROM shared.scheduling_holds WHERE hold_token = $1`,
      [input.holdToken],
    );

    return mapRow(result.rows[0]!);
  });

  // 6. audit.domain_events + realtime (fora da transação — best-effort)
  setImmediate(() => {
    void eventBus.publish(
      'appointment.created_via_aurora',
      input.clinicId,
      appointment.id,
      {
        appointmentId:  appointment.id,
        patientId:      appointment.patientId,
        providerId:     appointment.providerId,
        scheduledAt:    appointment.scheduledAt.toISOString(),
        conversationId: input.conversationId,
        holdToken:      input.holdToken,
      },
    );
    emitToClinic(input.clinicId, 'appointment.created', {
      appointmentId: appointment.id,
      providerId:    appointment.providerId,
      scheduledAt:   appointment.scheduledAt.toISOString(),
    });
  });

  return appointment;
}

/** Libera hold (paciente desistiu, timeout interno do bot, fluxo abortado). */
export async function releaseHold(holdToken: string, clinicId: string): Promise<void> {
  await withClinicContext(clinicId, async (client) => {
    await client.query(
      `DELETE FROM shared.scheduling_holds WHERE hold_token = $1 AND clinic_id = $2`,
      [holdToken, clinicId],
    );
  });
}

/**
 * Limpeza periódica de holds expirados. Roda em dermaos_worker (sem RLS).
 * Não depende de withClinicContext — faz DELETE global por expires_at < NOW().
 */
export async function deleteExpiredHolds(): Promise<number> {
  const result = await db.query<{ hold_token: string }>(
    `DELETE FROM shared.scheduling_holds WHERE expires_at < NOW() RETURNING hold_token`,
  );
  if (result.rowCount && result.rowCount > 0) {
    logger.info({ deleted: result.rowCount }, 'scheduling_holds.expired_cleanup');
  }
  return result.rowCount ?? 0;
}

/* ── Health / debug ──────────────────────────────────────────────────────── */

export async function pingScheduling(): Promise<boolean> {
  try {
    await db.query('SELECT 1');
    return true;
  } catch (err) {
    logger.error({ err }, 'Scheduling ping failed');
    return false;
  }
}

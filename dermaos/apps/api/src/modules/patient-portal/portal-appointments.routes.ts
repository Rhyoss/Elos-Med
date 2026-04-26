import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { verifyPortalToken } from './portal-middleware.js';
import {
  portalGetSlotsSchema,
  portalCreateHoldSchema,
  portalBookAppointmentSchema,
  appointmentsFilterSchema,
} from './portal.schemas.js';

const HOLD_TTL_MIN = 5; // reserva temporária de slot

export async function registerPortalAppointmentRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /portal/appointments ──────────────────────────────────────────────────
  // Histórico de consultas do paciente. Sem notas clínicas.
  app.get('/appointments', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const parsed = appointmentsFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parâmetros inválidos.' });
    }

    const { page, limit, filter } = parsed.data;
    const { id: patientId } = req.portalPatient;
    const offset = (page - 1) * limit;

    let timeFilter = '';
    if (filter === 'upcoming') timeFilter = "AND a.scheduled_at > NOW()";
    if (filter === 'past')     timeFilter = "AND a.scheduled_at <= NOW()";

    const [rows, countResult] = await Promise.all([
      db.query<{
        id: string; scheduled_at: string; duration_min: number;
        provider_name: string; service_name: string | null; status: string;
        type: string;
      }>(
        `SELECT a.id, a.scheduled_at, a.duration_min, a.status, a.type,
                u.name     AS provider_name,
                s.name     AS service_name
         FROM shared.appointments a
         JOIN shared.users         u ON u.id = a.provider_id
         LEFT JOIN shared.services s ON s.id = a.service_id
         WHERE a.patient_id = $1 ${timeFilter}
         ORDER BY a.scheduled_at DESC
         LIMIT $2 OFFSET $3`,
        [patientId, limit, offset],
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*)::TEXT AS count
         FROM shared.appointments
         WHERE patient_id = $1 ${timeFilter}`,
        [patientId],
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    return reply.send({
      data: rows.rows.map((r) => ({
        id:           r.id,
        scheduledAt:  r.scheduled_at,
        durationMin:  r.duration_min,
        status:       r.status,
        type:         r.type,
        providerName: r.provider_name,
        serviceName:  r.service_name,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // ── GET /portal/appointments/providers ───────────────────────────────────────
  // Profissionais disponíveis para agendamento online
  app.get('/appointments/providers', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { clinicId } = req.portalPatient;

    const r = await db.query<{
      id: string; name: string; specialty: string | null; avatar_url: string | null;
    }>(
      `SELECT id, name, specialty, avatar_url
       FROM shared.users
       WHERE clinic_id = $1
         AND is_active  = TRUE
         AND role IN ('dermatologist', 'nurse')
         AND (schedule_config->>'allowOnlineBooking')::boolean IS NOT FALSE
       ORDER BY name`,
      [clinicId],
    );

    return reply.send({ providers: r.rows });
  });

  // ── GET /portal/appointments/services ────────────────────────────────────────
  app.get('/appointments/services', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { clinicId } = req.portalPatient;

    const r = await db.query<{
      id: string; name: string; description: string | null;
      duration_min: number; category: string | null;
    }>(
      `SELECT id, name, description, duration_min, category
       FROM shared.services
       WHERE clinic_id = $1 AND is_active = TRUE AND allow_online = TRUE
       ORDER BY category NULLS LAST, name`,
      [clinicId],
    );

    return reply.send({ services: r.rows });
  });

  // ── GET /portal/appointments/slots ───────────────────────────────────────────
  // Slots disponíveis para um profissional em uma data
  app.get('/appointments/slots', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const parsed = portalGetSlotsSchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parâmetros inválidos.' });
    }

    const { providerId, date } = parsed.data;
    const { clinicId } = req.portalPatient;

    // Validar que data não é no passado
    const requestedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      return reply.status(400).send({ error: 'Não é possível agendar em datas passadas.' });
    }

    // Buscar config de agenda do profissional
    const providerResult = await db.query<{
      schedule_config: Record<string, unknown>;
    }>(
      'SELECT schedule_config FROM shared.users WHERE id = $1 AND clinic_id = $2 AND is_active = TRUE',
      [providerId, clinicId],
    );

    if (!providerResult.rows[0]) {
      return reply.status(404).send({ error: 'Profissional não encontrado.' });
    }

    // Buscar appointments já agendados para o dia
    const bookedResult = await db.query<{ scheduled_at: string; duration_min: number }>(
      `SELECT scheduled_at, duration_min
       FROM shared.appointments
       WHERE clinic_id   = $1
         AND provider_id = $2
         AND scheduled_at::DATE = $3::DATE
         AND status NOT IN ('cancelled', 'no_show')`,
      [clinicId, providerId, date],
    );

    // Buscar holds ativos
    const holdsResult = await db.query<{ scheduled_at: string }>(
      `SELECT scheduled_at
       FROM shared.scheduling_holds
       WHERE clinic_id   = $1
         AND provider_id = $2
         AND scheduled_at::DATE = $3::DATE
         AND expires_at > NOW()`,
      [clinicId, providerId, date],
    );

    // Gerar slots disponíveis baseado na config do profissional
    const slots = generateAvailableSlots(
      date,
      providerResult.rows[0].schedule_config,
      bookedResult.rows,
      holdsResult.rows.map((h) => h.scheduled_at),
    );

    return reply.send({ slots });
  });

  // ── POST /portal/appointments/hold ───────────────────────────────────────────
  // Reserva temporária de slot (5 minutos) antes de confirmar
  app.post('/appointments/hold', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const parsed = portalCreateHoldSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos.' });
    }

    const { providerId, scheduledAt } = parsed.data;
    const { id: patientId, clinicId } = req.portalPatient;

    // Não permitir agendamento no passado
    if (new Date(scheduledAt) <= new Date()) {
      return reply.status(400).send({ error: 'Horário inválido.' });
    }

    // Verificar se o slot ainda está disponível
    const conflict = await db.query(
      `SELECT 1 FROM shared.appointments
       WHERE clinic_id   = $1
         AND provider_id = $2
         AND ABS(EXTRACT(EPOCH FROM (scheduled_at - $3::TIMESTAMPTZ))) < 900
         AND status NOT IN ('cancelled', 'no_show')
       UNION ALL
       SELECT 1 FROM shared.scheduling_holds
       WHERE clinic_id   = $1
         AND provider_id = $2
         AND ABS(EXTRACT(EPOCH FROM (scheduled_at - $3::TIMESTAMPTZ))) < 900
         AND expires_at > NOW()
       LIMIT 1`,
      [clinicId, providerId, scheduledAt],
    );

    if (conflict.rows.length > 0) {
      return reply.status(409).send({
        error: 'Este horário não está mais disponível.',
        code:  'SLOT_TAKEN',
      });
    }

    // Verificar limite de agendamentos ativos por paciente
    const activeAppt = await db.query(
      `SELECT id FROM shared.appointments
       WHERE patient_id = $1
         AND scheduled_at > NOW()
         AND status NOT IN ('cancelled', 'no_show')
       LIMIT 1`,
      [patientId],
    );

    if (activeAppt.rows.length > 0) {
      return reply.status(409).send({
        error:             'Você já possui um agendamento ativo.',
        code:              'ACTIVE_APPOINTMENT_EXISTS',
        appointmentId:     activeAppt.rows[0].id,
      });
    }

    const expiresAt = new Date(Date.now() + HOLD_TTL_MIN * 60 * 1000);

    const holdResult = await db.query<{ id: string }>(
      `INSERT INTO shared.scheduling_holds
         (clinic_id, provider_id, patient_id, scheduled_at, expires_at, source)
       VALUES ($1, $2, $3, $4, $5, 'patient_portal')
       RETURNING id`,
      [clinicId, providerId, patientId, scheduledAt, expiresAt],
    );

    return reply.status(201).send({
      holdId:    holdResult.rows[0]!.id,
      expiresAt: expiresAt.toISOString(),
    });
  });

  // ── DELETE /portal/appointments/hold/:id ─────────────────────────────────────
  app.delete('/appointments/hold/:id', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { id: patientId } = req.portalPatient;

    await db.query(
      'DELETE FROM shared.scheduling_holds WHERE id = $1 AND patient_id = $2',
      [id, patientId],
    );

    return reply.send({ ok: true });
  });

  // ── POST /portal/appointments ─────────────────────────────────────────────────
  // Confirmar agendamento usando o hold
  app.post('/appointments', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const parsed = portalBookAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos.' });
    }

    const { holdId, notes } = parsed.data;
    const { id: patientId, clinicId } = req.portalPatient;

    // Buscar hold com lock
    const holdResult = await db.query<{
      id: string; provider_id: string; scheduled_at: string; expires_at: string;
    }>(
      `SELECT id, provider_id, scheduled_at, expires_at
       FROM shared.scheduling_holds
       WHERE id = $1 AND patient_id = $2 AND clinic_id = $3 AND expires_at > NOW()
       FOR UPDATE SKIP LOCKED`,
      [holdId, patientId, clinicId],
    );

    if (!holdResult.rows[0]) {
      return reply.status(409).send({
        error: 'A reserva expirou. Por favor, selecione um novo horário.',
        code:  'HOLD_EXPIRED',
      });
    }

    const hold = holdResult.rows[0]!;

    // Verificar conflito just-in-time
    const conflict = await db.query(
      `SELECT 1 FROM shared.appointments
       WHERE clinic_id   = $1
         AND provider_id = $2
         AND ABS(EXTRACT(EPOCH FROM (scheduled_at - $3::TIMESTAMPTZ))) < 900
         AND status NOT IN ('cancelled', 'no_show')
       LIMIT 1`,
      [clinicId, hold.provider_id, hold.scheduled_at],
    );

    if (conflict.rows.length > 0) {
      await db.query('DELETE FROM shared.scheduling_holds WHERE id = $1', [holdId]);
      return reply.status(409).send({
        error: 'Este horário foi reservado por outra pessoa. Por favor, escolha um novo horário.',
        code:  'SLOT_TAKEN',
      });
    }

    // Criar appointment
    const apptResult = await db.query<{ id: string }>(
      `INSERT INTO shared.appointments
         (clinic_id, patient_id, provider_id, scheduled_at, type, status, source, patient_notes)
       VALUES ($1, $2, $3, $4, 'consultation', 'scheduled', 'patient_portal', $5)
       RETURNING id`,
      [clinicId, patientId, hold.provider_id, hold.scheduled_at, notes ?? null],
    );

    // Remover hold
    await db.query('DELETE FROM shared.scheduling_holds WHERE id = $1', [holdId]);

    return reply.status(201).send({
      appointmentId: apptResult.rows[0]!.id,
      scheduledAt:   hold.scheduled_at,
    });
  });

  // ── DELETE /portal/appointments/:id ──────────────────────────────────────────
  // Cancelar agendamento
  app.delete('/appointments/:id', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { id: patientId } = req.portalPatient;

    const r = await db.query<{
      id: string; patient_id: string; status: string; scheduled_at: string;
    }>(
      'SELECT id, patient_id, status, scheduled_at FROM shared.appointments WHERE id = $1',
      [id],
    );

    if (!r.rows[0]) {
      return reply.status(403).send({ error: 'Acesso não autorizado.' });
    }

    if (r.rows[0].patient_id !== patientId) {
      return reply.status(403).send({ error: 'Acesso não autorizado.' });
    }

    if (['completed', 'cancelled', 'in_progress'].includes(r.rows[0].status)) {
      return reply.status(400).send({ error: 'Não é possível cancelar esta consulta.' });
    }

    await db.query(
      `UPDATE shared.appointments
       SET status = 'cancelled', cancelled_at = NOW(),
           cancellation_reason = 'Cancelado pelo paciente via portal',
           updated_at = NOW()
       WHERE id = $1`,
      [id],
    );

    return reply.send({ ok: true });
  });
}

// ─── Geração de slots disponíveis ────────────────────────────────────────────

interface BookedSlot { scheduled_at: string; duration_min: number }

function generateAvailableSlots(
  dateStr: string,
  scheduleConfig: Record<string, unknown>,
  booked: BookedSlot[],
  holdStarts: string[],
): Array<{ start: string; end: string }> {
  const dayMap: Record<number, string> = {
    0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
  };

  const date    = new Date(`${dateStr}T00:00:00`);
  const dayKey  = dayMap[date.getDay()]!;
  const wh      = (scheduleConfig['workingHours'] as Record<string, unknown> | undefined)?.[dayKey] as
    | { start: string; end: string; breaks?: Array<{ start: string; end: string }> }
    | undefined;

  if (!wh) return [];

  const slotMin = (scheduleConfig['slotSizeMin'] as number | undefined) ?? 15;
  const bufMin  = (scheduleConfig['bufferMin'] as number | undefined) ?? 0;
  const step    = slotMin + bufMin;

  function parseTime(hhmm: string): Date {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(`${dateStr}T00:00:00`);
    d.setHours(h!, m!, 0, 0);
    return d;
  }

  const start = parseTime(wh.start);
  const end   = parseTime(wh.end);

  const slots: Array<{ start: string; end: string }> = [];
  const cursor = new Date(start);

  while (true) {
    const slotEnd = new Date(cursor.getTime() + slotMin * 60_000);
    if (slotEnd > end) break;

    // Verificar se é no futuro
    if (cursor <= new Date()) {
      cursor.setTime(cursor.getTime() + step * 60_000);
      continue;
    }

    // Verificar breaks
    const inBreak = (wh.breaks ?? []).some((b) => {
      const bs = parseTime(b.start);
      const be = parseTime(b.end);
      return cursor >= bs && cursor < be;
    });

    // Verificar conflito com agendamentos
    const hasConflict = booked.some((a) => {
      const as = new Date(a.scheduled_at);
      const ae = new Date(as.getTime() + a.duration_min * 60_000);
      return cursor < ae && slotEnd > as;
    });

    // Verificar holds ativos
    const hasHold = holdStarts.some((h) => {
      const hs = new Date(h);
      const he = new Date(hs.getTime() + slotMin * 60_000);
      return cursor < he && slotEnd > hs;
    });

    if (!inBreak && !hasConflict && !hasHold) {
      slots.push({
        start: cursor.toISOString(),
        end:   slotEnd.toISOString(),
      });
    }

    cursor.setTime(cursor.getTime() + step * 60_000);
  }

  return slots;
}

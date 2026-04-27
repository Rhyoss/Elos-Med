import { z } from 'zod';

export const dayKeySchema = z.enum(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
export type DayKey = z.infer<typeof dayKeySchema>;

/**
 * Intervalo HH:MM (24h) — string leve para caber em JSONB do schedule_config.
 */
export const hhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM 24h)');

const workingDaySchema = z.object({
  start:  hhmmSchema,
  end:    hhmmSchema,
  breaks: z.array(z.object({ start: hhmmSchema, end: hhmmSchema })).default([]),
});

export const scheduleConfigSchema = z.object({
  workingHours: z.record(dayKeySchema, workingDaySchema).default({}),
  slotSizeMin:  z.number().int().min(5).max(120).default(15),
  bufferMin:    z.number().int().min(0).max(120).default(0),
});

export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;

/* ── Inputs ────────────────────────────────────────────────────────────────── */

export const getSlotsInputSchema = z.object({
  providerId: z.string().uuid(),
  date:       z.coerce.date(),
  durationMin: z.number().int().min(5).max(480).default(30),
});

export const createAppointmentInputSchema = z.object({
  patientId:      z.string().uuid(),
  providerId:     z.string().uuid(),
  serviceId:      z.string().uuid().optional(),
  type:           z.string().min(1).max(100).default('consultation'),
  scheduledAt:    z.coerce.date(),
  durationMin:    z.number().int().min(5).max(480).default(30),
  room:           z.string().max(50).optional(),
  source: z
    .enum(['manual', 'online_booking', 'whatsapp', 'phone', 'walk_in', 'referral', 'aura_ai'])
    .default('manual'),
  conversationId: z.string().uuid().optional(),
  price:          z.number().nonnegative().optional(),
  patientNotes:   z.string().max(2000).optional(),
  internalNotes:  z.string().max(2000).optional(),
});

export const cancelInputSchema = z.object({
  id:     z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export const confirmInputSchema = z.object({
  id:  z.string().uuid(),
  via: z.enum(['whatsapp', 'email', 'phone', 'app', 'manual']).default('manual'),
});

export const rescheduleInputSchema = z.object({
  id:            z.string().uuid(),
  newScheduledAt: z.coerce.date(),
  newDurationMin: z.number().int().min(5).max(480).optional(),
  reason:        z.string().max(500).optional(),
});

export const agendaDayInputSchema = z.object({
  date:       z.coerce.date(),
  providerId: z.string().uuid().optional(),
});

export const agendaWeekInputSchema = z.object({
  startDate:  z.coerce.date(),
  providerId: z.string().uuid().optional(),
});

export type GetSlotsInput         = z.infer<typeof getSlotsInputSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentInputSchema>;
export type CancelInput           = z.infer<typeof cancelInputSchema>;
export type ConfirmInput          = z.infer<typeof confirmInputSchema>;
export type RescheduleInput       = z.infer<typeof rescheduleInputSchema>;
export type AgendaDayInput        = z.infer<typeof agendaDayInputSchema>;
export type AgendaWeekInput       = z.infer<typeof agendaWeekInputSchema>;

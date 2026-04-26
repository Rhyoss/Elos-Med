import { z } from 'zod';

export const appointmentStatusSchema = z.enum([
  'scheduled',
  'confirmed',
  'waiting',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'rescheduled',
]);

export const appointmentSourceSchema = z.enum([
  'manual',
  'online_booking',
  'whatsapp',
  'phone',
  'walk_in',
  'referral',
]);

export const createAppointmentSchema = z.object({
  patientId:      z.string().uuid('ID de paciente inválido'),
  providerId:     z.string().uuid('ID de profissional inválido'),
  serviceId:      z.string().uuid().optional(),
  type:           z.string().min(1).max(100).default('consultation'),
  scheduledAt:    z.coerce.date(),
  durationMin:    z.number().int().positive().min(5).max(480).default(30),
  room:           z.string().max(50).optional(),
  source:         appointmentSourceSchema.default('manual'),
  price:          z.number().nonnegative().optional(),
  patientNotes:   z.string().max(2000).optional(),
  internalNotes:  z.string().max(2000).optional(),
});

export const updateAppointmentSchema = createAppointmentSchema
  .omit({ patientId: true, providerId: true })
  .partial();

export const cancelAppointmentSchema = z.object({
  reason: z.string().min(1, 'Motivo do cancelamento é obrigatório').max(500),
});

export const appointmentListQuerySchema = z.object({
  date:        z.coerce.date().optional(),
  dateFrom:    z.coerce.date().optional(),
  dateTo:      z.coerce.date().optional(),
  providerId:  z.string().uuid().optional(),
  patientId:   z.string().uuid().optional(),
  status:      appointmentStatusSchema.optional(),
  page:        z.coerce.number().int().positive().default(1),
  pageSize:    z.coerce.number().int().positive().max(100).default(20),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type AppointmentListQuery   = z.infer<typeof appointmentListQuerySchema>;

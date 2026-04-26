import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const portalLoginSchema = z.object({
  email:          z.string().email(),
  password:       z.string().min(1).max(128),
  clinicSlug:     z.string().min(1).max(64),
  captchaToken:   z.string().optional(),
});

export const portalSetPasswordSchema = z.object({
  token:       z.string().min(32),
  password:    z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(128)
    .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve ter pelo menos um número'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export const portalChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve ter pelo menos um número'),
});

export const portalForgotPasswordSchema = z.object({
  email:      z.string().email(),
  clinicSlug: z.string().min(1),
});

// ─── Scheduling ───────────────────────────────────────────────────────────────

export const portalGetSlotsSchema = z.object({
  providerId: z.string().uuid(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId:  z.string().uuid().optional(),
});

export const portalCreateHoldSchema = z.object({
  providerId:  z.string().uuid(),
  scheduledAt: z.string().datetime(),
  serviceId:   z.string().uuid().optional(),
});

export const portalBookAppointmentSchema = z.object({
  holdId:      z.string().uuid(),
  notes:       z.string().max(500).optional(),
});

// ─── Messages ─────────────────────────────────────────────────────────────────

export const portalCreateMessageSchema = z.object({
  body:    z.string().min(1).max(2000),
  subject: z.string().max(200).optional(),
});

export const portalReplySchema = z.object({
  body: z.string().min(1).max(2000),
});

// ─── Profile ──────────────────────────────────────────────────────────────────

export const portalUpdateProfileSchema = z.object({
  phone:   z.string()
    .regex(/^\+?[\d\s\-().]{8,20}$/, 'Telefone inválido')
    .optional(),
  address: z.object({
    street:     z.string().max(200).optional(),
    number:     z.string().max(20).optional(),
    complement: z.string().max(100).optional(),
    district:   z.string().max(100).optional(),
    city:       z.string().max(100).optional(),
    state:      z.string().length(2).optional(),
    zip:        z.string().regex(/^\d{5}-?\d{3}$/).optional(),
  }).optional(),
}).refine((d) => d.phone !== undefined || d.address !== undefined, {
  message: 'Informe pelo menos um campo para atualizar',
});

export const portalRequestEmailChangeSchema = z.object({
  newEmail: z.string().email(),
});

// ─── Push ─────────────────────────────────────────────────────────────────────

export const portalPushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
});

// ─── Pagination ───────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export const appointmentsFilterSchema = paginationSchema.extend({
  filter: z.enum(['upcoming', 'past', 'all']).default('all'),
});

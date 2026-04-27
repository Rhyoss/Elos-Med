import { z } from 'zod';
import { USER_ROLES } from '../constants/roles';
import { isValidCNPJ } from '../utils/validators';

// ─── Clínica ─────────────────────────────────────────────────────────────────

export const addressSchema = z.object({
  street:     z.string().min(1).max(200).trim(),
  number:     z.string().min(1).max(20).trim(),
  complement: z.string().max(100).trim().optional(),
  district:   z.string().min(1).max(100).trim(),
  city:       z.string().min(1).max(100).trim(),
  state:      z.string().length(2).toUpperCase(),
  zip:        z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos numéricos.'),
});
export type SettingsAddress = z.infer<typeof addressSchema>;

export const updateClinicSchema = z.object({
  name:      z.string().min(1, 'Nome obrigatório.').max(200).trim().optional(),
  cnpj:      z.string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 14, 'CNPJ deve ter 14 dígitos.')
    .refine((v) => isValidCNPJ(v), 'CNPJ inválido (dígitos verificadores).')
    .optional(),
  cnes:      z.string().regex(/^\d{7}$/, 'CNES deve ter exatamente 7 dígitos numéricos.').optional(),
  email:     z.string().email('E-mail inválido.').optional(),
  phone:     z.string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 10 || v.length === 11, 'Telefone deve ter DDD + número (10 ou 11 dígitos).')
    .optional(),
  address:   addressSchema.optional(),
  dpo_name:  z.string().min(1, 'Nome do DPO obrigatório.').max(200).trim().optional(),
  dpo_email: z.string().email('E-mail do DPO inválido.').optional(),
});
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;

export const updateTimezoneSchema = z.object({
  timezone: z.string().min(1, 'Timezone obrigatório.').max(100),
});
export type UpdateTimezoneInput = z.infer<typeof updateTimezoneSchema>;

const shiftSchema = z
  .object({
    start: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido (formato HH:MM).'),
    end:   z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido (formato HH:MM).'),
  })
  .refine((s) => s.start < s.end, { message: 'Horário de fim deve ser posterior ao início.' });

export const businessHoursDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isOpen:    z.boolean(),
  shifts:    z.array(shiftSchema).min(1, 'Ao menos um turno obrigatório.').max(3),
});

export const updateBusinessHoursSchema = z.object({
  hours: z.array(businessHoursDaySchema).length(7, 'Todos os 7 dias devem ser configurados.'),
});
export type UpdateBusinessHoursInput = z.infer<typeof updateBusinessHoursSchema>;

// ─── Usuários ─────────────────────────────────────────────────────────────────

export const PERMISSION_MODULES = [
  'patients', 'appointments', 'clinical',
  'financial', 'supply', 'omni', 'analytics', 'settings',
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = ['read', 'write', 'delete', 'export'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const permissionEntrySchema = z.object({
  module:  z.enum(PERMISSION_MODULES),
  action:  z.enum(PERMISSION_ACTIONS),
  granted: z.boolean(),
});
export type PermissionEntry = z.infer<typeof permissionEntrySchema>;

export const listUsersSchema = z.object({
  role:   z.enum(USER_ROLES).optional(),
  status: z.enum(['active', 'inactive', 'locked']).optional(),
  page:   z.number().int().positive().default(1),
  limit:  z.number().int().positive().max(100).default(25),
});
export type ListUsersInput = z.infer<typeof listUsersSchema>;

export const createUserSchema = z.object({
  name:        z.string().min(1, 'Nome obrigatório.').max(200).trim(),
  email:       z.string().email('E-mail inválido.'),
  role:        z.enum(USER_ROLES),
  permissions: z.array(permissionEntrySchema).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const setUserPermissionsSchema = z.object({
  userId:      z.string().uuid('ID de usuário inválido.'),
  permissions: z.array(permissionEntrySchema),
});
export type SetUserPermissionsInput = z.infer<typeof setUserPermissionsSchema>;

export const deactivateUserSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido.'),
  reason: z.string().min(5, 'Motivo de desativação obrigatório (mín. 5 caracteres).').max(500),
});
export type DeactivateUserInput = z.infer<typeof deactivateUserSchema>;

export const reactivateUserSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido.'),
});

export const initiatePasswordResetSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido.'),
});

// ─── Catálogo de Serviços ─────────────────────────────────────────────────────

export const createSettingsServiceSchema = z.object({
  name:        z.string().min(1, 'Nome obrigatório.').max(200).trim(),
  category:    z.string().min(1, 'Categoria obrigatória.').max(50),
  tussCode:    z.string().regex(/^\d{8}$/, 'Código TUSS deve ter 8 dígitos numéricos.').optional(),
  priceCents:  z.number().int('Preço deve ser em centavos (inteiro).').min(0, 'Preço não pode ser negativo.'),
  durationMin: z.number().int('Duração deve ser inteira.').positive('Duração deve ser maior que zero.'),
  description: z.string().max(1000).trim().optional(),
});
export type CreateSettingsServiceInput = z.infer<typeof createSettingsServiceSchema>;

export const updateSettingsServiceSchema = createSettingsServiceSchema.partial().extend({
  id: z.string().uuid('ID de serviço inválido.'),
});
export type UpdateSettingsServiceInput = z.infer<typeof updateSettingsServiceSchema>;

export const deleteSettingsServiceSchema = z.object({ id: z.string().uuid() });

// ─── Integrações ─────────────────────────────────────────────────────────────

export const CHANNELS = ['whatsapp', 'instagram', 'telegram', 'email'] as const;
export type Channel = (typeof CHANNELS)[number];

export const updateCredentialSchema = z.object({
  channel: z.enum(CHANNELS),
  token:   z.string().min(8, 'Token muito curto (mín. 8 caracteres).').max(512),
});
export type UpdateCredentialInput = z.infer<typeof updateCredentialSchema>;

export const testConnectionSchema = z.object({
  channel: z.enum(CHANNELS),
});

export const regenerateWebhookSecretSchema = z.object({
  channel: z.enum(CHANNELS),
});

// ─── IA ──────────────────────────────────────────────────────────────────────

export const updateAISettingsSchema = z.object({
  auroraEnabled:  z.boolean().optional(),
  preferredModel: z.string().min(1).max(100).optional(),
});
export type UpdateAISettingsInput = z.infer<typeof updateAISettingsSchema>;

export const updateSystemPromptSchema = z.object({
  promptText: z
    .string()
    .min(1, 'Prompt obrigatório.')
    .max(20_000, 'Prompt excede 20.000 caracteres.')
    .trim(),
});
export type UpdateSystemPromptInput = z.infer<typeof updateSystemPromptSchema>;

// ─── Auditoria ───────────────────────────────────────────────────────────────

export const listAuditLogsSchema = z.object({
  userId:   z.string().uuid().optional(),
  action:   z.string().max(50).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
  cursor:   z.string().optional(),
  limit:    z.number().int().positive().max(100).default(50),
});
export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;

export const getAuditLogDetailSchema = z.object({
  eventId: z.string().uuid(),
});

export const exportAuditLogsSchema = z.object({
  userId:   z.string().uuid().optional(),
  action:   z.string().max(50).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo:   z.coerce.date().optional(),
});
export type ExportAuditLogsInput = z.infer<typeof exportAuditLogsSchema>;

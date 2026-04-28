"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportAuditLogsSchema = exports.getAuditLogDetailSchema = exports.listAuditLogsSchema = exports.updateSystemPromptSchema = exports.updateAISettingsSchema = exports.regenerateWebhookSecretSchema = exports.testConnectionSchema = exports.updateCredentialSchema = exports.CHANNELS = exports.deleteSettingsServiceSchema = exports.updateSettingsServiceSchema = exports.createSettingsServiceSchema = exports.initiatePasswordResetSchema = exports.reactivateUserSchema = exports.deactivateUserSchema = exports.setUserPermissionsSchema = exports.createUserSchema = exports.listUsersSchema = exports.permissionEntrySchema = exports.PERMISSION_ACTIONS = exports.PERMISSION_MODULES = exports.updateBusinessHoursSchema = exports.businessHoursDaySchema = exports.updateTimezoneSchema = exports.updateClinicSchema = exports.addressSchema = void 0;
const zod_1 = require("zod");
const roles_1 = require("../constants/roles");
const validators_1 = require("../utils/validators");
// ─── Clínica ─────────────────────────────────────────────────────────────────
exports.addressSchema = zod_1.z.object({
    street: zod_1.z.string().min(1).max(200).trim(),
    number: zod_1.z.string().min(1).max(20).trim(),
    complement: zod_1.z.string().max(100).trim().optional(),
    district: zod_1.z.string().min(1).max(100).trim(),
    city: zod_1.z.string().min(1).max(100).trim(),
    state: zod_1.z.string().length(2).toUpperCase(),
    zip: zod_1.z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos numéricos.'),
});
exports.updateClinicSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nome obrigatório.').max(200).trim().optional(),
    cnpj: zod_1.z.string()
        .transform((v) => v.replace(/\D/g, ''))
        .refine((v) => v.length === 14, 'CNPJ deve ter 14 dígitos.')
        .refine((v) => (0, validators_1.isValidCNPJ)(v), 'CNPJ inválido (dígitos verificadores).')
        .optional(),
    cnes: zod_1.z.string().regex(/^\d{7}$/, 'CNES deve ter exatamente 7 dígitos numéricos.').optional(),
    email: zod_1.z.string().email('E-mail inválido.').optional(),
    phone: zod_1.z.string()
        .transform((v) => v.replace(/\D/g, ''))
        .refine((v) => v.length === 10 || v.length === 11, 'Telefone deve ter DDD + número (10 ou 11 dígitos).')
        .optional(),
    address: exports.addressSchema.optional(),
    dpo_name: zod_1.z.string().min(1, 'Nome do DPO obrigatório.').max(200).trim().optional(),
    dpo_email: zod_1.z.string().email('E-mail do DPO inválido.').optional(),
});
exports.updateTimezoneSchema = zod_1.z.object({
    timezone: zod_1.z.string().min(1, 'Timezone obrigatório.').max(100),
});
const shiftSchema = zod_1.z
    .object({
    start: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido (formato HH:MM).'),
    end: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido (formato HH:MM).'),
})
    .refine((s) => s.start < s.end, { message: 'Horário de fim deve ser posterior ao início.' });
exports.businessHoursDaySchema = zod_1.z.object({
    dayOfWeek: zod_1.z.number().int().min(0).max(6),
    isOpen: zod_1.z.boolean(),
    shifts: zod_1.z.array(shiftSchema).min(1, 'Ao menos um turno obrigatório.').max(3),
});
exports.updateBusinessHoursSchema = zod_1.z.object({
    hours: zod_1.z.array(exports.businessHoursDaySchema).length(7, 'Todos os 7 dias devem ser configurados.'),
});
// ─── Usuários ─────────────────────────────────────────────────────────────────
exports.PERMISSION_MODULES = [
    'patients', 'appointments', 'clinical',
    'financial', 'supply', 'omni', 'analytics', 'settings',
];
exports.PERMISSION_ACTIONS = ['read', 'write', 'delete', 'export'];
exports.permissionEntrySchema = zod_1.z.object({
    module: zod_1.z.enum(exports.PERMISSION_MODULES),
    action: zod_1.z.enum(exports.PERMISSION_ACTIONS),
    granted: zod_1.z.boolean(),
});
exports.listUsersSchema = zod_1.z.object({
    role: zod_1.z.enum(roles_1.USER_ROLES).optional(),
    status: zod_1.z.enum(['active', 'inactive', 'locked']).optional(),
    page: zod_1.z.number().int().positive().default(1),
    limit: zod_1.z.number().int().positive().max(100).default(25),
});
exports.createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nome obrigatório.').max(200).trim(),
    email: zod_1.z.string().email('E-mail inválido.'),
    role: zod_1.z.enum(roles_1.USER_ROLES),
    permissions: zod_1.z.array(exports.permissionEntrySchema).optional(),
});
exports.setUserPermissionsSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('ID de usuário inválido.'),
    permissions: zod_1.z.array(exports.permissionEntrySchema),
});
exports.deactivateUserSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('ID de usuário inválido.'),
    reason: zod_1.z.string().min(5, 'Motivo de desativação obrigatório (mín. 5 caracteres).').max(500),
});
exports.reactivateUserSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('ID de usuário inválido.'),
});
exports.initiatePasswordResetSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('ID de usuário inválido.'),
});
// ─── Catálogo de Serviços ─────────────────────────────────────────────────────
exports.createSettingsServiceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nome obrigatório.').max(200).trim(),
    category: zod_1.z.string().min(1, 'Categoria obrigatória.').max(50),
    tussCode: zod_1.z.string().regex(/^\d{8}$/, 'Código TUSS deve ter 8 dígitos numéricos.').optional(),
    priceCents: zod_1.z.number().int('Preço deve ser em centavos (inteiro).').min(0, 'Preço não pode ser negativo.'),
    durationMin: zod_1.z.number().int('Duração deve ser inteira.').positive('Duração deve ser maior que zero.'),
    description: zod_1.z.string().max(1000).trim().optional(),
});
exports.updateSettingsServiceSchema = exports.createSettingsServiceSchema.partial().extend({
    id: zod_1.z.string().uuid('ID de serviço inválido.'),
});
exports.deleteSettingsServiceSchema = zod_1.z.object({ id: zod_1.z.string().uuid() });
// ─── Integrações ─────────────────────────────────────────────────────────────
exports.CHANNELS = ['whatsapp', 'instagram', 'telegram', 'email'];
exports.updateCredentialSchema = zod_1.z.object({
    channel: zod_1.z.enum(exports.CHANNELS),
    token: zod_1.z.string().min(8, 'Token muito curto (mín. 8 caracteres).').max(512),
});
exports.testConnectionSchema = zod_1.z.object({
    channel: zod_1.z.enum(exports.CHANNELS),
});
exports.regenerateWebhookSecretSchema = zod_1.z.object({
    channel: zod_1.z.enum(exports.CHANNELS),
});
// ─── IA ──────────────────────────────────────────────────────────────────────
exports.updateAISettingsSchema = zod_1.z.object({
    auroraEnabled: zod_1.z.boolean().optional(),
    preferredModel: zod_1.z.string().min(1).max(100).optional(),
});
exports.updateSystemPromptSchema = zod_1.z.object({
    promptText: zod_1.z
        .string()
        .min(1, 'Prompt obrigatório.')
        .max(20_000, 'Prompt excede 20.000 caracteres.')
        .trim(),
});
// ─── Auditoria ───────────────────────────────────────────────────────────────
exports.listAuditLogsSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid().optional(),
    action: zod_1.z.string().max(50).optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.number().int().positive().max(100).default(50),
});
exports.getAuditLogDetailSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
});
exports.exportAuditLogsSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid().optional(),
    action: zod_1.z.string().max(50).optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
});
//# sourceMappingURL=settings.schema.js.map
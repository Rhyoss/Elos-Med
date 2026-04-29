"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentListQuerySchema = exports.cancelAppointmentSchema = exports.updateAppointmentSchema = exports.createAppointmentSchema = exports.appointmentSourceSchema = exports.appointmentStatusSchema = void 0;
const zod_1 = require("zod");
exports.appointmentStatusSchema = zod_1.z.enum([
    'scheduled',
    'confirmed',
    'waiting',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
    'rescheduled',
]);
exports.appointmentSourceSchema = zod_1.z.enum([
    'manual',
    'online_booking',
    'whatsapp',
    'phone',
    'walk_in',
    'referral',
]);
exports.createAppointmentSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid('ID de paciente inválido'),
    providerId: zod_1.z.string().uuid('ID de profissional inválido'),
    serviceId: zod_1.z.string().uuid().optional(),
    type: zod_1.z.string().min(1).max(100).default('consultation'),
    scheduledAt: zod_1.z.coerce.date(),
    durationMin: zod_1.z.number().int().positive().min(5).max(480).default(30),
    room: zod_1.z.string().max(50).optional(),
    source: exports.appointmentSourceSchema.default('manual'),
    price: zod_1.z.number().nonnegative().optional(),
    patientNotes: zod_1.z.string().max(2000).optional(),
    internalNotes: zod_1.z.string().max(2000).optional(),
});
exports.updateAppointmentSchema = exports.createAppointmentSchema
    .omit({ patientId: true, providerId: true })
    .partial();
exports.cancelAppointmentSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1, 'Motivo do cancelamento é obrigatório').max(500),
});
exports.appointmentListQuerySchema = zod_1.z.object({
    date: zod_1.z.coerce.date().optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
    providerId: zod_1.z.string().uuid().optional(),
    patientId: zod_1.z.string().uuid().optional(),
    status: exports.appointmentStatusSchema.optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
//# sourceMappingURL=appointment.schema.js.map
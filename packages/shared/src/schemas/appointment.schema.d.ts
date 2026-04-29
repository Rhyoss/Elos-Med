import { z } from 'zod';
export declare const appointmentStatusSchema: z.ZodEnum<["scheduled", "confirmed", "waiting", "in_progress", "completed", "cancelled", "no_show", "rescheduled"]>;
export declare const appointmentSourceSchema: z.ZodEnum<["manual", "online_booking", "whatsapp", "phone", "walk_in", "referral"]>;
export declare const createAppointmentSchema: z.ZodObject<{
    patientId: z.ZodString;
    providerId: z.ZodString;
    serviceId: z.ZodOptional<z.ZodString>;
    type: z.ZodDefault<z.ZodString>;
    scheduledAt: z.ZodDate;
    durationMin: z.ZodDefault<z.ZodNumber>;
    room: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["manual", "online_booking", "whatsapp", "phone", "walk_in", "referral"]>>;
    price: z.ZodOptional<z.ZodNumber>;
    patientNotes: z.ZodOptional<z.ZodString>;
    internalNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    source: "phone" | "manual" | "online_booking" | "whatsapp" | "walk_in" | "referral";
    patientId: string;
    providerId: string;
    scheduledAt: Date;
    durationMin: number;
    internalNotes?: string | undefined;
    serviceId?: string | undefined;
    room?: string | undefined;
    price?: number | undefined;
    patientNotes?: string | undefined;
}, {
    patientId: string;
    providerId: string;
    scheduledAt: Date;
    type?: string | undefined;
    internalNotes?: string | undefined;
    source?: "phone" | "manual" | "online_booking" | "whatsapp" | "walk_in" | "referral" | undefined;
    serviceId?: string | undefined;
    durationMin?: number | undefined;
    room?: string | undefined;
    price?: number | undefined;
    patientNotes?: string | undefined;
}>;
export declare const updateAppointmentSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    internalNotes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    source: z.ZodOptional<z.ZodDefault<z.ZodEnum<["manual", "online_booking", "whatsapp", "phone", "walk_in", "referral"]>>>;
    serviceId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    scheduledAt: z.ZodOptional<z.ZodDate>;
    durationMin: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    room: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    price: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    patientNotes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type?: string | undefined;
    internalNotes?: string | undefined;
    source?: "phone" | "manual" | "online_booking" | "whatsapp" | "walk_in" | "referral" | undefined;
    serviceId?: string | undefined;
    scheduledAt?: Date | undefined;
    durationMin?: number | undefined;
    room?: string | undefined;
    price?: number | undefined;
    patientNotes?: string | undefined;
}, {
    type?: string | undefined;
    internalNotes?: string | undefined;
    source?: "phone" | "manual" | "online_booking" | "whatsapp" | "walk_in" | "referral" | undefined;
    serviceId?: string | undefined;
    scheduledAt?: Date | undefined;
    durationMin?: number | undefined;
    room?: string | undefined;
    price?: number | undefined;
    patientNotes?: string | undefined;
}>;
export declare const cancelAppointmentSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const appointmentListQuerySchema: z.ZodObject<{
    date: z.ZodOptional<z.ZodDate>;
    dateFrom: z.ZodOptional<z.ZodDate>;
    dateTo: z.ZodOptional<z.ZodDate>;
    providerId: z.ZodOptional<z.ZodString>;
    patientId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["scheduled", "confirmed", "waiting", "in_progress", "completed", "cancelled", "no_show", "rescheduled"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "scheduled" | "confirmed" | "waiting" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled" | undefined;
    date?: Date | undefined;
    patientId?: string | undefined;
    providerId?: string | undefined;
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
}, {
    status?: "scheduled" | "confirmed" | "waiting" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled" | undefined;
    date?: Date | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    patientId?: string | undefined;
    providerId?: string | undefined;
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
}>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;
//# sourceMappingURL=appointment.schema.d.ts.map
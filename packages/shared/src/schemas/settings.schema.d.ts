import { z } from 'zod';
export declare const addressSchema: z.ZodObject<{
    street: z.ZodString;
    number: z.ZodString;
    complement: z.ZodOptional<z.ZodString>;
    district: z.ZodString;
    city: z.ZodString;
    state: z.ZodString;
    zip: z.ZodString;
}, "strip", z.ZodTypeAny, {
    number: string;
    street: string;
    district: string;
    city: string;
    state: string;
    zip: string;
    complement?: string | undefined;
}, {
    number: string;
    street: string;
    district: string;
    city: string;
    state: string;
    zip: string;
    complement?: string | undefined;
}>;
export type SettingsAddress = z.infer<typeof addressSchema>;
export declare const updateClinicSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    cnpj: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>>;
    cnes: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    address: z.ZodOptional<z.ZodObject<{
        street: z.ZodString;
        number: z.ZodString;
        complement: z.ZodOptional<z.ZodString>;
        district: z.ZodString;
        city: z.ZodString;
        state: z.ZodString;
        zip: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        number: string;
        street: string;
        district: string;
        city: string;
        state: string;
        zip: string;
        complement?: string | undefined;
    }, {
        number: string;
        street: string;
        district: string;
        city: string;
        state: string;
        zip: string;
        complement?: string | undefined;
    }>>;
    dpo_name: z.ZodOptional<z.ZodString>;
    dpo_email: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: {
        number: string;
        street: string;
        district: string;
        city: string;
        state: string;
        zip: string;
        complement?: string | undefined;
    } | undefined;
    cnpj?: string | undefined;
    cnes?: string | undefined;
    dpo_name?: string | undefined;
    dpo_email?: string | undefined;
}, {
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: {
        number: string;
        street: string;
        district: string;
        city: string;
        state: string;
        zip: string;
        complement?: string | undefined;
    } | undefined;
    cnpj?: string | undefined;
    cnes?: string | undefined;
    dpo_name?: string | undefined;
    dpo_email?: string | undefined;
}>;
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
export declare const updateTimezoneSchema: z.ZodObject<{
    timezone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timezone: string;
}, {
    timezone: string;
}>;
export type UpdateTimezoneInput = z.infer<typeof updateTimezoneSchema>;
export declare const businessHoursDaySchema: z.ZodObject<{
    dayOfWeek: z.ZodNumber;
    isOpen: z.ZodBoolean;
    shifts: z.ZodArray<z.ZodEffects<z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        end: string;
        start: string;
    }, {
        end: string;
        start: string;
    }>, {
        end: string;
        start: string;
    }, {
        end: string;
        start: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    dayOfWeek: number;
    isOpen: boolean;
    shifts: {
        end: string;
        start: string;
    }[];
}, {
    dayOfWeek: number;
    isOpen: boolean;
    shifts: {
        end: string;
        start: string;
    }[];
}>;
export declare const updateBusinessHoursSchema: z.ZodObject<{
    hours: z.ZodArray<z.ZodObject<{
        dayOfWeek: z.ZodNumber;
        isOpen: z.ZodBoolean;
        shifts: z.ZodArray<z.ZodEffects<z.ZodObject<{
            start: z.ZodString;
            end: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            end: string;
            start: string;
        }, {
            end: string;
            start: string;
        }>, {
            end: string;
            start: string;
        }, {
            end: string;
            start: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        dayOfWeek: number;
        isOpen: boolean;
        shifts: {
            end: string;
            start: string;
        }[];
    }, {
        dayOfWeek: number;
        isOpen: boolean;
        shifts: {
            end: string;
            start: string;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    hours: {
        dayOfWeek: number;
        isOpen: boolean;
        shifts: {
            end: string;
            start: string;
        }[];
    }[];
}, {
    hours: {
        dayOfWeek: number;
        isOpen: boolean;
        shifts: {
            end: string;
            start: string;
        }[];
    }[];
}>;
export type UpdateBusinessHoursInput = z.infer<typeof updateBusinessHoursSchema>;
export declare const PERMISSION_MODULES: readonly ["patients", "appointments", "clinical", "financial", "supply", "omni", "analytics", "settings"];
export type PermissionModule = (typeof PERMISSION_MODULES)[number];
export declare const PERMISSION_ACTIONS: readonly ["read", "write", "delete", "export"];
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
export declare const permissionEntrySchema: z.ZodObject<{
    module: z.ZodEnum<["patients", "appointments", "clinical", "financial", "supply", "omni", "analytics", "settings"]>;
    action: z.ZodEnum<["read", "write", "delete", "export"]>;
    granted: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    action: "read" | "write" | "delete" | "export";
    module: "financial" | "clinical" | "appointments" | "patients" | "supply" | "omni" | "analytics" | "settings";
    granted: boolean;
}, {
    action: "read" | "write" | "delete" | "export";
    module: "financial" | "clinical" | "appointments" | "patients" | "supply" | "omni" | "analytics" | "settings";
    granted: boolean;
}>;
export type PermissionEntry = z.infer<typeof permissionEntrySchema>;
export declare const listUsersSchema: z.ZodObject<{
    role: z.ZodOptional<z.ZodEnum<["owner", "admin", "dermatologist", "nurse", "receptionist", "financial", "readonly"]>>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "locked"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "active" | "inactive" | "locked" | undefined;
    role?: "owner" | "admin" | "dermatologist" | "nurse" | "receptionist" | "financial" | "readonly" | undefined;
}, {
    status?: "active" | "inactive" | "locked" | undefined;
    role?: "owner" | "admin" | "dermatologist" | "nurse" | "receptionist" | "financial" | "readonly" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export declare const createUserSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    role: z.ZodEnum<["owner", "admin", "dermatologist", "nurse", "receptionist", "financial", "readonly"]>;
    permissions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        module: z.ZodEnum<["patients", "appointments", "clinical", "financial", "supply", "omni", "analytics", "settings"]>;
        action: z.ZodEnum<["read", "write", "delete", "export"]>;
        granted: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        action: "read" | "write" | "delete" | "export";
        module: "financial" | "clinical" | "appointments" | "patients" | "supply" | "omni" | "analytics" | "settings";
        granted: boolean;
    }, {
        action: "read" | "write" | "delete" | "export";
        module: "financial" | "clinical" | "appointments" | "patients" | "supply" | "omni" | "analytics" | "settings";
        granted: boolean;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    role: "owner" | "admin" | "dermatologist" | "nurse" | "receptionist" | "financial" | "readonly";
    permissions?: {
        action: "read" | "write" | "delete" | "export";
        module: "financial" | "clinical" | "appointments" | "patients" | "supply" | "omni" | "analytics" | "settings";
        granted: boolean;
    }[] | undefined;
}, {
    name: string;
    email: string;
    role: "owner" | "admin" | "dermatologist" | "nurse" | "receptionist" | "financial" | "readonly";
    permissions?: {
        action: "read" | "write" | "delete" | "export";
        module: "financial" | "clinical" | "appointments" | "patients" | "supply" | "omni" | "analytics" | "settings";
        granted: boolean;
    }[] | undefined;
}>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export declare const setUserPermissionsSchema: z.ZodObject<{
    userId: z.ZodString;
    permissions: z.ZodArray<z.ZodObject<{
        module: z.ZodEnum<["patients", "appointments", "clinical", "financial", "supply", "omni", "analytics", "settings"]>;
        action: z.ZodEnum<["read", "write", "delete", "export"]>;
        granted: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        action: "read" | "write" | "delete" | "export";
        module: "financial" | "clinical" | "appointments" | "patients" | "supply" | "omni" | "analytics" | "settings";
        granted: boolean;
    }, {
        action: "read" | "write" | "delete" | "export";
        module: "financial" | "clinical" | "appointments" | "patients" | "supply" | "omni" | "analytics" | "settings";
        granted: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    permissions: {
        action: "read" | "write" | "delete" | "export";
        module: "financial" | "clinical" | "appointments" | "patients" | "supply" | "omni" | "analytics" | "settings";
        granted: boolean;
    }[];
    userId: string;
}, {
    permissions: {
        action: "read" | "write" | "delete" | "export";
        module: "financial" | "clinical" | "appointments" | "patients" | "supply" | "omni" | "analytics" | "settings";
        granted: boolean;
    }[];
    userId: string;
}>;
export type SetUserPermissionsInput = z.infer<typeof setUserPermissionsSchema>;
export declare const deactivateUserSchema: z.ZodObject<{
    userId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    userId: string;
}, {
    reason: string;
    userId: string;
}>;
export type DeactivateUserInput = z.infer<typeof deactivateUserSchema>;
export declare const reactivateUserSchema: z.ZodObject<{
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userId: string;
}, {
    userId: string;
}>;
export declare const initiatePasswordResetSchema: z.ZodObject<{
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userId: string;
}, {
    userId: string;
}>;
export declare const createSettingsServiceSchema: z.ZodObject<{
    name: z.ZodString;
    category: z.ZodString;
    tussCode: z.ZodOptional<z.ZodString>;
    priceCents: z.ZodNumber;
    durationMin: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    durationMin: number;
    category: string;
    priceCents: number;
    description?: string | undefined;
    tussCode?: string | undefined;
}, {
    name: string;
    durationMin: number;
    category: string;
    priceCents: number;
    description?: string | undefined;
    tussCode?: string | undefined;
}>;
export type CreateSettingsServiceInput = z.infer<typeof createSettingsServiceSchema>;
export declare const updateSettingsServiceSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    tussCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    priceCents: z.ZodOptional<z.ZodNumber>;
    durationMin: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
} & {
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    durationMin?: number | undefined;
    description?: string | undefined;
    category?: string | undefined;
    tussCode?: string | undefined;
    priceCents?: number | undefined;
}, {
    id: string;
    name?: string | undefined;
    durationMin?: number | undefined;
    description?: string | undefined;
    category?: string | undefined;
    tussCode?: string | undefined;
    priceCents?: number | undefined;
}>;
export type UpdateSettingsServiceInput = z.infer<typeof updateSettingsServiceSchema>;
export declare const deleteSettingsServiceSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const CHANNELS: readonly ["whatsapp", "instagram", "telegram", "email"];
export type Channel = (typeof CHANNELS)[number];
export declare const updateCredentialSchema: z.ZodObject<{
    channel: z.ZodEnum<["whatsapp", "instagram", "telegram", "email"]>;
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    channel: "email" | "whatsapp" | "instagram" | "telegram";
}, {
    token: string;
    channel: "email" | "whatsapp" | "instagram" | "telegram";
}>;
export type UpdateCredentialInput = z.infer<typeof updateCredentialSchema>;
export declare const testConnectionSchema: z.ZodObject<{
    channel: z.ZodEnum<["whatsapp", "instagram", "telegram", "email"]>;
}, "strip", z.ZodTypeAny, {
    channel: "email" | "whatsapp" | "instagram" | "telegram";
}, {
    channel: "email" | "whatsapp" | "instagram" | "telegram";
}>;
export declare const regenerateWebhookSecretSchema: z.ZodObject<{
    channel: z.ZodEnum<["whatsapp", "instagram", "telegram", "email"]>;
}, "strip", z.ZodTypeAny, {
    channel: "email" | "whatsapp" | "instagram" | "telegram";
}, {
    channel: "email" | "whatsapp" | "instagram" | "telegram";
}>;
export declare const updateAISettingsSchema: z.ZodObject<{
    auroraEnabled: z.ZodOptional<z.ZodBoolean>;
    preferredModel: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    auroraEnabled?: boolean | undefined;
    preferredModel?: string | undefined;
}, {
    auroraEnabled?: boolean | undefined;
    preferredModel?: string | undefined;
}>;
export type UpdateAISettingsInput = z.infer<typeof updateAISettingsSchema>;
export declare const updateSystemPromptSchema: z.ZodObject<{
    promptText: z.ZodString;
}, "strip", z.ZodTypeAny, {
    promptText: string;
}, {
    promptText: string;
}>;
export type UpdateSystemPromptInput = z.infer<typeof updateSystemPromptSchema>;
export declare const listAuditLogsSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodString>;
    dateFrom: z.ZodOptional<z.ZodDate>;
    dateTo: z.ZodOptional<z.ZodDate>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
    action?: string | undefined;
    cursor?: string | undefined;
    userId?: string | undefined;
}, {
    limit?: number | undefined;
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
    action?: string | undefined;
    cursor?: string | undefined;
    userId?: string | undefined;
}>;
export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;
export declare const getAuditLogDetailSchema: z.ZodObject<{
    eventId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    eventId: string;
}, {
    eventId: string;
}>;
export declare const exportAuditLogsSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodString>;
    dateFrom: z.ZodOptional<z.ZodDate>;
    dateTo: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
    action?: string | undefined;
    userId?: string | undefined;
}, {
    dateFrom?: Date | undefined;
    dateTo?: Date | undefined;
    action?: string | undefined;
    userId?: string | undefined;
}>;
export type ExportAuditLogsInput = z.infer<typeof exportAuditLogsSchema>;
//# sourceMappingURL=settings.schema.d.ts.map
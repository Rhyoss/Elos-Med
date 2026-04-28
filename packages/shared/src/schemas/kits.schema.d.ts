import { z } from 'zod';
export declare const KIT_STATUSES: readonly ["active", "superseded", "archived"];
export type KitStatus = (typeof KIT_STATUSES)[number];
export declare const KIT_STATUS_LABELS: Record<KitStatus, string>;
export declare const KIT_AVAILABILITY_STATUSES: readonly ["completo", "parcial", "indisponivel"];
export type KitAvailabilityStatus = (typeof KIT_AVAILABILITY_STATUSES)[number];
export declare const KIT_AVAILABILITY_LABELS: Record<KitAvailabilityStatus, string>;
export declare const KIT_ITEM_STATUSES: readonly ["disponivel", "insuficiente", "indisponivel"];
export type KitItemStatus = (typeof KIT_ITEM_STATUSES)[number];
export declare const kitItemInputSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
    isOptional: z.ZodDefault<z.ZodBoolean>;
    displayOrder: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    productId: string;
    isOptional: boolean;
    displayOrder: number;
    notes?: string | null | undefined;
}, {
    quantity: number;
    productId: string;
    notes?: string | null | undefined;
    isOptional?: boolean | undefined;
    displayOrder?: number | undefined;
}>;
export type KitItemInput = z.infer<typeof kitItemInputSchema>;
export declare const createKitSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    procedureTypeId: z.ZodString;
    items: z.ZodEffects<z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        isOptional: z.ZodDefault<z.ZodBoolean>;
        displayOrder: z.ZodDefault<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        productId: string;
        isOptional: boolean;
        displayOrder: number;
        notes?: string | null | undefined;
    }, {
        quantity: number;
        productId: string;
        notes?: string | null | undefined;
        isOptional?: boolean | undefined;
        displayOrder?: number | undefined;
    }>, "many">, {
        quantity: number;
        productId: string;
        isOptional: boolean;
        displayOrder: number;
        notes?: string | null | undefined;
    }[], {
        quantity: number;
        productId: string;
        notes?: string | null | undefined;
        isOptional?: boolean | undefined;
        displayOrder?: number | undefined;
    }[]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    items: {
        quantity: number;
        productId: string;
        isOptional: boolean;
        displayOrder: number;
        notes?: string | null | undefined;
    }[];
    procedureTypeId: string;
    description?: string | null | undefined;
}, {
    name: string;
    items: {
        quantity: number;
        productId: string;
        notes?: string | null | undefined;
        isOptional?: boolean | undefined;
        displayOrder?: number | undefined;
    }[];
    procedureTypeId: string;
    description?: string | null | undefined;
}>;
export type CreateKitInput = z.infer<typeof createKitSchema>;
export declare const updateKitSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    procedureTypeId: z.ZodOptional<z.ZodString>;
    items: z.ZodOptional<z.ZodEffects<z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        isOptional: z.ZodDefault<z.ZodBoolean>;
        displayOrder: z.ZodDefault<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        productId: string;
        isOptional: boolean;
        displayOrder: number;
        notes?: string | null | undefined;
    }, {
        quantity: number;
        productId: string;
        notes?: string | null | undefined;
        isOptional?: boolean | undefined;
        displayOrder?: number | undefined;
    }>, "many">, {
        quantity: number;
        productId: string;
        isOptional: boolean;
        displayOrder: number;
        notes?: string | null | undefined;
    }[], {
        quantity: number;
        productId: string;
        notes?: string | null | undefined;
        isOptional?: boolean | undefined;
        displayOrder?: number | undefined;
    }[]>>;
    acknowledgeVersioning: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    description?: string | null | undefined;
    items?: {
        quantity: number;
        productId: string;
        isOptional: boolean;
        displayOrder: number;
        notes?: string | null | undefined;
    }[] | undefined;
    procedureTypeId?: string | undefined;
    acknowledgeVersioning?: boolean | undefined;
}, {
    id: string;
    name?: string | undefined;
    description?: string | null | undefined;
    items?: {
        quantity: number;
        productId: string;
        notes?: string | null | undefined;
        isOptional?: boolean | undefined;
        displayOrder?: number | undefined;
    }[] | undefined;
    procedureTypeId?: string | undefined;
    acknowledgeVersioning?: boolean | undefined;
}>;
export type UpdateKitInput = z.infer<typeof updateKitSchema>;
export declare const listKitsSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    procedureTypeId: z.ZodOptional<z.ZodString>;
    availability: z.ZodOptional<z.ZodEnum<["completo", "parcial", "indisponivel"]>>;
    includeArchived: z.ZodDefault<z.ZodBoolean>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    includeArchived: boolean;
    search?: string | undefined;
    procedureTypeId?: string | undefined;
    availability?: "completo" | "parcial" | "indisponivel" | undefined;
}, {
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    procedureTypeId?: string | undefined;
    availability?: "completo" | "parcial" | "indisponivel" | undefined;
    includeArchived?: boolean | undefined;
}>;
export type ListKitsInput = z.infer<typeof listKitsSchema>;
export declare const archiveKitSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type ArchiveKitInput = z.infer<typeof archiveKitSchema>;
export declare const kitAvailabilitySchema: z.ZodObject<{
    kitId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kitId: string;
}, {
    kitId: string;
}>;
export type KitAvailabilityInput = z.infer<typeof kitAvailabilitySchema>;
export interface KitAvailabilityItemResult {
    productId: string;
    productName: string;
    productUnit: string;
    isOptional: boolean;
    quantityRequired: number;
    quantityAvailable: number;
    status: KitItemStatus;
    suggestedLots: Array<{
        lotId: string;
        lotNumber: string;
        expiryDate: string | null;
        quantityFromLot: number;
        quantityAvailable: number;
    }>;
}
export interface KitAvailabilityResult {
    kitId: string;
    kitName: string;
    kitVersion: number;
    status: KitAvailabilityStatus;
    items: KitAvailabilityItemResult[];
    checkedAt: string;
}
export declare const CONSUMPTION_SOURCES: readonly ["encounter", "protocol_session", "manual", "offline_sync"];
export type ConsumptionSource = (typeof CONSUMPTION_SOURCES)[number];
export declare const CONSUMPTION_STATUSES: readonly ["completed", "partial", "skipped", "failed"];
export type ConsumptionStatus = (typeof CONSUMPTION_STATUSES)[number];
export declare const consumptionItemOverrideSchema: z.ZodObject<{
    productId: z.ZodString;
    lotId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    skipped: z.ZodDefault<z.ZodBoolean>;
    quantity: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    skipped: boolean;
    quantity?: number | undefined;
    lotId?: string | null | undefined;
}, {
    productId: string;
    quantity?: number | undefined;
    lotId?: string | null | undefined;
    skipped?: boolean | undefined;
}>;
export type ConsumptionItemOverride = z.infer<typeof consumptionItemOverrideSchema>;
export declare const consumeKitSchema: z.ZodEffects<z.ZodObject<{
    kitId: z.ZodString;
    patientId: z.ZodString;
    encounterId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    protocolSessionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source: z.ZodDefault<z.ZodEnum<["encounter", "protocol_session", "manual", "offline_sync"]>>;
    idempotencyKey: z.ZodString;
    confirmed: z.ZodLiteral<true>;
    overrides: z.ZodDefault<z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        lotId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        skipped: z.ZodDefault<z.ZodBoolean>;
        quantity: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        skipped: boolean;
        quantity?: number | undefined;
        lotId?: string | null | undefined;
    }, {
        productId: string;
        quantity?: number | undefined;
        lotId?: string | null | undefined;
        skipped?: boolean | undefined;
    }>, "many">>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    allowPartial: z.ZodDefault<z.ZodBoolean>;
    occurredAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: "manual" | "encounter" | "protocol_session" | "offline_sync";
    confirmed: true;
    patientId: string;
    kitId: string;
    idempotencyKey: string;
    overrides: {
        productId: string;
        skipped: boolean;
        quantity?: number | undefined;
        lotId?: string | null | undefined;
    }[];
    allowPartial: boolean;
    notes?: string | null | undefined;
    encounterId?: string | null | undefined;
    protocolSessionId?: string | null | undefined;
    occurredAt?: string | undefined;
}, {
    confirmed: true;
    patientId: string;
    kitId: string;
    idempotencyKey: string;
    source?: "manual" | "encounter" | "protocol_session" | "offline_sync" | undefined;
    notes?: string | null | undefined;
    encounterId?: string | null | undefined;
    protocolSessionId?: string | null | undefined;
    overrides?: {
        productId: string;
        quantity?: number | undefined;
        lotId?: string | null | undefined;
        skipped?: boolean | undefined;
    }[] | undefined;
    allowPartial?: boolean | undefined;
    occurredAt?: string | undefined;
}>, {
    source: "manual" | "encounter" | "protocol_session" | "offline_sync";
    confirmed: true;
    patientId: string;
    kitId: string;
    idempotencyKey: string;
    overrides: {
        productId: string;
        skipped: boolean;
        quantity?: number | undefined;
        lotId?: string | null | undefined;
    }[];
    allowPartial: boolean;
    notes?: string | null | undefined;
    encounterId?: string | null | undefined;
    protocolSessionId?: string | null | undefined;
    occurredAt?: string | undefined;
}, {
    confirmed: true;
    patientId: string;
    kitId: string;
    idempotencyKey: string;
    source?: "manual" | "encounter" | "protocol_session" | "offline_sync" | undefined;
    notes?: string | null | undefined;
    encounterId?: string | null | undefined;
    protocolSessionId?: string | null | undefined;
    overrides?: {
        productId: string;
        quantity?: number | undefined;
        lotId?: string | null | undefined;
        skipped?: boolean | undefined;
    }[] | undefined;
    allowPartial?: boolean | undefined;
    occurredAt?: string | undefined;
}>;
export type ConsumeKitInput = z.infer<typeof consumeKitSchema>;
export interface ConsumeKitResultItem {
    productId: string;
    productName: string;
    quantityConsumed: number;
    quantityMissing: number;
    skipped: boolean;
    lots: Array<{
        lotId: string;
        lotNumber: string;
        quantity: number;
    }>;
}
export interface ConsumeKitResult {
    consumptionLogId: string;
    kitId: string;
    status: ConsumptionStatus;
    itemsConsumed: number;
    itemsPending: number;
    items: ConsumeKitResultItem[];
    alreadyProcessed: boolean;
}
export declare const listConsumptionsSchema: z.ZodObject<{
    patientId: z.ZodOptional<z.ZodString>;
    kitId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["completed", "partial", "skipped", "failed"]>>;
    encounterId: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "completed" | "failed" | "skipped" | "partial" | undefined;
    from?: string | undefined;
    to?: string | undefined;
    patientId?: string | undefined;
    encounterId?: string | undefined;
    kitId?: string | undefined;
}, {
    status?: "completed" | "failed" | "skipped" | "partial" | undefined;
    page?: number | undefined;
    from?: string | undefined;
    to?: string | undefined;
    limit?: number | undefined;
    patientId?: string | undefined;
    encounterId?: string | undefined;
    kitId?: string | undefined;
}>;
export type ListConsumptionsInput = z.infer<typeof listConsumptionsSchema>;
export declare const todayAppointmentsWithKitsSchema: z.ZodObject<{
    providerId: z.ZodOptional<z.ZodString>;
    date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date?: string | undefined;
    providerId?: string | undefined;
}, {
    date?: string | undefined;
    providerId?: string | undefined;
}>;
export type TodayAppointmentsWithKitsInput = z.infer<typeof todayAppointmentsWithKitsSchema>;
export declare const tracebackByLotSchema: z.ZodEffects<z.ZodObject<{
    lotId: z.ZodOptional<z.ZodString>;
    lotNumber: z.ZodOptional<z.ZodString>;
    productId: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    productId?: string | undefined;
    lotId?: string | undefined;
    cursor?: string | undefined;
    lotNumber?: string | undefined;
}, {
    limit?: number | undefined;
    productId?: string | undefined;
    lotId?: string | undefined;
    cursor?: string | undefined;
    lotNumber?: string | undefined;
}>, {
    limit: number;
    productId?: string | undefined;
    lotId?: string | undefined;
    cursor?: string | undefined;
    lotNumber?: string | undefined;
}, {
    limit?: number | undefined;
    productId?: string | undefined;
    lotId?: string | undefined;
    cursor?: string | undefined;
    lotNumber?: string | undefined;
}>;
export type TracebackByLotInput = z.infer<typeof tracebackByLotSchema>;
export declare const tracebackByPatientSchema: z.ZodObject<{
    patientId: z.ZodString;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    patientId: string;
    from?: string | undefined;
    to?: string | undefined;
    cursor?: string | undefined;
}, {
    patientId: string;
    from?: string | undefined;
    to?: string | undefined;
    limit?: number | undefined;
    cursor?: string | undefined;
}>;
export type TracebackByPatientInput = z.infer<typeof tracebackByPatientSchema>;
export interface TracebackRow {
    traceId: string;
    appliedAt: string;
    quantityUsed: number;
    patientId: string;
    patientLabel: string;
    patientPhone: string | null;
    productId: string;
    productName: string;
    productAnvisa: string | null;
    lotId: string;
    lotNumber: string;
    expiryDate: string | null;
    supplierName: string | null;
    encounterId: string | null;
    procedureName: string | null;
    providerName: string | null;
}
export interface TracebackResult {
    rows: TracebackRow[];
    nextCursor: string | null;
    total: number;
}
export declare const generateRecallReportSchema: z.ZodEffects<z.ZodObject<{
    scope: z.ZodEnum<["by_lot", "by_patient"]>;
    lotId: z.ZodOptional<z.ZodString>;
    patientId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    scope: "by_lot" | "by_patient";
    patientId?: string | undefined;
    lotId?: string | undefined;
}, {
    scope: "by_lot" | "by_patient";
    patientId?: string | undefined;
    lotId?: string | undefined;
}>, {
    scope: "by_lot" | "by_patient";
    patientId?: string | undefined;
    lotId?: string | undefined;
}, {
    scope: "by_lot" | "by_patient";
    patientId?: string | undefined;
    lotId?: string | undefined;
}>;
export type GenerateRecallReportInput = z.infer<typeof generateRecallReportSchema>;
export interface RecallReportResult {
    reportId: string;
    objectKey: string;
    downloadUrl: string;
    sha256: string;
    sizeBytes: number;
    generatedAt: string;
}
export declare const downloadRecallReportSchema: z.ZodObject<{
    reportId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reportId: string;
}, {
    reportId: string;
}>;
export type DownloadRecallReportInput = z.infer<typeof downloadRecallReportSchema>;
export interface EncounterCompletedEvent {
    clinicId: string;
    encounterId: string;
    patientId: string;
    providerId: string;
    appointmentId: string | null;
    serviceId: string | null;
    completedAt: string;
}
export interface ProtocolSessionCompletedEvent {
    clinicId: string;
    protocolSessionId: string;
    protocolId: string;
    patientId: string;
    appointmentId: string | null;
    serviceId: string | null;
    performedBy: string | null;
    performedAt: string;
}
export interface StockConsumptionIncompletePayload {
    kitId: string;
    kitName: string;
    encounterId: string | null;
    patientId: string;
    missingItems: Array<{
        productId: string;
        productName: string;
        quantityMissing: number;
    }>;
}
//# sourceMappingURL=kits.schema.d.ts.map
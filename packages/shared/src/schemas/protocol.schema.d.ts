import { z } from 'zod';
export declare const PROTOCOL_TYPES: readonly ["fototerapia", "laser_fracionado", "peeling", "injetavel", "microagulhamento", "outro"];
export declare const protocolTypeSchema: z.ZodEnum<["fototerapia", "laser_fracionado", "peeling", "injetavel", "microagulhamento", "outro"]>;
export type ProtocolType = z.infer<typeof protocolTypeSchema>;
export declare const PROTOCOL_TYPE_LABELS: Record<ProtocolType, string>;
export declare const protocolStatusSchema: z.ZodEnum<["ativo", "pausado", "concluido", "cancelado"]>;
export type ProtocolStatus = z.infer<typeof protocolStatusSchema>;
export declare const PROTOCOL_STATUS_LABELS: Record<ProtocolStatus, string>;
export declare const adverseSeveritySchema: z.ZodEnum<["none", "leve", "moderado", "grave"]>;
export type AdverseSeverity = z.infer<typeof adverseSeveritySchema>;
export declare const ADVERSE_SEVERITY_LABELS: Record<AdverseSeverity, string>;
export declare const protocolProductLinkSchema: z.ZodObject<{
    productId: z.ZodString;
    quantityPerSession: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    quantityPerSession: number;
    notes?: string | undefined;
}, {
    productId: string;
    quantityPerSession: number;
    notes?: string | undefined;
}>;
export type ProtocolProductLink = z.infer<typeof protocolProductLinkSchema>;
export declare const createProtocolSchema: z.ZodObject<{
    patientId: z.ZodString;
    providerId: z.ZodString;
    type: z.ZodEnum<["fototerapia", "laser_fracionado", "peeling", "injetavel", "microagulhamento", "outro"]>;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    totalSessions: z.ZodNumber;
    intervalDays: z.ZodNumber;
    startedAt: z.ZodOptional<z.ZodDate>;
    parametersSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    productLinks: z.ZodOptional<z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantityPerSession: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantityPerSession: number;
        notes?: string | undefined;
    }, {
        productId: string;
        quantityPerSession: number;
        notes?: string | undefined;
    }>, "many">>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "fototerapia" | "laser_fracionado" | "peeling" | "injetavel" | "microagulhamento" | "outro";
    name: string;
    patientId: string;
    providerId: string;
    intervalDays: number;
    totalSessions: number;
    notes?: string | undefined;
    description?: string | undefined;
    startedAt?: Date | undefined;
    parametersSchema?: Record<string, unknown> | undefined;
    productLinks?: {
        productId: string;
        quantityPerSession: number;
        notes?: string | undefined;
    }[] | undefined;
}, {
    type: "fototerapia" | "laser_fracionado" | "peeling" | "injetavel" | "microagulhamento" | "outro";
    name: string;
    patientId: string;
    providerId: string;
    intervalDays: number;
    totalSessions: number;
    notes?: string | undefined;
    description?: string | undefined;
    startedAt?: Date | undefined;
    parametersSchema?: Record<string, unknown> | undefined;
    productLinks?: {
        productId: string;
        quantityPerSession: number;
        notes?: string | undefined;
    }[] | undefined;
}>;
export type CreateProtocolInput = z.infer<typeof createProtocolSchema>;
export declare const updateProtocolSchema: z.ZodObject<{
    id: z.ZodString;
    data: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        totalSessions: z.ZodOptional<z.ZodNumber>;
        intervalDays: z.ZodOptional<z.ZodNumber>;
        parametersSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        productLinks: z.ZodOptional<z.ZodArray<z.ZodObject<{
            productId: z.ZodString;
            quantityPerSession: z.ZodNumber;
            notes: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            productId: string;
            quantityPerSession: number;
            notes?: string | undefined;
        }, {
            productId: string;
            quantityPerSession: number;
            notes?: string | undefined;
        }>, "many">>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        notes?: string | null | undefined;
        description?: string | null | undefined;
        intervalDays?: number | undefined;
        totalSessions?: number | undefined;
        parametersSchema?: Record<string, unknown> | undefined;
        productLinks?: {
            productId: string;
            quantityPerSession: number;
            notes?: string | undefined;
        }[] | undefined;
    }, {
        name?: string | undefined;
        notes?: string | null | undefined;
        description?: string | null | undefined;
        intervalDays?: number | undefined;
        totalSessions?: number | undefined;
        parametersSchema?: Record<string, unknown> | undefined;
        productLinks?: {
            productId: string;
            quantityPerSession: number;
            notes?: string | undefined;
        }[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    data: {
        name?: string | undefined;
        notes?: string | null | undefined;
        description?: string | null | undefined;
        intervalDays?: number | undefined;
        totalSessions?: number | undefined;
        parametersSchema?: Record<string, unknown> | undefined;
        productLinks?: {
            productId: string;
            quantityPerSession: number;
            notes?: string | undefined;
        }[] | undefined;
    };
}, {
    id: string;
    data: {
        name?: string | undefined;
        notes?: string | null | undefined;
        description?: string | null | undefined;
        intervalDays?: number | undefined;
        totalSessions?: number | undefined;
        parametersSchema?: Record<string, unknown> | undefined;
        productLinks?: {
            productId: string;
            quantityPerSession: number;
            notes?: string | undefined;
        }[] | undefined;
    };
}>;
export type UpdateProtocolInput = z.infer<typeof updateProtocolSchema>;
export declare const cancelProtocolSchema: z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    id: string;
}, {
    reason: string;
    id: string;
}>;
export type CancelProtocolInput = z.infer<typeof cancelProtocolSchema>;
export declare const pauseProtocolSchema: z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    id: string;
}, {
    reason: string;
    id: string;
}>;
export type PauseProtocolInput = z.infer<typeof pauseProtocolSchema>;
export declare const resumeProtocolSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const adverseEventSchema: z.ZodObject<{
    description: z.ZodString;
    severity: z.ZodEnum<["leve", "moderado", "grave"]>;
    action: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    severity: "leve" | "moderado" | "grave";
    action?: string | undefined;
}, {
    description: string;
    severity: "leve" | "moderado" | "grave";
    action?: string | undefined;
}>;
export type AdverseEvent = z.infer<typeof adverseEventSchema>;
export declare const sessionProductConsumptionSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
    lotId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    productId: string;
    notes?: string | undefined;
    lotId?: string | undefined;
}, {
    quantity: number;
    productId: string;
    notes?: string | undefined;
    lotId?: string | undefined;
}>;
export type SessionProductConsumption = z.infer<typeof sessionProductConsumptionSchema>;
export declare const registerSessionSchema: z.ZodObject<{
    protocolId: z.ZodString;
    appointmentId: z.ZodOptional<z.ZodString>;
    performedAt: z.ZodOptional<z.ZodDate>;
    durationMin: z.ZodOptional<z.ZodNumber>;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    patientResponse: z.ZodOptional<z.ZodString>;
    adverseEvents: z.ZodDefault<z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        severity: z.ZodEnum<["leve", "moderado", "grave"]>;
        action: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        severity: "leve" | "moderado" | "grave";
        action?: string | undefined;
    }, {
        description: string;
        severity: "leve" | "moderado" | "grave";
        action?: string | undefined;
    }>, "many">>;
    productsConsumed: z.ZodDefault<z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        lotId: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        productId: string;
        notes?: string | undefined;
        lotId?: string | undefined;
    }, {
        quantity: number;
        productId: string;
        notes?: string | undefined;
        lotId?: string | undefined;
    }>, "many">>;
    preImageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    postImageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    outcome: z.ZodOptional<z.ZodString>;
    nextSessionNotes: z.ZodOptional<z.ZodString>;
    observations: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    protocolId: string;
    adverseEvents: {
        description: string;
        severity: "leve" | "moderado" | "grave";
        action?: string | undefined;
    }[];
    productsConsumed: {
        quantity: number;
        productId: string;
        notes?: string | undefined;
        lotId?: string | undefined;
    }[];
    preImageIds: string[];
    postImageIds: string[];
    durationMin?: number | undefined;
    appointmentId?: string | undefined;
    performedAt?: Date | undefined;
    parameters?: Record<string, unknown> | undefined;
    patientResponse?: string | undefined;
    outcome?: string | undefined;
    nextSessionNotes?: string | undefined;
    observations?: string | undefined;
}, {
    protocolId: string;
    durationMin?: number | undefined;
    appointmentId?: string | undefined;
    performedAt?: Date | undefined;
    parameters?: Record<string, unknown> | undefined;
    patientResponse?: string | undefined;
    adverseEvents?: {
        description: string;
        severity: "leve" | "moderado" | "grave";
        action?: string | undefined;
    }[] | undefined;
    productsConsumed?: {
        quantity: number;
        productId: string;
        notes?: string | undefined;
        lotId?: string | undefined;
    }[] | undefined;
    preImageIds?: string[] | undefined;
    postImageIds?: string[] | undefined;
    outcome?: string | undefined;
    nextSessionNotes?: string | undefined;
    observations?: string | undefined;
}>;
export type RegisterSessionInput = z.infer<typeof registerSessionSchema>;
export declare const correctSessionSchema: z.ZodObject<{
    sessionId: z.ZodString;
    justification: z.ZodString;
    correction: z.ZodObject<{
        durationMin: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        appointmentId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        performedAt: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
        parameters: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        patientResponse: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        adverseEvents: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
            description: z.ZodString;
            severity: z.ZodEnum<["leve", "moderado", "grave"]>;
            action: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            severity: "leve" | "moderado" | "grave";
            action?: string | undefined;
        }, {
            description: string;
            severity: "leve" | "moderado" | "grave";
            action?: string | undefined;
        }>, "many">>>;
        productsConsumed: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
            productId: z.ZodString;
            quantity: z.ZodNumber;
            lotId: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            quantity: number;
            productId: string;
            notes?: string | undefined;
            lotId?: string | undefined;
        }, {
            quantity: number;
            productId: string;
            notes?: string | undefined;
            lotId?: string | undefined;
        }>, "many">>>;
        preImageIds: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
        postImageIds: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
        outcome: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        nextSessionNotes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        observations: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        durationMin?: number | undefined;
        appointmentId?: string | undefined;
        performedAt?: Date | undefined;
        parameters?: Record<string, unknown> | undefined;
        patientResponse?: string | undefined;
        adverseEvents?: {
            description: string;
            severity: "leve" | "moderado" | "grave";
            action?: string | undefined;
        }[] | undefined;
        productsConsumed?: {
            quantity: number;
            productId: string;
            notes?: string | undefined;
            lotId?: string | undefined;
        }[] | undefined;
        preImageIds?: string[] | undefined;
        postImageIds?: string[] | undefined;
        outcome?: string | undefined;
        nextSessionNotes?: string | undefined;
        observations?: string | undefined;
    }, {
        durationMin?: number | undefined;
        appointmentId?: string | undefined;
        performedAt?: Date | undefined;
        parameters?: Record<string, unknown> | undefined;
        patientResponse?: string | undefined;
        adverseEvents?: {
            description: string;
            severity: "leve" | "moderado" | "grave";
            action?: string | undefined;
        }[] | undefined;
        productsConsumed?: {
            quantity: number;
            productId: string;
            notes?: string | undefined;
            lotId?: string | undefined;
        }[] | undefined;
        preImageIds?: string[] | undefined;
        postImageIds?: string[] | undefined;
        outcome?: string | undefined;
        nextSessionNotes?: string | undefined;
        observations?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    correction: {
        durationMin?: number | undefined;
        appointmentId?: string | undefined;
        performedAt?: Date | undefined;
        parameters?: Record<string, unknown> | undefined;
        patientResponse?: string | undefined;
        adverseEvents?: {
            description: string;
            severity: "leve" | "moderado" | "grave";
            action?: string | undefined;
        }[] | undefined;
        productsConsumed?: {
            quantity: number;
            productId: string;
            notes?: string | undefined;
            lotId?: string | undefined;
        }[] | undefined;
        preImageIds?: string[] | undefined;
        postImageIds?: string[] | undefined;
        outcome?: string | undefined;
        nextSessionNotes?: string | undefined;
        observations?: string | undefined;
    };
    justification: string;
    sessionId: string;
}, {
    correction: {
        durationMin?: number | undefined;
        appointmentId?: string | undefined;
        performedAt?: Date | undefined;
        parameters?: Record<string, unknown> | undefined;
        patientResponse?: string | undefined;
        adverseEvents?: {
            description: string;
            severity: "leve" | "moderado" | "grave";
            action?: string | undefined;
        }[] | undefined;
        productsConsumed?: {
            quantity: number;
            productId: string;
            notes?: string | undefined;
            lotId?: string | undefined;
        }[] | undefined;
        preImageIds?: string[] | undefined;
        postImageIds?: string[] | undefined;
        outcome?: string | undefined;
        nextSessionNotes?: string | undefined;
        observations?: string | undefined;
    };
    justification: string;
    sessionId: string;
}>;
export type CorrectSessionInput = z.infer<typeof correctSessionSchema>;
export declare const suggestNextSessionSchema: z.ZodObject<{
    protocolId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    protocolId: string;
}, {
    protocolId: string;
}>;
export declare const listProtocolsByPatientSchema: z.ZodObject<{
    patientId: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["ativo", "pausado", "concluido", "cancelado"]>>;
}, "strip", z.ZodTypeAny, {
    patientId: string;
    status?: "ativo" | "pausado" | "concluido" | "cancelado" | undefined;
}, {
    patientId: string;
    status?: "ativo" | "pausado" | "concluido" | "cancelado" | undefined;
}>;
export type ListProtocolsQuery = z.infer<typeof listProtocolsByPatientSchema>;
export declare const getProtocolByIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const listProtocolSessionsSchema: z.ZodObject<{
    protocolId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    protocolId: string;
}, {
    protocolId: string;
}>;
export declare const getProtocolSessionByIdSchema: z.ZodObject<{
    sessionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
}, {
    sessionId: string;
}>;
//# sourceMappingURL=protocol.schema.d.ts.map
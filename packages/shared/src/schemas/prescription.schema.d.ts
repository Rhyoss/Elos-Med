import { z } from 'zod';
export declare const PRESCRIPTION_TYPES: readonly ["topica", "sistemica", "manipulada", "cosmeceutica"];
export declare const prescriptionTypeSchema: z.ZodEnum<["topica", "sistemica", "manipulada", "cosmeceutica"]>;
export type PrescriptionType = z.infer<typeof prescriptionTypeSchema>;
export declare const PRESCRIPTION_TYPE_LABELS: Record<PrescriptionType, string>;
export declare const prescriptionStatusSchema: z.ZodEnum<["rascunho", "emitida", "assinada", "enviada_digital", "impressa", "expirada", "cancelada"]>;
export type PrescriptionStatus = z.infer<typeof prescriptionStatusSchema>;
export declare const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string>;
export declare const prescriptionDeliveryStatusSchema: z.ZodEnum<["pending", "sent_mock", "delivered", "failed"]>;
export type PrescriptionDeliveryStatus = z.infer<typeof prescriptionDeliveryStatusSchema>;
export declare const topicaItemSchema: z.ZodObject<{
    type: z.ZodLiteral<"topica">;
    name: z.ZodString;
    concentration: z.ZodOptional<z.ZodString>;
    applicationArea: z.ZodString;
    frequency: z.ZodString;
    durationDays: z.ZodOptional<z.ZodNumber>;
    instructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "topica";
    name: string;
    applicationArea: string;
    frequency: string;
    concentration?: string | undefined;
    durationDays?: number | undefined;
    instructions?: string | undefined;
}, {
    type: "topica";
    name: string;
    applicationArea: string;
    frequency: string;
    concentration?: string | undefined;
    durationDays?: number | undefined;
    instructions?: string | undefined;
}>;
export type TopicaItem = z.infer<typeof topicaItemSchema>;
export declare const sistemicaItemSchema: z.ZodObject<{
    type: z.ZodLiteral<"sistemica">;
    name: z.ZodString;
    dosage: z.ZodString;
    form: z.ZodOptional<z.ZodString>;
    route: z.ZodOptional<z.ZodString>;
    frequency: z.ZodString;
    durationDays: z.ZodNumber;
    quantity: z.ZodOptional<z.ZodNumber>;
    continuousUse: z.ZodDefault<z.ZodBoolean>;
    instructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "sistemica";
    name: string;
    frequency: string;
    durationDays: number;
    dosage: string;
    continuousUse: boolean;
    instructions?: string | undefined;
    form?: string | undefined;
    route?: string | undefined;
    quantity?: number | undefined;
}, {
    type: "sistemica";
    name: string;
    frequency: string;
    durationDays: number;
    dosage: string;
    instructions?: string | undefined;
    form?: string | undefined;
    route?: string | undefined;
    quantity?: number | undefined;
    continuousUse?: boolean | undefined;
}>;
export type SistemicaItem = z.infer<typeof sistemicaItemSchema>;
export declare const manipuladaComponentSchema: z.ZodObject<{
    substance: z.ZodString;
    concentration: z.ZodString;
}, "strip", z.ZodTypeAny, {
    concentration: string;
    substance: string;
}, {
    concentration: string;
    substance: string;
}>;
export type ManipuladaComponent = z.infer<typeof manipuladaComponentSchema>;
export declare const manipuladaItemSchema: z.ZodObject<{
    type: z.ZodLiteral<"manipulada">;
    formulation: z.ZodString;
    vehicle: z.ZodString;
    components: z.ZodArray<z.ZodObject<{
        substance: z.ZodString;
        concentration: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        concentration: string;
        substance: string;
    }, {
        concentration: string;
        substance: string;
    }>, "many">;
    quantity: z.ZodString;
    applicationArea: z.ZodString;
    frequency: z.ZodString;
    durationDays: z.ZodOptional<z.ZodNumber>;
    instructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "manipulada";
    applicationArea: string;
    frequency: string;
    quantity: string;
    formulation: string;
    vehicle: string;
    components: {
        concentration: string;
        substance: string;
    }[];
    durationDays?: number | undefined;
    instructions?: string | undefined;
}, {
    type: "manipulada";
    applicationArea: string;
    frequency: string;
    quantity: string;
    formulation: string;
    vehicle: string;
    components: {
        concentration: string;
        substance: string;
    }[];
    durationDays?: number | undefined;
    instructions?: string | undefined;
}>;
export type ManipuladaItem = z.infer<typeof manipuladaItemSchema>;
export declare const cosmeceuticaItemSchema: z.ZodObject<{
    type: z.ZodLiteral<"cosmeceutica">;
    name: z.ZodString;
    brand: z.ZodOptional<z.ZodString>;
    applicationArea: z.ZodString;
    frequency: z.ZodString;
    instructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "cosmeceutica";
    name: string;
    applicationArea: string;
    frequency: string;
    instructions?: string | undefined;
    brand?: string | undefined;
}, {
    type: "cosmeceutica";
    name: string;
    applicationArea: string;
    frequency: string;
    instructions?: string | undefined;
    brand?: string | undefined;
}>;
export type CosmeceuticaItem = z.infer<typeof cosmeceuticaItemSchema>;
export declare const prescriptionItemSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"topica">;
    name: z.ZodString;
    concentration: z.ZodOptional<z.ZodString>;
    applicationArea: z.ZodString;
    frequency: z.ZodString;
    durationDays: z.ZodOptional<z.ZodNumber>;
    instructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "topica";
    name: string;
    applicationArea: string;
    frequency: string;
    concentration?: string | undefined;
    durationDays?: number | undefined;
    instructions?: string | undefined;
}, {
    type: "topica";
    name: string;
    applicationArea: string;
    frequency: string;
    concentration?: string | undefined;
    durationDays?: number | undefined;
    instructions?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"sistemica">;
    name: z.ZodString;
    dosage: z.ZodString;
    form: z.ZodOptional<z.ZodString>;
    route: z.ZodOptional<z.ZodString>;
    frequency: z.ZodString;
    durationDays: z.ZodNumber;
    quantity: z.ZodOptional<z.ZodNumber>;
    continuousUse: z.ZodDefault<z.ZodBoolean>;
    instructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "sistemica";
    name: string;
    frequency: string;
    durationDays: number;
    dosage: string;
    continuousUse: boolean;
    instructions?: string | undefined;
    form?: string | undefined;
    route?: string | undefined;
    quantity?: number | undefined;
}, {
    type: "sistemica";
    name: string;
    frequency: string;
    durationDays: number;
    dosage: string;
    instructions?: string | undefined;
    form?: string | undefined;
    route?: string | undefined;
    quantity?: number | undefined;
    continuousUse?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"manipulada">;
    formulation: z.ZodString;
    vehicle: z.ZodString;
    components: z.ZodArray<z.ZodObject<{
        substance: z.ZodString;
        concentration: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        concentration: string;
        substance: string;
    }, {
        concentration: string;
        substance: string;
    }>, "many">;
    quantity: z.ZodString;
    applicationArea: z.ZodString;
    frequency: z.ZodString;
    durationDays: z.ZodOptional<z.ZodNumber>;
    instructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "manipulada";
    applicationArea: string;
    frequency: string;
    quantity: string;
    formulation: string;
    vehicle: string;
    components: {
        concentration: string;
        substance: string;
    }[];
    durationDays?: number | undefined;
    instructions?: string | undefined;
}, {
    type: "manipulada";
    applicationArea: string;
    frequency: string;
    quantity: string;
    formulation: string;
    vehicle: string;
    components: {
        concentration: string;
        substance: string;
    }[];
    durationDays?: number | undefined;
    instructions?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"cosmeceutica">;
    name: z.ZodString;
    brand: z.ZodOptional<z.ZodString>;
    applicationArea: z.ZodString;
    frequency: z.ZodString;
    instructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "cosmeceutica";
    name: string;
    applicationArea: string;
    frequency: string;
    instructions?: string | undefined;
    brand?: string | undefined;
}, {
    type: "cosmeceutica";
    name: string;
    applicationArea: string;
    frequency: string;
    instructions?: string | undefined;
    brand?: string | undefined;
}>]>;
export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;
export declare const createPrescriptionSchema: z.ZodEffects<z.ZodObject<{
    patientId: z.ZodString;
    encounterId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["topica", "sistemica", "manipulada", "cosmeceutica"]>;
    items: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"topica">;
        name: z.ZodString;
        concentration: z.ZodOptional<z.ZodString>;
        applicationArea: z.ZodString;
        frequency: z.ZodString;
        durationDays: z.ZodOptional<z.ZodNumber>;
        instructions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "topica";
        name: string;
        applicationArea: string;
        frequency: string;
        concentration?: string | undefined;
        durationDays?: number | undefined;
        instructions?: string | undefined;
    }, {
        type: "topica";
        name: string;
        applicationArea: string;
        frequency: string;
        concentration?: string | undefined;
        durationDays?: number | undefined;
        instructions?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"sistemica">;
        name: z.ZodString;
        dosage: z.ZodString;
        form: z.ZodOptional<z.ZodString>;
        route: z.ZodOptional<z.ZodString>;
        frequency: z.ZodString;
        durationDays: z.ZodNumber;
        quantity: z.ZodOptional<z.ZodNumber>;
        continuousUse: z.ZodDefault<z.ZodBoolean>;
        instructions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "sistemica";
        name: string;
        frequency: string;
        durationDays: number;
        dosage: string;
        continuousUse: boolean;
        instructions?: string | undefined;
        form?: string | undefined;
        route?: string | undefined;
        quantity?: number | undefined;
    }, {
        type: "sistemica";
        name: string;
        frequency: string;
        durationDays: number;
        dosage: string;
        instructions?: string | undefined;
        form?: string | undefined;
        route?: string | undefined;
        quantity?: number | undefined;
        continuousUse?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"manipulada">;
        formulation: z.ZodString;
        vehicle: z.ZodString;
        components: z.ZodArray<z.ZodObject<{
            substance: z.ZodString;
            concentration: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            concentration: string;
            substance: string;
        }, {
            concentration: string;
            substance: string;
        }>, "many">;
        quantity: z.ZodString;
        applicationArea: z.ZodString;
        frequency: z.ZodString;
        durationDays: z.ZodOptional<z.ZodNumber>;
        instructions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "manipulada";
        applicationArea: string;
        frequency: string;
        quantity: string;
        formulation: string;
        vehicle: string;
        components: {
            concentration: string;
            substance: string;
        }[];
        durationDays?: number | undefined;
        instructions?: string | undefined;
    }, {
        type: "manipulada";
        applicationArea: string;
        frequency: string;
        quantity: string;
        formulation: string;
        vehicle: string;
        components: {
            concentration: string;
            substance: string;
        }[];
        durationDays?: number | undefined;
        instructions?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"cosmeceutica">;
        name: z.ZodString;
        brand: z.ZodOptional<z.ZodString>;
        applicationArea: z.ZodString;
        frequency: z.ZodString;
        instructions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "cosmeceutica";
        name: string;
        applicationArea: string;
        frequency: string;
        instructions?: string | undefined;
        brand?: string | undefined;
    }, {
        type: "cosmeceutica";
        name: string;
        applicationArea: string;
        frequency: string;
        instructions?: string | undefined;
        brand?: string | undefined;
    }>]>, "many">;
    notes: z.ZodOptional<z.ZodString>;
    validUntil: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    type: "topica" | "sistemica" | "manipulada" | "cosmeceutica";
    patientId: string;
    items: ({
        type: "topica";
        name: string;
        applicationArea: string;
        frequency: string;
        concentration?: string | undefined;
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "sistemica";
        name: string;
        frequency: string;
        durationDays: number;
        dosage: string;
        continuousUse: boolean;
        instructions?: string | undefined;
        form?: string | undefined;
        route?: string | undefined;
        quantity?: number | undefined;
    } | {
        type: "manipulada";
        applicationArea: string;
        frequency: string;
        quantity: string;
        formulation: string;
        vehicle: string;
        components: {
            concentration: string;
            substance: string;
        }[];
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "cosmeceutica";
        name: string;
        applicationArea: string;
        frequency: string;
        instructions?: string | undefined;
        brand?: string | undefined;
    })[];
    notes?: string | undefined;
    encounterId?: string | undefined;
    validUntil?: Date | undefined;
}, {
    type: "topica" | "sistemica" | "manipulada" | "cosmeceutica";
    patientId: string;
    items: ({
        type: "topica";
        name: string;
        applicationArea: string;
        frequency: string;
        concentration?: string | undefined;
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "sistemica";
        name: string;
        frequency: string;
        durationDays: number;
        dosage: string;
        instructions?: string | undefined;
        form?: string | undefined;
        route?: string | undefined;
        quantity?: number | undefined;
        continuousUse?: boolean | undefined;
    } | {
        type: "manipulada";
        applicationArea: string;
        frequency: string;
        quantity: string;
        formulation: string;
        vehicle: string;
        components: {
            concentration: string;
            substance: string;
        }[];
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "cosmeceutica";
        name: string;
        applicationArea: string;
        frequency: string;
        instructions?: string | undefined;
        brand?: string | undefined;
    })[];
    notes?: string | undefined;
    encounterId?: string | undefined;
    validUntil?: Date | undefined;
}>, {
    type: "topica" | "sistemica" | "manipulada" | "cosmeceutica";
    patientId: string;
    items: ({
        type: "topica";
        name: string;
        applicationArea: string;
        frequency: string;
        concentration?: string | undefined;
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "sistemica";
        name: string;
        frequency: string;
        durationDays: number;
        dosage: string;
        continuousUse: boolean;
        instructions?: string | undefined;
        form?: string | undefined;
        route?: string | undefined;
        quantity?: number | undefined;
    } | {
        type: "manipulada";
        applicationArea: string;
        frequency: string;
        quantity: string;
        formulation: string;
        vehicle: string;
        components: {
            concentration: string;
            substance: string;
        }[];
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "cosmeceutica";
        name: string;
        applicationArea: string;
        frequency: string;
        instructions?: string | undefined;
        brand?: string | undefined;
    })[];
    notes?: string | undefined;
    encounterId?: string | undefined;
    validUntil?: Date | undefined;
}, {
    type: "topica" | "sistemica" | "manipulada" | "cosmeceutica";
    patientId: string;
    items: ({
        type: "topica";
        name: string;
        applicationArea: string;
        frequency: string;
        concentration?: string | undefined;
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "sistemica";
        name: string;
        frequency: string;
        durationDays: number;
        dosage: string;
        instructions?: string | undefined;
        form?: string | undefined;
        route?: string | undefined;
        quantity?: number | undefined;
        continuousUse?: boolean | undefined;
    } | {
        type: "manipulada";
        applicationArea: string;
        frequency: string;
        quantity: string;
        formulation: string;
        vehicle: string;
        components: {
            concentration: string;
            substance: string;
        }[];
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "cosmeceutica";
        name: string;
        applicationArea: string;
        frequency: string;
        instructions?: string | undefined;
        brand?: string | undefined;
    })[];
    notes?: string | undefined;
    encounterId?: string | undefined;
    validUntil?: Date | undefined;
}>;
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export declare const updatePrescriptionSchema: z.ZodObject<{
    id: z.ZodString;
    items: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"topica">;
        name: z.ZodString;
        concentration: z.ZodOptional<z.ZodString>;
        applicationArea: z.ZodString;
        frequency: z.ZodString;
        durationDays: z.ZodOptional<z.ZodNumber>;
        instructions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "topica";
        name: string;
        applicationArea: string;
        frequency: string;
        concentration?: string | undefined;
        durationDays?: number | undefined;
        instructions?: string | undefined;
    }, {
        type: "topica";
        name: string;
        applicationArea: string;
        frequency: string;
        concentration?: string | undefined;
        durationDays?: number | undefined;
        instructions?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"sistemica">;
        name: z.ZodString;
        dosage: z.ZodString;
        form: z.ZodOptional<z.ZodString>;
        route: z.ZodOptional<z.ZodString>;
        frequency: z.ZodString;
        durationDays: z.ZodNumber;
        quantity: z.ZodOptional<z.ZodNumber>;
        continuousUse: z.ZodDefault<z.ZodBoolean>;
        instructions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "sistemica";
        name: string;
        frequency: string;
        durationDays: number;
        dosage: string;
        continuousUse: boolean;
        instructions?: string | undefined;
        form?: string | undefined;
        route?: string | undefined;
        quantity?: number | undefined;
    }, {
        type: "sistemica";
        name: string;
        frequency: string;
        durationDays: number;
        dosage: string;
        instructions?: string | undefined;
        form?: string | undefined;
        route?: string | undefined;
        quantity?: number | undefined;
        continuousUse?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"manipulada">;
        formulation: z.ZodString;
        vehicle: z.ZodString;
        components: z.ZodArray<z.ZodObject<{
            substance: z.ZodString;
            concentration: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            concentration: string;
            substance: string;
        }, {
            concentration: string;
            substance: string;
        }>, "many">;
        quantity: z.ZodString;
        applicationArea: z.ZodString;
        frequency: z.ZodString;
        durationDays: z.ZodOptional<z.ZodNumber>;
        instructions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "manipulada";
        applicationArea: string;
        frequency: string;
        quantity: string;
        formulation: string;
        vehicle: string;
        components: {
            concentration: string;
            substance: string;
        }[];
        durationDays?: number | undefined;
        instructions?: string | undefined;
    }, {
        type: "manipulada";
        applicationArea: string;
        frequency: string;
        quantity: string;
        formulation: string;
        vehicle: string;
        components: {
            concentration: string;
            substance: string;
        }[];
        durationDays?: number | undefined;
        instructions?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"cosmeceutica">;
        name: z.ZodString;
        brand: z.ZodOptional<z.ZodString>;
        applicationArea: z.ZodString;
        frequency: z.ZodString;
        instructions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "cosmeceutica";
        name: string;
        applicationArea: string;
        frequency: string;
        instructions?: string | undefined;
        brand?: string | undefined;
    }, {
        type: "cosmeceutica";
        name: string;
        applicationArea: string;
        frequency: string;
        instructions?: string | undefined;
        brand?: string | undefined;
    }>]>, "many">>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    validUntil: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    notes?: string | null | undefined;
    items?: ({
        type: "topica";
        name: string;
        applicationArea: string;
        frequency: string;
        concentration?: string | undefined;
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "sistemica";
        name: string;
        frequency: string;
        durationDays: number;
        dosage: string;
        continuousUse: boolean;
        instructions?: string | undefined;
        form?: string | undefined;
        route?: string | undefined;
        quantity?: number | undefined;
    } | {
        type: "manipulada";
        applicationArea: string;
        frequency: string;
        quantity: string;
        formulation: string;
        vehicle: string;
        components: {
            concentration: string;
            substance: string;
        }[];
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "cosmeceutica";
        name: string;
        applicationArea: string;
        frequency: string;
        instructions?: string | undefined;
        brand?: string | undefined;
    })[] | undefined;
    validUntil?: Date | null | undefined;
}, {
    id: string;
    notes?: string | null | undefined;
    items?: ({
        type: "topica";
        name: string;
        applicationArea: string;
        frequency: string;
        concentration?: string | undefined;
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "sistemica";
        name: string;
        frequency: string;
        durationDays: number;
        dosage: string;
        instructions?: string | undefined;
        form?: string | undefined;
        route?: string | undefined;
        quantity?: number | undefined;
        continuousUse?: boolean | undefined;
    } | {
        type: "manipulada";
        applicationArea: string;
        frequency: string;
        quantity: string;
        formulation: string;
        vehicle: string;
        components: {
            concentration: string;
            substance: string;
        }[];
        durationDays?: number | undefined;
        instructions?: string | undefined;
    } | {
        type: "cosmeceutica";
        name: string;
        applicationArea: string;
        frequency: string;
        instructions?: string | undefined;
        brand?: string | undefined;
    })[] | undefined;
    validUntil?: Date | null | undefined;
}>;
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>;
export declare const signPrescriptionSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type SignPrescriptionInput = z.infer<typeof signPrescriptionSchema>;
export declare const duplicatePrescriptionSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type DuplicatePrescriptionInput = z.infer<typeof duplicatePrescriptionSchema>;
export declare const cancelPrescriptionSchema: z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    id: string;
}, {
    reason: string;
    id: string;
}>;
export type CancelPrescriptionInput = z.infer<typeof cancelPrescriptionSchema>;
export declare const sendPrescriptionSchema: z.ZodObject<{
    id: z.ZodString;
    channel: z.ZodDefault<z.ZodEnum<["email", "sms", "whatsapp", "portal"]>>;
    recipient: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    channel: "email" | "whatsapp" | "sms" | "portal";
    recipient?: string | undefined;
}, {
    id: string;
    channel?: "email" | "whatsapp" | "sms" | "portal" | undefined;
    recipient?: string | undefined;
}>;
export type SendPrescriptionInput = z.infer<typeof sendPrescriptionSchema>;
export declare const listPrescriptionsByPatientSchema: z.ZodObject<{
    patientId: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["rascunho", "emitida", "assinada", "enviada_digital", "impressa", "expirada", "cancelada"]>>;
    type: z.ZodOptional<z.ZodEnum<["topica", "sistemica", "manipulada", "cosmeceutica"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    patientId: string;
    type?: "topica" | "sistemica" | "manipulada" | "cosmeceutica" | undefined;
    status?: "rascunho" | "emitida" | "assinada" | "enviada_digital" | "impressa" | "expirada" | "cancelada" | undefined;
}, {
    patientId: string;
    type?: "topica" | "sistemica" | "manipulada" | "cosmeceutica" | undefined;
    status?: "rascunho" | "emitida" | "assinada" | "enviada_digital" | "impressa" | "expirada" | "cancelada" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type ListPrescriptionsQuery = z.infer<typeof listPrescriptionsByPatientSchema>;
export declare const getPrescriptionByIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const requestPrescriptionPdfSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export interface PrescriptionTypeField {
    key: string;
    label: string;
    kind: 'text' | 'textarea' | 'number' | 'select' | 'switch' | 'components';
    required: boolean;
    placeholder?: string;
    options?: readonly {
        value: string;
        label: string;
    }[];
    maxLength?: number;
    min?: number;
    max?: number;
}
export declare const PRESCRIPTION_TYPE_FIELDS: Record<PrescriptionType, readonly PrescriptionTypeField[]>;
//# sourceMappingURL=prescription.schema.d.ts.map
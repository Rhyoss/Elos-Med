import { z } from 'zod';
export declare const encounterTypeSchema: z.ZodEnum<["clinical", "aesthetic", "followup", "emergency", "telemedicine"]>;
export declare const encounterStatusSchema: z.ZodEnum<["rascunho", "revisao", "assinado", "corrigido"]>;
export declare const vitalSignsSchema: z.ZodObject<{
    bloodPressureSys: z.ZodOptional<z.ZodNumber>;
    bloodPressureDia: z.ZodOptional<z.ZodNumber>;
    heartRate: z.ZodOptional<z.ZodNumber>;
    temperatureC: z.ZodOptional<z.ZodNumber>;
    oxygenSaturation: z.ZodOptional<z.ZodNumber>;
    weightKg: z.ZodOptional<z.ZodNumber>;
    heightCm: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    bloodPressureSys?: number | undefined;
    bloodPressureDia?: number | undefined;
    heartRate?: number | undefined;
    temperatureC?: number | undefined;
    oxygenSaturation?: number | undefined;
    weightKg?: number | undefined;
    heightCm?: number | undefined;
    notes?: string | undefined;
}, {
    bloodPressureSys?: number | undefined;
    bloodPressureDia?: number | undefined;
    heartRate?: number | undefined;
    temperatureC?: number | undefined;
    oxygenSaturation?: number | undefined;
    weightKg?: number | undefined;
    heightCm?: number | undefined;
    notes?: string | undefined;
}>;
export type VitalSignsInput = z.infer<typeof vitalSignsSchema>;
export declare const encounterDiagnosisSchema: z.ZodObject<{
    code: z.ZodString;
    description: z.ZodString;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
    aiGenerated: z.ZodDefault<z.ZodBoolean>;
    confidence: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    code: string;
    description: string;
    isPrimary: boolean;
    aiGenerated: boolean;
    confidence?: number | undefined;
}, {
    code: string;
    description: string;
    isPrimary?: boolean | undefined;
    aiGenerated?: boolean | undefined;
    confidence?: number | undefined;
}>;
export type EncounterDiagnosisInput = z.infer<typeof encounterDiagnosisSchema>;
export declare const nextAppointmentHintSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    intervalDays: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    notes?: string | undefined;
    intervalDays?: number | undefined;
}, {
    notes?: string | undefined;
    enabled?: boolean | undefined;
    intervalDays?: number | undefined;
}>;
export declare const createEncounterSchema: z.ZodObject<{
    appointmentId: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<["clinical", "aesthetic", "followup", "emergency", "telemedicine"]>>;
}, "strip", z.ZodTypeAny, {
    type: "clinical" | "aesthetic" | "followup" | "emergency" | "telemedicine";
    appointmentId: string;
}, {
    appointmentId: string;
    type?: "clinical" | "aesthetic" | "followup" | "emergency" | "telemedicine" | undefined;
}>;
export declare const updateEncounterSchema: z.ZodObject<{
    chiefComplaint: z.ZodOptional<z.ZodString>;
    subjective: z.ZodOptional<z.ZodString>;
    objective: z.ZodOptional<z.ZodString>;
    assessment: z.ZodOptional<z.ZodString>;
    plan: z.ZodOptional<z.ZodString>;
    internalNotes: z.ZodOptional<z.ZodString>;
    diagnoses: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        description: z.ZodString;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
        aiGenerated: z.ZodDefault<z.ZodBoolean>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        description: string;
        isPrimary: boolean;
        aiGenerated: boolean;
        confidence?: number | undefined;
    }, {
        code: string;
        description: string;
        isPrimary?: boolean | undefined;
        aiGenerated?: boolean | undefined;
        confidence?: number | undefined;
    }>, "many">>;
    vitalSigns: z.ZodOptional<z.ZodObject<{
        bloodPressureSys: z.ZodOptional<z.ZodNumber>;
        bloodPressureDia: z.ZodOptional<z.ZodNumber>;
        heartRate: z.ZodOptional<z.ZodNumber>;
        temperatureC: z.ZodOptional<z.ZodNumber>;
        oxygenSaturation: z.ZodOptional<z.ZodNumber>;
        weightKg: z.ZodOptional<z.ZodNumber>;
        heightCm: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        bloodPressureSys?: number | undefined;
        bloodPressureDia?: number | undefined;
        heartRate?: number | undefined;
        temperatureC?: number | undefined;
        oxygenSaturation?: number | undefined;
        weightKg?: number | undefined;
        heightCm?: number | undefined;
        notes?: string | undefined;
    }, {
        bloodPressureSys?: number | undefined;
        bloodPressureDia?: number | undefined;
        heartRate?: number | undefined;
        temperatureC?: number | undefined;
        oxygenSaturation?: number | undefined;
        weightKg?: number | undefined;
        heightCm?: number | undefined;
        notes?: string | undefined;
    }>>;
    structuredData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    nextAppointment: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        intervalDays: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        notes?: string | undefined;
        intervalDays?: number | undefined;
    }, {
        notes?: string | undefined;
        enabled?: boolean | undefined;
        intervalDays?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    internalNotes?: string | undefined;
    chiefComplaint?: string | undefined;
    subjective?: string | undefined;
    objective?: string | undefined;
    assessment?: string | undefined;
    plan?: string | undefined;
    diagnoses?: {
        code: string;
        description: string;
        isPrimary: boolean;
        aiGenerated: boolean;
        confidence?: number | undefined;
    }[] | undefined;
    vitalSigns?: {
        bloodPressureSys?: number | undefined;
        bloodPressureDia?: number | undefined;
        heartRate?: number | undefined;
        temperatureC?: number | undefined;
        oxygenSaturation?: number | undefined;
        weightKg?: number | undefined;
        heightCm?: number | undefined;
        notes?: string | undefined;
    } | undefined;
    structuredData?: Record<string, unknown> | undefined;
    nextAppointment?: {
        enabled: boolean;
        notes?: string | undefined;
        intervalDays?: number | undefined;
    } | undefined;
}, {
    internalNotes?: string | undefined;
    chiefComplaint?: string | undefined;
    subjective?: string | undefined;
    objective?: string | undefined;
    assessment?: string | undefined;
    plan?: string | undefined;
    diagnoses?: {
        code: string;
        description: string;
        isPrimary?: boolean | undefined;
        aiGenerated?: boolean | undefined;
        confidence?: number | undefined;
    }[] | undefined;
    vitalSigns?: {
        bloodPressureSys?: number | undefined;
        bloodPressureDia?: number | undefined;
        heartRate?: number | undefined;
        temperatureC?: number | undefined;
        oxygenSaturation?: number | undefined;
        weightKg?: number | undefined;
        heightCm?: number | undefined;
        notes?: string | undefined;
    } | undefined;
    structuredData?: Record<string, unknown> | undefined;
    nextAppointment?: {
        notes?: string | undefined;
        enabled?: boolean | undefined;
        intervalDays?: number | undefined;
    } | undefined;
}>;
export declare const autoSaveEncounterSchema: z.ZodObject<{
    chiefComplaint: z.ZodOptional<z.ZodString>;
    subjective: z.ZodOptional<z.ZodString>;
    objective: z.ZodOptional<z.ZodString>;
    assessment: z.ZodOptional<z.ZodString>;
    plan: z.ZodOptional<z.ZodString>;
    internalNotes: z.ZodOptional<z.ZodString>;
    diagnoses: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        description: z.ZodString;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
        aiGenerated: z.ZodDefault<z.ZodBoolean>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        description: string;
        isPrimary: boolean;
        aiGenerated: boolean;
        confidence?: number | undefined;
    }, {
        code: string;
        description: string;
        isPrimary?: boolean | undefined;
        aiGenerated?: boolean | undefined;
        confidence?: number | undefined;
    }>, "many">>;
    vitalSigns: z.ZodOptional<z.ZodObject<{
        bloodPressureSys: z.ZodOptional<z.ZodNumber>;
        bloodPressureDia: z.ZodOptional<z.ZodNumber>;
        heartRate: z.ZodOptional<z.ZodNumber>;
        temperatureC: z.ZodOptional<z.ZodNumber>;
        oxygenSaturation: z.ZodOptional<z.ZodNumber>;
        weightKg: z.ZodOptional<z.ZodNumber>;
        heightCm: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        bloodPressureSys?: number | undefined;
        bloodPressureDia?: number | undefined;
        heartRate?: number | undefined;
        temperatureC?: number | undefined;
        oxygenSaturation?: number | undefined;
        weightKg?: number | undefined;
        heightCm?: number | undefined;
        notes?: string | undefined;
    }, {
        bloodPressureSys?: number | undefined;
        bloodPressureDia?: number | undefined;
        heartRate?: number | undefined;
        temperatureC?: number | undefined;
        oxygenSaturation?: number | undefined;
        weightKg?: number | undefined;
        heightCm?: number | undefined;
        notes?: string | undefined;
    }>>;
    structuredData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    internalNotes?: string | undefined;
    chiefComplaint?: string | undefined;
    subjective?: string | undefined;
    objective?: string | undefined;
    assessment?: string | undefined;
    plan?: string | undefined;
    diagnoses?: {
        code: string;
        description: string;
        isPrimary: boolean;
        aiGenerated: boolean;
        confidence?: number | undefined;
    }[] | undefined;
    vitalSigns?: {
        bloodPressureSys?: number | undefined;
        bloodPressureDia?: number | undefined;
        heartRate?: number | undefined;
        temperatureC?: number | undefined;
        oxygenSaturation?: number | undefined;
        weightKg?: number | undefined;
        heightCm?: number | undefined;
        notes?: string | undefined;
    } | undefined;
    structuredData?: Record<string, unknown> | undefined;
}, {
    internalNotes?: string | undefined;
    chiefComplaint?: string | undefined;
    subjective?: string | undefined;
    objective?: string | undefined;
    assessment?: string | undefined;
    plan?: string | undefined;
    diagnoses?: {
        code: string;
        description: string;
        isPrimary?: boolean | undefined;
        aiGenerated?: boolean | undefined;
        confidence?: number | undefined;
    }[] | undefined;
    vitalSigns?: {
        bloodPressureSys?: number | undefined;
        bloodPressureDia?: number | undefined;
        heartRate?: number | undefined;
        temperatureC?: number | undefined;
        oxygenSaturation?: number | undefined;
        weightKg?: number | undefined;
        heightCm?: number | undefined;
        notes?: string | undefined;
    } | undefined;
    structuredData?: Record<string, unknown> | undefined;
}>;
export declare const signEncounterSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const correctEncounterSchema: z.ZodObject<{
    id: z.ZodString;
    correction: z.ZodObject<{
        chiefComplaint: z.ZodOptional<z.ZodString>;
        subjective: z.ZodOptional<z.ZodString>;
        objective: z.ZodOptional<z.ZodString>;
        assessment: z.ZodOptional<z.ZodString>;
        plan: z.ZodOptional<z.ZodString>;
        internalNotes: z.ZodOptional<z.ZodString>;
        diagnoses: z.ZodOptional<z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            description: z.ZodString;
            isPrimary: z.ZodDefault<z.ZodBoolean>;
            aiGenerated: z.ZodDefault<z.ZodBoolean>;
            confidence: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            code: string;
            description: string;
            isPrimary: boolean;
            aiGenerated: boolean;
            confidence?: number | undefined;
        }, {
            code: string;
            description: string;
            isPrimary?: boolean | undefined;
            aiGenerated?: boolean | undefined;
            confidence?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        internalNotes?: string | undefined;
        chiefComplaint?: string | undefined;
        subjective?: string | undefined;
        objective?: string | undefined;
        assessment?: string | undefined;
        plan?: string | undefined;
        diagnoses?: {
            code: string;
            description: string;
            isPrimary: boolean;
            aiGenerated: boolean;
            confidence?: number | undefined;
        }[] | undefined;
    }, {
        internalNotes?: string | undefined;
        chiefComplaint?: string | undefined;
        subjective?: string | undefined;
        objective?: string | undefined;
        assessment?: string | undefined;
        plan?: string | undefined;
        diagnoses?: {
            code: string;
            description: string;
            isPrimary?: boolean | undefined;
            aiGenerated?: boolean | undefined;
            confidence?: number | undefined;
        }[] | undefined;
    }>;
    justification: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    correction: {
        internalNotes?: string | undefined;
        chiefComplaint?: string | undefined;
        subjective?: string | undefined;
        objective?: string | undefined;
        assessment?: string | undefined;
        plan?: string | undefined;
        diagnoses?: {
            code: string;
            description: string;
            isPrimary: boolean;
            aiGenerated: boolean;
            confidence?: number | undefined;
        }[] | undefined;
    };
    justification: string;
}, {
    id: string;
    correction: {
        internalNotes?: string | undefined;
        chiefComplaint?: string | undefined;
        subjective?: string | undefined;
        objective?: string | undefined;
        assessment?: string | undefined;
        plan?: string | undefined;
        diagnoses?: {
            code: string;
            description: string;
            isPrimary?: boolean | undefined;
            aiGenerated?: boolean | undefined;
            confidence?: number | undefined;
        }[] | undefined;
    };
    justification: string;
}>;
export declare const encounterListByPatientSchema: z.ZodObject<{
    patientId: z.ZodString;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    patientId: string;
}, {
    patientId: string;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const getEncounterByIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const aiSuggestCidsSchema: z.ZodObject<{
    soapText: z.ZodString;
}, "strip", z.ZodTypeAny, {
    soapText: string;
}, {
    soapText: string;
}>;
export declare const aiSuggestSoapSchema: z.ZodObject<{
    chiefComplaint: z.ZodString;
    patientHistory: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    chiefComplaint: string;
    patientHistory?: string | undefined;
}, {
    chiefComplaint: string;
    patientHistory?: string | undefined;
}>;
export declare const aiCidSuggestionSchema: z.ZodObject<{
    cid: z.ZodString;
    description: z.ZodString;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    description: string;
    confidence: number;
    cid: string;
}, {
    description: string;
    confidence: number;
    cid: string;
}>;
export type CreateEncounterInput = z.infer<typeof createEncounterSchema>;
export type UpdateEncounterInput = z.infer<typeof updateEncounterSchema>;
export type AutoSaveEncounterInput = z.infer<typeof autoSaveEncounterSchema>;
export type CorrectEncounterInput = z.infer<typeof correctEncounterSchema>;
export type EncounterListByPatientQuery = z.infer<typeof encounterListByPatientSchema>;
export type AiSuggestCidsInput = z.infer<typeof aiSuggestCidsSchema>;
export type AiSuggestSoapInput = z.infer<typeof aiSuggestSoapSchema>;
export type AiCidSuggestion = z.infer<typeof aiCidSuggestionSchema>;
export type NextAppointmentHint = z.infer<typeof nextAppointmentHintSchema>;
//# sourceMappingURL=encounter.schema.d.ts.map
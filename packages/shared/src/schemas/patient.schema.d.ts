import { z } from 'zod';
export declare const genderSchema: z.ZodEnum<["male", "female", "non_binary", "prefer_not_to_say", "other"]>;
export declare const patientStatusSchema: z.ZodEnum<["active", "inactive", "blocked", "deceased", "transferred", "merged"]>;
export declare const createPatientSchema: z.ZodObject<{
    name: z.ZodString;
    cpf: z.ZodOptional<z.ZodString>;
    birthDate: z.ZodOptional<z.ZodDate>;
    gender: z.ZodOptional<z.ZodEnum<["male", "female", "non_binary", "prefer_not_to_say", "other"]>>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    phoneSecondary: z.ZodOptional<z.ZodString>;
    bloodType: z.ZodOptional<z.ZodEnum<["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]>>;
    allergies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    chronicConditions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    activeMedications: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    address: z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        number: z.ZodOptional<z.ZodString>;
        complement: z.ZodOptional<z.ZodString>;
        district: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        zip: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        number?: string | undefined;
        street?: string | undefined;
        complement?: string | undefined;
        district?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    }, {
        number?: string | undefined;
        street?: string | undefined;
        complement?: string | undefined;
        district?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    }>>;
    sourceChannel: z.ZodOptional<z.ZodString>;
    sourceCampaign: z.ZodOptional<z.ZodString>;
    referredBy: z.ZodOptional<z.ZodString>;
    portalEnabled: z.ZodDefault<z.ZodBoolean>;
    portalEmail: z.ZodOptional<z.ZodString>;
    internalNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    allergies: string[];
    chronicConditions: string[];
    activeMedications: string[];
    portalEnabled: boolean;
    email?: string | undefined;
    cpf?: string | undefined;
    birthDate?: Date | undefined;
    gender?: "male" | "female" | "non_binary" | "prefer_not_to_say" | "other" | undefined;
    phone?: string | undefined;
    phoneSecondary?: string | undefined;
    bloodType?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | undefined;
    address?: {
        number?: string | undefined;
        street?: string | undefined;
        complement?: string | undefined;
        district?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    } | undefined;
    sourceChannel?: string | undefined;
    sourceCampaign?: string | undefined;
    referredBy?: string | undefined;
    portalEmail?: string | undefined;
    internalNotes?: string | undefined;
}, {
    name: string;
    email?: string | undefined;
    cpf?: string | undefined;
    birthDate?: Date | undefined;
    gender?: "male" | "female" | "non_binary" | "prefer_not_to_say" | "other" | undefined;
    phone?: string | undefined;
    phoneSecondary?: string | undefined;
    bloodType?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | undefined;
    allergies?: string[] | undefined;
    chronicConditions?: string[] | undefined;
    activeMedications?: string[] | undefined;
    address?: {
        number?: string | undefined;
        street?: string | undefined;
        complement?: string | undefined;
        district?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    } | undefined;
    sourceChannel?: string | undefined;
    sourceCampaign?: string | undefined;
    referredBy?: string | undefined;
    portalEnabled?: boolean | undefined;
    portalEmail?: string | undefined;
    internalNotes?: string | undefined;
}>;
export declare const updatePatientSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    cpf: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    birthDate: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    gender: z.ZodOptional<z.ZodOptional<z.ZodEnum<["male", "female", "non_binary", "prefer_not_to_say", "other"]>>>;
    email: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    phoneSecondary: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    bloodType: z.ZodOptional<z.ZodOptional<z.ZodEnum<["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]>>>;
    allergies: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    chronicConditions: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    activeMedications: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    address: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        number: z.ZodOptional<z.ZodString>;
        complement: z.ZodOptional<z.ZodString>;
        district: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        zip: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        number?: string | undefined;
        street?: string | undefined;
        complement?: string | undefined;
        district?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    }, {
        number?: string | undefined;
        street?: string | undefined;
        complement?: string | undefined;
        district?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    }>>>;
    sourceChannel: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    sourceCampaign: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    referredBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    portalEnabled: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    portalEmail: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    internalNotes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    email?: string | undefined;
    cpf?: string | undefined;
    birthDate?: Date | undefined;
    gender?: "male" | "female" | "non_binary" | "prefer_not_to_say" | "other" | undefined;
    phone?: string | undefined;
    phoneSecondary?: string | undefined;
    bloodType?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | undefined;
    allergies?: string[] | undefined;
    chronicConditions?: string[] | undefined;
    activeMedications?: string[] | undefined;
    address?: {
        number?: string | undefined;
        street?: string | undefined;
        complement?: string | undefined;
        district?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    } | undefined;
    sourceChannel?: string | undefined;
    sourceCampaign?: string | undefined;
    referredBy?: string | undefined;
    portalEnabled?: boolean | undefined;
    portalEmail?: string | undefined;
    internalNotes?: string | undefined;
}, {
    name?: string | undefined;
    email?: string | undefined;
    cpf?: string | undefined;
    birthDate?: Date | undefined;
    gender?: "male" | "female" | "non_binary" | "prefer_not_to_say" | "other" | undefined;
    phone?: string | undefined;
    phoneSecondary?: string | undefined;
    bloodType?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | undefined;
    allergies?: string[] | undefined;
    chronicConditions?: string[] | undefined;
    activeMedications?: string[] | undefined;
    address?: {
        number?: string | undefined;
        street?: string | undefined;
        complement?: string | undefined;
        district?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    } | undefined;
    sourceChannel?: string | undefined;
    sourceCampaign?: string | undefined;
    referredBy?: string | undefined;
    portalEnabled?: boolean | undefined;
    portalEmail?: string | undefined;
    internalNotes?: string | undefined;
}>;
export declare const patientListQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "blocked", "deceased", "transferred", "merged"]>>;
    source: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["name", "createdAt", "lastVisitAt"]>>;
    sortDir: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "name" | "createdAt" | "lastVisitAt";
    sortDir: "asc" | "desc";
    status?: "active" | "inactive" | "blocked" | "deceased" | "transferred" | "merged" | undefined;
    search?: string | undefined;
    source?: string | undefined;
}, {
    status?: "active" | "inactive" | "blocked" | "deceased" | "transferred" | "merged" | undefined;
    search?: string | undefined;
    source?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "name" | "createdAt" | "lastVisitAt" | undefined;
    sortDir?: "asc" | "desc" | undefined;
}>;
export declare const searchPatientSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "blocked", "deceased", "transferred", "merged"]>>;
    source: z.ZodOptional<z.ZodString>;
    dateRange: z.ZodOptional<z.ZodObject<{
        from: z.ZodOptional<z.ZodDate>;
        to: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        from?: Date | undefined;
        to?: Date | undefined;
    }, {
        from?: Date | undefined;
        to?: Date | undefined;
    }>>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sort: z.ZodDefault<z.ZodEnum<["name", "createdAt", "lastVisitAt"]>>;
    sortDir: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    sort: "name" | "createdAt" | "lastVisitAt";
    page: number;
    sortDir: "asc" | "desc";
    limit: number;
    status?: "active" | "inactive" | "blocked" | "deceased" | "transferred" | "merged" | undefined;
    source?: string | undefined;
    query?: string | undefined;
    dateRange?: {
        from?: Date | undefined;
        to?: Date | undefined;
    } | undefined;
}, {
    sort?: "name" | "createdAt" | "lastVisitAt" | undefined;
    status?: "active" | "inactive" | "blocked" | "deceased" | "transferred" | "merged" | undefined;
    source?: string | undefined;
    page?: number | undefined;
    sortDir?: "asc" | "desc" | undefined;
    query?: string | undefined;
    dateRange?: {
        from?: Date | undefined;
        to?: Date | undefined;
    } | undefined;
    limit?: number | undefined;
}>;
export declare const mergePatientSchema: z.ZodEffects<z.ZodObject<{
    primaryId: z.ZodString;
    secondaryId: z.ZodString;
    fieldsToKeep: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEnum<["primary", "secondary"]>>>;
}, "strip", z.ZodTypeAny, {
    primaryId: string;
    secondaryId: string;
    fieldsToKeep?: Record<string, "primary" | "secondary"> | undefined;
}, {
    primaryId: string;
    secondaryId: string;
    fieldsToKeep?: Record<string, "primary" | "secondary"> | undefined;
}>, {
    primaryId: string;
    secondaryId: string;
    fieldsToKeep?: Record<string, "primary" | "secondary"> | undefined;
}, {
    primaryId: string;
    secondaryId: string;
    fieldsToKeep?: Record<string, "primary" | "secondary"> | undefined;
}>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;
export type SearchPatientInput = z.infer<typeof searchPatientSchema>;
export type MergePatientInput = z.infer<typeof mergePatientSchema>;
//# sourceMappingURL=patient.schema.d.ts.map
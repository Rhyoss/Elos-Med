import { z } from 'zod';
export declare const doctorDashboardInput: z.ZodObject<{
    date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date?: string | undefined;
}, {
    date?: string | undefined;
}>;
export type DoctorDashboardInput = z.infer<typeof doctorDashboardInput>;
export declare const receptionDashboardInput: z.ZodObject<{
    date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date?: string | undefined;
}, {
    date?: string | undefined;
}>;
export type ReceptionDashboardInput = z.infer<typeof receptionDashboardInput>;
export declare const adminDashboardInput: z.ZodEffects<z.ZodObject<{
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
}>;
export type AdminDashboardInput = z.infer<typeof adminDashboardInput>;
export declare const analyticsDateRange: z.ZodEffects<z.ZodObject<{
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
}>;
export type AnalyticsDateRangeInput = z.infer<typeof analyticsDateRange>;
export declare const reportRequestInput: z.ZodObject<{
    type: z.ZodEnum<["productivity_by_doctor", "epidemiological_profile", "aesthetic_procedures", "biopsies", "access_audit"]>;
    start: z.ZodString;
    end: z.ZodString;
    includePatientData: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "productivity_by_doctor" | "epidemiological_profile" | "aesthetic_procedures" | "biopsies" | "access_audit";
    end: string;
    start: string;
    includePatientData: boolean;
}, {
    type: "productivity_by_doctor" | "epidemiological_profile" | "aesthetic_procedures" | "biopsies" | "access_audit";
    end: string;
    start: string;
    includePatientData?: boolean | undefined;
}>;
export type ReportRequestInput = z.infer<typeof reportRequestInput>;
export declare const csvExportInput: z.ZodObject<{
    resource: z.ZodEnum<["appointments", "payments", "patients", "biopsies", "movements"]>;
    start: z.ZodString;
    end: z.ZodString;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    end: string;
    start: string;
    resource: "biopsies" | "appointments" | "payments" | "patients" | "movements";
    filters?: Record<string, unknown> | undefined;
}, {
    end: string;
    start: string;
    resource: "biopsies" | "appointments" | "payments" | "patients" | "movements";
    filters?: Record<string, unknown> | undefined;
}>;
export type CsvExportInput = z.infer<typeof csvExportInput>;
export declare const analyticsOverviewInput: z.ZodEffects<z.ZodObject<{
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
}>;
export type AnalyticsOverviewInput = z.infer<typeof analyticsOverviewInput>;
export declare const patientJourneyInput: z.ZodEffects<z.ZodObject<{
    start: z.ZodString;
    end: z.ZodString;
    cohortMonths: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    end: string;
    start: string;
    cohortMonths: number;
}, {
    end: string;
    start: string;
    cohortMonths?: number | undefined;
}>, {
    end: string;
    start: string;
    cohortMonths: number;
}, {
    end: string;
    start: string;
    cohortMonths?: number | undefined;
}>;
export type PatientJourneyInput = z.infer<typeof patientJourneyInput>;
export declare const supplyIntelligenceInput: z.ZodEffects<z.ZodObject<{
    start: z.ZodString;
    end: z.ZodString;
    topN: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    end: string;
    start: string;
    topN: number;
}, {
    end: string;
    start: string;
    topN?: number | undefined;
}>, {
    end: string;
    start: string;
    topN: number;
}, {
    end: string;
    start: string;
    topN?: number | undefined;
}>;
export type SupplyIntelligenceInput = z.infer<typeof supplyIntelligenceInput>;
export declare const omniPerformanceInput: z.ZodEffects<z.ZodObject<{
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
}>;
export type OmniPerformanceInput = z.infer<typeof omniPerformanceInput>;
export declare const financialAdvancedInput: z.ZodEffects<z.ZodObject<{
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
}>;
export type FinancialAdvancedInput = z.infer<typeof financialAdvancedInput>;
export declare const analyticsExportInput: z.ZodEffects<z.ZodObject<{
    tab: z.ZodEnum<["overview", "journey", "supply", "omni", "financial"]>;
    format: z.ZodEnum<["pdf", "csv"]>;
    start: z.ZodString;
    end: z.ZodString;
}, "strip", z.ZodTypeAny, {
    end: string;
    start: string;
    tab: "financial" | "overview" | "journey" | "supply" | "omni";
    format: "pdf" | "csv";
}, {
    end: string;
    start: string;
    tab: "financial" | "overview" | "journey" | "supply" | "omni";
    format: "pdf" | "csv";
}>, {
    end: string;
    start: string;
    tab: "financial" | "overview" | "journey" | "supply" | "omni";
    format: "pdf" | "csv";
}, {
    end: string;
    start: string;
    tab: "financial" | "overview" | "journey" | "supply" | "omni";
    format: "pdf" | "csv";
}>;
export type AnalyticsExportInput = z.infer<typeof analyticsExportInput>;
//# sourceMappingURL=dashboard.schema.d.ts.map
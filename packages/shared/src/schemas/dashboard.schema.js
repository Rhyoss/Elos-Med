"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsExportInput = exports.financialAdvancedInput = exports.omniPerformanceInput = exports.supplyIntelligenceInput = exports.patientJourneyInput = exports.analyticsOverviewInput = exports.csvExportInput = exports.reportRequestInput = exports.analyticsDateRange = exports.adminDashboardInput = exports.receptionDashboardInput = exports.doctorDashboardInput = void 0;
const zod_1 = require("zod");
const isoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD');
exports.doctorDashboardInput = zod_1.z.object({
    date: isoDate.optional(),
});
exports.receptionDashboardInput = zod_1.z.object({
    date: isoDate.optional(),
});
exports.adminDashboardInput = zod_1.z
    .object({
    start: isoDate,
    end: isoDate,
})
    .superRefine((data, ctx) => {
    const start = new Date(`${data.start}T00:00:00Z`);
    const end = new Date(`${data.end}T00:00:00Z`);
    if (start > end) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Data inicial deve ser anterior ou igual à data final',
            path: ['start'],
        });
        return;
    }
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
    if (days > 365) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Período não pode exceder 365 dias',
            path: ['end'],
        });
    }
});
exports.analyticsDateRange = exports.adminDashboardInput;
exports.reportRequestInput = zod_1.z.object({
    type: zod_1.z.enum([
        'productivity_by_doctor',
        'epidemiological_profile',
        'aesthetic_procedures',
        'biopsies',
        'access_audit',
    ]),
    start: isoDate,
    end: isoDate,
    includePatientData: zod_1.z.boolean().default(false),
});
exports.csvExportInput = zod_1.z.object({
    resource: zod_1.z.enum(['appointments', 'payments', 'patients', 'biopsies', 'movements']),
    start: isoDate,
    end: isoDate,
    filters: zod_1.z.record(zod_1.z.unknown()).optional(),
});
/* ── DermaIQ Analytics — inputs por tab ───────────────────────────────────── */
exports.analyticsOverviewInput = exports.adminDashboardInput;
exports.patientJourneyInput = zod_1.z
    .object({
    start: isoDate,
    end: isoDate,
    cohortMonths: zod_1.z.number().int().min(1).max(24).default(12),
})
    .superRefine((data, ctx) => {
    const start = new Date(`${data.start}T00:00:00Z`);
    const end = new Date(`${data.end}T00:00:00Z`);
    if (start > end) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Data inicial deve ser anterior ou igual à data final',
            path: ['start'],
        });
        return;
    }
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
    if (days > 365) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Período não pode exceder 365 dias',
            path: ['end'],
        });
    }
});
exports.supplyIntelligenceInput = zod_1.z
    .object({
    start: isoDate,
    end: isoDate,
    topN: zod_1.z.number().int().min(1).max(50).default(10),
})
    .superRefine((data, ctx) => {
    const start = new Date(`${data.start}T00:00:00Z`);
    const end = new Date(`${data.end}T00:00:00Z`);
    if (start > end) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Data inicial deve ser anterior ou igual à data final',
            path: ['start'],
        });
        return;
    }
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
    if (days > 365) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Período não pode exceder 365 dias',
            path: ['end'],
        });
    }
});
exports.omniPerformanceInput = exports.adminDashboardInput;
exports.financialAdvancedInput = exports.adminDashboardInput;
exports.analyticsExportInput = zod_1.z
    .object({
    tab: zod_1.z.enum(['overview', 'journey', 'supply', 'omni', 'financial']),
    format: zod_1.z.enum(['pdf', 'csv']),
    start: isoDate,
    end: isoDate,
})
    .superRefine((data, ctx) => {
    const start = new Date(`${data.start}T00:00:00Z`);
    const end = new Date(`${data.end}T00:00:00Z`);
    if (start > end) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Data inicial deve ser anterior ou igual à data final',
            path: ['start'],
        });
        return;
    }
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
    if (days > 365) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Período não pode exceder 365 dias',
            path: ['end'],
        });
    }
});
//# sourceMappingURL=dashboard.schema.js.map
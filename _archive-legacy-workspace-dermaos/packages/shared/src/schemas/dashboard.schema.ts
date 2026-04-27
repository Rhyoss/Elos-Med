import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD');

export const doctorDashboardInput = z.object({
  date: isoDate.optional(),
});
export type DoctorDashboardInput = z.infer<typeof doctorDashboardInput>;

export const receptionDashboardInput = z.object({
  date: isoDate.optional(),
});
export type ReceptionDashboardInput = z.infer<typeof receptionDashboardInput>;

export const adminDashboardInput = z
  .object({
    start: isoDate,
    end:   isoDate,
  })
  .superRefine((data, ctx) => {
    const start = new Date(`${data.start}T00:00:00Z`);
    const end   = new Date(`${data.end}T00:00:00Z`);
    if (start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data inicial deve ser anterior ou igual à data final',
        path: ['start'],
      });
      return;
    }
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
    if (days > 365) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Período não pode exceder 365 dias',
        path: ['end'],
      });
    }
  });
export type AdminDashboardInput = z.infer<typeof adminDashboardInput>;

export const analyticsDateRange = adminDashboardInput;
export type AnalyticsDateRangeInput = z.infer<typeof analyticsDateRange>;

export const reportRequestInput = z.object({
  type: z.enum([
    'productivity_by_doctor',
    'epidemiological_profile',
    'aesthetic_procedures',
    'biopsies',
    'access_audit',
  ]),
  start: isoDate,
  end:   isoDate,
  includePatientData: z.boolean().default(false),
});
export type ReportRequestInput = z.infer<typeof reportRequestInput>;

export const csvExportInput = z.object({
  resource: z.enum(['appointments', 'payments', 'patients', 'biopsies', 'movements']),
  start: isoDate,
  end:   isoDate,
  filters: z.record(z.unknown()).optional(),
});
export type CsvExportInput = z.infer<typeof csvExportInput>;

/* ── DermaIQ Analytics — inputs por tab ───────────────────────────────────── */

export const analyticsOverviewInput = adminDashboardInput;
export type AnalyticsOverviewInput = z.infer<typeof analyticsOverviewInput>;

export const patientJourneyInput = z
  .object({
    start: isoDate,
    end:   isoDate,
    cohortMonths: z.number().int().min(1).max(24).default(12),
  })
  .superRefine((data, ctx) => {
    const start = new Date(`${data.start}T00:00:00Z`);
    const end   = new Date(`${data.end}T00:00:00Z`);
    if (start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data inicial deve ser anterior ou igual à data final',
        path: ['start'],
      });
      return;
    }
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
    if (days > 365) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Período não pode exceder 365 dias',
        path: ['end'],
      });
    }
  });
export type PatientJourneyInput = z.infer<typeof patientJourneyInput>;

export const supplyIntelligenceInput = z
  .object({
    start: isoDate,
    end:   isoDate,
    topN:  z.number().int().min(1).max(50).default(10),
  })
  .superRefine((data, ctx) => {
    const start = new Date(`${data.start}T00:00:00Z`);
    const end   = new Date(`${data.end}T00:00:00Z`);
    if (start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data inicial deve ser anterior ou igual à data final',
        path: ['start'],
      });
      return;
    }
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
    if (days > 365) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Período não pode exceder 365 dias',
        path: ['end'],
      });
    }
  });
export type SupplyIntelligenceInput = z.infer<typeof supplyIntelligenceInput>;

export const omniPerformanceInput = adminDashboardInput;
export type OmniPerformanceInput = z.infer<typeof omniPerformanceInput>;

export const financialAdvancedInput = adminDashboardInput;
export type FinancialAdvancedInput = z.infer<typeof financialAdvancedInput>;

export const analyticsExportInput = z
  .object({
    tab: z.enum(['overview', 'journey', 'supply', 'omni', 'financial']),
    format: z.enum(['pdf', 'csv']),
    start:  isoDate,
    end:    isoDate,
  })
  .superRefine((data, ctx) => {
    const start = new Date(`${data.start}T00:00:00Z`);
    const end   = new Date(`${data.end}T00:00:00Z`);
    if (start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data inicial deve ser anterior ou igual à data final',
        path: ['start'],
      });
      return;
    }
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
    if (days > 365) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Período não pode exceder 365 dias',
        path: ['end'],
      });
    }
  });
export type AnalyticsExportInput = z.infer<typeof analyticsExportInput>;

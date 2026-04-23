import { z } from 'zod';

export const genderSchema = z.enum([
  'male',
  'female',
  'non_binary',
  'prefer_not_to_say',
  'other',
]);

export const patientStatusSchema = z.enum([
  'active',
  'inactive',
  'blocked',
  'deceased',
  'transferred',
  'merged',
]);

const cpfRegex = /^\d{11}$/;
const phoneRegex = /^\d{10,11}$/;

export const createPatientSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(200, 'Nome muito longo')
    .trim(),
  cpf: z
    .string()
    .regex(cpfRegex, 'CPF deve conter 11 dígitos sem formatação')
    .optional(),
  birthDate: z.coerce
    .date()
    .max(new Date(), 'Data de nascimento não pode ser no futuro')
    .optional(),
  gender: genderSchema.optional(),
  email: z.string().email('Email inválido').toLowerCase().trim().optional(),
  phone: z
    .string()
    .regex(phoneRegex, 'Telefone deve conter 10 ou 11 dígitos')
    .optional(),
  phoneSecondary: z
    .string()
    .regex(phoneRegex, 'Telefone deve conter 10 ou 11 dígitos')
    .optional(),
  bloodType: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .optional(),
  allergies:         z.array(z.string().max(200)).default([]),
  chronicConditions: z.array(z.string().max(200)).default([]),
  activeMedications: z.array(z.string().max(200)).default([]),
  address: z
    .object({
      street:     z.string().optional(),
      number:     z.string().optional(),
      complement: z.string().optional(),
      district:   z.string().optional(),
      city:       z.string().optional(),
      state:      z.string().length(2).optional(),
      zip:        z.string().optional(),
    })
    .optional(),
  sourceChannel:  z.string().optional(),
  sourceCampaign: z.string().optional(),
  referredBy:     z.string().uuid().optional(),
  portalEnabled:  z.boolean().default(false),
  portalEmail:    z.string().email().optional(),
  internalNotes:  z.string().max(5000).optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const patientListQuerySchema = z.object({
  search:   z.string().optional(),
  status:   patientStatusSchema.optional(),
  source:   z.string().optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sortBy:   z.enum(['name', 'createdAt', 'lastVisitAt']).default('name'),
  sortDir:  z.enum(['asc', 'desc']).default('asc'),
});

export const searchPatientSchema = z.object({
  query:  z.string().optional(),
  status: patientStatusSchema.optional(),
  source: z.string().optional(),
  dateRange: z
    .object({
      from: z.coerce.date().optional(),
      to:   z.coerce.date().optional(),
    })
    .optional(),
  page:    z.coerce.number().int().positive().default(1),
  limit:   z.coerce.number().int().positive().max(100).default(20),
  sort:    z.enum(['name', 'createdAt', 'lastVisitAt']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const mergePatientSchema = z.object({
  primaryId:    z.string().uuid('ID primário inválido'),
  secondaryId:  z.string().uuid('ID secundário inválido'),
  fieldsToKeep: z.record(z.string(), z.enum(['primary', 'secondary'])).optional(),
}).refine(
  (d) => d.primaryId !== d.secondaryId,
  { message: 'Paciente primário e secundário devem ser diferentes' },
);

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientListQuery   = z.infer<typeof patientListQuerySchema>;
export type SearchPatientInput = z.infer<typeof searchPatientSchema>;
export type MergePatientInput  = z.infer<typeof mergePatientSchema>;

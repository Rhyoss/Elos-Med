import { z } from 'zod';

/* ── Enums ───────────────────────────────────────────────────────────────── */

export const DOCUMENT_TYPES = [
  'prescricao',
  'termo_consentimento',
  'atestado',
  'declaracao',
  'solicitacao',
  'orientacao_pos_procedimento',
  'laudo',
  'anexo',
] as const;

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  prescricao:                   'Prescrição',
  termo_consentimento:          'Termo de consentimento',
  atestado:                     'Atestado',
  declaracao:                   'Declaração',
  solicitacao:                  'Solicitação',
  orientacao_pos_procedimento:  'Orientação pós-procedimento',
  laudo:                        'Laudo',
  anexo:                        'Documento anexado',
};

export const DOCUMENT_STATUSES = [
  'rascunho',
  'emitido',
  'assinado',
  'revogado',
] as const;

export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  rascunho: 'Rascunho',
  emitido:  'Emitido',
  assinado: 'Assinado',
  revogado: 'Revogado',
};

export const CONSENT_STATUSES = ['pendente', 'assinado', 'revogado'] as const;
export const consentStatusSchema = z.enum(CONSENT_STATUSES);
export type ConsentStatus = z.infer<typeof consentStatusSchema>;

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  pendente: 'Pendente',
  assinado: 'Assinado',
  revogado: 'Revogado',
};

/* ── Document CRUD ───────────────────────────────────────────────────────── */

export const createDocumentSchema = z.object({
  patientId:      z.string().uuid('ID de paciente inválido'),
  encounterId:    z.string().uuid().optional(),
  procedureId:    z.string().uuid().optional(),
  prescriptionId: z.string().uuid().optional(),
  type:           documentTypeSchema,
  title:          z.string().trim().min(2, 'Título obrigatório').max(300),
  contentHtml:    z.string().max(100_000).optional(),
  templateId:     z.string().uuid().optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = z.object({
  id:          z.string().uuid(),
  title:       z.string().trim().min(2).max(300).optional(),
  contentHtml: z.string().max(100_000).optional(),
});
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const signDocumentSchema = z.object({
  id: z.string().uuid(),
});
export type SignDocumentInput = z.infer<typeof signDocumentSchema>;

export const revokeDocumentSchema = z.object({
  id:     z.string().uuid(),
  reason: z.string().trim().min(3, 'Motivo obrigatório').max(500),
});
export type RevokeDocumentInput = z.infer<typeof revokeDocumentSchema>;

/* ── Document Queries ────────────────────────────────────────────────────── */

export const listDocumentsByPatientSchema = z.object({
  patientId: z.string().uuid(),
  type:      documentTypeSchema.optional(),
  status:    documentStatusSchema.optional(),
  page:      z.coerce.number().int().positive().default(1),
  pageSize:  z.coerce.number().int().positive().max(100).default(30),
});
export type ListDocumentsByPatientQuery = z.infer<typeof listDocumentsByPatientSchema>;

export const listDocumentsSchema = z.object({
  type:       documentTypeSchema.optional(),
  status:     documentStatusSchema.optional(),
  providerId: z.string().uuid().optional(),
  patientId:  z.string().uuid().optional(),
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
  page:       z.coerce.number().int().positive().default(1),
  pageSize:   z.coerce.number().int().positive().max(100).default(30),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsSchema>;

export const getDocumentByIdSchema = z.object({
  id: z.string().uuid(),
});

export const requestDocumentPdfSchema = z.object({
  id: z.string().uuid(),
});

/* ── Consent Terms CRUD ──────────────────────────────────────────────────── */

export const createConsentTermSchema = z.object({
  patientId:    z.string().uuid('ID de paciente inválido'),
  documentId:   z.string().uuid().optional(),
  procedureId:  z.string().uuid().optional(),
  lesionPhotoId: z.string().uuid().optional(),
  description:  z.string().trim().max(10_000).optional(),
});
export type CreateConsentTermInput = z.infer<typeof createConsentTermSchema>;

export const signConsentTermSchema = z.object({
  id:               z.string().uuid(),
  patientSignature: z.string().max(4000).optional(),
});
export type SignConsentTermInput = z.infer<typeof signConsentTermSchema>;

export const revokeConsentTermSchema = z.object({
  id:     z.string().uuid(),
  reason: z.string().trim().min(3, 'Motivo obrigatório').max(500),
});
export type RevokeConsentTermInput = z.infer<typeof revokeConsentTermSchema>;

export const listConsentTermsByPatientSchema = z.object({
  patientId: z.string().uuid(),
  status:    consentStatusSchema.optional(),
  page:      z.coerce.number().int().positive().default(1),
  pageSize:  z.coerce.number().int().positive().max(100).default(30),
});
export type ListConsentTermsByPatientQuery = z.infer<typeof listConsentTermsByPatientSchema>;

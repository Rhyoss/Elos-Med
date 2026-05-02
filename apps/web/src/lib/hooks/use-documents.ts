'use client';

import { trpc } from '@/lib/trpc-provider';
import type {
  DocumentType,
  DocumentStatus,
  ConsentStatus,
} from '@dermaos/shared';

/* ── Re-exported types from backend service (inferred from tRPC response) ── */

// These match DocumentPublic / ConsentTermPublic from documents.service.ts
export interface DocumentPublic {
  id:                 string;
  clinicId:           string;
  patientId:          string;
  patientName:        string | null;
  encounterId:        string | null;
  procedureId:        string | null;
  prescriptionId:     string | null;
  type:               DocumentType;
  status:             DocumentStatus;
  title:              string;
  contentHtml:        string | null;
  templateId:         string | null;
  pdfStorageKey:      string | null;
  pdfGeneratedAt:     Date | null;
  version:            number;
  previousVersionId:  string | null;
  signedAt:           Date | null;
  signedBy:           string | null;
  signedByName:       string | null;
  signatureHash:      string | null;
  revokedAt:          Date | null;
  revokedBy:          string | null;
  revocationReason:   string | null;
  createdBy:          string | null;
  updatedBy:          string | null;
  createdAt:          Date;
  updatedAt:          Date;
}

export interface ConsentTermPublic {
  id:               string;
  clinicId:         string;
  patientId:        string;
  patientName:      string | null;
  documentId:       string | null;
  procedureId:      string | null;
  lesionPhotoId:    string | null;
  status:           ConsentStatus;
  description:      string | null;
  signedAt:         Date | null;
  signedByPatient:  boolean;
  revokedAt:        Date | null;
  revocationReason: string | null;
  createdBy:        string | null;
  createdAt:        Date;
  updatedAt:        Date;
}

/* ── Hooks ───────────────────────────────────────────────────────────────── */

export function useDocumentsByPatient(
  patientId: string,
  options?: { type?: DocumentType; status?: DocumentStatus; pageSize?: number },
) {
  return trpc.clinical.documents.listByPatient.useQuery(
    { patientId, ...options },
    { staleTime: 30_000, enabled: !!patientId },
  );
}

export function useDocuments(options?: {
  type?: DocumentType;
  status?: DocumentStatus;
  patientId?: string;
  pageSize?: number;
}) {
  return trpc.clinical.documents.list.useQuery(
    { ...options },
    { staleTime: 30_000 },
  );
}

export function useCreateDocument() {
  return trpc.clinical.documents.create.useMutation();
}

export function useUpdateDocument() {
  return trpc.clinical.documents.update.useMutation();
}

export function useSignDocument() {
  return trpc.clinical.documents.sign.useMutation();
}

export function useRevokeDocument() {
  return trpc.clinical.documents.revoke.useMutation();
}

export function useConsentTermsByPatient(
  patientId: string,
  options?: { status?: ConsentStatus; pageSize?: number },
) {
  return trpc.clinical.documents.listConsentTermsByPatient.useQuery(
    { patientId, ...options },
    { staleTime: 30_000, enabled: !!patientId },
  );
}

export function useCreateConsentTerm() {
  return trpc.clinical.documents.createConsentTerm.useMutation();
}

export function useSignConsentTerm() {
  return trpc.clinical.documents.signConsentTerm.useMutation();
}

export function useRevokeConsentTerm() {
  return trpc.clinical.documents.revokeConsentTerm.useMutation();
}

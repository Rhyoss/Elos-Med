import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { db, withClinicContext } from '../../../db/client.js';
import { eventBus } from '../../../events/event-bus.js';
import { emitToClinic } from '../../../lib/socket.js';
import { logger } from '../../../lib/logger.js';
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
  RevokeDocumentInput,
  ListDocumentsByPatientQuery,
  ListDocumentsQuery,
  CreateConsentTermInput,
  SignConsentTermInput,
  RevokeConsentTermInput,
  ListConsentTermsByPatientQuery,
  DocumentType,
  DocumentStatus,
  ConsentStatus,
} from '@dermaos/shared';

/* ── Row types ───────────────────────────────────────────────────────────── */

interface DocumentRow {
  id:                    string;
  clinic_id:             string;
  patient_id:            string;
  encounter_id:          string | null;
  procedure_id:          string | null;
  prescription_id:       string | null;
  type:                  DocumentType;
  status:                DocumentStatus;
  title:                 string;
  content_html:          string | null;
  template_id:           string | null;
  pdf_storage_key:       string | null;
  pdf_generated_at:      string | null;
  version:               number;
  previous_version_id:   string | null;
  signed_at:             string | null;
  signed_by:             string | null;
  signature_hash:        string | null;
  revoked_at:            string | null;
  revoked_by:            string | null;
  revocation_reason:     string | null;
  created_by:            string | null;
  updated_by:            string | null;
  created_at:            string;
  updated_at:            string;
  // joined fields
  patient_name?:         string | null;
  signed_by_name?:       string | null;
}

interface ConsentTermRow {
  id:                    string;
  clinic_id:             string;
  patient_id:            string;
  document_id:           string | null;
  procedure_id:          string | null;
  lesion_photo_id:       string | null;
  status:                ConsentStatus;
  description:           string | null;
  signed_at:             string | null;
  signed_by_patient:     boolean;
  patient_signature:     string | null;
  revoked_at:            string | null;
  revocation_reason:     string | null;
  created_by:            string | null;
  created_at:            string;
  updated_at:            string;
  patient_name?:         string | null;
}

/* ── Public shapes ───────────────────────────────────────────────────────── */

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

export interface PaginatedDocuments {
  data:       DocumentPublic[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

export interface PaginatedConsentTerms {
  data:       ConsentTermPublic[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

/* ── Mappers ─────────────────────────────────────────────────────────────── */

function mapDocument(row: DocumentRow): DocumentPublic {
  return {
    id:                row.id,
    clinicId:          row.clinic_id,
    patientId:         row.patient_id,
    patientName:       row.patient_name ?? null,
    encounterId:       row.encounter_id,
    procedureId:       row.procedure_id,
    prescriptionId:    row.prescription_id,
    type:              row.type,
    status:            row.status,
    title:             row.title,
    contentHtml:       row.content_html,
    templateId:        row.template_id,
    pdfStorageKey:     row.pdf_storage_key,
    pdfGeneratedAt:    row.pdf_generated_at ? new Date(row.pdf_generated_at) : null,
    version:           row.version,
    previousVersionId: row.previous_version_id,
    signedAt:          row.signed_at ? new Date(row.signed_at) : null,
    signedBy:          row.signed_by,
    signedByName:      row.signed_by_name ?? null,
    signatureHash:     row.signature_hash,
    revokedAt:         row.revoked_at ? new Date(row.revoked_at) : null,
    revokedBy:         row.revoked_by,
    revocationReason:  row.revocation_reason,
    createdBy:         row.created_by,
    updatedBy:         row.updated_by,
    createdAt:         new Date(row.created_at),
    updatedAt:         new Date(row.updated_at),
  };
}

function mapConsentTerm(row: ConsentTermRow): ConsentTermPublic {
  return {
    id:               row.id,
    clinicId:         row.clinic_id,
    patientId:        row.patient_id,
    patientName:      row.patient_name ?? null,
    documentId:       row.document_id,
    procedureId:      row.procedure_id,
    lesionPhotoId:    row.lesion_photo_id,
    status:           row.status,
    description:      row.description,
    signedAt:         row.signed_at ? new Date(row.signed_at) : null,
    signedByPatient:  row.signed_by_patient,
    revokedAt:        row.revoked_at ? new Date(row.revoked_at) : null,
    revocationReason: row.revocation_reason,
    createdBy:        row.created_by,
    createdAt:        new Date(row.created_at),
    updatedAt:        new Date(row.updated_at),
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

async function fetchDocumentById(
  clinicId: string,
  id: string,
): Promise<DocumentRow> {
  const res = await db.query<DocumentRow>(
    `SELECT d.*, p.name AS patient_name, u.name AS signed_by_name
       FROM clinical.documents d
       JOIN shared.patients p ON p.id = d.patient_id
       LEFT JOIN shared.users u ON u.id = d.signed_by
      WHERE d.id = $1 AND d.clinic_id = $2`,
    [id, clinicId],
  );
  if (!res.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Documento não encontrado.' });
  }
  return res.rows[0];
}

async function assertPatientInClinic(clinicId: string, patientId: string): Promise<void> {
  const res = await db.query<{ id: string }>(
    `SELECT id FROM shared.patients WHERE id = $1 AND clinic_id = $2`,
    [patientId, clinicId],
  );
  if (!res.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado nesta clínica.' });
  }
}

/* ── Document mutations ──────────────────────────────────────────────────── */

export async function createDocument(
  input:    CreateDocumentInput,
  clinicId: string,
  userId:   string,
): Promise<DocumentPublic> {
  return withClinicContext(clinicId, async (client) => {
    await assertPatientInClinic(clinicId, input.patientId);

    const res = await client.query<DocumentRow>(
      `INSERT INTO clinical.documents
         (clinic_id, patient_id, encounter_id, procedure_id, prescription_id,
          type, status, title, content_html, template_id,
          version, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6::clinical.document_type, 'rascunho',
               $7, $8, $9, 1, $10, $10)
       RETURNING *`,
      [
        clinicId,
        input.patientId,
        input.encounterId ?? null,
        input.procedureId ?? null,
        input.prescriptionId ?? null,
        input.type,
        input.title,
        input.contentHtml ?? null,
        input.templateId ?? null,
        userId,
      ],
    );
    const doc = mapDocument(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish('document.created', clinicId, doc.id, {
        documentId: doc.id,
        patientId:  doc.patientId,
        type:       doc.type,
      }, { userId });
      emitToClinic(clinicId, 'document.created', { documentId: doc.id, patientId: doc.patientId });
    });

    return doc;
  });
}

export async function updateDocument(
  input:    UpdateDocumentInput,
  clinicId: string,
  userId:   string,
): Promise<DocumentPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchDocumentById(clinicId, input.id);
    if (current.status === 'assinado') {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Documento assinado não pode ser editado. Crie uma nova versão.' });
    }
    if (current.status === 'revogado') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Documento revogado não pode ser editado.' });
    }

    const sets: string[] = ['updated_at = NOW()', 'updated_by = $3'];
    const values: unknown[] = [input.id, clinicId, userId];
    let idx = 4;

    if (input.title       !== undefined) { sets.push(`title = $${idx++}`);        values.push(input.title); }
    if (input.contentHtml !== undefined) { sets.push(`content_html = $${idx++}`); values.push(input.contentHtml); }

    const res = await client.query<DocumentRow>(
      `UPDATE clinical.documents SET ${sets.join(', ')}
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      values,
    );
    return mapDocument(res.rows[0]!);
  });
}

export async function signDocument(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<DocumentPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchDocumentById(clinicId, id);
    if (current.status === 'assinado') {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Documento já está assinado.' });
    }
    if (current.status === 'revogado') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Documento revogado não pode ser assinado.' });
    }

    const signedAt = new Date();
    const signatureHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ id, clinicId, userId, signedAt: signedAt.toISOString(), title: current.title }))
      .digest('hex');

    const res = await client.query<DocumentRow>(
      `UPDATE clinical.documents
          SET status = 'assinado',
              signed_at = $3,
              signed_by = $4,
              signature_hash = $5,
              updated_at = NOW(),
              updated_by = $4
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      [id, clinicId, signedAt, userId, signatureHash],
    );
    const doc = mapDocument(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish('document.signed', clinicId, doc.id, {
        documentId: doc.id,
        patientId:  doc.patientId,
      }, { userId });
      emitToClinic(clinicId, 'document.updated', { documentId: doc.id, status: 'assinado' });
    });

    return doc;
  });
}

export async function revokeDocument(
  input:    RevokeDocumentInput,
  clinicId: string,
  userId:   string,
): Promise<DocumentPublic> {
  return withClinicContext(clinicId, async (client) => {
    const current = await fetchDocumentById(clinicId, input.id);
    if (current.status === 'revogado') {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Documento já está revogado.' });
    }

    const res = await client.query<DocumentRow>(
      `UPDATE clinical.documents
          SET status = 'revogado',
              revoked_at = NOW(),
              revoked_by = $3,
              revocation_reason = $4,
              updated_at = NOW(),
              updated_by = $3
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      [input.id, clinicId, userId, input.reason],
    );
    const doc = mapDocument(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish('document.revoked', clinicId, doc.id, {
        documentId: doc.id,
        patientId:  doc.patientId,
        reason:     input.reason,
      }, { userId });
    });

    return doc;
  });
}

/* ── Document queries ────────────────────────────────────────────────────── */

export async function getDocumentById(
  id:       string,
  clinicId: string,
): Promise<DocumentPublic> {
  const row = await fetchDocumentById(clinicId, id);
  return mapDocument(row);
}

export async function listDocumentsByPatient(
  params:   ListDocumentsByPatientQuery,
  clinicId: string,
): Promise<PaginatedDocuments> {
  const where: string[] = ['d.clinic_id = $1', 'd.patient_id = $2'];
  const values: unknown[] = [clinicId, params.patientId];
  let idx = 3;

  if (params.type)   { where.push(`d.type = $${idx++}::clinical.document_type`);     values.push(params.type); }
  if (params.status) { where.push(`d.status = $${idx++}::clinical.document_status`); values.push(params.status); }

  const offset = (params.page - 1) * params.pageSize;
  const whereClause = where.join(' AND ');

  const [countRes, dataRes] = await Promise.all([
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM clinical.documents d WHERE ${whereClause}`,
      values,
    ),
    db.query<DocumentRow>(
      `SELECT d.*, p.name AS patient_name, u.name AS signed_by_name
         FROM clinical.documents d
         JOIN shared.patients p ON p.id = d.patient_id
         LEFT JOIN shared.users u ON u.id = d.signed_by
        WHERE ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.pageSize, offset],
    ),
  ]);

  const total = parseInt(countRes.rows[0]?.count ?? '0', 10);
  return {
    data:       dataRes.rows.map(mapDocument),
    total,
    page:       params.page,
    pageSize:   params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function listDocuments(
  params:   ListDocumentsQuery,
  clinicId: string,
): Promise<PaginatedDocuments> {
  const where: string[] = ['d.clinic_id = $1'];
  const values: unknown[] = [clinicId];
  let idx = 2;

  if (params.patientId)  { where.push(`d.patient_id = $${idx++}`);                                         values.push(params.patientId); }
  if (params.type)       { where.push(`d.type = $${idx++}::clinical.document_type`);                       values.push(params.type); }
  if (params.status)     { where.push(`d.status = $${idx++}::clinical.document_status`);                   values.push(params.status); }
  if (params.providerId) { where.push(`d.created_by = $${idx++}`);                                         values.push(params.providerId); }
  if (params.from)       { where.push(`d.created_at >= $${idx++}`);                                        values.push(params.from); }
  if (params.to)         { where.push(`d.created_at <= $${idx++}`);                                        values.push(params.to); }

  const offset = (params.page - 1) * params.pageSize;
  const whereClause = where.join(' AND ');

  const [countRes, dataRes] = await Promise.all([
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM clinical.documents d WHERE ${whereClause}`,
      values,
    ),
    db.query<DocumentRow>(
      `SELECT d.*, p.name AS patient_name, u.name AS signed_by_name
         FROM clinical.documents d
         JOIN shared.patients p ON p.id = d.patient_id
         LEFT JOIN shared.users u ON u.id = d.signed_by
        WHERE ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.pageSize, offset],
    ),
  ]);

  const total = parseInt(countRes.rows[0]?.count ?? '0', 10);
  return {
    data:       dataRes.rows.map(mapDocument),
    total,
    page:       params.page,
    pageSize:   params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/* ── Consent Term mutations ──────────────────────────────────────────────── */

export async function createConsentTerm(
  input:    CreateConsentTermInput,
  clinicId: string,
  userId:   string,
): Promise<ConsentTermPublic> {
  return withClinicContext(clinicId, async (client) => {
    await assertPatientInClinic(clinicId, input.patientId);

    const res = await client.query<ConsentTermRow>(
      `INSERT INTO clinical.consent_terms
         (clinic_id, patient_id, document_id, procedure_id, lesion_photo_id,
          description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        clinicId,
        input.patientId,
        input.documentId ?? null,
        input.procedureId ?? null,
        input.lesionPhotoId ?? null,
        input.description ?? null,
        userId,
      ],
    );
    const term = mapConsentTerm(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish('consent_term.created', clinicId, term.id, {
        consentTermId: term.id,
        patientId:     term.patientId,
      }, { userId });
    });

    return term;
  });
}

export async function signConsentTerm(
  input:    SignConsentTermInput,
  clinicId: string,
  userId:   string,
): Promise<ConsentTermPublic> {
  return withClinicContext(clinicId, async (client) => {
    const res = await client.query<ConsentTermRow>(
      `UPDATE clinical.consent_terms
          SET status = 'assinado',
              signed_at = NOW(),
              signed_by_patient = TRUE,
              patient_signature = $3,
              updated_at = NOW()
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      [input.id, clinicId, input.patientSignature ?? null],
    );
    if (!res.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Termo não encontrado.' });
    }
    const term = mapConsentTerm(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish('consent_term.signed', clinicId, term.id, {
        consentTermId: term.id,
        patientId:     term.patientId,
      }, { userId });
      emitToClinic(clinicId, 'consent_term.signed', { consentTermId: term.id, patientId: term.patientId });
    });

    return term;
  });
}

export async function revokeConsentTerm(
  input:    RevokeConsentTermInput,
  clinicId: string,
  userId:   string,
): Promise<ConsentTermPublic> {
  return withClinicContext(clinicId, async (client) => {
    const res = await client.query<ConsentTermRow>(
      `UPDATE clinical.consent_terms
          SET status = 'revogado',
              revoked_at = NOW(),
              revocation_reason = $3,
              updated_at = NOW()
        WHERE id = $1 AND clinic_id = $2
        RETURNING *`,
      [input.id, clinicId, input.reason],
    );
    if (!res.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Termo não encontrado.' });
    }
    const term = mapConsentTerm(res.rows[0]!);

    setImmediate(() => {
      void eventBus.publish('consent_term.revoked', clinicId, term.id, {
        consentTermId: term.id,
        patientId:     term.patientId,
        reason:        input.reason,
      }, { userId });
    });

    return term;
  });
}

export async function listConsentTermsByPatient(
  params:   ListConsentTermsByPatientQuery,
  clinicId: string,
): Promise<PaginatedConsentTerms> {
  const where: string[] = ['ct.clinic_id = $1', 'ct.patient_id = $2'];
  const values: unknown[] = [clinicId, params.patientId];
  let idx = 3;

  if (params.status) { where.push(`ct.status = $${idx++}::clinical.consent_status`); values.push(params.status); }

  const offset = (params.page - 1) * params.pageSize;
  const whereClause = where.join(' AND ');

  const [countRes, dataRes] = await Promise.all([
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM clinical.consent_terms ct WHERE ${whereClause}`,
      values,
    ),
    db.query<ConsentTermRow>(
      `SELECT ct.*, p.name AS patient_name
         FROM clinical.consent_terms ct
         JOIN shared.patients p ON p.id = ct.patient_id
        WHERE ${whereClause}
        ORDER BY ct.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.pageSize, offset],
    ),
  ]);

  const total = parseInt(countRes.rows[0]?.count ?? '0', 10);
  return {
    data:       dataRes.rows.map(mapConsentTerm),
    total,
    page:       params.page,
    pageSize:   params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/* ── Pending signature count (for dashboard badge) ───────────────────────── */

export async function countPendingDocuments(clinicId: string): Promise<number> {
  const res = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM clinical.documents
      WHERE clinic_id = $1 AND status IN ('rascunho', 'emitido')`,
    [clinicId],
  );
  return parseInt(res.rows[0]?.count ?? '0', 10);
}

export async function countPendingConsentTerms(clinicId: string): Promise<number> {
  const res = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM clinical.consent_terms
      WHERE clinic_id = $1 AND status = 'pendente'`,
    [clinicId],
  );
  return parseInt(res.rows[0]?.count ?? '0', 10);
}

/* ── Lookup: documents linked to a prescription ──────────────────────────── */

export async function listDocumentsByPrescription(
  prescriptionId: string,
  clinicId: string,
): Promise<DocumentPublic[]> {
  const res = await db.query<DocumentRow>(
    `SELECT d.*, p.name AS patient_name, u.name AS signed_by_name
       FROM clinical.documents d
       JOIN shared.patients p ON p.id = d.patient_id
       LEFT JOIN shared.users u ON u.id = d.signed_by
      WHERE d.prescription_id = $1 AND d.clinic_id = $2
      ORDER BY d.created_at DESC`,
    [prescriptionId, clinicId],
  );
  return res.rows.map(mapDocument);
}

logger.debug('documents.service loaded');

import PDFDocument from 'pdfkit';
import { TRPCError } from '@trpc/server';
import { db, withClinicContext } from '../../../db/client.js';
import { logger } from '../../../lib/logger.js';
import {
  PRESCRIPTIONS_BUCKET,
  presignGet,
  putObjectBuffer,
} from '../../../lib/minio.js';
import {
  PRESCRIPTION_TYPE_LABELS,
  type PrescriptionItem,
  type PrescriptionType,
} from '@dermaos/shared';
import { sanitizeItemText } from './prescriptions.sanitize.js';
import {
  getPrescriptionById,
  loadPatientInfo,
  loadPrescriberInfo,
  type PrescriptionPublic,
} from './prescriptions.service.js';

const PDF_GENERATION_TIMEOUT_MS = 30_000;
const PRESCRIPTION_PDF_URL_TTL  = 10 * 60;      // 10 minutos

/* ── Helpers de render ────────────────────────────────────────────────── */

function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
}

function renderHeader(
  doc: PDFKit.PDFDocument,
  params: {
    prescriberName: string;
    prescriberCrm:  string | null;
    prescriberSpecialty: string | null;
    prescriptionNumber: string | null;
    issuedAt: Date;
  },
) {
  doc
    .fontSize(16).font('Helvetica-Bold')
    .text('RECEITUÁRIO MÉDICO', { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica');
  doc.text(sanitizeItemText(params.prescriberName), { align: 'left' });

  const crmLine = [
    params.prescriberCrm ? `CRM: ${sanitizeItemText(params.prescriberCrm)}` : null,
    params.prescriberSpecialty ? sanitizeItemText(params.prescriberSpecialty) : null,
  ].filter(Boolean).join(' · ');
  if (crmLine) doc.text(crmLine);

  doc.moveDown(0.5);
  doc.fontSize(9).fillColor('#555');
  doc.text(
    `Prescrição ${params.prescriptionNumber ?? '—'}   ·   Emitida em ${formatDate(params.issuedAt)}`,
  );
  doc.fillColor('#000').moveDown();
  doc.moveTo(doc.x, doc.y).lineTo(550, doc.y).stroke('#888');
  doc.moveDown(0.5);
}

function renderPatientBlock(
  doc: PDFKit.PDFDocument,
  params: { name: string; birthDate: Date | null },
) {
  doc.fontSize(11).font('Helvetica-Bold').text('Paciente');
  doc.font('Helvetica').fontSize(10);
  doc.text(sanitizeItemText(params.name));
  if (params.birthDate) {
    doc.text(`Data de nascimento: ${formatDate(params.birthDate)}`);
  }
  doc.moveDown();
}

function renderItem(
  doc: PDFKit.PDFDocument,
  item: PrescriptionItem,
  index: number,
) {
  doc.fontSize(11).font('Helvetica-Bold');
  const title = (() => {
    switch (item.type) {
      case 'topica':       return `${index + 1}. ${sanitizeItemText(item.name)}`;
      case 'sistemica':    return `${index + 1}. ${sanitizeItemText(item.name)} ${sanitizeItemText(item.dosage)}`;
      case 'manipulada':   return `${index + 1}. ${sanitizeItemText(item.formulation)}`;
      case 'cosmeceutica': return `${index + 1}. ${sanitizeItemText(item.name)}`;
    }
  })();
  doc.text(title);
  doc.font('Helvetica').fontSize(10);

  const lines: string[] = [];
  switch (item.type) {
    case 'topica': {
      if (item.concentration)  lines.push(`Concentração: ${sanitizeItemText(item.concentration)}`);
      lines.push(`Aplicar em: ${sanitizeItemText(item.applicationArea)}`);
      lines.push(`Posologia: ${sanitizeItemText(item.frequency)}`);
      if (item.durationDays)   lines.push(`Duração: ${item.durationDays} dia(s)`);
      if (item.instructions)   lines.push(`Orientações: ${sanitizeItemText(item.instructions)}`);
      break;
    }
    case 'sistemica': {
      if (item.form)  lines.push(`Forma: ${sanitizeItemText(item.form)}`);
      if (item.route) lines.push(`Via: ${sanitizeItemText(item.route)}`);
      lines.push(`Posologia: ${sanitizeItemText(item.frequency)}`);
      lines.push(`Duração: ${item.durationDays} dia(s)${item.continuousUse ? ' (uso contínuo)' : ''}`);
      if (item.quantity)     lines.push(`Quantidade: ${item.quantity}`);
      if (item.instructions) lines.push(`Orientações: ${sanitizeItemText(item.instructions)}`);
      break;
    }
    case 'manipulada': {
      lines.push(`Veículo: ${sanitizeItemText(item.vehicle)}`);
      lines.push('Componentes:');
      for (const c of item.components) {
        lines.push(`  • ${sanitizeItemText(c.substance)} — ${sanitizeItemText(c.concentration)}`);
      }
      lines.push(`Quantidade total: ${sanitizeItemText(item.quantity)}`);
      lines.push(`Aplicar em: ${sanitizeItemText(item.applicationArea)}`);
      lines.push(`Posologia: ${sanitizeItemText(item.frequency)}`);
      if (item.durationDays)  lines.push(`Duração: ${item.durationDays} dia(s)`);
      if (item.instructions)  lines.push(`Orientações: ${sanitizeItemText(item.instructions)}`);
      break;
    }
    case 'cosmeceutica': {
      if (item.brand) lines.push(`Marca: ${sanitizeItemText(item.brand)}`);
      lines.push(`Aplicar em: ${sanitizeItemText(item.applicationArea)}`);
      lines.push(`Frequência: ${sanitizeItemText(item.frequency)}`);
      if (item.instructions) lines.push(`Orientações: ${sanitizeItemText(item.instructions)}`);
      break;
    }
  }

  for (const line of lines) doc.text(line);
  doc.moveDown(0.5);
}

function renderSignature(
  doc: PDFKit.PDFDocument,
  params: {
    prescriberName: string;
    prescriberCrm:  string | null;
    signatureHash:  string | null;
    signedAt:       Date;
  },
) {
  doc.moveDown(2);
  doc.moveTo(doc.x, doc.y).lineTo(300, doc.y).stroke('#000');
  doc.fontSize(10).font('Helvetica').text(sanitizeItemText(params.prescriberName));
  if (params.prescriberCrm) doc.text(`CRM: ${sanitizeItemText(params.prescriberCrm)}`);

  doc.fontSize(8).fillColor('#666');
  doc.text(`Assinado digitalmente em ${formatDate(params.signedAt)}`);
  if (params.signatureHash) {
    doc.text(`Hash: ${params.signatureHash.slice(0, 16)}...${params.signatureHash.slice(-8)}`);
  }
  doc.fillColor('#000');
}

/* ── Geração e armazenamento ─────────────────────────────────────────── */

async function renderPdfBuffer(
  prescription: PrescriptionPublic,
  typeLabel: string,
  patient: { name: string; birthDate: Date | null },
  prescriber: { name: string; crm: string | null; specialty: string | null },
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 48, bottom: 48, left: 56, right: 56 },
      info: {
        Title:    `Prescrição ${prescription.prescriptionNumber ?? prescription.id}`,
        Author:   prescriber.name,
        Subject:  `Prescrição ${typeLabel}`,
        Keywords: 'DermaOS, prescrição',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const issuedAt = prescription.signedAt ?? new Date();

    renderHeader(doc, {
      prescriberName:      prescriber.name,
      prescriberCrm:       prescriber.crm,
      prescriberSpecialty: prescriber.specialty,
      prescriptionNumber:  prescription.prescriptionNumber,
      issuedAt,
    });

    renderPatientBlock(doc, patient);

    doc.fontSize(11).font('Helvetica-Bold').text(`Prescrição — ${typeLabel}`);
    doc.moveDown(0.3);

    prescription.items.forEach((item, i) => renderItem(doc, item, i));

    if (prescription.notes) {
      doc.moveDown();
      doc.fontSize(10).font('Helvetica-Bold').text('Observações');
      doc.font('Helvetica').text(sanitizeItemText(prescription.notes));
    }

    renderSignature(doc, {
      prescriberName: prescriber.name,
      prescriberCrm:  prescriber.crm,
      signatureHash:  prescription.signatureHash,
      signedAt:       issuedAt,
    });

    doc.end();
  });
}

async function renderWithTimeout(
  prescription: PrescriptionPublic,
  typeLabel: string,
  patient: { name: string; birthDate: Date | null },
  prescriber: { name: string; crm: string | null; specialty: string | null },
): Promise<Buffer> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<Buffer>((_, reject) => {
    timer = setTimeout(() => reject(new Error('pdf_timeout')), PDF_GENERATION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      renderPdfBuffer(prescription, typeLabel, patient, prescriber),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Gera (ou reutiliza) o PDF da prescrição e retorna uma presigned URL de
 * download. O PDF é imutável após assinatura: se já existe e a prescrição
 * está assinada, reaproveitamos a chave existente.
 */
export async function getOrGeneratePrescriptionPdf(
  prescriptionId: string,
  clinicId: string,
  userId: string,
): Promise<{ url: string; storageKey: string; generatedAt: Date }> {
  const prescription = await getPrescriptionById(prescriptionId, clinicId);

  if (prescription.status === 'rascunho') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Assine a prescrição antes de gerar o PDF.',
    });
  }
  if (prescription.status === 'cancelada') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Prescrição cancelada não pode ser exportada.' });
  }

  // Se assinada e já existe PDF, reaproveita (PDF assinado é imutável)
  if (prescription.pdfStorageKey && (prescription.status === 'assinada' || prescription.status === 'enviada_digital')) {
    const url = await presignGet(prescription.pdfStorageKey, PRESCRIPTION_PDF_URL_TTL, PRESCRIPTIONS_BUCKET);
    return { url, storageKey: prescription.pdfStorageKey, generatedAt: prescription.pdfGeneratedAt ?? new Date() };
  }

  const [patient, prescriber] = await Promise.all([
    loadPatientInfo(prescription.patientId, clinicId),
    loadPrescriberInfo(prescription.prescriberId, clinicId),
  ]);

  const typeLabel = PRESCRIPTION_TYPE_LABELS[prescription.type as PrescriptionType] ?? prescription.type;

  let buffer: Buffer;
  try {
    buffer = await renderWithTimeout(prescription, typeLabel, patient, prescriber);
  } catch (err) {
    logger.error({ err, prescriptionId }, 'Prescription PDF generation failed');
    if (err instanceof Error && err.message === 'pdf_timeout') {
      throw new TRPCError({
        code: 'TIMEOUT',
        message: 'Tempo excedido ao gerar o PDF. Tente novamente.',
      });
    }
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Não foi possível gerar o PDF. Tente novamente em instantes.',
    });
  }

  const storageKey = `${clinicId}/${new Date().toISOString().slice(0, 10)}/${prescription.id}-v${prescription.version}.pdf`;
  await putObjectBuffer(storageKey, buffer, 'application/pdf', PRESCRIPTIONS_BUCKET);

  const generatedAt = new Date();

  await withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE clinical.prescriptions
          SET pdf_storage_key = $3,
              pdf_url         = $3,
              pdf_generated_at = $4,
              updated_at = NOW(),
              updated_by = $5
        WHERE id = $1 AND clinic_id = $2`,
      [prescriptionId, clinicId, storageKey, generatedAt, userId],
    );
  });

  const url = await presignGet(storageKey, PRESCRIPTION_PDF_URL_TTL, PRESCRIPTIONS_BUCKET);
  return { url, storageKey, generatedAt };
}

/** Apenas gera uma URL de download da versão já armazenada (sem regenerar). */
export async function getPrescriptionPdfUrl(
  prescriptionId: string,
  clinicId: string,
): Promise<string | null> {
  const res = await db.query<{ pdf_storage_key: string | null }>(
    `SELECT pdf_storage_key FROM clinical.prescriptions
      WHERE id = $1 AND clinic_id = $2`,
    [prescriptionId, clinicId],
  );
  const key = res.rows[0]?.pdf_storage_key ?? null;
  if (!key) return null;
  return presignGet(key, PRESCRIPTION_PDF_URL_TTL, PRESCRIPTIONS_BUCKET);
}

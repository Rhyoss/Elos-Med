import { TRPCError } from '@trpc/server';
import { createHash, randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { withClinicContext, db } from '../../db/client.js';
import { REPORTS_BUCKET, ensureReportsBucket, putObjectBuffer, presignGet } from '../../lib/minio.js';
import { logger } from '../../lib/logger.js';
import { decryptOptional } from '../../lib/crypto.js';
import type {
  TracebackByLotInput,
  TracebackByPatientInput,
  TracebackResult,
  TracebackRow,
  GenerateRecallReportInput,
  RecallReportResult,
} from '@dermaos/shared';

/* ══════════════════════════════════════════════════════════════════════════
 * Rastreabilidade ANVISA — consultas bidirecionais + relatório PDF.
 * ══════════════════════════════════════════════════════════════════════════ */

const REPORT_PDF_URL_TTL  = 10 * 60;   // 10min
const REPORT_GEN_TIMEOUT  = 60_000;    // 60s

export interface TraceabilityContext {
  clinicId: string;
  userId:   string | null;
  ipOrigin: string | null;
  canRecall: boolean;   // permissão traceability.recall
}

/* ── Sanitização PDF (remove controles, limita tamanho) ─────────────────── */

function sanitizeForPdf(input: string | null | undefined, maxLen = 500): string {
  if (input == null) return '-';
  return String(input)
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen) || '-';
}

/**
 * Mascaramento de dados de paciente para usuários sem permissão 'recall'.
 * "Maria Silva Santos" → "Maria S.***".
 */
function maskPatientName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '***';
  const first = parts[0]!;
  const secondInitial = parts[1]?.[0] ?? '';
  return secondInitial ? `${first} ${secondInitial}.***` : `${first}***`;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 2)}*****${digits.slice(-2)}`;
}

/* ── Access log ─────────────────────────────────────────────────────────── */

async function logTraceabilityAccess(
  ctx: TraceabilityContext,
  args: {
    action:    'query_by_lot' | 'query_by_patient' | 'generate_report' | 'download_report';
    lotId?:    string | null;
    patientId?:string | null;
    reportId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO supply.traceability_access_log
         (clinic_id, user_id, action, lot_id, patient_id, report_id, ip_origin, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8)`,
      [
        ctx.clinicId, ctx.userId, args.action,
        args.lotId ?? null, args.patientId ?? null, args.reportId ?? null,
        ctx.ipOrigin, JSON.stringify(args.metadata ?? {}),
      ],
    );
  } catch (err) {
    logger.error({ err, clinicId: ctx.clinicId, action: args.action }, 'Failed to write traceability access log');
  }
}

/* ── Query: por lote (scenarios de recall) ──────────────────────────────── */

export async function tracebackByLot(
  input: TracebackByLotInput,
  ctx:   TraceabilityContext,
): Promise<TracebackResult> {
  return withClinicContext(ctx.clinicId, async (client) => {
    // Resolve lotId se apenas lotNumber foi passado
    let lotId = input.lotId ?? null;
    if (!lotId && input.lotNumber) {
      const conds: string[] = [`il.clinic_id = $1`, `il.lot_number = $2`];
      const params: unknown[] = [ctx.clinicId, input.lotNumber.trim()];
      if (input.productId) {
        conds.push(`il.product_id = $3`);
        params.push(input.productId);
      }
      const r = await client.query<{ id: string }>(
        `SELECT il.id FROM supply.inventory_lots il WHERE ${conds.join(' AND ')} LIMIT 1`,
        params,
      );
      if (!r.rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lote não encontrado.' });
      }
      lotId = r.rows[0].id;
    }
    if (!lotId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe lotId ou lotNumber.' });
    }

    const conds: string[] = ['plt.clinic_id = $1', 'plt.lot_id = $2'];
    const params: unknown[] = [ctx.clinicId, lotId];
    let p = 3;
    if (input.cursor) {
      conds.push(`plt.applied_at < $${p++}`);
      params.push(input.cursor);
    }

    const rows = await client.query<{
      trace_id: string; applied_at: string; quantity_used: number;
      patient_id: string; patient_name_enc: string | null; patient_phone_enc: string | null;
      product_id: string; product_name: string; product_anvisa: string | null;
      lot_id: string; lot_number: string; expiry_date: string | null;
      supplier_name: string | null;
      encounter_id: string | null; procedure_name: string | null; provider_name: string | null;
    }>(
      `SELECT plt.id AS trace_id, plt.applied_at, plt.quantity_used,
              plt.patient_id,
              pt.name  AS patient_name_enc,
              pt.phone_encrypted AS patient_phone_enc,
              COALESCE(plt.product_id, il.product_id) AS product_id,
              p.name AS product_name, p.anvisa_registration AS product_anvisa,
              il.id AS lot_id, il.lot_number, il.expiry_date,
              sup.name AS supplier_name,
              plt.encounter_id,
              s.name AS procedure_name,
              usr.name AS provider_name
         FROM supply.patient_lot_traces plt
         JOIN shared.patients pt         ON pt.id = plt.patient_id
         JOIN supply.inventory_lots il   ON il.id = plt.lot_id
         JOIN supply.products p          ON p.id  = COALESCE(plt.product_id, il.product_id)
    LEFT JOIN supply.purchase_order_items poi ON poi.id = il.purchase_order_item_id
    LEFT JOIN supply.purchase_orders po  ON po.id  = poi.purchase_order_id
    LEFT JOIN supply.suppliers sup       ON sup.id = po.supplier_id
    LEFT JOIN clinical.encounters e      ON e.id   = plt.encounter_id
    LEFT JOIN shared.appointments a      ON a.id   = e.appointment_id
    LEFT JOIN shared.services s          ON s.id   = a.service_id
    LEFT JOIN shared.users usr           ON usr.id = e.provider_id
        WHERE ${conds.join(' AND ')}
        ORDER BY plt.applied_at DESC
        LIMIT $${p}`,
      [...params, input.limit + 1],
    );

    const hasNext    = rows.rows.length > input.limit;
    const pageRows   = hasNext ? rows.rows.slice(0, input.limit) : rows.rows;
    const nextCursor = hasNext ? pageRows[pageRows.length - 1]!.applied_at : null;

    const countR = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM supply.patient_lot_traces plt
        WHERE plt.clinic_id = $1 AND plt.lot_id = $2`,
      [ctx.clinicId, lotId],
    );

    const traceRows: TracebackRow[] = pageRows.map((r) => {
      const fullName = decryptOptional(r.patient_name_enc) ?? 'Paciente';
      const fullPhone = decryptOptional(r.patient_phone_enc);
      return {
        traceId:       r.trace_id,
        appliedAt:     new Date(r.applied_at).toISOString(),
        quantityUsed:  Number(r.quantity_used),
        patientId:     r.patient_id,
        patientLabel:  ctx.canRecall ? fullName : maskPatientName(fullName),
        patientPhone:  ctx.canRecall ? fullPhone : maskPhone(fullPhone),
        productId:     r.product_id,
        productName:   r.product_name,
        productAnvisa: r.product_anvisa,
        lotId:         r.lot_id,
        lotNumber:     r.lot_number,
        expiryDate:    r.expiry_date,
        supplierName:  r.supplier_name,
        encounterId:   r.encounter_id,
        procedureName: r.procedure_name,
        providerName:  r.provider_name,
      };
    });

    await logTraceabilityAccess(ctx, {
      action:  'query_by_lot',
      lotId,
      metadata: { rows: traceRows.length },
    });

    return {
      rows:       traceRows,
      nextCursor,
      total:      parseInt(countR.rows[0]?.count ?? '0', 10),
    };
  });
}

/* ── Query: por paciente ────────────────────────────────────────────────── */

export async function tracebackByPatient(
  input: TracebackByPatientInput,
  ctx:   TraceabilityContext,
): Promise<TracebackResult> {
  return withClinicContext(ctx.clinicId, async (client) => {
    const conds: string[] = ['plt.clinic_id = $1', 'plt.patient_id = $2'];
    const params: unknown[] = [ctx.clinicId, input.patientId];
    let p = 3;
    if (input.from) { conds.push(`plt.applied_at >= $${p++}`); params.push(input.from); }
    if (input.to)   { conds.push(`plt.applied_at <= $${p++}`); params.push(input.to); }
    if (input.cursor) { conds.push(`plt.applied_at < $${p++}`); params.push(input.cursor); }

    const rows = await client.query<{
      trace_id: string; applied_at: string; quantity_used: number;
      patient_id: string; patient_name_enc: string | null; patient_phone_enc: string | null;
      product_id: string; product_name: string; product_anvisa: string | null;
      lot_id: string; lot_number: string; expiry_date: string | null;
      supplier_name: string | null;
      encounter_id: string | null; procedure_name: string | null; provider_name: string | null;
    }>(
      `SELECT plt.id AS trace_id, plt.applied_at, plt.quantity_used,
              plt.patient_id,
              pt.name  AS patient_name_enc,
              pt.phone_encrypted AS patient_phone_enc,
              COALESCE(plt.product_id, il.product_id) AS product_id,
              p.name AS product_name, p.anvisa_registration AS product_anvisa,
              il.id AS lot_id, il.lot_number, il.expiry_date,
              sup.name AS supplier_name,
              plt.encounter_id,
              s.name AS procedure_name,
              usr.name AS provider_name
         FROM supply.patient_lot_traces plt
         JOIN shared.patients pt       ON pt.id = plt.patient_id
         JOIN supply.inventory_lots il ON il.id = plt.lot_id
         JOIN supply.products p        ON p.id  = COALESCE(plt.product_id, il.product_id)
    LEFT JOIN supply.purchase_order_items poi ON poi.id = il.purchase_order_item_id
    LEFT JOIN supply.purchase_orders po ON po.id  = poi.purchase_order_id
    LEFT JOIN supply.suppliers sup     ON sup.id = po.supplier_id
    LEFT JOIN clinical.encounters e    ON e.id   = plt.encounter_id
    LEFT JOIN shared.appointments a    ON a.id   = e.appointment_id
    LEFT JOIN shared.services s        ON s.id   = a.service_id
    LEFT JOIN shared.users usr         ON usr.id = e.provider_id
        WHERE ${conds.join(' AND ')}
        ORDER BY plt.applied_at DESC
        LIMIT $${p}`,
      [...params, input.limit + 1],
    );

    const hasNext    = rows.rows.length > input.limit;
    const pageRows   = hasNext ? rows.rows.slice(0, input.limit) : rows.rows;
    const nextCursor = hasNext ? pageRows[pageRows.length - 1]!.applied_at : null;

    const countR = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM supply.patient_lot_traces plt
        WHERE plt.clinic_id = $1 AND plt.patient_id = $2`,
      [ctx.clinicId, input.patientId],
    );

    const traceRows: TracebackRow[] = pageRows.map((r) => {
      const fullName = decryptOptional(r.patient_name_enc) ?? 'Paciente';
      const fullPhone = decryptOptional(r.patient_phone_enc);
      return {
        traceId:       r.trace_id,
        appliedAt:     new Date(r.applied_at).toISOString(),
        quantityUsed:  Number(r.quantity_used),
        patientId:     r.patient_id,
        patientLabel:  fullName,
        patientPhone:  fullPhone,
        productId:     r.product_id,
        productName:   r.product_name,
        productAnvisa: r.product_anvisa,
        lotId:         r.lot_id,
        lotNumber:     r.lot_number,
        expiryDate:    r.expiry_date,
        supplierName:  r.supplier_name,
        encounterId:   r.encounter_id,
        procedureName: r.procedure_name,
        providerName:  r.provider_name,
      };
    });

    await logTraceabilityAccess(ctx, {
      action:  'query_by_patient',
      patientId: input.patientId,
      metadata: { rows: traceRows.length },
    });

    return {
      rows:       traceRows,
      nextCursor,
      total:      parseInt(countR.rows[0]?.count ?? '0', 10),
    };
  });
}

/* ── Relatório PDF (recall por lote ou paciente) ─────────────────────────── */

interface ClinicInfo {
  name: string;
  cnpj: string | null;
  address: string | null;
  technical_responsible: string | null;
}

async function loadClinicInfo(clinicId: string): Promise<ClinicInfo> {
  const r = await db.query<{
    name: string; cnpj: string | null; address: Record<string, string | null> | null;
    cnes: string | null; afe: string | null;
  }>(
    `SELECT name, cnpj, address, cnes, afe
       FROM shared.clinics WHERE id = $1`,
    [clinicId],
  );
  if (!r.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Clínica não encontrada.' });
  }
  const row = r.rows[0];
  const addr = row.address ?? {};
  const addressLine = [addr.street, addr.number, addr.complement, addr.district, addr.city, addr.state, addr.zip]
    .filter((v) => v && String(v).trim().length > 0)
    .join(', ');
  const technical = [row.cnes ? `CNES ${row.cnes}` : null, row.afe ? `AFE ${row.afe}` : null].filter(Boolean).join(' · ');
  return {
    name: row.name,
    cnpj: row.cnpj,
    address: addressLine || null,
    technical_responsible: technical || null,
  };
}

async function renderPdfToBuffer(render: (doc: PDFKit.PDFDocument) => Promise<void> | void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size:    'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info:    { Title: 'DermaOS - Relatório de Rastreabilidade ANVISA' },
    });
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const timeout = setTimeout(() => {
      reject(new TRPCError({ code: 'TIMEOUT', message: 'Timeout ao gerar relatório PDF.' }));
      doc.end();
    }, REPORT_GEN_TIMEOUT);

    Promise.resolve()
      .then(() => render(doc))
      .then(() => { clearTimeout(timeout); doc.end(); })
      .catch((err) => { clearTimeout(timeout); reject(err); doc.end(); });
  });
}

function drawHeader(doc: PDFKit.PDFDocument, clinic: ClinicInfo): void {
  doc.fontSize(16).font('Helvetica-Bold').text('RELATÓRIO DE RASTREABILIDADE — ANVISA', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica').fillColor('#555');
  doc.text('Documento de uso regulatório — vigilância sanitária', { align: 'center' });
  doc.fillColor('#000').moveDown();

  doc.fontSize(11).font('Helvetica-Bold').text('Clínica');
  doc.font('Helvetica').fontSize(10);
  doc.text(sanitizeForPdf(clinic.name));
  if (clinic.cnpj)                 doc.text(`CNPJ: ${sanitizeForPdf(clinic.cnpj, 20)}`);
  if (clinic.address)              doc.text(`Endereço: ${sanitizeForPdf(clinic.address, 200)}`);
  if (clinic.technical_responsible) doc.text(`Responsável técnico: ${sanitizeForPdf(clinic.technical_responsible, 120)}`);
  doc.moveDown();
}

function drawFooter(doc: PDFKit.PDFDocument, hash: string): void {
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#666')
    .text(`Emitido em ${new Date().toLocaleString('pt-BR')} · Hash SHA-256: ${hash.slice(0, 16)}…`, { align: 'center' });
  doc.fillColor('#000');
}

export async function generateRecallReport(
  input: GenerateRecallReportInput,
  ctx:   TraceabilityContext,
): Promise<RecallReportResult> {
  if (!ctx.canRecall) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Geração de relatório exige permissão traceability.recall.' });
  }
  await ensureReportsBucket();
  const clinic = await loadClinicInfo(ctx.clinicId);

  // Carrega dados imprimíveis
  const rows = input.scope === 'by_lot'
    ? (await tracebackByLot(
        { lotId: input.lotId!, limit: 500 },
        ctx,
      )).rows
    : (await tracebackByPatient(
        { patientId: input.patientId!, limit: 500 },
        ctx,
      )).rows;

  // Renderiza PDF (duas passes — primeiro para calcular hash, depois persiste)
  const pdfBuffer = await renderPdfToBuffer(async (doc) => {
    drawHeader(doc, clinic);

    doc.fontSize(11).font('Helvetica-Bold').text(
      input.scope === 'by_lot' ? 'Escopo: Rastreamento por Lote' : 'Escopo: Rastreamento por Paciente',
    );
    doc.font('Helvetica').fontSize(10);

    if (input.scope === 'by_lot' && rows[0]) {
      doc.text(`Produto: ${sanitizeForPdf(rows[0].productName)}`);
      if (rows[0].productAnvisa) doc.text(`Registro ANVISA: ${sanitizeForPdf(rows[0].productAnvisa, 40)}`);
      doc.text(`Lote: ${sanitizeForPdf(rows[0].lotNumber, 80)}`);
      if (rows[0].expiryDate) doc.text(`Validade: ${sanitizeForPdf(rows[0].expiryDate, 20)}`);
      if (rows[0].supplierName) doc.text(`Fornecedor: ${sanitizeForPdf(rows[0].supplierName, 120)}`);
    } else if (input.scope === 'by_patient' && rows[0]) {
      doc.text(`Paciente: ${sanitizeForPdf(rows[0].patientLabel, 120)}`);
    }
    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold').text(`Ocorrências de uso (${rows.length})`);
    doc.moveDown(0.3);

    for (const row of rows) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
      doc.text(`• ${new Date(row.appliedAt).toLocaleString('pt-BR')}`);
      doc.font('Helvetica').fontSize(9).fillColor('#333');
      const patientLine = `   Paciente: ${sanitizeForPdf(row.patientLabel, 80)}`
        + (row.patientPhone ? ` (${sanitizeForPdf(row.patientPhone, 30)})` : '');
      doc.text(patientLine);
      doc.text(`   Produto: ${sanitizeForPdf(row.productName, 120)} · Lote: ${sanitizeForPdf(row.lotNumber, 40)} · Qtd: ${row.quantityUsed}`);
      if (row.procedureName || row.providerName) {
        doc.text(`   Procedimento: ${sanitizeForPdf(row.procedureName, 80)}${
          row.providerName ? ` · Responsável: ${sanitizeForPdf(row.providerName, 60)}` : ''
        }`);
      }
      doc.moveDown(0.2);

      // Page break check
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
      }
    }

    doc.fillColor('#000');
  });

  const sha256 = createHash('sha256').update(pdfBuffer).digest('hex');

  // Render novamente com hash no rodapé (mantém consistência do hash)
  const finalBuffer = await renderPdfToBuffer(async (doc) => {
    drawHeader(doc, clinic);

    doc.fontSize(11).font('Helvetica-Bold').text(
      input.scope === 'by_lot' ? 'Escopo: Rastreamento por Lote' : 'Escopo: Rastreamento por Paciente',
    );
    doc.font('Helvetica').fontSize(10);

    if (input.scope === 'by_lot' && rows[0]) {
      doc.text(`Produto: ${sanitizeForPdf(rows[0].productName)}`);
      if (rows[0].productAnvisa) doc.text(`Registro ANVISA: ${sanitizeForPdf(rows[0].productAnvisa, 40)}`);
      doc.text(`Lote: ${sanitizeForPdf(rows[0].lotNumber, 80)}`);
      if (rows[0].expiryDate) doc.text(`Validade: ${sanitizeForPdf(rows[0].expiryDate, 20)}`);
      if (rows[0].supplierName) doc.text(`Fornecedor: ${sanitizeForPdf(rows[0].supplierName, 120)}`);
    } else if (input.scope === 'by_patient' && rows[0]) {
      doc.text(`Paciente: ${sanitizeForPdf(rows[0].patientLabel, 120)}`);
    }
    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold').text(`Ocorrências de uso (${rows.length})`);
    doc.moveDown(0.3);

    for (const row of rows) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
      doc.text(`• ${new Date(row.appliedAt).toLocaleString('pt-BR')}`);
      doc.font('Helvetica').fontSize(9).fillColor('#333');
      const patientLine = `   Paciente: ${sanitizeForPdf(row.patientLabel, 80)}`
        + (row.patientPhone ? ` (${sanitizeForPdf(row.patientPhone, 30)})` : '');
      doc.text(patientLine);
      doc.text(`   Produto: ${sanitizeForPdf(row.productName, 120)} · Lote: ${sanitizeForPdf(row.lotNumber, 40)} · Qtd: ${row.quantityUsed}`);
      if (row.procedureName || row.providerName) {
        doc.text(`   Procedimento: ${sanitizeForPdf(row.procedureName, 80)}${
          row.providerName ? ` · Responsável: ${sanitizeForPdf(row.providerName, 60)}` : ''
        }`);
      }
      doc.moveDown(0.2);
      if (doc.y > doc.page.height - 120) doc.addPage();
    }

    doc.fillColor('#000');
    drawFooter(doc, sha256);
  });

  // Upload para MinIO
  const objectKey = `${ctx.clinicId}/recall-${input.scope}-${Date.now()}-${randomUUID().slice(0, 8)}.pdf`;
  await putObjectBuffer(objectKey, finalBuffer, 'application/pdf', REPORTS_BUCKET);

  // Persiste registro do report
  const insertR = await db.query<{ id: string; generated_at: string }>(
    `INSERT INTO supply.traceability_reports
       (clinic_id, report_type, scope_lot_id, scope_patient_id, scope_product_id,
        object_key, sha256_hex, size_bytes, generated_by, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, generated_at`,
    [
      ctx.clinicId,
      input.scope === 'by_lot' ? 'recall_by_lot' : 'recall_by_patient',
      input.scope === 'by_lot' ? input.lotId : null,
      input.scope === 'by_patient' ? input.patientId : null,
      rows[0]?.productId ?? null,
      objectKey,
      sha256,
      finalBuffer.length,
      ctx.userId,
      JSON.stringify({ rowCount: rows.length, scope: input.scope }),
    ],
  );
  const reportId = insertR.rows[0]!.id;

  await logTraceabilityAccess(ctx, {
    action: 'generate_report',
    lotId:     input.scope === 'by_lot'     ? input.lotId! : null,
    patientId: input.scope === 'by_patient' ? input.patientId! : null,
    reportId,
    metadata: { rowCount: rows.length, sha256, sizeBytes: finalBuffer.length },
  });

  // Audit trail separado
  await db.query(
    `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
     VALUES ($1, 'traceability_report', $2, 'report.generated', $3, $4)`,
    [
      ctx.clinicId, reportId,
      JSON.stringify({ scope: input.scope, lotId: input.lotId ?? null, patientId: input.patientId ?? null, sha256, sizeBytes: finalBuffer.length, rowCount: rows.length }),
      JSON.stringify({ user_id: ctx.userId, ip: ctx.ipOrigin }),
    ],
  );

  const downloadUrl = await presignGet(objectKey, REPORT_PDF_URL_TTL, REPORTS_BUCKET);

  return {
    reportId,
    objectKey,
    downloadUrl,
    sha256,
    sizeBytes:  finalBuffer.length,
    generatedAt: new Date(insertR.rows[0]!.generated_at).toISOString(),
  };
}

/* ── Download (presigned URL) ────────────────────────────────────────────── */

export async function downloadRecallReport(
  reportId: string,
  ctx:      TraceabilityContext,
): Promise<{ downloadUrl: string; sha256: string; objectKey: string }> {
  if (!ctx.canRecall) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Download exige permissão traceability.recall.' });
  }
  return withClinicContext(ctx.clinicId, async (client) => {
    const r = await client.query<{ object_key: string; sha256_hex: string }>(
      `SELECT object_key, sha256_hex FROM supply.traceability_reports
        WHERE id = $1 AND clinic_id = $2`,
      [reportId, ctx.clinicId],
    );
    if (!r.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Relatório não encontrado.' });
    }
    const url = await presignGet(r.rows[0].object_key, REPORT_PDF_URL_TTL, REPORTS_BUCKET);

    await logTraceabilityAccess(ctx, { action: 'download_report', reportId });

    return { downloadUrl: url, sha256: r.rows[0].sha256_hex, objectKey: r.rows[0].object_key };
  });
}

import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { minio } from '../../lib/minio.js';
import { verifyPortalToken, assertOwnership } from './portal-middleware.js';
import { paginationSchema } from './portal.schemas.js';
import { env } from '../../config/env.js';

const PRESIGNED_TTL_SEC = 15 * 60; // 15 minutos
const PRESCRIPTIONS_BUCKET = 'documents';

export async function registerPortalPrescriptionRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /portal/prescriptions ─────────────────────────────────────────────────
  // Lista prescrições assinadas (não rascunhos).
  // Sem acesso a notas SOAP, diagnósticos ou dados clínicos detalhados.
  app.get('/prescriptions', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parâmetros inválidos.' });
    }

    const { page, limit } = parsed.data;
    const { id: patientId } = req.portalPatient;
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db.query<{
        id: string; type: string; status: string; valid_until: string | null;
        created_at: string; prescription_number: string | null;
        prescriber_name: string; has_pdf: boolean;
      }>(
        `SELECT p.id, p.type, p.status, p.valid_until, p.created_at,
                p.prescription_number,
                u.name        AS prescriber_name,
                (p.pdf_url IS NOT NULL) AS has_pdf
         FROM clinical.prescriptions p
         JOIN shared.users            u ON u.id = p.prescriber_id
         WHERE p.patient_id = $1
           AND p.status IN ('emitida', 'enviada_digital', 'impressa')
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [patientId, limit, offset],
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*)::TEXT AS count
         FROM clinical.prescriptions
         WHERE patient_id = $1
           AND status IN ('emitida', 'enviada_digital', 'impressa')`,
        [patientId],
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    return reply.send({
      data: rows.rows.map((r) => ({
        id:                 r.id,
        type:               r.type,
        status:             r.status,
        validUntil:         r.valid_until,
        createdAt:          r.created_at,
        prescriptionNumber: r.prescription_number,
        prescriberName:     r.prescriber_name,
        hasPdf:             r.has_pdf,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // ── GET /portal/prescriptions/:id/download ────────────────────────────────────
  // Gera presigned URL com TTL de 15 minutos. Registra acesso para auditoria.
  app.get('/prescriptions/:id/download', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { id: patientId } = req.portalPatient;

    const r = await db.query<{
      id: string; patient_id: string; pdf_url: string | null; status: string;
    }>(
      `SELECT id, patient_id, pdf_url, status
       FROM clinical.prescriptions WHERE id = $1`,
      [id],
    );

    if (!r.rows[0]) {
      return reply.status(403).send({ error: 'Acesso não autorizado.' });
    }

    // RLS: 403 (nunca 404) se pertencer a outro paciente
    if (!assertOwnership(reply, r.rows[0].patient_id, patientId)) return;

    if (!['emitida', 'enviada_digital', 'impressa'].includes(r.rows[0].status)) {
      return reply.status(403).send({ error: 'Prescrição não disponível para download.' });
    }

    if (!r.rows[0].pdf_url) {
      return reply.status(404).send({ error: 'PDF não disponível. Entre em contato com a clínica.' });
    }

    // Gerar presigned URL — nunca URL pública permanente
    const presignedUrl = await minio.presignedGetObject(
      PRESCRIPTIONS_BUCKET,
      r.rows[0].pdf_url,
      PRESIGNED_TTL_SEC,
    );

    // Auditoria de acesso
    await db.query(
      `INSERT INTO portal.document_access_log
         (patient_id, document_type, document_id, ip_address, user_agent)
       VALUES ($1, 'prescription_pdf', $2, $3, $4)`,
      [patientId, id, req.ip, req.headers['user-agent'] ?? null],
    );

    return reply.send({
      url:       presignedUrl,
      expiresIn: PRESIGNED_TTL_SEC,
    });
  });
}

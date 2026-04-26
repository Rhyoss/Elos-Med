import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { minio } from '../../lib/minio.js';
import { verifyPortalToken, assertOwnership } from './portal-middleware.js';
import { paginationSchema } from './portal.schemas.js';

const PRESIGNED_TTL_SEC = 15 * 60;
const DOCUMENTS_BUCKET  = 'documents';

export async function registerPortalResultsRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /portal/results ───────────────────────────────────────────────────────
  // Apenas resultados explicitamente liberados pelo médico (released_to_patient = true).
  // Resultados não liberados simplesmente não existem para o paciente — sem "bloqueado".
  app.get('/results', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parâmetros inválidos.' });
    }

    const { page, limit } = parsed.data;
    const { id: patientId } = req.portalPatient;
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db.query<{
        id: string; type: string; status: string; collected_at: string;
        released_at: string; released_by_name: string;
        lab_name: string | null; has_pdf: boolean;
      }>(
        `SELECT b.id,
                b.type,
                b.status,
                b.collected_at,
                b.released_at,
                u.name           AS released_by_name,
                b.lab_name,
                (b.result_pdf_url IS NOT NULL) AS has_pdf
         FROM clinical.biopsies  b
         JOIN shared.users        u ON u.id = b.released_by
         WHERE b.patient_id         = $1
           AND b.released_to_patient = TRUE
           AND b.result_received_at  IS NOT NULL
         ORDER BY b.released_at DESC
         LIMIT $2 OFFSET $3`,
        [patientId, limit, offset],
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*)::TEXT AS count
         FROM clinical.biopsies
         WHERE patient_id          = $1
           AND released_to_patient  = TRUE
           AND result_received_at   IS NOT NULL`,
        [patientId],
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    return reply.send({
      data: rows.rows.map((r) => ({
        id:              r.id,
        type:            r.type,
        status:          r.status,
        collectedAt:     r.collected_at,
        releasedAt:      r.released_at,
        releasedByName:  r.released_by_name,
        labName:         r.lab_name,
        hasPdf:          r.has_pdf,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // ── GET /portal/results/:id/download ─────────────────────────────────────────
  // Presigned URL para laudo PDF (15 min). Auditoria de acesso.
  app.get('/results/:id/download', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { id: patientId } = req.portalPatient;

    const r = await db.query<{
      patient_id: string; released_to_patient: boolean;
      result_pdf_url: string | null; result_received_at: string | null;
    }>(
      `SELECT patient_id, released_to_patient, result_pdf_url, result_received_at
       FROM clinical.biopsies WHERE id = $1`,
      [id],
    );

    if (!r.rows[0]) {
      return reply.status(403).send({ error: 'Acesso não autorizado.' });
    }

    // RLS: 403 independente — não revela existência de dados de outros pacientes
    if (!assertOwnership(reply, r.rows[0].patient_id, patientId)) return;

    // Resultado não liberado: simplesmente 403 — não revela que existe
    if (!r.rows[0].released_to_patient) {
      return reply.status(403).send({ error: 'Acesso não autorizado.' });
    }

    if (!r.rows[0].result_pdf_url) {
      return reply.status(404).send({ error: 'Laudo não disponível. Entre em contato com a clínica.' });
    }

    const presignedUrl = await minio.presignedGetObject(
      DOCUMENTS_BUCKET,
      r.rows[0].result_pdf_url,
      PRESIGNED_TTL_SEC,
    );

    await db.query(
      `INSERT INTO portal.document_access_log
         (patient_id, document_type, document_id, ip_address, user_agent)
       VALUES ($1, 'biopsy_result', $2, $3, $4)`,
      [patientId, id, req.ip, req.headers['user-agent'] ?? null],
    );

    return reply.send({
      url:       presignedUrl,
      expiresIn: PRESIGNED_TTL_SEC,
    });
  });
}

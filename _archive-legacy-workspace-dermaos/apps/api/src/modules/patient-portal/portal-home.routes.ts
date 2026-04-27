import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { verifyPortalToken } from './portal-middleware.js';

export async function registerPortalHomeRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /portal/home ──────────────────────────────────────────────────────────
  // Próximo agendamento, prescrições ativas e avisos não lidos.
  // Sem dados clínicos: SOAP, diagnósticos em texto livre e imagens clínicas não expostos.
  app.get('/home', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id: patientId } = req.portalPatient;

    const [apptResult, rxResult, notifResult] = await Promise.all([
      // Próximo agendamento futuro confirmado ou agendado
      db.query<{
        id: string; scheduled_at: string; duration_min: number;
        provider_name: string; service_name: string | null; status: string;
      }>(
        `SELECT a.id,
                a.scheduled_at,
                a.duration_min,
                u.name        AS provider_name,
                s.name        AS service_name,
                a.status
         FROM shared.appointments a
         JOIN shared.users        u ON u.id = a.provider_id
         LEFT JOIN shared.services s ON s.id = a.service_id
         WHERE a.patient_id = $1
           AND a.scheduled_at > NOW()
           AND a.status NOT IN ('cancelled', 'no_show')
         ORDER BY a.scheduled_at ASC
         LIMIT 1`,
        [patientId],
      ),

      // Prescrições ativas (emitidas, não rascunhos nem expiradas)
      db.query<{
        id: string; type: string; valid_until: string | null;
        created_at: string; prescription_number: string | null;
      }>(
        `SELECT id, type, valid_until, created_at, prescription_number
         FROM clinical.prescriptions
         WHERE patient_id = $1
           AND status IN ('emitida', 'enviada_digital', 'impressa')
           AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
         ORDER BY created_at DESC
         LIMIT 5`,
        [patientId],
      ),

      // Avisos/notificações não lidos
      db.query<{
        id: string; type: string; title: string; body: string; created_at: string;
      }>(
        `SELECT id, type, title, body, created_at
         FROM portal.notifications
         WHERE patient_id = $1
           AND read_at IS NULL
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC
         LIMIT 10`,
        [patientId],
      ),
    ]);

    const nextAppointment = apptResult.rows[0]
      ? {
          id:           apptResult.rows[0].id,
          scheduledAt:  apptResult.rows[0].scheduled_at,
          durationMin:  apptResult.rows[0].duration_min,
          providerName: apptResult.rows[0].provider_name,
          serviceName:  apptResult.rows[0].service_name,
          status:       apptResult.rows[0].status,
        }
      : null;

    return reply.send({
      nextAppointment,
      activePrescriptions: rxResult.rows.map((r) => ({
        id:                 r.id,
        type:               r.type,
        validUntil:         r.valid_until,
        createdAt:          r.created_at,
        prescriptionNumber: r.prescription_number,
      })),
      unreadNotices: notifResult.rows.map((n) => ({
        id:        n.id,
        type:      n.type,
        title:     n.title,
        body:      n.body,
        createdAt: n.created_at,
      })),
      unreadCount: notifResult.rows.length,
    });
  });

  // ── POST /portal/home/notices/:id/read ───────────────────────────────────────
  app.post('/home/notices/:id/read', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { id: patientId } = req.portalPatient;

    // Valida ownership antes de marcar como lido
    const r = await db.query(
      'SELECT id FROM portal.notifications WHERE id = $1 AND patient_id = $2',
      [id, patientId],
    );

    if (!r.rows[0]) {
      return reply.status(403).send({ error: 'Acesso não autorizado.' });
    }

    await db.query(
      'UPDATE portal.notifications SET read_at = NOW() WHERE id = $1',
      [id],
    );

    return reply.send({ ok: true });
  });
}

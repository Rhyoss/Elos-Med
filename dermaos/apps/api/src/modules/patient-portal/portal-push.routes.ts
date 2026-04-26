import type { FastifyInstance } from 'fastify';
import webpush from 'web-push';
import { db } from '../../db/client.js';
import { verifyPortalToken } from './portal-middleware.js';
import { portalPushSubscribeSchema } from './portal.schemas.js';
import { env } from '../../config/env.js';

export async function registerPortalPushRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /portal/push/vapid-public-key ────────────────────────────────────────
  app.get('/push/vapid-public-key', async (_req, reply) => {
    if (!env.PORTAL_VAPID_PUBLIC_KEY) {
      return reply.status(503).send({ error: 'Push notifications não configuradas.' });
    }
    return reply.send({ publicKey: env.PORTAL_VAPID_PUBLIC_KEY });
  });

  // ── POST /portal/push/subscribe ───────────────────────────────────────────────
  app.post('/push/subscribe', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const parsed = portalPushSubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados de subscrição inválidos.' });
    }

    const { endpoint, keys } = parsed.data;
    const { id: patientId } = req.portalPatient;

    await db.query(
      `INSERT INTO portal.push_subscriptions (patient_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint)
       DO UPDATE SET patient_id = $1, p256dh = $3, auth = $4, is_active = TRUE`,
      [patientId, endpoint, keys.p256dh, keys.auth],
    );

    return reply.status(201).send({ ok: true });
  });

  // ── DELETE /portal/push/subscribe ────────────────────────────────────────────
  app.delete('/push/subscribe', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { endpoint } = (req.body ?? {}) as { endpoint?: string };
    const { id: patientId } = req.portalPatient;

    if (endpoint) {
      await db.query(
        'UPDATE portal.push_subscriptions SET is_active = FALSE WHERE endpoint = $1 AND patient_id = $2',
        [endpoint, patientId],
      );
    } else {
      await db.query(
        'UPDATE portal.push_subscriptions SET is_active = FALSE WHERE patient_id = $1',
        [patientId],
      );
    }

    return reply.send({ ok: true });
  });
}

// ─── Utilitário para enviar push (usado pelo worker) ─────────────────────────

export async function sendPushToPatient(
  patientId: string,
  payload: { title: string; body: string; type: string },
): Promise<void> {
  if (!env.PORTAL_VAPID_PUBLIC_KEY || !env.PORTAL_VAPID_PRIVATE_KEY) return;

  webpush.setVapidDetails(
    env.PORTAL_VAPID_SUBJECT ?? 'mailto:noreply@dermaos.com.br',
    env.PORTAL_VAPID_PUBLIC_KEY,
    env.PORTAL_VAPID_PRIVATE_KEY,
  );

  const subs = await db.query<{ endpoint: string; p256dh: string; auth: string }>(
    'SELECT endpoint, p256dh, auth FROM portal.push_subscriptions WHERE patient_id = $1 AND is_active = TRUE',
    [patientId],
  );

  const results = await Promise.allSettled(
    subs.rows.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          title: payload.title,
          body:  payload.body,
          type:  payload.type,
        }),
      ),
    ),
  );

  // Desativar subscriptions inválidas (410 Gone)
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (res?.status === 'rejected') {
      const err = res.reason as { statusCode?: number };
      if (err.statusCode === 410) {
        await db.query(
          'UPDATE portal.push_subscriptions SET is_active = FALSE WHERE endpoint = $1',
          [subs.rows[i]!.endpoint],
        );
      }
    }

    if (res?.status === 'fulfilled') {
      await db.query(
        'UPDATE portal.push_subscriptions SET last_used_at = NOW() WHERE endpoint = $1',
        [subs.rows[i]!.endpoint],
      );
    }
  }
}

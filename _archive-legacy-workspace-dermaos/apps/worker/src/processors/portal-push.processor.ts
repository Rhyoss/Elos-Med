import type { Job } from 'bullmq';
import webpush from 'web-push';
import { db } from '../db/client.js';
import { logger } from '../lib/logger.js';

export interface PortalPushJobData {
  patientId: string;
  type:      'appointment_reminder_24h' | 'appointment_reminder_2h' | 'result_available' | 'new_message';
  payload:   Record<string, string>;
}

const NOTIFICATION_CONTENT: Record<PortalPushJobData['type'], (p: Record<string, string>) => { title: string; body: string }> = {
  appointment_reminder_24h: (p) => ({
    title: 'Lembrete de consulta',
    body:  `Você tem uma consulta amanhã às ${p['time']} com ${p['provider']}.`,
  }),
  appointment_reminder_2h: (p) => ({
    title: 'Consulta em 2 horas',
    body:  `Sua consulta com ${p['provider']} é hoje às ${p['time']}. Não esqueça!`,
  }),
  result_available: () => ({
    title: 'Resultado disponível',
    body:  'Um laudo de exame foi disponibilizado no portal.',
  }),
  new_message: (p) => ({
    title: 'Nova mensagem da clínica',
    body:  p['preview'] ? `"${p['preview']}"` : 'Você recebeu uma mensagem.',
  }),
};

async function sendPush(
  patientId: string,
  payload: { title: string; body: string; type: string },
): Promise<void> {
  const vapidPublic  = process.env['PORTAL_VAPID_PUBLIC_KEY'];
  const vapidPrivate = process.env['PORTAL_VAPID_PRIVATE_KEY'];
  const vapidSubject = process.env['PORTAL_VAPID_SUBJECT'] ?? 'mailto:noreply@dermaos.com.br';

  if (!vapidPublic || !vapidPrivate) return;

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const subs = await db.query<{ endpoint: string; p256dh: string; auth: string }>(
    'SELECT endpoint, p256dh, auth FROM portal.push_subscriptions WHERE patient_id = $1 AND is_active = TRUE',
    [patientId],
  );

  const results = await Promise.allSettled(
    subs.rows.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: payload.title, body: payload.body, type: payload.type }),
      ),
    ),
  );

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
    } else if (res?.status === 'fulfilled') {
      await db.query(
        'UPDATE portal.push_subscriptions SET last_used_at = NOW() WHERE endpoint = $1',
        [subs.rows[i]!.endpoint],
      );
    }
  }
}

export async function processPortalPush(job: Job<PortalPushJobData>): Promise<void> {
  const { patientId, type, payload } = job.data;

  const notif = NOTIFICATION_CONTENT[type]?.(payload);
  if (!notif) {
    logger.warn({ type }, 'Portal push: unknown notification type');
    return;
  }

  // Registrar notificação no banco para exibição in-app
  try {
    const clinic = await db.query<{ clinic_id: string }>(
      'SELECT clinic_id FROM shared.patients WHERE id = $1',
      [patientId],
    );

    if (clinic.rows[0]) {
      await db.query(
        `INSERT INTO portal.notifications (clinic_id, patient_id, type, title, body)
         VALUES ($1, $2, $3, $4, $5)`,
        [clinic.rows[0].clinic_id, patientId, type, notif.title, notif.body],
      );
    }
  } catch (err) {
    logger.warn({ err, patientId }, 'Failed to store portal notification in DB');
  }

  // Enviar push notification
  try {
    await sendPush(patientId, { ...notif, type });
    logger.info({ patientId, type }, 'Portal push sent');
  } catch (err) {
    logger.error({ err, patientId, type }, 'Portal push failed');
    throw err;
  }
}

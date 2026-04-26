import { redisSub } from '../../db/redis.js';
import { emitToClinic } from '../../lib/socket.js';
import { logger } from '../../lib/logger.js';

const REALTIME_CHANNEL = 'omni:realtime';

interface RealtimeMessage {
  clinicId: string;
  event:    string;
  payload:  Record<string, unknown>;
}

/**
 * Assina o canal Redis onde o worker publica eventos de mensagens recebidas.
 * Cada mensagem é relayed para a sala "clinic:<clinicId>" via Socket.io.
 */
export async function subscribeOmniRealtime(): Promise<void> {
  await redisSub.subscribe(REALTIME_CHANNEL);

  redisSub.on('message', (channel, raw) => {
    if (channel !== REALTIME_CHANNEL) return;
    try {
      const msg = JSON.parse(raw) as RealtimeMessage;
      if (!msg.clinicId || !msg.event) return;
      emitToClinic(msg.clinicId, msg.event, msg.payload ?? {});
    } catch (err) {
      logger.warn({ err, raw }, 'Failed to relay omni realtime message');
    }
  });

  logger.info({ channel: REALTIME_CHANNEL }, 'Omni realtime subscriber active');
}

import { redisSub } from '../../db/redis.js';
import { emitToClinic } from '../../lib/socket.js';
import { logger } from '../../lib/logger.js';

const REALTIME_CHANNEL = 'supply:realtime';

interface RealtimeMessage {
  clinicId: string;
  event:    string;
  payload:  Record<string, unknown>;
}

/**
 * Assina o canal Redis onde o worker de supply publica alertas novos.
 * Cada alerta é relayed para a sala "clinic:<clinicId>" via Socket.io,
 * sob eventos como `stock.lot_expiring`, `stock.rupture`, etc.
 */
export async function subscribeSupplyRealtime(): Promise<void> {
  await redisSub.subscribe(REALTIME_CHANNEL);

  redisSub.on('message', (channel, raw) => {
    if (channel !== REALTIME_CHANNEL) return;
    try {
      const msg = JSON.parse(raw) as RealtimeMessage;
      if (!msg.clinicId || !msg.event) return;
      emitToClinic(msg.clinicId, msg.event, msg.payload ?? {});
    } catch (err) {
      logger.warn({ err, raw }, 'Failed to relay supply realtime message');
    }
  });

  logger.info({ channel: REALTIME_CHANNEL }, 'Supply realtime subscriber active');
}

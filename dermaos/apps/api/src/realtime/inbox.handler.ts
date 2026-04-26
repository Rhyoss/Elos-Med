import { redisSub } from '../db/redis.js';
import { logger } from '../lib/logger.js';
import { emitToInbox } from '../lib/socket.js';

/**
 * Inbox real-time relay.
 * Relays omni events from the Redis `omni:realtime` channel to the
 * tenant-scoped `{clinicId}:inbox` room.
 *
 * Server-side typing throttle: at most 1 `inbox:typing` per conversation per second.
 * 10 webhook typing events in 1s → only 1 Socket.io event delivered to clients.
 */

const OMNI_CHANNEL = 'omni:realtime';

// Throttle state: `typing:{clinicId}:{conversationId}` → last emit timestamp
const typingThrottle = new Map<string, number>();

// Cleanup stale throttle entries every 30s
setInterval(() => {
  const cutoff = Date.now() - 10_000;
  for (const [key, ts] of typingThrottle) {
    if (ts < cutoff) typingThrottle.delete(key);
  }
}, 30_000).unref();

interface OmniMessage {
  clinicId: string;
  event: string;
  payload: Record<string, unknown>;
}

function handleOmniMessage(raw: string): void {
  let msg: OmniMessage;
  try {
    msg = JSON.parse(raw) as OmniMessage;
  } catch {
    logger.warn({ raw }, 'Failed to parse omni realtime message');
    return;
  }

  if (!msg.clinicId || !msg.event) return;

  // Typing events — throttle to 1/s per conversation
  if (msg.event === 'inbox:typing') {
    const conversationId = msg.payload?.conversation_id;
    if (typeof conversationId !== 'string') return;

    const key = `typing:${msg.clinicId}:${conversationId}`;
    const now = Date.now();
    if (now - (typingThrottle.get(key) ?? 0) < 1_000) return;
    typingThrottle.set(key, now);

    emitToInbox(msg.clinicId, 'inbox:typing', {
      conversation_id: conversationId,
      is_typing: true,
    });
    return;
  }

  // All other inbox events — emit directly
  // new_message payload: {conversation_id, message_id, channel, sender_name, preview, timestamp, unread_count}
  // conversation_updated payload: {conversation_id, status, assigned_to, updated_at}
  emitToInbox(msg.clinicId, msg.event, msg.payload ?? {});
}

export async function subscribeInboxRealtime(): Promise<void> {
  await redisSub.subscribe(OMNI_CHANNEL);

  redisSub.on('message', (channel, raw) => {
    if (channel !== OMNI_CHANNEL) return;
    handleOmniMessage(raw);
  });

  logger.info({ channel: OMNI_CHANNEL }, 'Inbox realtime handler active (replaces omni.pubsub)');
}

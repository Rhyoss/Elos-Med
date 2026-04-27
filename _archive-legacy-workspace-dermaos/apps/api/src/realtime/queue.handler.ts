import { db } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { emitToQueue } from '../lib/socket.js';
import { eventBus } from '../events/event-bus.js';
import type { DomainEventType } from '../events/event-types.js';

const MAX_QUEUE_SIZE = 50;

interface QueueEntry {
  position: number;
  appointment_id: string;
  patient_name: string;
  scheduled_time: string;
  checkin_time: string | null;
  wait_minutes: number | null;
  provider_name: string;
  status: string;
}

async function fetchQueue(clinicId: string): Promise<QueueEntry[]> {
  const result = await db.query<QueueEntry>(
    `
    SELECT
      ROW_NUMBER() OVER (ORDER BY a.scheduled_at ASC) AS position,
      a.id                                              AS appointment_id,
      p.full_name                                       AS patient_name,
      a.scheduled_at                                    AS scheduled_time,
      CASE WHEN a.status = 'waiting' OR a.status = 'in_progress'
           THEN a.updated_at ELSE NULL END              AS checkin_time,
      CASE WHEN a.status IN ('waiting', 'in_progress')
           THEN ROUND(EXTRACT(EPOCH FROM (NOW() - a.updated_at)) / 60)
           ELSE NULL END                                AS wait_minutes,
      u.name                                            AS provider_name,
      a.status
    FROM  shared.appointments a
    JOIN  shared.patients p ON p.id = a.patient_id
    JOIN  shared.users    u ON u.id = a.provider_id
    WHERE a.clinic_id  = $1
      AND a.scheduled_at::date = CURRENT_DATE
      AND a.status IN ('confirmed', 'waiting', 'in_progress')
    ORDER BY a.scheduled_at ASC
    LIMIT $2
    `,
    [clinicId, MAX_QUEUE_SIZE],
  );
  return result.rows;
}

// Per-clinic debounce state
const pendingDebounce = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleQueueEmit(clinicId: string): void {
  const existing = pendingDebounce.get(clinicId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    pendingDebounce.delete(clinicId);
    try {
      const queue = await fetchQueue(clinicId);
      emitToQueue(clinicId, 'queue:updated', { queue });
    } catch (err) {
      logger.error({ err, clinicId }, 'Failed to emit queue:updated');
    }
  }, 1_000);

  pendingDebounce.set(clinicId, timer);
}

const QUEUE_TRIGGER_EVENTS: DomainEventType[] = [
  'appointment.checked_in',
  'appointment.called',
  'encounter.started',
  'appointment.no_show',
  'appointment.cancelled',
  'appointment.confirmed',
];

export function initQueueHandler(): void {
  for (const eventType of QUEUE_TRIGGER_EVENTS) {
    eventBus.subscribe(eventType, async (event) => {
      scheduleQueueEmit(event.clinicId);
    });
  }
  logger.info('Queue real-time handler initialized');
}

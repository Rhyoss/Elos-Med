import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { db } from '../db/client.js';
import { logger } from '../lib/logger.js';
import type { DomainEvent, DomainEventType, EventPayloads } from './event-types.js';
import { EVENT_AGGREGATE_MAP } from './event-types.js';

type AnyHandler = (event: DomainEvent) => Promise<void>;

interface RetryOptions {
  maxRetries?: number;
}

class DomainEventBus extends EventEmitter {
  async publish(
    type: DomainEventType,
    clinicId: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    metadata: DomainEvent['metadata'] = {},
  ): Promise<void> {
    const event: DomainEvent = {
      id: crypto.randomUUID(),
      type,
      clinicId,
      aggregateType: EVENT_AGGREGATE_MAP[type],
      aggregateId,
      payload,
      metadata,
      occurredAt: new Date(),
    };

    // Persistência síncrona antes de emitir — garante rastreabilidade mesmo que handler falhe
    try {
      await db.query(
        `INSERT INTO audit.domain_events
           (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          event.clinicId,
          event.aggregateType,
          event.aggregateId,
          event.type,
          JSON.stringify(event.payload),
          JSON.stringify(event.metadata),
        ],
      );
    } catch (err) {
      logger.error({ err, eventType: type, aggregateId }, 'Failed to persist domain event');
    }

    this.emit(type, event);
    logger.debug({ eventType: type, aggregateId, clinicId }, 'Domain event published');
  }

  subscribe<T extends DomainEventType>(
    eventType: T,
    handler: (event: DomainEvent & { payload: EventPayloads[T] }) => Promise<void>,
    options: RetryOptions = {},
  ): void {
    const maxRetries = options.maxRetries ?? 3;

    const wrapped: AnyHandler = async (event) => {
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          await handler(event as DomainEvent & { payload: EventPayloads[T] });
          return;
        } catch (err) {
          attempt++;
          const delay = Math.min(100 * Math.pow(2, attempt), 5_000);

          logger.warn(
            { err, eventType, attempt, maxRetries, eventId: event.id },
            'Event handler failed — retrying',
          );

          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }

      // Dead letter — event persisted in audit.domain_events; log for alerting
      logger.error(
        { eventType, eventId: event.id, aggregateId: event.aggregateId },
        'Event handler exhausted retries — dead lettered',
      );
    };

    this.on(eventType, wrapped);
  }
}

export const eventBus = new DomainEventBus();
eventBus.setMaxListeners(100);

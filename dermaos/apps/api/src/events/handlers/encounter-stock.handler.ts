import { eventBus } from '../event-bus.js';
import { logger } from '../../lib/logger.js';
import { enqueueSupplyConsumption } from '../../jobs/queues.js';

/**
 * Ao assinar um encounter, dispara consumo idempotente do kit vinculado
 * ao procedimento (se houver). A lógica atômica roda no worker —
 * este handler apenas enfileira o evento e retorna imediatamente.
 *
 * Idempotência: jobId = `encounter:<id>` garante que retries do event bus
 * ou reinícios do processo não causem duplo consumo.
 */
export function registerEncounterStockHandler(): void {
  eventBus.subscribe('encounter.signed', async (event) => {
    const { encounterId, patientId, providerId, serviceId } = event.payload as {
      encounterId: string;
      patientId:   string;
      providerId:  string;
      serviceId?:  string | null;
    };

    if (!serviceId) {
      logger.debug({ encounterId }, 'encounter.signed: sem serviceId, pulando consumo');
      return;
    }

    try {
      await enqueueSupplyConsumption({
        clinicId:    event.clinicId,
        patientId,
        encounterId,
        protocolSessionId: null,
        serviceId,
        performedBy: providerId,
        triggeredAt: new Date().toISOString(),
        source:      'encounter',
      });
      logger.info({ encounterId, clinicId: event.clinicId }, 'encounter-stock: consumo enfileirado');
    } catch (err) {
      logger.error({ err, encounterId }, 'encounter-stock: falha ao enfileirar consumo');
    }
  });

  eventBus.subscribe('protocol.session_completed', async (event) => {
    const { sessionId, protocolId, patientId, performedBy, serviceId } = event.payload as {
      sessionId:  string;
      protocolId: string;
      patientId:  string;
      performedBy?: string | null;
      serviceId?:   string | null;
    };

    if (!serviceId) {
      logger.debug({ sessionId }, 'protocol_session.completed: sem serviceId, pulando consumo');
      return;
    }

    try {
      await enqueueSupplyConsumption({
        clinicId:    event.clinicId,
        patientId,
        encounterId: null,
        protocolSessionId: sessionId,
        serviceId,
        performedBy: performedBy ?? null,
        triggeredAt: new Date().toISOString(),
        source:      'protocol_session',
      });
      logger.info({ sessionId, protocolId, clinicId: event.clinicId }, 'protocol-stock: consumo enfileirado');
    } catch (err) {
      logger.error({ err, sessionId }, 'protocol-stock: falha ao enfileirar consumo');
    }
  });
}

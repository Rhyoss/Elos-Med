import { eventBus } from '../event-bus.js';
import { invalidateClinicScope } from '../../modules/dashboard/dashboard.cache.js';
import { emitToClinic } from '../../lib/socket.js';
import { getReceptionWaitQueue } from '../../modules/dashboard/dashboard.service.js';
import { logger } from '../../lib/logger.js';

/**
 * Invalida caches dos dashboards e emite eventos real-time conforme mutações
 * relevantes acontecem. Mantém o trade-off:
 *   - Caches admin/médico/recepção: invalidação proativa por prefixo.
 *   - Fila de espera: nunca cacheada — empurra atualização via socket
 *     para todos os clientes da clínica.
 *
 * Os handlers são best-effort: erros são logados mas não bloqueiam o fluxo
 * principal. O event bus já implementa retries com backoff.
 */

async function broadcastWaitQueue(clinicId: string): Promise<void> {
  try {
    const rows = await getReceptionWaitQueue(clinicId);
    emitToClinic(clinicId, 'dashboard:waitQueue:updated', { rows });
  } catch (err) {
    logger.warn({ err, clinicId }, 'broadcastWaitQueue failed');
  }
}

export function registerDashboardCacheHandlers(): void {
  // ── Admin: invalidar quando receita ou faturas mudarem
  eventBus.subscribe('payment.approved', async (event) => {
    await invalidateClinicScope(event.clinicId, ['admin', 'analytics']);
  });
  eventBus.subscribe('payment.refunded', async (event) => {
    await invalidateClinicScope(event.clinicId, ['admin', 'analytics']);
  });
  eventBus.subscribe('invoice.issued', async (event) => {
    await invalidateClinicScope(event.clinicId, ['admin', 'reception']);
  });
  eventBus.subscribe('invoice.paid', async (event) => {
    await invalidateClinicScope(event.clinicId, ['admin', 'reception', 'analytics']);
  });
  eventBus.subscribe('invoice.cancelled', async (event) => {
    await invalidateClinicScope(event.clinicId, ['admin', 'reception']);
  });

  // ── Agenda: invalidar médico + recepção em qualquer mudança de appointment
  const apptScopes = ['doctor', 'reception', 'admin'] as const;

  eventBus.subscribe('appointment.scheduled', async (event) => {
    await invalidateClinicScope(event.clinicId, [...apptScopes]);
  });
  eventBus.subscribe('appointment.confirmed', async (event) => {
    await invalidateClinicScope(event.clinicId, [...apptScopes]);
  });
  eventBus.subscribe('appointment.cancelled', async (event) => {
    await invalidateClinicScope(event.clinicId, [...apptScopes]);
    // status may have left the wait queue
    await broadcastWaitQueue(event.clinicId);
  });
  eventBus.subscribe('appointment.rescheduled', async (event) => {
    await invalidateClinicScope(event.clinicId, [...apptScopes]);
  });
  eventBus.subscribe('appointment.completed', async (event) => {
    await invalidateClinicScope(event.clinicId, [...apptScopes]);
    await broadcastWaitQueue(event.clinicId);
  });
  eventBus.subscribe('appointment.no_show', async (event) => {
    await invalidateClinicScope(event.clinicId, [...apptScopes]);
  });

  // ── Biópsias: dashboards do médico e admin (alerts)
  eventBus.subscribe('biopsy.collected', async (event) => {
    await invalidateClinicScope(event.clinicId, ['doctor', 'admin']);
  });
  eventBus.subscribe('biopsy.result_received', async (event) => {
    await invalidateClinicScope(event.clinicId, ['doctor', 'admin']);
  });
  eventBus.subscribe('biopsy.patient_notified', async (event) => {
    await invalidateClinicScope(event.clinicId, ['doctor', 'admin']);
  });

  // ── Estoque crítico → admin alerts
  eventBus.subscribe('stock.critical_alert', async (event) => {
    await invalidateClinicScope(event.clinicId, ['admin']);
  });
  eventBus.subscribe('stock.low_alert', async (event) => {
    await invalidateClinicScope(event.clinicId, ['admin']);
  });

  // ── Pacientes (recepção / admin novos pacientes)
  eventBus.subscribe('patient.created', async (event) => {
    await invalidateClinicScope(event.clinicId, ['reception', 'admin']);
  });

  logger.info('Dashboard cache invalidation handlers registered');
}

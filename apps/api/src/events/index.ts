import { registerLeadToPatientHandler } from './handlers/lead-to-patient.handler.js';
import { registerAppointmentSupplyHandler } from './handlers/appointment-supply.handler.js';
import { registerEncounterStockHandler } from './handlers/encounter-stock.handler.js';
import { logger } from '../lib/logger.js';

export function registerAllEventHandlers(): void {
  registerLeadToPatientHandler();
  registerAppointmentSupplyHandler();
  registerEncounterStockHandler();
  logger.info('Domain event handlers registered');
}

export { eventBus } from './event-bus.js';
export * from './event-types.js';

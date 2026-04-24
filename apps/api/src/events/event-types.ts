export const DOMAIN_EVENT_TYPES = [
  // Pacientes
  'patient.created',
  'patient.updated',
  'patient.merged',

  // Agendamentos
  'appointment.scheduled',
  'appointment.confirmed',
  'appointment.cancelled',
  'appointment.completed',
  'appointment.no_show',
  'appointment.rescheduled',
  'appointment.created_via_aurora',

  // Encontros clínicos
  'encounter.started',
  'encounter.completed',
  'encounter.signed',

  // Prescrições
  'prescription.created',
  'prescription.updated',
  'prescription.signed',
  'prescription.issued',
  'prescription.sent',
  'prescription.duplicated',
  'prescription.cancelled',

  // Protocolos
  'protocol.created',
  'protocol.updated',
  'protocol.started',
  'protocol.session_completed',
  'protocol.session_corrected',
  'protocol.session_flagged_review',
  'protocol.completed',
  'protocol.cancelled',
  'protocol.paused',
  'protocol.resumed',

  // Biópsias
  'biopsy.collected',
  'biopsy.result_received',
  'biopsy.patient_notified',

  // Omni — leads
  'lead.created',
  'lead.qualified',
  'lead.converted',
  'lead.score_changed',

  // Omni — conversas
  'conversation.opened',
  'conversation.resolved',
  'conversation.escalated',
  'conversation.ai_responded',
  'conversation.assigned',
  'conversation.message_sent',
  'conversation.message_retried',

  // Aurora — recepcionista virtual
  'aurora.message_handled',
  'aurora.guardrail_block',
  'aurora.transfer_to_human',

  // Estoque
  'stock.low_alert',
  'stock.critical_alert',
  'stock.lot_expiring',
  'stock.lot_expired',

  // Pedidos de compra
  'purchase_order.requested',
  'purchase_order.approved',
  'purchase_order.rejected',
  'purchase_order.received',

  // Movimentação de estoque
  'inventory.movement_recorded',
  'inventory.lot_traced',

  // Financeiro
  'invoice.issued',
  'invoice.paid',
  'invoice.cancelled',
  'payment.approved',
  'payment.refunded',

  // Usuários / segurança
  'user.login',
  'user.logout',
  'user.password_changed',
  'user.permission_changed',
  'user.locked',

  // Exportações (LGPD)
  'data.export_requested',
  'data.export_completed',
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

// Mapa de aggregate_type por event_type (obrigatório pelo CHECK constraint)
export const EVENT_AGGREGATE_MAP: Record<DomainEventType, string> = {
  'patient.created':              'patient',
  'patient.updated':              'patient',
  'patient.merged':               'patient',
  'appointment.scheduled':        'appointment',
  'appointment.confirmed':        'appointment',
  'appointment.cancelled':        'appointment',
  'appointment.completed':        'appointment',
  'appointment.no_show':          'appointment',
  'appointment.rescheduled':      'appointment',
  'appointment.created_via_aurora': 'appointment',
  'encounter.started':            'encounter',
  'encounter.completed':          'encounter',
  'encounter.signed':             'encounter',
  'prescription.created':         'prescription',
  'prescription.updated':         'prescription',
  'prescription.signed':          'prescription',
  'prescription.issued':          'prescription',
  'prescription.sent':            'prescription',
  'prescription.duplicated':      'prescription',
  'prescription.cancelled':       'prescription',
  'protocol.created':             'protocol',
  'protocol.updated':             'protocol',
  'protocol.started':             'protocol',
  'protocol.session_completed':   'protocol',
  'protocol.session_corrected':   'protocol',
  'protocol.session_flagged_review': 'protocol',
  'protocol.completed':           'protocol',
  'protocol.cancelled':           'protocol',
  'protocol.paused':              'protocol',
  'protocol.resumed':             'protocol',
  'biopsy.collected':             'biopsy',
  'biopsy.result_received':       'biopsy',
  'biopsy.patient_notified':      'biopsy',
  'lead.created':                 'contact',
  'lead.qualified':               'contact',
  'lead.converted':               'contact',
  'lead.score_changed':           'contact',
  'conversation.opened':          'conversation',
  'conversation.resolved':        'conversation',
  'conversation.escalated':       'conversation',
  'conversation.ai_responded':    'conversation',
  'conversation.assigned':        'conversation',
  'conversation.message_sent':    'conversation',
  'conversation.message_retried': 'conversation',
  'aurora.message_handled':       'conversation',
  'aurora.guardrail_block':       'conversation',
  'aurora.transfer_to_human':     'conversation',
  'stock.low_alert':              'product',
  'stock.critical_alert':         'product',
  'stock.lot_expiring':           'inventory_lot',
  'stock.lot_expired':            'inventory_lot',
  'purchase_order.requested':     'purchase_order',
  'purchase_order.approved':      'purchase_order',
  'purchase_order.rejected':      'purchase_order',
  'purchase_order.received':      'purchase_order',
  'inventory.movement_recorded':  'inventory_movement',
  'inventory.lot_traced':         'inventory_lot',
  'invoice.issued':               'invoice',
  'invoice.paid':                 'invoice',
  'invoice.cancelled':            'invoice',
  'payment.approved':             'payment',
  'payment.refunded':             'payment',
  'user.login':                   'user',
  'user.logout':                  'user',
  'user.password_changed':        'user',
  'user.permission_changed':      'user',
  'user.locked':                  'user',
  'data.export_requested':        'user',
  'data.export_completed':        'user',
};

export interface DomainEvent {
  id: string;
  type: DomainEventType;
  clinicId: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  metadata: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
    [key: string]: unknown;
  };
  occurredAt: Date;
}

export type EventPayloads = {
  'lead.converted': { contactId: string; patientId?: string; cpfHash?: string; phone?: string };
  'appointment.scheduled': { appointmentId: string; procedureType?: string; patientId: string };
  'encounter.completed': { encounterId: string; patientId: string; kitId?: string; providerId: string };
  'encounter.signed': { encounterId: string; patientId: string; providerId: string; serviceId?: string | null };
  'protocol.session_completed': {
    sessionId: string; protocolId: string; patientId: string;
    performedBy?: string | null; serviceId?: string | null;
  };
  [key: string]: Record<string, unknown>;
};

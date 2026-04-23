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

  // Encontros clínicos
  'encounter.started',
  'encounter.completed',
  'encounter.signed',

  // Prescrições
  'prescription.issued',
  'prescription.sent',

  // Protocolos
  'protocol.started',
  'protocol.session_completed',
  'protocol.completed',

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
  'encounter.started':            'encounter',
  'encounter.completed':          'encounter',
  'encounter.signed':             'encounter',
  'prescription.issued':          'prescription',
  'prescription.sent':            'prescription',
  'protocol.started':             'protocol',
  'protocol.session_completed':   'protocol',
  'protocol.completed':           'protocol',
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
  [key: string]: Record<string, unknown>;
};

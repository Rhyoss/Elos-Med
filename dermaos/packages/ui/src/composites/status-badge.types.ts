export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'waiting'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

export type PurchaseStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'received'
  | 'cancelled';

export type InventoryStatus =
  | 'ok'
  | 'attention'
  | 'critical'
  | 'stockout';

export type StatusDomain = 'appointment' | 'purchase' | 'inventory';

export type AnyStatus = AppointmentStatus | PurchaseStatus | InventoryStatus;

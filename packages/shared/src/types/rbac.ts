export type Resource =
  | 'clinical'
  | 'supply'
  | 'financial'
  | 'omni'
  | 'analytics'
  | 'admin'
  | 'patients'
  | 'appointments'
  | 'traceability';

export type Action =
  | 'read'
  | 'write'
  | 'delete'
  | 'sign'
  | 'approve'
  | 'export'
  | 'ai_config'
  | 'recall';

export interface Permission {
  resource: Resource;
  action: Action;
  allowed: boolean;
}

export type PermissionMap = Partial<Record<Resource, Partial<Record<Action, boolean>>>>;

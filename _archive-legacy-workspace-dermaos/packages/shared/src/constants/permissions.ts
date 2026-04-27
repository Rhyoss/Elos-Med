import type { UserRole } from './roles';
import type { Resource, Action, PermissionMap } from '../types/rbac';

const ALL_ACTIONS: Action[] = ['read', 'write', 'delete', 'sign', 'approve', 'export', 'ai_config', 'recall'];
const ALL_RESOURCES: Resource[] = [
  'clinical', 'supply', 'financial', 'omni',
  'analytics', 'admin', 'patients', 'appointments',
  'traceability',
];

function grantAll(): PermissionMap {
  const map: PermissionMap = {};
  for (const res of ALL_RESOURCES) {
    map[res] = Object.fromEntries(ALL_ACTIONS.map((a) => [a, true])) as Record<Action, boolean>;
  }
  return map;
}

function grant(...entries: [Resource, Action[]][]): PermissionMap {
  const map: PermissionMap = {};
  for (const [resource, actions] of entries) {
    map[resource] = Object.fromEntries(actions.map((a) => [a, true])) as Record<Action, boolean>;
  }
  return map;
}

export const DEFAULT_PERMISSIONS: Record<UserRole, PermissionMap> = {
  owner: grantAll(),

  admin: {
    ...grantAll(),
    // Admin não assina prontuários — privativo de médicos habilitados
    clinical: {
      read: true, write: true, delete: true,
      approve: true, export: true, ai_config: true,
      sign: false,
    },
  },

  dermatologist: grant(
    ['patients',     ['read', 'write']],
    ['appointments', ['read', 'write']],
    ['clinical',     ['read', 'write', 'sign', 'export']],
    ['supply',       ['read', 'write']],
    ['financial',    ['read']],
    ['omni',         ['read']],
    ['analytics',    ['read']],
    ['traceability', ['read', 'recall', 'export']],
  ),

  nurse: grant(
    ['patients',     ['read', 'write']],
    ['appointments', ['read', 'write']],
    ['clinical',     ['read', 'write']],
    ['supply',       ['read', 'write']],
    ['omni',         ['read']],
    ['traceability', ['read']],
  ),

  receptionist: grant(
    ['patients',     ['read', 'write']],
    ['appointments', ['read', 'write']],
    ['omni',         ['read', 'write']],
    ['financial',    ['read']],
  ),

  financial: grant(
    ['patients',     ['read']],
    ['appointments', ['read']],
    ['financial',    ['read', 'write', 'approve', 'export']],
    ['supply',       ['read']],
    ['analytics',    ['read', 'export']],
  ),

  readonly: grant(
    ['patients',     ['read']],
    ['appointments', ['read']],
    ['clinical',     ['read']],
    ['supply',       ['read']],
    ['financial',    ['read']],
    ['omni',         ['read']],
    ['analytics',    ['read']],
  ),
};

export function checkPermission(
  map: PermissionMap,
  resource: Resource,
  action: Action,
): boolean {
  return map[resource]?.[action] === true;
}

export function getPermissionsForRole(role: UserRole): PermissionMap {
  return DEFAULT_PERMISSIONS[role] ?? {};
}

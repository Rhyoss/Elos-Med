export const USER_ROLES = [
  'owner',
  'admin',
  'dermatologist',
  'nurse',
  'receptionist',
  'financial',
  'readonly',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

// Mapa de permissões por role — base para RBAC no frontend e backend
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ['*'],
  admin: ['*'],
  dermatologist: [
    'patients:read',
    'patients:write',
    'clinical:read',
    'clinical:write',
    'appointments:read',
    'appointments:write',
    'omni:read',
    'omni:write',
    'analytics:read',
    'supply:read',
    'financial:read',
  ],
  nurse: [
    'patients:read',
    'patients:write',
    'clinical:read',
    'clinical:write',
    'appointments:read',
    'appointments:write',
    'omni:read',
    'supply:read',
    'supply:write',
  ],
  receptionist: [
    'patients:read',
    'patients:write',
    'appointments:read',
    'appointments:write',
    'omni:read',
    'omni:write',
    'financial:read',
  ],
  financial: [
    'patients:read',
    'appointments:read',
    'financial:read',
    'financial:write',
    'analytics:read',
    'supply:read',
  ],
  readonly: [
    'patients:read',
    'appointments:read',
    'clinical:read',
    'omni:read',
    'financial:read',
    'analytics:read',
    'supply:read',
  ],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes('*') || perms.includes(permission);
}

// Labels em português para UI
export const ROLE_LABELS: Record<UserRole, string> = {
  owner:         'Proprietário',
  admin:         'Administrador',
  dermatologist: 'Dermatologista',
  nurse:         'Enfermeira(o)',
  receptionist:  'Recepcionista',
  financial:     'Financeiro',
  readonly:      'Somente Leitura',
};

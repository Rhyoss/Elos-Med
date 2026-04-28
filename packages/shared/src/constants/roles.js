"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_LABELS = exports.ROLE_PERMISSIONS = exports.USER_ROLES = void 0;
exports.hasPermission = hasPermission;
exports.USER_ROLES = [
    'owner',
    'admin',
    'dermatologist',
    'nurse',
    'receptionist',
    'financial',
    'readonly',
];
// Mapa de permissões por role — base para RBAC no frontend e backend
exports.ROLE_PERMISSIONS = {
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
function hasPermission(role, permission) {
    const perms = exports.ROLE_PERMISSIONS[role];
    if (!perms)
        return false;
    return perms.includes('*') || perms.includes(permission);
}
// Labels em português para UI
exports.ROLE_LABELS = {
    owner: 'Proprietário',
    admin: 'Administrador',
    dermatologist: 'Dermatologista',
    nurse: 'Enfermeira(o)',
    receptionist: 'Recepcionista',
    financial: 'Financeiro',
    readonly: 'Somente Leitura',
};
//# sourceMappingURL=roles.js.map
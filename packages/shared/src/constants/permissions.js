"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PERMISSIONS = void 0;
exports.checkPermission = checkPermission;
exports.getPermissionsForRole = getPermissionsForRole;
const ALL_ACTIONS = ['read', 'write', 'delete', 'sign', 'approve', 'export', 'ai_config', 'recall'];
const ALL_RESOURCES = [
    'clinical', 'supply', 'financial', 'omni',
    'analytics', 'admin', 'patients', 'appointments',
    'traceability',
];
function grantAll() {
    const map = {};
    for (const res of ALL_RESOURCES) {
        map[res] = Object.fromEntries(ALL_ACTIONS.map((a) => [a, true]));
    }
    return map;
}
function grant(...entries) {
    const map = {};
    for (const [resource, actions] of entries) {
        map[resource] = Object.fromEntries(actions.map((a) => [a, true]));
    }
    return map;
}
exports.DEFAULT_PERMISSIONS = {
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
    dermatologist: grant(['patients', ['read', 'write']], ['appointments', ['read', 'write']], ['clinical', ['read', 'write', 'sign', 'export']], ['supply', ['read', 'write']], ['financial', ['read']], ['omni', ['read']], ['analytics', ['read']], ['traceability', ['read', 'recall', 'export']]),
    nurse: grant(['patients', ['read', 'write']], ['appointments', ['read', 'write']], ['clinical', ['read', 'write']], ['supply', ['read', 'write']], ['omni', ['read']], ['traceability', ['read']]),
    receptionist: grant(['patients', ['read', 'write']], ['appointments', ['read', 'write']], ['omni', ['read', 'write']], ['financial', ['read']]),
    financial: grant(['patients', ['read']], ['appointments', ['read']], ['financial', ['read', 'write', 'approve', 'export']], ['supply', ['read']], ['analytics', ['read', 'export']]),
    readonly: grant(['patients', ['read']], ['appointments', ['read']], ['clinical', ['read']], ['supply', ['read']], ['financial', ['read']], ['omni', ['read']], ['analytics', ['read']]),
};
function checkPermission(map, resource, action) {
    return map?.[resource]?.[action] === true;
}
function getPermissionsForRole(role) {
    return exports.DEFAULT_PERMISSIONS[role] ?? {};
}
//# sourceMappingURL=permissions.js.map
import type { UserRole } from './roles';
import type { Resource, Action, PermissionMap } from '../types/rbac';
export declare const DEFAULT_PERMISSIONS: Record<UserRole, PermissionMap>;
export declare function checkPermission(map: PermissionMap | null | undefined, resource: Resource, action: Action): boolean;
export declare function getPermissionsForRole(role: UserRole): PermissionMap;
//# sourceMappingURL=permissions.d.ts.map
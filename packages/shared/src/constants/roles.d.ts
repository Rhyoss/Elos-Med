export declare const USER_ROLES: readonly ["owner", "admin", "dermatologist", "nurse", "receptionist", "financial", "readonly"];
export type UserRole = (typeof USER_ROLES)[number];
export declare const ROLE_PERMISSIONS: Record<UserRole, string[]>;
export declare function hasPermission(role: UserRole, permission: string): boolean;
export declare const ROLE_LABELS: Record<UserRole, string>;
//# sourceMappingURL=roles.d.ts.map
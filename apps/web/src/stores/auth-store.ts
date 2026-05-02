import { create } from 'zustand';
import type { SessionUser, SessionClinic, PermissionMap } from '@dermaos/shared';
import { getPermissionsForRole } from '@dermaos/shared';

interface AuthState {
  user: SessionUser | null;
  clinic: SessionClinic | null;
  permissions: PermissionMap;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setSession: (user: SessionUser, clinic: SessionClinic, permissions: PermissionMap) => void;
  clearSession: () => void;
  setHydrated: () => void;
}

const DEV_MOCK = process.env.NEXT_PUBLIC_DEV_MOCK_AUTH === 'true';

const DEV_USER: SessionUser = {
  id: 'dev-owner-1',
  clinicId: 'dev-clinic-1',
  clinicSlug: 'dev',
  clinicName: 'Clínica Demo',
  name: 'Admin Dev',
  email: 'dev@elosmed.com',
  role: 'owner',
  avatarUrl: null,
  crm: null,
  specialty: null,
};

const DEV_CLINIC: SessionClinic = {
  id: 'dev-clinic-1',
  name: 'Clínica Demo',
  slug: 'dev',
  logoUrl: null,
};

export const useAuthStore = create<AuthState>((set) => ({
  user: DEV_MOCK ? DEV_USER : null,
  clinic: DEV_MOCK ? DEV_CLINIC : null,
  permissions: DEV_MOCK ? getPermissionsForRole('owner') : {},
  isAuthenticated: DEV_MOCK,
  isHydrated: false,

  setSession: (user, clinic, permissions) =>
    set({ user, clinic, permissions: permissions ?? {}, isAuthenticated: true }),

  clearSession: () =>
    set({ user: null, clinic: null, permissions: {}, isAuthenticated: false }),

  setHydrated: () => set({ isHydrated: true }),
}));

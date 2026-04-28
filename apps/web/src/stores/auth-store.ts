import { create } from 'zustand';
import type { SessionUser, SessionClinic, PermissionMap } from '@dermaos/shared';

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  clinic: null,
  permissions: {},
  isAuthenticated: false,
  isHydrated: false,

  setSession: (user, clinic, permissions) =>
    set({ user, clinic, permissions: permissions ?? {}, isAuthenticated: true }),

  clearSession: () =>
    set({ user: null, clinic: null, permissions: {}, isAuthenticated: false }),

  setHydrated: () => set({ isHydrated: true }),
}));

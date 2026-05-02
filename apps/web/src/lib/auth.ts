'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { type Resource, type Action, checkPermission } from '@dermaos/shared';
import { useAuthStore } from '@/stores/auth-store';
import { trpc } from '@/lib/trpc-provider';

/**
 * Hook principal de autenticação.
 * Sincroniza a query auth.me com o Zustand store.
 */
export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const devMock = process.env.NEXT_PUBLIC_DEV_MOCK_AUTH === 'true';

  useEffect(() => {
    const s = useAuthStore.getState();
    if (meQuery.data) {
      s.setSession(meQuery.data.user, meQuery.data.clinic, meQuery.data.permissions);
    } else if (meQuery.isError && !devMock) {
      s.clearSession();
    }

    if (!meQuery.isLoading) {
      s.setHydrated();
    }
  }, [meQuery.data, meQuery.isError, meQuery.isLoading, devMock]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      store.clearSession();
      router.push('/login');
    },
    onError: () => {
      store.clearSession();
      router.push('/login');
    },
  });

  const logout = useCallback(() => {
    if (devMock) {
      store.clearSession();
      router.push('/login');
      return;
    }
    logoutMutation.mutate();
  }, [logoutMutation, devMock, store, router]);

  return {
    user: store.user,
    clinic: store.clinic,
    permissions: store.permissions,
    isAuthenticated: store.isAuthenticated,
    isLoading: meQuery.isLoading || !store.isHydrated,
    isLoggingOut: logoutMutation.isPending,
    logout,
    refetch: meQuery.refetch,
  };
}

/**
 * Verifica se o usuário autenticado tem uma permissão específica.
 */
export function usePermission(resource: Resource, action: Action): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  return checkPermission(permissions ?? {}, resource, action);
}

/**
 * Retorna true se o usuário tem TODAS as permissões especificadas.
 */
export function usePermissions(checks: [Resource, Action][]): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  return checks.every(([resource, action]) => checkPermission(permissions ?? {}, resource, action));
}

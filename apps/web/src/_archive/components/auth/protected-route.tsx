'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { type Resource, type Action } from '@dermaos/shared';
import { useAuth, usePermission } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: { resource: Resource; action: Action };
  fallback?: React.ReactNode;
}

/**
 * Guarda de rota client-side.
 * Redireciona para /login se não autenticado, ou /unauthorized se sem permissão.
 */
export function ProtectedRoute({
  children,
  requiredPermission,
  fallback,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const hasPermission = usePermission(
    requiredPermission?.resource ?? 'patients',
    requiredPermission?.action ?? 'read',
  );

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (requiredPermission && !hasPermission) {
      router.replace('/unauthorized');
    }
  }, [isAuthenticated, isLoading, hasPermission, requiredPermission, router]);

  if (isLoading) {
    return fallback ?? (
      <div
        className="flex items-center justify-center min-h-screen"
        role="status"
        aria-label="Carregando..."
      >
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (requiredPermission && !hasPermission) return null;

  return <>{children}</>;
}

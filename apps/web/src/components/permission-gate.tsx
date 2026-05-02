'use client';

import * as React from 'react';
import { type Resource, type Action, checkPermission } from '@dermaos/shared';
import { usePermission } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth-store';

interface PermissionGateProps {
  resource: Resource;
  action: Action;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface MultiPermissionGateProps {
  checks: [Resource, Action][];
  mode?: 'all' | 'any';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({
  resource,
  action,
  children,
  fallback = null,
}: PermissionGateProps) {
  const allowed = usePermission(resource, action);
  return allowed ? <>{children}</> : <>{fallback}</>;
}

export function MultiPermissionGate({
  checks,
  mode = 'all',
  children,
  fallback = null,
}: MultiPermissionGateProps) {
  const permissions = useAuthStore((s) => s.permissions);

  const allowed = mode === 'all'
    ? checks.every(([r, a]) => checkPermission(permissions ?? {}, r, a))
    : checks.some(([r, a]) => checkPermission(permissions ?? {}, r, a));

  return allowed ? <>{children}</> : <>{fallback}</>;
}

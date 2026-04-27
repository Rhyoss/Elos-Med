'use client';

import { EmptyState } from '@dermaos/ui';
import { useAuth } from '@/lib/auth';
import { DoctorDashboard } from './_components/doctor-dashboard';
import { ReceptionDashboard } from './_components/reception-dashboard';
import { AdminDashboard } from './_components/admin-dashboard';
import { KpiCardSkeleton, ListCardSkeleton } from './_components/card-states';

/**
 * Dashboard contextual por papel.
 * O servidor também restringe via requireRoles em dashboard.router — esta dispatch
 * é apenas para escolher o componente correto conforme o usuário autenticado.
 */
export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <div className="flex flex-col gap-6 pb-8" aria-busy="true" aria-label="Carregando dashboard">
        <div className="border-b border-border/70 bg-card px-6 py-5">
          <div className="h-3 w-20 bg-muted rounded animate-pulse mb-2" />
          <div className="h-7 w-72 bg-muted rounded animate-pulse" />
          <div className="h-4 w-96 bg-muted/60 rounded animate-pulse mt-2" />
        </div>
        <div className="px-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton />
        </div>
        <div className="px-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><ListCardSkeleton rows={6} /></div>
          <ListCardSkeleton rows={4} />
        </div>
      </div>
    );
  }

  switch (user.role) {
    case 'dermatologist':
    case 'nurse':
      return <DoctorDashboard />;

    case 'receptionist':
      return <ReceptionDashboard />;

    case 'admin':
    case 'owner':
    case 'financial':
      return <AdminDashboard role={user.role} />;

    default:
      return (
        <div className="p-6">
          <EmptyState
            title="Bem-vindo ao DermaOS"
            description="Selecione um módulo na barra lateral para começar."
          />
        </div>
      );
  }
}

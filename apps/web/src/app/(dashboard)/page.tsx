'use client';

import { PageHeader, MetricCard, EmptyState } from '@dermaos/ui';
import { useAuth } from '@/lib/auth';
import { Calendar, Users, DollarSign, Activity } from 'lucide-react';

/* ── Dashboards por role ──────────────────────────────────────────────────── */

function AdminDashboard({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`Bom dia, ${name.split(' ')[0]}!`}
        description="Visão geral da clínica — todos os módulos"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Agendamentos hoje"
          value="12"
          trend={{ direction: 'up', percent: 8 }}
          icon={<Calendar className="h-5 w-5" />}
        />
        <MetricCard
          label="Pacientes ativos"
          value="1.247"
          trend={{ direction: 'up', percent: 3 }}
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          label="Faturamento do dia"
          value="R$ 4.320"
          trend={{ direction: 'up', percent: 12 }}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <MetricCard
          label="Satisfação média"
          value="4,8 ★"
          icon={<Activity className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}

function DermatologistDashboard({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`Bom dia, Dr(a). ${name.split(' ')[0]}!`}
        description="Seus atendimentos de hoje"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Consultas hoje" value="8" icon={<Calendar className="h-5 w-5" />} />
        <MetricCard label="Pacientes na fila" value="2" icon={<Users className="h-5 w-5" />} />
        <MetricCard label="Prontuários pendentes" value="1" icon={<Activity className="h-5 w-5" />} />
      </div>
    </div>
  );
}

function ReceptionistDashboard({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`Bom dia, ${name.split(' ')[0]}!`}
        description="Agenda e atendimento do dia"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard label="Agendamentos hoje" value="14" icon={<Calendar className="h-5 w-5" />} />
        <MetricCard
          label="Confirmados"
          value="9"
          trend={{ direction: 'up', percent: 5 }}
          icon={<Users className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}

function NurseDashboard({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`Bom dia, ${name.split(' ')[0]}!`}
        description="Procedimentos e estoque do dia"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard label="Procedimentos hoje" value="6" icon={<Activity className="h-5 w-5" />} />
        <MetricCard
          label="Itens em estoque crítico"
          value="3"
          trend={{ direction: 'down', percent: 2 }}
          icon={<DollarSign className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}

/* ── Página principal ─────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <div className="p-6 flex flex-col gap-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  switch (user.role) {
    case 'owner':
    case 'admin':
      return <AdminDashboard name={user.name} />;
    case 'dermatologist':
      return <DermatologistDashboard name={user.name} />;
    case 'receptionist':
      return <ReceptionistDashboard name={user.name} />;
    case 'nurse':
      return <NurseDashboard name={user.name} />;
    case 'financial':
      return (
        <div className="flex flex-col gap-6 p-6">
          <PageHeader title={`Bom dia, ${user.name.split(' ')[0]}!`} description="Financeiro do dia" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard label="Faturamento hoje" value="R$ 4.320" icon={<DollarSign className="h-5 w-5" />} />
            <MetricCard label="Pendências" value="7" icon={<Activity className="h-5 w-5" />} />
          </div>
        </div>
      );
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

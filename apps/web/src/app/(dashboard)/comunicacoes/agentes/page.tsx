'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Bot, Power } from 'lucide-react';
import {
  PageHeader,
  Button,
  Badge,
  DataTable,
  type ColumnDef,
  EmptyState,
  Switch,
  useToast,
} from '@dermaos/ui';
import type { AiAgentSummary, AiAgentType, AiAgentModel } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { usePermission } from '@/lib/auth';

const TYPE_LABELS: Record<AiAgentType, string> = {
  receptionist: 'Recepcionista',
  scheduler:    'Agendamento',
  follow_up:    'Follow-up',
  support:      'Suporte',
  custom:       'Personalizado',
};

const MODEL_LABELS: Record<AiAgentModel, string> = {
  'claude-haiku-4-5':           'Claude Haiku 4.5',
  'claude-sonnet-4-20250514':   'Claude Sonnet 4',
  'ollama:llama3.1:8b':         'Ollama Llama 3.1',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
    hour:  '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function AgentesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const canConfigure = usePermission('omni', 'ai_config');

  const { data, isLoading } = trpc.aurora.admin.list.useQuery();
  const toggleMutation = trpc.aurora.admin.toggle.useMutation({
    onSuccess: () => {
      void utils.aurora.admin.list.invalidate();
    },
    onError: (err) => {
      toast.error('Falha ao alterar agente', { description: err.message });
    },
  });

  const agents: AiAgentSummary[] = data?.agents ?? [];

  const columns: ColumnDef<AiAgentSummary>[] = React.useMemo(
    () => [
      {
        id:     'name',
        header: 'Agente',
        cell:   ({ row }) => (
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 shrink-0"
              aria-hidden="true"
            >
              <Bot className="h-4 w-4" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-foreground truncate">{row.original.name}</span>
              <span className="text-xs text-muted-foreground">
                {TYPE_LABELS[row.original.type]}
              </span>
            </div>
          </div>
        ),
        size: 280,
      },
      {
        id:     'model',
        header: 'Modelo',
        cell:   ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {MODEL_LABELS[row.original.model]}
          </span>
        ),
        size: 180,
      },
      {
        id:     'channels',
        header: 'Canais',
        cell:   ({ row }) => {
          const count = row.original.channelIds.length;
          return count > 0 ? (
            <Badge variant="neutral" size="sm">{count}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Nenhum</span>
          );
        },
        size: 90,
      },
      {
        id:     'status',
        header: 'Status',
        cell:   ({ row }) => (
          <Badge
            variant={row.original.isActive ? 'success' : 'neutral'}
            dot
            size="sm"
          >
            {row.original.isActive ? 'Ativo' : 'Inativo'}
          </Badge>
        ),
        size: 100,
      },
      {
        id:     'activity',
        header: 'Última atividade',
        cell:   ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.lastActivityAt)}
          </span>
        ),
        size: 170,
      },
      {
        id:     'actions',
        header: '',
        cell:   ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            {canConfigure && (
              <div
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Switch
                  checked={row.original.isActive}
                  disabled={
                    toggleMutation.isPending &&
                    toggleMutation.variables?.id === row.original.id
                  }
                  onCheckedChange={(checked) => {
                    toggleMutation.mutate({
                      id:       row.original.id,
                      isActive: checked,
                    });
                  }}
                  aria-label={row.original.isActive ? 'Desativar agente' : 'Ativar agente'}
                />
                <Power
                  className={`h-3.5 w-3.5 ${row.original.isActive ? 'text-success-700' : 'text-muted-foreground'}`}
                  aria-hidden="true"
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/comunicacoes/agentes/${row.original.id}`);
              }}
            >
              Configurar
            </Button>
          </div>
        ),
        size: 200,
      },
    ],
    [canConfigure, router, toggleMutation],
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Agentes IA"
        description="Configure e gerencie os agentes da Aurora"
        actions={
          canConfigure ? (
            <Link href="/comunicacoes/agentes/novo">
              <Button size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Novo agente
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="flex flex-col gap-4 p-6 flex-1 min-h-0">
        {!isLoading && agents.length === 0 ? (
          <EmptyState
            title="Nenhum agente configurado"
            description={
              canConfigure
                ? 'Crie seu primeiro agente para começar a atender via Aurora.'
                : 'Nenhum agente foi configurado nesta clínica.'
            }
            action={
              canConfigure
                ? { label: 'Criar agente', onClick: () => router.push('/comunicacoes/agentes/novo') }
                : undefined
            }
          />
        ) : (
          <DataTable<AiAgentSummary>
            data={agents}
            columns={columns}
            isLoading={isLoading}
            emptyTitle="Nenhum agente encontrado"
            emptyDescription="Crie o primeiro agente para esta clínica."
            stickyHeader
          />
        )}
      </div>
    </div>
  );
}

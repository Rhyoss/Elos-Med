'use client';

import * as React from 'react';
import { SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@dermaos/ui';
import { Plus } from 'lucide-react';
import { Btn, PageHero } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { keepPreviousData } from '@tanstack/react-query';
import { AUTOMATION_TRIGGERS, TRIGGER_META, type AutomationTrigger } from '@dermaos/shared';
import { AutomationTable } from './_components/automation-table';
import { AutomationModal } from './_components/automation-modal';
import type { AutomationRow } from '@/lib/types/automation';

const CHANNEL_OPTIONS = [
  { value: 'all',      label: 'Todos os canais' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms',      label: 'SMS' },
  { value: 'email',    label: 'E-mail' },
];

const STATUS_OPTIONS = [
  { value: 'all',   label: 'Todos os status' },
  { value: 'true',  label: 'Ativos' },
  { value: 'false', label: 'Inativos' },
];

export default function AutomacoesPage() {
  const [triggerFilter, setTriggerFilter] = React.useState<string>('all');
  const [channelFilter, setChannelFilter] = React.useState<string>('all');
  const [statusFilter,  setStatusFilter]  = React.useState<string>('all');
  const [modalOpen,     setModalOpen]     = React.useState(false);
  const [togglingId,    setTogglingId]    = React.useState<string | null>(null);

  const utils = trpc.useUtils();

  const query = trpc.automations.list.useQuery(
    {
      trigger:  triggerFilter !== 'all' ? (triggerFilter as AutomationTrigger) : undefined,
      channel:  channelFilter !== 'all' ? channelFilter as 'whatsapp' | 'sms' | 'email' : undefined,
      isActive: statusFilter  !== 'all' ? statusFilter === 'true' : undefined,
      limit:    50,
    },
    { placeholderData: keepPreviousData, staleTime: 15_000 },
  );

  const toggleMutation = trpc.automations.toggle.useMutation({
    onSettled: () => { void utils.automations.list.invalidate(); setTogglingId(null); },
  });

  const deleteMutation = trpc.automations.delete.useMutation({
    onSuccess: () => { void utils.automations.list.invalidate(); },
  });

  async function handleToggle(id: string, isActive: boolean) {
    setTogglingId(id);
    try { await toggleMutation.mutateAsync({ id, isActive }); } catch { /* handled by onSettled */ }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir a automação "${name}"? Esta ação não pode ser desfeita.`)) return;
    try { await deleteMutation.mutateAsync({ id }); } catch { /* handled by mutation error state */ }
  }

  const automations = (query.data?.data ?? []) as AutomationRow[];
  const activeCount = automations.filter((a) => a.is_active).length;

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHero
        eyebrow="GATILHOS · CANAIS · SEQUÊNCIAS"
        title="Automações"
        module="aiMod"
        icon="zap"
        description={
          <>
            {automations.length} regra{automations.length !== 1 ? 's' : ''} configurada{automations.length !== 1 ? 's' : ''}
            {activeCount > 0 && ` · ${activeCount} ativa${activeCount !== 1 ? 's' : ''}`}
          </>
        }
        actions={<Btn small icon="plus" onClick={() => setModalOpen(true)}>Nova Automação</Btn>}
      />
      <div style={{ display: 'none' }}>
        {/* anchor para diff mínimo abaixo */}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3" role="group" aria-label="Filtros de automações">
        <SelectRoot value={triggerFilter} onValueChange={setTriggerFilter}>
          <SelectTrigger className="w-52" aria-label="Filtrar por gatilho">
            <SelectValue placeholder="Todos os gatilhos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os gatilhos</SelectItem>
            {AUTOMATION_TRIGGERS.map((t) => (
              <SelectItem key={t} value={t}>{TRIGGER_META[t].label}</SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>

        <SelectRoot value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-40" aria-label="Filtrar por canal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>

        <SelectRoot value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>

        {(triggerFilter !== 'all' || channelFilter !== 'all' || statusFilter !== 'all') && (
          <Btn
            variant="ghost"
            small
            icon="x"
            onClick={() => { setTriggerFilter('all'); setChannelFilter('all'); setStatusFilter('all'); }}
            aria-label="Limpar filtros"
          >
            Limpar filtros
          </Btn>
        )}
      </div>

      {/* Erro */}
      {query.isError && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          Falha ao carregar automações. {query.error.message}
        </div>
      )}

      {/* Tabela */}
      {!query.isError && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <AutomationTable
            automations={automations}
            isLoading={query.isLoading}
            onToggle={handleToggle}
            onDelete={handleDelete}
            togglingId={togglingId}
          />
        </div>
      )}

      {/* Modal */}
      <AutomationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => void utils.automations.list.invalidate()}
      />
    </div>
  );
}

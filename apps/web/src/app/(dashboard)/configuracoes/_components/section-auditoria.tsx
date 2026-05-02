'use client';

import * as React from 'react';
import {
  Glass, Btn, Mono, Badge, Ico, DataTable, EmptyState,
  Field, Input, Select, Skeleton, T, type DataTableColumn,
} from '@dermaos/ui/ds';
import {
  DialogRoot, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@dermaos/ui';
import { Button } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { useAuth } from '@/lib/auth';

interface AuditRow {
  id: string;
  event_type: string;
  aggregate_type: string;
  occurred_at: string;
  user_name?: string | null;
  metadata?: Record<string, unknown>;
}

const EVENT_LABELS: Record<string, string> = {
  'settings.user_created': 'Usuário convidado',
  'settings.permissions_updated': 'Permissões alteradas',
  'settings.user_deactivated': 'Usuário desativado',
  'settings.user_reactivated': 'Usuário reativado',
  'settings.password_reset_initiated': 'Reset de senha',
  'settings.integration_updated': 'Integração atualizada',
  'settings.webhook_regenerated': 'Webhook regenerado',
  'settings.clinic_updated': 'Dados da clínica alterados',
  'settings.clinic_logo_updated': 'Logo alterado',
  'settings.hours_updated': 'Horários alterados',
  'settings.timezone_updated': 'Timezone alterado',
  'settings.service_created': 'Serviço criado',
  'settings.service_updated': 'Serviço atualizado',
  'settings.service_deleted': 'Serviço desativado',
  'settings.ai_updated': 'Config IA alterada',
  'settings.prompt_updated': 'Prompt atualizado',
  'settings.audit_exported': 'Auditoria exportada',
};

function eventBadgeVariant(type: string): 'success' | 'warning' | 'danger' | 'info' {
  if (type.includes('deleted') || type.includes('deactivated')) return 'danger';
  if (type.includes('created') || type.includes('reactivated')) return 'success';
  if (type.includes('reset') || type.includes('regenerated')) return 'warning';
  return 'info';
}

export function SectionAuditoria() {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'owner' || user?.role === 'admin';

  const [actionFilter, setActionFilter] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [allRows, setAllRows] = React.useState<AuditRow[]>([]);

  const logsQuery = trpc.settings.audit.list.useQuery(
    {
      limit: 50,
      cursor,
      ...(actionFilter ? { action: actionFilter } : {}),
      ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
      ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
    },
    {
      staleTime: 15_000,
      enabled: isPrivileged,
    },
  );

  React.useEffect(() => {
    if (logsQuery.data) {
      const events = logsQuery.data.events as AuditRow[];
      if (cursor) {
        setAllRows((prev) => [...prev, ...events]);
      } else {
        setAllRows(events);
      }
    }
  }, [logsQuery.data, cursor]);

  const [detailId, setDetailId] = React.useState<string | null>(null);
  const detailQuery = trpc.settings.audit.detail.useQuery(
    { eventId: detailId ?? '' },
    { enabled: !!detailId, staleTime: 60_000 },
  );

  const exportMutation = trpc.settings.audit.exportCsv.useMutation();
  const [exportStatus, setExportStatus] = React.useState<'success' | 'error' | null>(null);

  function handleExport() {
    setExportStatus(null);
    exportMutation.mutate(
      {
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
        ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
      },
      {
        onSuccess: (data) => {
          const blob = new Blob([data as string], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          setExportStatus('success');
          setTimeout(() => setExportStatus(null), 3000);
        },
        onError: () => setExportStatus('error'),
      },
    );
  }

  function handleFilter() {
    setCursor(undefined);
    setAllRows([]);
    void logsQuery.refetch();
  }

  function loadMore() {
    if (logsQuery.data?.nextCursor) {
      setCursor(logsQuery.data.nextCursor as string);
    }
  }

  if (!isPrivileged) {
    return (
      <Glass style={{ padding: 32, textAlign: 'center' }}>
        <Ico name="lock" size={32} color={T.textMuted} />
        <p style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary, marginTop: 12 }}>
          Acesso restrito
        </p>
        <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4 }}>
          Somente administradores e proprietários podem acessar os logs de auditoria.
        </p>
      </Glass>
    );
  }

  const columns: DataTableColumn<AuditRow>[] = [
    {
      header: 'Evento',
      cell: (row) => (
        <div>
          <Badge variant={eventBadgeVariant(row.event_type)}>
            {EVENT_LABELS[row.event_type] ?? row.event_type}
          </Badge>
        </div>
      ),
      width: 200,
    },
    {
      header: 'Módulo',
      cell: (row) => <Mono size={11}>{row.aggregate_type}</Mono>,
      width: 100,
    },
    {
      header: 'Usuário',
      cell: (row) => (
        <span style={{ fontSize: 13, color: T.textPrimary }}>
          {row.user_name ?? String((row.metadata as Record<string, unknown>)?.user_id ?? '—')}
        </span>
      ),
      width: 160,
    },
    {
      header: 'Data/Hora',
      cell: (row) => (
        <Mono size={11}>
          {new Date(row.occurred_at).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          })}
        </Mono>
      ),
      width: 160,
    },
    {
      header: '',
      width: 60,
      cell: (row) => (
        <Btn small variant="ghost" icon="eye" iconOnly onClick={() => setDetailId(row.id)} />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filters */}
      <Glass style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Ação" style={{ flex: 1, minWidth: 160 }}>
            <Input
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Ex: settings.user_created"
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}
            />
          </Field>
          <Field label="De" style={{ width: 160 }}>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="Até" style={{ width: 160 }}>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          <Btn small variant="glass" icon="search" onClick={handleFilter}>Filtrar</Btn>
          <Btn small variant="ghost" icon="download" onClick={handleExport} loading={exportMutation.isPending}>
            Exportar CSV
          </Btn>
        </div>

        {exportStatus === 'success' && (
          <div style={{ marginTop: 8, padding: '6px 12px', borderRadius: T.r.sm, background: T.successBg, fontSize: 12, color: T.success, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ico name="check" size={12} color={T.success} />CSV exportado com sucesso
          </div>
        )}
        {exportStatus === 'error' && (
          <div style={{ marginTop: 8, padding: '6px 12px', borderRadius: T.r.sm, background: T.dangerBg, fontSize: 12, color: T.danger, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ico name="alert" size={12} color={T.danger} />Erro ao exportar. Tente novamente.
          </div>
        )}
      </Glass>

      {/* Table */}
      <Glass style={{ padding: 0, overflow: 'hidden' }}>
        {logsQuery.isLoading && allRows.length === 0 ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={44} delay={i * 60} />)}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={allRows}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                icon="file"
                title="Nenhum evento encontrado"
                description="Ajuste os filtros ou aguarde ações serem registradas no sistema."
              />
            }
          />
        )}
      </Glass>

      {/* Load More */}
      {logsQuery.data?.nextCursor && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Btn small variant="glass" onClick={loadMore} loading={logsQuery.isFetching}>
            Carregar mais
          </Btn>
        </div>
      )}

      {/* Detail Dialog */}
      <DialogRoot open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent a11yTitle="Detalhe do evento" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhe do Evento</DialogTitle>
            <DialogDescription>Dados completos do evento de auditoria (PII sanitizado).</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4" style={{ maxHeight: 480, overflowY: 'auto' }}>
            {detailQuery.isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={24} delay={i * 80} />)}
              </div>
            ) : detailQuery.data ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px' }}>
                  <Mono size={10} color={T.textMuted}>EVENTO</Mono>
                  <span style={{ fontSize: 13, color: T.textPrimary }}>
                    {EVENT_LABELS[(detailQuery.data as AuditRow).event_type] ?? (detailQuery.data as AuditRow).event_type}
                  </span>
                  <Mono size={10} color={T.textMuted}>MÓDULO</Mono>
                  <span style={{ fontSize: 13, color: T.textPrimary }}>{(detailQuery.data as AuditRow).aggregate_type}</span>
                  <Mono size={10} color={T.textMuted}>DATA</Mono>
                  <Mono size={12}>{new Date((detailQuery.data as AuditRow).occurred_at).toLocaleString('pt-BR')}</Mono>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Mono size={10} spacing="1px" color={T.textMuted} style={{ marginBottom: 8 }}>PAYLOAD</Mono>
                  <pre style={{
                    padding: '12px 16px', borderRadius: T.r.md,
                    background: T.inputBg, border: `1px solid ${T.divider}`,
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                    color: T.textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    maxHeight: 280, overflowY: 'auto',
                  }}>
                    {JSON.stringify((detailQuery.data as Record<string, unknown>).payload ?? {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <Mono size={10} spacing="1px" color={T.textMuted} style={{ marginBottom: 8 }}>METADATA</Mono>
                  <pre style={{
                    padding: '12px 16px', borderRadius: T.r.md,
                    background: T.inputBg, border: `1px solid ${T.divider}`,
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                    color: T.textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    maxHeight: 200, overflowY: 'auto',
                  }}>
                    {JSON.stringify((detailQuery.data as Record<string, unknown>).metadata ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}

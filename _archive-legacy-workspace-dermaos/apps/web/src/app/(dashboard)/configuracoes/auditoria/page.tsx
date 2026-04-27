'use client';

import * as React from 'react';
import { Download, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { PageHeader } from '@dermaos/ui';
import type { ListAuditLogsInput } from '@dermaos/shared';

type AuditEvent = {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  user_name: string | null;
  user_email: string | null;
};

type AuditDetail = AuditEvent & {
  payload: Record<string, unknown>;
};

function DiffView({ payload }: { payload: Record<string, unknown> }) {
  const changes = Object.entries(payload?.changes ?? {}) as [string, { old: unknown; new: unknown }][];

  if (changes.length === 0) {
    return <pre className="text-xs text-muted-foreground">{JSON.stringify(payload, null, 2)}</pre>;
  }

  return (
    <div className="space-y-2">
      {changes.map(([field, diff]) => (
        <div key={field} className="rounded-md border">
          <div className="border-b px-3 py-1.5 text-xs font-medium bg-muted/30">{field}</div>
          <div className="grid grid-cols-2 divide-x">
            <div className="p-3">
              <div className="mb-1 text-xs text-muted-foreground">Anterior</div>
              <pre className="rounded bg-red-50 p-2 text-xs text-red-700 whitespace-pre-wrap">
                {typeof diff.old === 'object' ? JSON.stringify(diff.old, null, 2) : String(diff.old ?? '—')}
              </pre>
            </div>
            <div className="p-3">
              <div className="mb-1 text-xs text-muted-foreground">Novo</div>
              <pre className="rounded bg-green-50 p-2 text-xs text-green-700 whitespace-pre-wrap">
                {typeof diff.new === 'object' ? JSON.stringify(diff.new, null, 2) : String(diff.new ?? '—')}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = React.useState(false);
  const detailQuery = trpc.settings.audit.detail.useQuery(
    { eventId: event.id },
    { enabled: expanded },
  );

  const detail = detailQuery.data as AuditDetail | undefined;

  return (
    <>
      <tr
        className="border-t cursor-pointer hover:bg-muted/30"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {new Date(event.occurred_at).toLocaleString('pt-BR')}
        </td>
        <td className="px-4 py-3">
          <div className="text-sm font-medium">{event.user_name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{event.user_email ?? ''}</div>
        </td>
        <td className="px-4 py-3">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{event.event_type}</code>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{event.aggregate_type}</td>
        <td className="px-4 py-3 text-right">
          {expanded
            ? <ChevronDown className="ml-auto h-4 w-4" />
            : <ChevronRight className="ml-auto h-4 w-4" />
          }
        </td>
      </tr>
      {expanded && (
        <tr className="border-t bg-muted/10">
          <td colSpan={5} className="px-6 py-4">
            {detailQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Carregando detalhes...</p>
            ) : detail ? (
              <DiffView payload={detail.payload ?? {}} />
            ) : (
              <p className="text-xs text-destructive">Falha ao carregar detalhes.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditoriaPage() {
  const [filters, setFilters] = React.useState<ListAuditLogsInput>({
    limit: 50,
  });
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [exporting, setExporting] = React.useState(false);

  const auditQuery = trpc.settings.audit.list.useQuery({ ...filters, cursor });
  const exportMut  = trpc.settings.audit.exportCsv.useMutation();

  const data = auditQuery.data;
  const events = (data?.events ?? []) as AuditEvent[];

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await exportMut.mutateAsync({
        userId:   filters.userId,
        action:   filters.action,
        dateFrom: filters.dateFrom,
        dateTo:   filters.dateTo,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const periodDays = filters.dateFrom && filters.dateTo
    ? Math.round((new Date(filters.dateTo).getTime() - new Date(filters.dateFrom).getTime()) / 86400000)
    : null;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Auditoria & Compliance"
        description="Logs imutáveis de alterações e acessos — LGPD / CFM"
        actions={
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </button>
        }
      />

      {/* ── Filtros ─────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4 border-b px-6 py-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Ação / Evento</label>
          <input
            value={filters.action ?? ''}
            onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value || undefined }))}
            placeholder="ex: settings"
            className="rounded-md border px-3 py-1.5 text-sm w-40"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">De</label>
          <input
            type="date"
            value={filters.dateFrom ? new Date(filters.dateFrom).toISOString().slice(0, 10) : ''}
            onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value ? new Date(e.target.value) : undefined }))}
            className="rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Até</label>
          <input
            type="date"
            value={filters.dateTo ? new Date(filters.dateTo).toISOString().slice(0, 10) : ''}
            onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value ? new Date(e.target.value) : undefined }))}
            className="rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={() => setCursor(undefined)}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground"
        >
          Filtrar
        </button>
      </div>

      {data?.suggestExport && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Período longo ({periodDays} dias). Recomendamos exportar em CSV para melhor performance.
        </div>
      )}

      <div className="p-6">
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-xs">Data/Hora</th>
                <th className="px-4 py-3 text-left font-medium text-xs">Usuário</th>
                <th className="px-4 py-3 text-left font-medium text-xs">Evento</th>
                <th className="px-4 py-3 text-left font-medium text-xs">Entidade</th>
                <th className="px-4 py-3 text-right font-medium text-xs">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
              {events.length === 0 && !auditQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum evento encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
              {auditQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando logs...
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {data?.hasMore && (
            <div className="flex justify-center border-t p-4">
              <button
                onClick={() => setCursor(data.nextCursor ?? undefined)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Carregar mais
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

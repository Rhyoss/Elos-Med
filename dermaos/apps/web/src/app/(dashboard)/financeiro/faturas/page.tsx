'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button, Input } from '@dermaos/ui';
import { Plus, Search, Filter } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { INVOICE_STATUSES, INVOICE_STATUS_LABELS, type InvoiceStatus } from '@dermaos/shared';
import { FinanceiroTabs }     from '../_components/financeiro-tabs';
import { InvoiceStatusBadge } from '../_components/invoice-status-badge';
import { InvoiceSheet }       from '../_components/invoice-sheet';
import { PaymentModal }       from '../_components/payment-modal';
import { formatBRL, formatDate } from '../_components/format-brl';
import { cn } from '@dermaos/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dermaos/ui';

const PAGE_SIZE = 25;

export default function FaturasPage() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const utils    = trpc.useUtils();

  const page       = parseInt(params.get('page') ?? '1', 10);
  const status     = (params.get('status') as InvoiceStatus | null) ?? undefined;
  const search     = params.get('search') ?? '';
  const dateFrom   = params.get('dateFrom') ?? '';
  const dateTo     = params.get('dateTo') ?? '';

  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string | null>(null);
  const [paymentModalOpen,  setPaymentModalOpen]  = React.useState(false);
  const [searchInput,       setSearchInput]       = React.useState(search);

  function updateParams(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else    next.delete(k);
    }
    next.delete('page'); // reset paginação ao filtrar
    router.replace(`${pathname}?${next.toString()}`);
  }

  const invoicesQuery = trpc.financial.invoices.list.useQuery(
    {
      status,
      search:   search || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo:   dateTo   ? new Date(dateTo)   : undefined,
      page,
      limit:    PAGE_SIZE,
    },
    { staleTime: 30_000 },
  );

  const invoices    = invoicesQuery.data?.data ?? [];
  const total       = invoicesQuery.data?.total ?? 0;
  const totalPages  = Math.ceil(total / PAGE_SIZE);
  const hasFilters  = !!(status || search || dateFrom || dateTo);

  const today = new Date();

  function isDueSoon(dueDateStr: string | null): boolean {
    if (!dueDateStr) return false;
    const diff = (new Date(dueDateStr).getTime() - today.getTime()) / 86_400_000;
    return diff >= 0 && diff <= 3;
  }

  return (
    <div className="flex flex-col gap-0">
      <FinanceiroTabs />

      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Faturas</h1>
            <p className="text-sm text-muted-foreground">
              {total > 0 ? `${total} fatura${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}` : 'Gestão de faturamento e cobranças'}
            </p>
          </div>
          <Button onClick={() => setPaymentModalOpen(true)}>
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Nova Fatura
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Busca */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <Input
              className="pl-9"
              placeholder="Buscar por número ou paciente..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && updateParams({ search: searchInput || undefined })}
              aria-label="Buscar faturas"
            />
          </div>

          {/* Status */}
          <Select
            value={status ?? 'all'}
            onValueChange={(v) => updateParams({ status: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="w-36" aria-label="Filtrar por status">
              <Filter className="mr-2 size-4" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {INVOICE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Período */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => updateParams({ dateFrom: e.target.value || undefined })}
            className="px-3 py-2 text-sm border border-input rounded-md bg-background"
            aria-label="Data inicial"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => updateParams({ dateTo: e.target.value || undefined })}
            className="px-3 py-2 text-sm border border-input rounded-md bg-background"
            aria-label="Data final"
          />
        </div>

        {/* DataTable */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-40">Número</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Paciente</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground w-32">Valor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-28">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-28">Vencimento</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground w-36">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoicesQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-muted animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    {hasFilters
                      ? 'Nenhuma fatura encontrada para os filtros selecionados.'
                      : 'Nenhuma fatura cadastrada ainda.'}
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isVencida  = inv.status === 'vencida';
                  const isSoon     = isDueSoon(inv.due_date);

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedInvoiceId(inv.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {inv.invoice_number}
                      </td>
                      <td className="px-4 py-3 font-medium">{inv.patient_name ?? '–'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <div>{formatBRL(inv.total_amount)}</div>
                        {inv.amount_due > 0 && inv.status !== 'rascunho' && (
                          <div className="text-xs text-muted-foreground">
                            saldo: {formatBRL(inv.amount_due)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={inv.status as any} />
                      </td>
                      <td className="px-4 py-3">
                        {inv.due_date ? (
                          <span className={cn(
                            'text-sm',
                            isVencida && 'text-red-600 font-medium',
                            isSoon && !isVencida && 'text-amber-600',
                          )}>
                            {formatDate(inv.due_date)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={(e) => { e.stopPropagation(); setSelectedInvoiceId(inv.id); }}
                        >
                          Ver detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted-foreground">
              <span>{total} faturas · página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => updateParams({ page: String(page - 1) })}
                  disabled={page === 1}
                  className="px-2 py-1 rounded border border-border disabled:opacity-40"
                >
                  ‹ Anterior
                </button>
                <button
                  onClick={() => updateParams({ page: String(page + 1) })}
                  disabled={page === totalPages}
                  className="px-2 py-1 rounded border border-border disabled:opacity-40"
                >
                  Próxima ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <InvoiceSheet
        invoiceId={selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
        onChanged={() => {
          utils.financial.invoices.list.invalidate();
          utils.financial.caixa.getDia.invalidate();
        }}
      />

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={() => {
          setPaymentModalOpen(false);
          utils.financial.invoices.list.invalidate();
          utils.financial.caixa.getDia.invalidate();
        }}
      />
    </div>
  );
}

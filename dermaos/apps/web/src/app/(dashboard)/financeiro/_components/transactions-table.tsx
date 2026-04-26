'use client';

import * as React from 'react';
import { Badge } from '@dermaos/ui';
import { QrCode, CreditCard, Banknote, Building2, FileText, ArrowDownLeft } from 'lucide-react';
import { formatTime, formatBRL } from './format-brl';
import { cn } from '@dermaos/ui';

interface Transaction {
  id:             string;
  invoice_id:     string;
  invoice_number: string;
  patient_name:   string | null;
  method:         string;
  payment_type:   string;
  amount:         number;
  received_at:    string;
  registered_by:  string | null;
}

interface TransactionsTableProps {
  transactions: Transaction[];
  loading:      boolean;
}

const METHOD_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  pix:            { label: 'PIX',        icon: QrCode },
  cartao_credito: { label: 'Crédito',    icon: CreditCard },
  cartao_debito:  { label: 'Débito',     icon: CreditCard },
  dinheiro:       { label: 'Dinheiro',   icon: Banknote },
  plano_saude:    { label: 'Convênio',   icon: Building2 },
  boleto:         { label: 'Boleto',     icon: FileText },
};

export function TransactionsTable({ transactions, loading }: TransactionsTableProps) {
  const [page, setPage] = React.useState(1);
  const pageSize = 20;
  const totalPages = Math.ceil(transactions.length / pageSize);
  const paged = transactions.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 flex flex-col items-center gap-2 text-muted-foreground">
        <FileText className="size-8" aria-hidden="true" />
        <p className="text-sm">Nenhuma transação registrada hoje.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-20">Hora</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Paciente</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-36">Fatura</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-36">Método</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-24">Tipo</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground w-32">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paged.map((tx) => {
            const isRefund = tx.payment_type === 'estorno';
            const methodCfg = METHOD_LABELS[tx.method] ?? { label: tx.method, icon: FileText };
            const Icon = methodCfg.icon;

            return (
              <tr key={tx.id} className={cn('hover:bg-muted/30 transition-colors', isRefund && 'bg-red-50/50')}>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {formatTime(tx.received_at)}
                </td>
                <td className="px-4 py-3 font-medium">{tx.patient_name ?? '–'}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {tx.invoice_number}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {methodCfg.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {isRefund ? (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1">
                      <ArrowDownLeft className="size-3" aria-hidden="true" />
                      Estorno
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                      Pagamento
                    </Badge>
                  )}
                </td>
                <td className={cn('px-4 py-3 text-right font-semibold tabular-nums', isRefund && 'text-red-600')}>
                  {isRefund ? '−' : ''}{formatBRL(tx.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted-foreground">
          <span>{transactions.length} transações</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-border disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-2 py-1">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border border-border disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { Button } from '@dermaos/ui';
import { Plus, CalendarDays } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { FinanceiroTabs }     from './_components/financeiro-tabs';
import { CaixaCards }         from './_components/caixa-cards';
import { TransactionsTable }  from './_components/transactions-table';
import { PaymentModal }       from './_components/payment-modal';
import { formatDate }         from './_components/format-brl';

export default function FinanceiroCaixaPage() {
  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const [selectedDate, setSelectedDate]         = React.useState<string>('');

  const caixaQuery = trpc.financial.caixa.getDia.useQuery(
    { date: selectedDate ? new Date(selectedDate) : undefined },
    { staleTime: 30_000 },
  );

  const utils = trpc.useUtils();

  function handlePaymentSuccess() {
    setPaymentModalOpen(false);
    utils.financial.caixa.getDia.invalidate();
  }

  const data = caixaQuery.data;

  return (
    <div className="flex flex-col gap-0">
      <FinanceiroTabs />

      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Caixa do Dia</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `${formatDate(data.date)} · ${data.countTransacoes} transação${data.countTransacoes !== 1 ? 'ões' : ''}` : 'Movimentação financeira diária'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Seletor de data */}
            <div className="relative">
              <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Selecionar data"
              />
            </div>
            <Button onClick={() => setPaymentModalOpen(true)}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Registrar Pagamento
            </Button>
          </div>
        </div>

        {/* Cards de totais */}
        <CaixaCards
          loading={caixaQuery.isLoading}
          totalGeral={data?.totalGeral ?? 0}
          totalPorMetodo={data?.totalPorMetodo ?? {}}
        />

        {/* Tabela de transações */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Transações</h2>
          <TransactionsTable
            loading={caixaQuery.isLoading}
            transactions={data?.transactions ?? []}
          />
        </div>
      </div>

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}

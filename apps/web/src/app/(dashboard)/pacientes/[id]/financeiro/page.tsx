'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  Btn,
  Glass,
  Ico,
  MetalTag,
  Mono,
  Skeleton,
  T,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

type PageParams = Promise<{ id: string }>;

function fmtBRL(centavos: number): string {
  const reais = centavos / 100;
  return new Intl.NumberFormat('pt-BR', {
    style:    'currency',
    currency: 'BRL',
  }).format(reais);
}

export default function PatientFinanceiroPage({ params }: { params: PageParams }) {
  const { id: patientId } = React.use(params);
  const router = useRouter();

  const summaryQ = trpc.financial.invoices.patientSummary.useQuery(
    { patientId },
    { staleTime: 15_000 },
  );

  if (summaryQ.isLoading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Skeleton height={120} radius={16} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={96} radius={16} delay={60 * i} />
          ))}
        </div>
      </div>
    );
  }

  const summary = summaryQ.data ?? {
    totalInvoiced: 0,
    totalPaid:     0,
    balance:       0,
    pendingCount:  0,
  };
  const paidPct =
    summary.totalInvoiced > 0
      ? (summary.totalPaid / summary.totalInvoiced) * 100
      : 0;
  const hasBalance = summary.balance > 0;

  return (
    <div
      style={{
        padding: '22px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <Glass metal style={{ padding: '18px 22px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mono size={9} spacing="1.2px" color={T.financial.color}>
              SITUAÇÃO FINANCEIRA
            </Mono>
            <MetalTag>LGPD</MetalTag>
          </div>
          <Btn
            small
            icon="creditCard"
            onClick={() => router.push(`/financeiro?paciente=${patientId}`)}
          >
            Abrir financeiro
          </Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Metric label="Total faturado" value={fmtBRL(summary.totalInvoiced)} accent={T.textPrimary} />
          <Metric
            label="Total pago"
            value={fmtBRL(summary.totalPaid)}
            accent={T.success}
          />
          <Metric
            label="Saldo em aberto"
            value={fmtBRL(summary.balance)}
            accent={hasBalance ? T.danger : T.textPrimary}
            sub={
              summary.pendingCount > 0
                ? `${summary.pendingCount} fatura${summary.pendingCount > 1 ? 's' : ''} pendente${summary.pendingCount > 1 ? 's' : ''}`
                : 'Sem pendências'
            }
          />
        </div>
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <Mono size={8}>QUITADO</Mono>
            <Mono size={9} color={T.financial.color}>
              {paidPct.toFixed(0)}%
            </Mono>
          </div>
          <Bar pct={paidPct} color={T.financial.color} height={6} />
        </div>
      </Glass>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <Glass style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ico name="alert" size={15} color={hasBalance ? T.danger : T.success} />
            <Mono size={9} spacing="1px" color={hasBalance ? T.danger : T.success}>
              {hasBalance ? 'PENDÊNCIAS ABERTAS' : 'TUDO EM DIA'}
            </Mono>
          </div>
          <p
            style={{
              fontSize: 13,
              color: T.textSecondary,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {hasBalance
              ? `Existem ${summary.pendingCount} fatura${summary.pendingCount > 1 ? 's' : ''} aguardando pagamento, totalizando ${fmtBRL(summary.balance)}.`
              : 'Nenhuma fatura em aberto para este paciente.'}
          </p>
          {hasBalance && (
            <div style={{ marginTop: 12 }}>
              <Btn
                variant="accent"
                small
                icon="creditCard"
                onClick={() => router.push(`/financeiro/faturas?paciente=${patientId}`)}
              >
                Cobrar pendências
              </Btn>
            </div>
          )}
        </Glass>

        <Glass style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ico name="file" size={15} color={T.financial.color} />
            <Mono size={9} spacing="1px" color={T.financial.color}>
              AÇÕES RÁPIDAS
            </Mono>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Btn
              variant="glass"
              small
              icon="plus"
              onClick={() => router.push(`/financeiro/faturas?paciente=${patientId}&novo=1`)}
            >
              Nova fatura
            </Btn>
            <Btn
              variant="glass"
              small
              icon="download"
              onClick={() => router.push(`/financeiro?paciente=${patientId}`)}
            >
              Histórico completo
            </Btn>
            <Btn
              variant="ghost"
              small
              icon="printer"
              onClick={() => window.print()}
            >
              Imprimir resumo
            </Btn>
          </div>
        </Glass>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div>
      <Mono size={8} spacing="1.1px">
        {label.toUpperCase()}
      </Mono>
      <p
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: accent,
          letterSpacing: '-0.02em',
          margin: '4px 0 2px',
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{sub}</p>
      )}
    </div>
  );
}

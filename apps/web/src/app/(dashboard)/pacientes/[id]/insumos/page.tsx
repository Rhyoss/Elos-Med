'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Btn,
  DataTable,
  EmptyState,
  Glass,
  Mono,
  Skeleton,
  T,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

type PageParams = Promise<{ id: string }>;

const STATUS_LABEL: Record<string, string> = {
  pending:    'Pendente',
  confirmed:  'Confirmado',
  rolled_back: 'Estornado',
};

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  pending:    'warning',
  confirmed:  'success',
  rolled_back: 'danger',
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  }).format(date);
}

interface ConsumptionRow {
  id?: string;
  consumptionId?: string;
  status?: string;
  kitId?: string;
  kitName?: string;
  encounterId?: string;
  appointmentId?: string;
  consumedAt?: Date | string;
  createdAt?: Date | string;
  itemsCount?: number;
  totalCost?: number;
  performedBy?: string;
  performerName?: string;
}

export default function PatientInsumosPage({ params }: { params: PageParams }) {
  const { id: patientId } = React.use(params);
  const router = useRouter();

  const consumptionsQ = trpc.supply.consumption.list.useQuery(
    { patientId, page: 1, limit: 50 },
    { staleTime: 15_000 },
  );

  const data = (consumptionsQ.data as { data?: ConsumptionRow[] } | undefined)?.data ?? [];

  if (consumptionsQ.isLoading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Skeleton height={56} radius={16} />
        <Skeleton height={320} radius={16} delay={120} />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '22px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div>
          <Mono size={9} spacing="1.2px" color={T.supply.color}>
            INSUMOS · KITS APLICADOS
          </Mono>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: T.textPrimary,
              margin: '4px 0 0',
            }}
          >
            Histórico de consumo
          </h2>
        </div>
        <Btn
          small
          icon="plus"
          onClick={() => router.push(`/suprimentos/kits/consumir?paciente=${patientId}`)}
        >
          Registrar consumo
        </Btn>
      </div>

      <Glass style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <DataTable
          columns={[
            {
              header: 'Kit',
              cell: (row: ConsumptionRow) => (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, margin: 0 }}>
                    {row.kitName ?? row.kitId ?? '—'}
                  </p>
                  {row.itemsCount ? (
                    <Mono size={8}>{row.itemsCount} item{row.itemsCount > 1 ? 's' : ''}</Mono>
                  ) : null}
                </div>
              ),
            },
            {
              header: 'Aplicado em',
              cell: (row: ConsumptionRow) => (
                <Mono size={9}>{fmtDate(row.consumedAt ?? row.createdAt)}</Mono>
              ),
            },
            {
              header: 'Profissional',
              cell: (row: ConsumptionRow) => (
                <span style={{ fontSize: 12, color: T.textSecondary }}>
                  {row.performerName ?? row.performedBy ?? '—'}
                </span>
              ),
            },
            {
              header: 'Custo',
              align: 'right',
              cell: (row: ConsumptionRow) =>
                row.totalCost !== undefined ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
                    {new Intl.NumberFormat('pt-BR', {
                      style:    'currency',
                      currency: 'BRL',
                    }).format((row.totalCost ?? 0) / 100)}
                  </span>
                ) : (
                  <Mono size={9}>—</Mono>
                ),
            },
            {
              header: 'Status',
              cell: (row: ConsumptionRow) => (
                <Badge
                  variant={STATUS_VARIANT[row.status ?? 'confirmed'] ?? 'default'}
                  dot={false}
                >
                  {STATUS_LABEL[row.status ?? 'confirmed'] ?? row.status ?? '—'}
                </Badge>
              ),
            },
          ]}
          rows={data}
          rowKey={(row, i) => row.id ?? row.consumptionId ?? `c-${i}`}
          empty={
            <EmptyState
              icon="box"
              title="Nenhum kit consumido"
              description="Quando você registrar consumo de kits para este paciente, eles aparecerão aqui."
              action={
                <Btn
                  variant="glass"
                  small
                  icon="plus"
                  onClick={() => router.push(`/suprimentos/kits/consumir?paciente=${patientId}`)}
                >
                  Registrar primeiro consumo
                </Btn>
              }
            />
          }
        />
      </Glass>
    </div>
  );
}

'use client';

import * as React from 'react';
import {
  Glass, Btn, Stat, Mono, Badge, Ico, Bar,
  PageHero, T,
} from '@dermaos/ui/ds';

/**
 * Financeiro — caixa & faturamento.
 *
 * Phase-4 deliverable: layout 1:1 com o reference (4 stats + DRE + Caixa
 * do dia + tabela de faturas), mock data até Phase 5 ligar tRPC
 * `financial.*`. A entrada/saída de caixa, conciliação e parcelamento
 * vivem em sub-rotas (`/financeiro/dre`, `/faturas`, `/metas`).
 */
export default function FinanceiroPage() {
  const stats = [
    { label: 'Receita hoje',     value: 'R$ 8.420',  sub: 'Meta: R$ 10k',       icon: 'activity'   as const, mod: 'financial' as const, pct: 84 },
    { label: 'Faturas abertas',  value: '7',         sub: 'R$ 4.230 pend.',     icon: 'creditCard' as const, mod: 'financial' as const, pct: 42 },
    { label: 'Recebido mês',     value: 'R$ 62.4k',  sub: '+12% vs jan/25',     icon: 'barChart'   as const, mod: 'financial' as const, pct: 78 },
    { label: 'Ticket médio',     value: 'R$ 580',    sub: 'vs R$ 510',          icon: 'percent'    as const, mod: 'financial' as const, pct: 68 },
  ];

  const dre = [
    { l: 'Consultas',     v: 6200, p: 62 },
    { l: 'Procedimentos', v: 3100, p: 31 },
    { l: 'Produtos',      v: 700,  p: 7  },
  ];

  const cashSplit = [
    { l: 'Dinheiro', v: 'R$ 1.240', p: 15 },
    { l: 'Débito',   v: 'R$ 2.800', p: 33 },
    { l: 'Crédito',  v: 'R$ 3.100', p: 37 },
    { l: 'PIX',      v: 'R$ 1.280', p: 15 },
  ];

  const faturas: Array<{
    id: string;
    patient: string;
    valor: string;
    status: string;
    s: 'success' | 'warning' | 'danger';
    data: string;
  }> = [
    { id: 'F-0091', patient: 'Ana Clara Mendes', valor: 'R$ 580,00',   status: 'Pago',     s: 'success', data: '15 Jan' },
    { id: 'F-0092', patient: 'Roberto Alves',    valor: 'R$ 320,00',   status: 'Pendente', s: 'warning', data: '18 Jan' },
    { id: 'F-0093', patient: 'Mariana Costa',    valor: 'R$ 1.200,00', status: 'Pago',     s: 'success', data: '20 Jan' },
    { id: 'F-0094', patient: 'João Ferreira',    valor: 'R$ 450,00',   status: 'Vencida',  s: 'danger',  data: '10 Jan' },
    { id: 'F-0095', patient: 'Carla Nunes',      valor: 'R$ 890,00',   status: 'Pago',     s: 'success', data: '19 Jan' },
  ];

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow="CAIXA E FATURAMENTO"
        title="Financeiro"
        module="financial"
        icon="creditCard"
        actions={
          <>
            <Btn variant="glass" small icon="barChart">DRE</Btn>
            <Btn small icon="plus">Nova fatura</Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 20 }}>
        {stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {/* DRE */}
        <Glass style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>DRE — Janeiro 2026</span>
            <Mono size={9} color={T.financial.color}>R$ 10.000 / MÊS</Mono>
          </div>
          {dre.map((d) => (
            <div key={d.l} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: T.textSecondary }}>{d.l}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>R$ {d.v.toLocaleString('pt-BR')}</span>
              </div>
              <Bar pct={d.p} color={T.financial.color} />
            </div>
          ))}
          <div
            style={{
              paddingTop: 10,
              borderTop: `1px solid ${T.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Total</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.financial.color }}>R$ 10.000</span>
          </div>
        </Glass>

        {/* Caixa do dia (metal) */}
        <Glass metal style={{ padding: '18px 22px' }}>
          <Mono size={9} spacing="1.2px">CAIXA DO DIA</Mono>
          <p
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: T.textPrimary,
              letterSpacing: '-0.02em',
              marginTop: 6,
              marginBottom: 8,
            }}
          >
            R$ 8.420
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <Badge variant="success">+R$ 1.200 botox</Badge>
            <Badge variant="warning">−R$ 320 fornec.</Badge>
          </div>
          {cashSplit.map((m) => (
            <div key={m.l} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
              <span style={{ fontSize: 11, color: T.textSecondary, width: 55, flexShrink: 0 }}>{m.l}</span>
              <Bar pct={m.p} color={T.primary} height={4} />
              <span style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, width: 65, textAlign: 'right', flexShrink: 0 }}>
                {m.v}
              </span>
            </div>
          ))}
        </Glass>
      </div>

      <Glass style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 18px',
            borderBottom: `1px solid ${T.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Ico name="creditCard" size={14} color={T.financial.color} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Faturas recentes</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['N°', 'Paciente', 'Valor', 'Data', 'Status', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '9px 16px',
                    textAlign: 'left',
                    fontSize: 8,
                    fontFamily: "'IBM Plex Mono', monospace",
                    letterSpacing: '1.1px',
                    color: T.textMuted,
                    fontWeight: 500,
                    borderBottom: `1px solid ${T.divider}`,
                    background: T.metalGrad,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {faturas.map((f, i) => (
              <tr
                key={f.id}
                style={{
                  borderBottom: `1px solid ${T.divider}`,
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.20)',
                }}
              >
                <td style={{ padding: '11px 16px' }}><Mono size={9}>{f.id}</Mono></td>
                <td style={{ padding: '11px 16px', fontSize: 12, color: T.textPrimary, fontWeight: 500 }}>{f.patient}</td>
                <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{f.valor}</td>
                <td style={{ padding: '11px 16px' }}><Mono size={9}>{f.data}</Mono></td>
                <td style={{ padding: '11px 16px' }}><Badge variant={f.s}>{f.status}</Badge></td>
                <td style={{ padding: '11px 16px' }}><Btn variant="ghost" small>Ver</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}

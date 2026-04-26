'use client';

import * as React from 'react';
import {
  Glass, Btn, Stat, Mono, Bar,
  PageHero, T, type ShellModule,
} from '@dermaos/ui/ds';

/**
 * Analytics — inteligência operacional.
 *
 * Phase-4 deliverable: layout 1:1 com o reference (4 stats por módulo +
 * mini bar-chart de consultas/dia + NPS por dimensão + breakdown 4-col),
 * mock data até Phase 5 ligar tRPC `analytics.*` (já existem MVs no
 * worker noturno do Prompt 17).
 */
export default function AnalyticsPage() {
  const stats: Array<{
    label: string;
    value: string;
    sub: string;
    icon: 'user' | 'creditCard' | 'zap' | 'box';
    mod: ShellModule;
  }> = [
    { label: 'Clinical',     value: '68%',       sub: 'Consultas e prontuários',  icon: 'user',       mod: 'clinical' },
    { label: 'Financeiro',   value: 'R$ 62.4k',  sub: 'Receita do mês',           icon: 'creditCard', mod: 'financial' },
    { label: 'IA / Aurora',  value: '94%',       sub: 'Satisfação atendimento',   icon: 'zap',        mod: 'aiMod' },
    { label: 'Suprimentos',  value: '127',       sub: 'Itens em estoque',         icon: 'box',        mod: 'supply' },
  ];

  const weekData = [
    { l: 'Seg', v: 12 },
    { l: 'Ter', v: 18 },
    { l: 'Qua', v: 14 },
    { l: 'Qui', v: 20 },
    { l: 'Sex', v: 16 },
    { l: 'Sáb', v: 6  },
  ];

  const nps = [
    { l: 'Atendimento clínico', v: 96, c: T.clinical.color },
    { l: 'Comunicação IA',      v: 91, c: T.ai },
    { l: 'Tempo de espera',     v: 74, c: T.warning },
    { l: 'Espaço físico',       v: 88, c: T.financial.color },
  ];

  const breakdown: Array<{ mod: ShellModule; items: Array<[string, string]> }> = [
    { mod: 'clinical',  items: [['Consultas', '86'], ['Prescrições', '43'], ['Protocolos', '21']] },
    { mod: 'financial', items: [['Receita', 'R$ 62.4k'], ['Ticket', 'R$ 580'], ['Faturas', '108']] },
    { mod: 'aiMod',     items: [['Msgs IA', '412'], ['Escalações', '14'], ['NPS IA', '91%']] },
    { mod: 'supply',    items: [['Kits usados', '38'], ['Consumidos', '247'], ['Compras', 'R$ 8.2k']] },
  ];

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow="INTELIGÊNCIA OPERACIONAL"
        title="Analytics"
        icon="barChart"
        accent={T.ai}
        actions={
          <>
            <Btn variant="ghost" small>CSV</Btn>
            <Btn variant="glass" small icon="download">PDF</Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 20 }}>
        {stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {/* Bar chart Consultas/dia */}
        <Glass style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Consultas/dia — Jan 2026</span>
            <Mono size={9} color={T.clinical.color}>86 TOTAL</Mono>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
            {weekData.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    borderRadius: `${T.r.sm}px ${T.r.sm}px 0 0`,
                    background: `linear-gradient(180deg, ${T.clinical.color}, ${T.clinical.color}88)`,
                    height: `${(d.v / 24) * 72}px`,
                    transition: 'height 0.6s',
                  }}
                />
                <Mono size={7}>{d.l}</Mono>
              </div>
            ))}
          </div>
        </Glass>

        {/* NPS metal */}
        <Glass metal style={{ padding: '18px 22px' }}>
          <Mono size={9} spacing="1.2px">NPS &amp; SATISFAÇÃO</Mono>
          <div style={{ marginTop: 12 }}>
            {nps.map((item) => (
              <div key={item.l} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: T.textSecondary, width: 150, flexShrink: 0 }}>
                  {item.l}
                </span>
                <Bar pct={item.v} color={item.c} />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.textPrimary,
                    width: 32,
                    textAlign: 'right',
                  }}
                >
                  {item.v}%
                </span>
              </div>
            ))}
          </div>
        </Glass>
      </div>

      {/* Breakdown por módulo */}
      <Glass style={{ padding: '18px 22px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Breakdown por módulo — Jan 2026</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 12 }}>
          {breakdown.map((col) => {
            const m = T[col.mod];
            return (
              <div
                key={col.mod}
                style={{
                  padding: '12px 14px',
                  borderRadius: T.r.md,
                  background: m.bg,
                  border: `1px solid ${m.color}15`,
                }}
              >
                <Mono size={7} color={m.color}>{m.label.toUpperCase()}</Mono>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {col.items.map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: T.textMuted }}>{k}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Glass>
    </div>
  );
}

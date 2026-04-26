'use client';

import * as React from 'react';
import {
  Glass, Btn, Stat, Mono, Badge, Ico,
  PageHero, formatHeroDate, T,
} from '@dermaos/ui/ds';

/**
 * Dashboard — visão geral.
 *
 * Phase-4 deliverable: layout 1:1 com o reference Quite Clear, dados mock
 * alinhados ao reference. As queries reais (consultas hoje, receita,
 * alertas IA, alertas FEFO) são integradas em Phase 5 quando o backend
 * de KPIs do dashboard for finalizado.
 */
export default function DashboardPage() {
  const today = new Date();

  const stats = [
    { label: 'Consultas',  value: '14',         sub: '+2 em espera',     icon: 'calendar'   as const, mod: 'clinical'  as const, pct: 70 },
    { label: 'Receita',    value: 'R$ 8.420',   sub: 'Meta: R$ 10k',     icon: 'creditCard' as const, mod: 'financial' as const, pct: 84 },
    { label: 'Alertas IA', value: '3',          sub: '2 críticos',       icon: 'zap'        as const, mod: 'aiMod'     as const, pct: 30 },
    { label: 'Estoque',    value: '7 alertas',  sub: 'FEFO: 2 vencendo', icon: 'box'        as const, mod: 'supply'    as const, pct: 55 },
  ];

  const appts = [
    { time: '09:30', name: 'Mariana Costa',  type: 'Botox 100U',         mod: 'supply'   as const, s: 'success' as const, status: 'Confirmado' },
    { time: '11:00', name: 'João Ferreira',  type: 'Lesão IA',           mod: 'aiMod'    as const, s: 'default' as const, status: 'Aguardando' },
    { time: '14:00', name: 'Carla Nunes',    type: 'Protocolo rejuv.',   mod: 'clinical' as const, s: 'success' as const, status: 'Confirmado' },
    { time: '15:00', name: 'Pedro Gomes',    type: 'Revisão prescrição', mod: 'clinical' as const, s: 'warning' as const, status: 'Pendente'    },
  ];

  const alerts: Array<{ msg: string; color: string; icon: 'alert' | 'zap' | 'creditCard' }> = [
    { msg: 'Estoque crítico: Toxina Botulínica (4 unid.)', color: T.warning, icon: 'alert' },
    { msg: 'IA detectou lesão suspeita — PAC-0851',        color: T.ai,      icon: 'zap' },
    { msg: 'Fatura #F-0091 vencida há 3 dias',             color: T.danger,  icon: 'creditCard' },
  ];

  const messages = [
    { name: 'Sandra Ramos',   ch: 'WhatsApp',  msg: 'Confirmar consulta amanhã 10h.',  time: '14:32' },
    { name: 'Lucas Teixeira', ch: 'Instagram', msg: 'Tratamento para manchas?',         time: '13:15' },
    { name: 'Beatriz Viana',  ch: 'Email',     msg: 'Solicito resultado dos exames.',   time: '11:48' },
  ];

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow={formatHeroDate(today)}
        title="Dashboard"
        actions={<Btn small icon="activity">Relatório</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
        {stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {/* Agenda de Hoje */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Ico name="calendar" size={14} color={T.clinical.color} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Agenda de Hoje</span>
          </div>
          {appts.map((a, i) => {
            const m = T[a.mod];
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 16px',
                  borderBottom: i < appts.length - 1 ? `1px solid ${T.divider}` : 'none',
                }}
              >
                <Mono size={9}>{a.time}</Mono>
                <div style={{ width: 3, height: 28, borderRadius: 2, background: m.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.name}
                  </p>
                  <p style={{ fontSize: 10, color: T.textTertiary }}>{a.type}</p>
                </div>
                <Badge variant={a.s} dot={false}>{a.status}</Badge>
              </div>
            );
          })}
        </Glass>

        {/* Alertas Críticos */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Ico name="alert" size={14} color={T.danger} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Alertas Críticos</span>
          </div>
          {alerts.map((a, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 9,
                padding: '10px 16px',
                borderBottom: i < alerts.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: T.r.sm,
                  background: `${a.color}0F`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ico name={a.icon} size={13} color={a.color} />
              </div>
              <p style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>{a.msg}</p>
            </div>
          ))}
        </Glass>

        {/* Comunicações */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Ico name="message" size={14} color={T.aiMod.color} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Comunicações</span>
          </div>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                padding: '10px 16px',
                borderBottom: i < messages.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{m.name}</span>
                <Mono size={8}>{m.time}</Mono>
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 8,
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: T.primaryBg,
                    color: T.primary,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {m.ch}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: T.textMuted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.msg}
                </span>
              </div>
            </div>
          ))}
        </Glass>
      </div>
    </div>
  );
}

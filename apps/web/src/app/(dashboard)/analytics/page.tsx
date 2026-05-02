'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Glass, Btn, Mono, TabBar, PageHero, T,
  type TabItem,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { isoNDaysAgo, isoToday } from './_components/analytics-helpers';
import { TabOcupacao } from './_components/tab-ocupacao';
import { TabReceita } from './_components/tab-receita';
import { TabPacientes } from './_components/tab-pacientes';
import { TabProcedimentos } from './_components/tab-procedimentos';
import { TabComunicacao } from './_components/tab-comunicacao';
import { TabEstoque } from './_components/tab-estoque';

/* ── Tab definitions ───────────────────────────────────────────────────────── */

const TABS: ReadonlyArray<TabItem> = [
  { id: 'ocupacao',       label: 'Ocupação',       icon: 'calendar' },
  { id: 'receita',        label: 'Receita',        icon: 'creditCard' },
  { id: 'pacientes',      label: 'Pacientes',      icon: 'users' },
  { id: 'procedimentos',  label: 'Procedimentos',  icon: 'activity' },
  { id: 'comunicacao',    label: 'Comunicação',     icon: 'message' },
  { id: 'estoque',        label: 'Estoque',         icon: 'box' },
];

type TabId = typeof TABS[number]['id'];

const EXPORT_TAB_MAP: Record<TabId, string> = {
  ocupacao:      'overview',
  receita:       'financial',
  pacientes:     'journey',
  procedimentos: 'overview',
  comunicacao:   'omni',
  estoque:       'supply',
};

/* ── Period presets ─────────────────────────────────────────────────────────── */

const PRESETS = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '12m', days: 365 },
] as const;

/* ── Main page ─────────────────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const activeTab = (params.get('tab') as TabId) || 'ocupacao';
  const startParam = params.get('start') || isoNDaysAgo(30);
  const endParam = params.get('end') || isoToday();

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val == null || val === '') next.delete(key);
      else next.set(key, val);
    }
    router.replace(`${pathname}?${next.toString()}`);
  }

  function setTab(id: string) {
    updateParams({ tab: id });
  }

  function setPeriod(days: number) {
    updateParams({ start: isoNDaysAgo(days), end: isoToday() });
  }

  const activeDays = Math.round(
    (new Date(endParam).getTime() - new Date(startParam).getTime()) / 86_400_000 + 1
  );

  /* ── Export ──────────────────────────────────────────────────────────────── */

  const exportMut = trpc.analytics.exportReport.useMutation({
    onSuccess: (result) => {
      if (result.format === 'pdf' && 'contentBase64' in result) {
        const binary = atob(result.contentBase64 as string);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'text/html; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else if (result.format === 'csv' && 'content' in result) {
        const blob = new Blob([result.content as string], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${activeTab}-${startParam}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
  });

  function handleExport(format: 'pdf' | 'csv') {
    const tab = EXPORT_TAB_MAP[activeTab] as 'overview' | 'financial' | 'journey' | 'omni' | 'supply';
    exportMut.mutate({ tab, format, start: startParam, end: endParam });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '22px 26px 0' }}>
        <PageHero
          eyebrow="INTELIGÊNCIA OPERACIONAL"
          title="Analytics"
          icon="barChart"
          accent={T.ai}
          actions={
            <>
              <Btn
                variant="ghost"
                small
                onClick={() => handleExport('csv')}
                disabled={exportMut.isPending}
              >
                CSV
              </Btn>
              <Btn
                variant="glass"
                small
                icon="download"
                onClick={() => handleExport('pdf')}
                disabled={exportMut.isPending}
              >
                {exportMut.isPending ? 'Exportando…' : 'PDF'}
              </Btn>
            </>
          }
        />

        {/* Period filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <Mono size={10} spacing="1px" color={T.textMuted}>PERÍODO</Mono>
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {PRESETS.map((p) => {
              const isActive = activeDays === p.days || (p.days === 365 && activeDays >= 360);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPeriod(p.days)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: T.r.sm,
                    border: `1px solid ${isActive ? T.primary : T.divider}`,
                    background: isActive ? `${T.primary}12` : 'transparent',
                    color: isActive ? T.primary : T.textSecondary,
                    fontSize: 12,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={startParam}
              onChange={(e) => updateParams({ start: e.target.value })}
              style={{
                padding: '4px 8px', borderRadius: T.r.sm,
                border: `1px solid ${T.divider}`, background: 'transparent',
                color: T.textPrimary, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
              }}
            />
            <span style={{ color: T.textMuted, fontSize: 11 }}>—</span>
            <input
              type="date"
              value={endParam}
              onChange={(e) => updateParams({ end: e.target.value })}
              style={{
                padding: '4px 8px', borderRadius: T.r.sm,
                border: `1px solid ${T.divider}`, background: 'transparent',
                color: T.textPrimary, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
              }}
            />
          </div>
          {exportMut.isError && (
            <span style={{ fontSize: 11, color: T.danger, marginLeft: 12 }}>
              Erro ao exportar. Verifique suas permissões.
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <TabBar
        tabs={TABS}
        activeId={activeTab}
        onChange={setTab}
        module="clinical"
      />

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px 40px' }}>
        {activeTab === 'ocupacao' && <TabOcupacao start={startParam} end={endParam} />}
        {activeTab === 'receita' && <TabReceita start={startParam} end={endParam} />}
        {activeTab === 'pacientes' && <TabPacientes start={startParam} end={endParam} />}
        {activeTab === 'procedimentos' && <TabProcedimentos start={startParam} end={endParam} />}
        {activeTab === 'comunicacao' && <TabComunicacao start={startParam} end={endParam} />}
        {activeTab === 'estoque' && <TabEstoque start={startParam} end={endParam} />}
      </div>
    </div>
  );
}

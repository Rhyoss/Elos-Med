'use client';

import * as React from 'react';
import { cn } from '@dermaos/ui';
import { Btn, Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import { MiniCalendar } from './mini-calendar';
import { DaySummary } from './day-summary';
import { startOfDay } from '@/lib/agenda-utils';
import type { AppointmentCardData } from './appointment-detail-sheet';

/* ── Filter types ────────────────────────────────────────────────────────── */

export interface AgendaFilters {
  providerId: string;
  status: string;
  type: string;
}

interface AgendaSidebarProps {
  selectedDate: Date;
  calMonth: Date;
  apptDays: Set<number>;
  appointments: AppointmentCardData[];
  providers: Array<{ id: string; name: string; crm?: string | null }>;
  filters: AgendaFilters;
  onDateChange: (d: Date) => void;
  onMonthChange: (delta: number) => void;
  onFiltersChange: (f: Partial<AgendaFilters>) => void;
  onNewAppointment?: () => void;
  onBlockSlot?: () => void;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'scheduled', label: 'Pendentes' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'waiting', label: 'Aguardando' },
  { value: 'in_progress', label: 'Em atendimento' },
  { value: 'completed', label: 'Concluídos' },
  { value: 'cancelled', label: 'Cancelados' },
  { value: 'no_show', label: 'Não compareceu' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'consultation', label: 'Consulta' },
  { value: 'return', label: 'Retorno' },
  { value: 'procedure', label: 'Procedimento' },
  { value: 'protocol', label: 'Protocolo' },
  { value: 'evaluation', label: 'Avaliação' },
];

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 8,
  background: T.glass,
  border: `1px solid ${T.glassBorder}`,
  fontSize: 12,
  fontFamily: "'IBM Plex Sans', sans-serif",
  color: T.textPrimary,
  outline: 'none',
  cursor: 'pointer',
};

export function AgendaSidebar({
  selectedDate,
  calMonth,
  apptDays,
  appointments,
  providers,
  filters,
  onDateChange,
  onMonthChange,
  onFiltersChange,
  onNewAppointment,
  onBlockSlot,
}: AgendaSidebarProps) {
  /* ── KPIs ───────────────────────────────────────────────────────────── */
  const total = appointments.length;
  const confirmados = appointments.filter(
    (a) => a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'in_progress',
  ).length;
  const aguardando = appointments.filter((a) => a.status === 'waiting').length;
  const emSala = appointments.filter((a) => a.status === 'in_progress').length;
  const atrasados = appointments.filter(
    (a) =>
      (a.status === 'scheduled' || a.status === 'confirmed') &&
      new Date(a.scheduledAt).getTime() < Date.now(),
  ).length;

  return (
    <aside
      className="flex flex-col gap-3 shrink-0 overflow-y-auto px-3 py-3.5"
      style={{
        width: 216,
        borderRight: `1px solid ${T.divider}`,
      }}
    >
      {/* Mini calendar */}
      <MiniCalendar
        date={calMonth}
        selected={selectedDate}
        apptDays={apptDays}
        onDayClick={(d) => onDateChange(startOfDay(d))}
        onMonthChange={onMonthChange}
      />

      {/* Today button */}
      <button
        type="button"
        onClick={() => {
          const today = startOfDay(new Date());
          onDateChange(today);
        }}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-colors hover:opacity-80"
        style={{
          background: T.primaryBg,
          border: `1px solid ${T.primaryBorder}`,
        }}
      >
        <Ico name="clock" size={12} color={T.primary} />
        <Mono size={9} color={T.primary}>HOJE</Mono>
      </button>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <Mono size={8} spacing="1px" color={T.textMuted}>FILTROS</Mono>
        <select
          value={filters.providerId}
          onChange={(e) => onFiltersChange({ providerId: e.target.value })}
          aria-label="Filtrar por profissional"
          style={selectStyle}
        >
          <option value="all">Todos profissionais</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => onFiltersChange({ status: e.target.value })}
          aria-label="Filtrar por status"
          style={selectStyle}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(e) => onFiltersChange({ type: e.target.value })}
          aria-label="Filtrar por tipo"
          style={selectStyle}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Day summary KPIs */}
      <Glass style={{ padding: '10px 12px', borderRadius: T.r.md }}>
        <Mono size={7} spacing="1px" color={T.textMuted}>
          RESUMO DO DIA
        </Mono>
        <div className="flex flex-col gap-1.5 mt-2">
          {[
            { l: 'Total', v: total, c: T.textPrimary },
            { l: 'Confirmados', v: confirmados, c: T.primary },
            { l: 'Aguardando', v: aguardando, c: '#f59e0b' },
            { l: 'Em sala', v: emSala, c: '#16a34a' },
            { l: 'Atrasados', v: atrasados, c: '#ef4444' },
          ].map((s) => (
            <div key={s.l} className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.c }} />
                <span className="text-[10px]" style={{ color: T.textMuted }}>{s.l}</span>
              </div>
              <span className="text-xs font-bold" style={{ color: T.textPrimary }}>{s.v}</span>
            </div>
          ))}
        </div>
      </Glass>

      {/* Breakdown by type */}
      <DaySummary appointments={appointments} selected={selectedDate} />

      {/* CTA — gated by RBAC (appointments.write) */}
      {(onNewAppointment || onBlockSlot) && (
        <div className="flex flex-col gap-2 mt-auto pt-2">
          {onNewAppointment && (
            <Btn
              small
              icon="plus"
              onClick={onNewAppointment}
              style={{ width: '100%' }}
            >
              Agendar
            </Btn>
          )}
          {onBlockSlot && (
            <button
              type="button"
              onClick={onBlockSlot}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs transition-colors hover:opacity-80"
              style={{
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
                color: T.textSecondary,
              }}
            >
              <Ico name="lock" size={11} color={T.textMuted} />
              Bloquear horário
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

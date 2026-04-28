'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Glass, Btn, Stat, Mono, Badge, Select,
  PageHero, formatHeroDate, T,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';
import { isToday, startOfDay } from '@/lib/agenda-utils';
import { DayGrid } from './_components/day-grid';
import {
  AppointmentDetailSheet,
  type AppointmentCardData,
} from './_components/appointment-detail-sheet';
import { NewAppointmentDialog } from './_components/new-appointment-dialog';

/**
 * Agenda — DS chrome + DayGrid legacy preservado.
 *
 * Phase-4 reskin:
 * - PageHero com data + título e ações Quite Clear.
 * - 4 Stats derivados de `agendaQuery.data.appointments` em tempo real.
 * - Toolbar DS (date nav + provider Select + Novo Agendamento).
 * - `DayGrid`, `AppointmentDetailSheet`, `NewAppointmentDialog` mantidos
 *   intactos para preservar drag/click slot, sheets e mutations.
 *   Migração desses sub-componentes para DS fica para Phase 5.
 */
export default function AgendaPage() {
  const [date, setDate] = React.useState<Date>(startOfDay(new Date()));
  const [providerFilter, setProviderFilter] = React.useState<string>('all');
  const [selected, setSelected] = React.useState<AppointmentCardData | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [newSlotStart, setNewSlotStart] = React.useState<Date | undefined>();
  const [newSlotProvider, setNewSlotProvider] = React.useState<string | undefined>();

  const providersQuery = trpc.scheduling.listProviders.useQuery();
  const agendaQuery = trpc.scheduling.agendaDay.useQuery({
    date,
    providerId: providerFilter === 'all' ? undefined : providerFilter,
  });

  useRealtime(['appointment.created', 'appointment.updated', 'appointment.checked_in'], () => {
    void agendaQuery.refetch();
  });

  const providers = React.useMemo(() => {
    const list = providersQuery.data?.providers ?? [];
    if (providerFilter === 'all') return list;
    return list.filter((p) => p.id === providerFilter);
  }, [providersQuery.data, providerFilter]);

  const appointments = (agendaQuery.data?.appointments ?? []) as AppointmentCardData[];
  const isLoadingSchedule = providersQuery.isLoading || agendaQuery.isLoading;
  const hasScheduleError = providersQuery.isError || agendaQuery.isError;
  const scheduleErrorMessage =
    providersQuery.error?.message ?? agendaQuery.error?.message ?? 'Falha ao carregar a agenda.';

  /* ── KPIs derivados ────────────────────────────────────────────────── */
  const totalToday  = appointments.length;
  const confirmados = appointments.filter((a) => a.status === 'confirmed' || a.status === 'checked_in').length;
  const aguardando  = appointments.filter((a) => a.status === 'scheduled' || a.status === 'waiting').length;
  const pendentes   = Math.max(0, totalToday - confirmados - aguardando);

  function shiftDay(delta: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    setDate(startOfDay(next));
  }

  function handleCardClick(a: AppointmentCardData) {
    setSelected(a);
    setSheetOpen(true);
  }

  function handleEmptyClick(providerId: string, start: Date) {
    setNewSlotProvider(providerId);
    setNewSlotStart(start);
    setNewOpen(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '20px 26px 12px', flexShrink: 0 }}>
        <PageHero
          eyebrow={formatHeroDate(date)}
          title="Agenda Clínica"
          module="clinical"
          icon="calendar"
          actions={
            <>
              <Link href="/agenda/semana" style={{ textDecoration: 'none' }}>
                <Btn variant="glass" small icon="grid">Semana</Btn>
              </Link>
              <Link href="/agenda/fila" style={{ textDecoration: 'none' }}>
                <Btn variant="glass" small icon="clock">Fila</Btn>
              </Link>
              <Btn small icon="plus" onClick={() => { setNewSlotStart(undefined); setNewSlotProvider(undefined); setNewOpen(true); }}>
                Agendar
              </Btn>
            </>
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
          <Stat label="Hoje"        value={String(totalToday)}  sub={totalToday === 1 ? 'agendamento' : 'agendamentos'} icon="calendar" mod="clinical" />
          <Stat label="Confirmados" value={String(confirmados)} sub="check-in OK"                                     icon="check"    mod="clinical" />
          <Stat label="Aguardando"  value={String(aguardando)}  sub="agendados"                                       icon="clock"    mod="clinical" />
          <Stat label="Pendentes"   value={String(pendentes)}   sub="atenção"                                         icon="alert"    mod="clinical" />
        </div>

        {/* Toolbar */}
        <Glass style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <Btn variant="ghost" small icon="arrowLeft" onClick={() => shiftDay(-1)} aria-label="Dia anterior">{''}</Btn>
            <Btn variant={isToday(date) ? 'primary' : 'ghost'} small onClick={() => setDate(startOfDay(new Date()))}>Hoje</Btn>
            <Btn variant="ghost" small icon="arrowRight" onClick={() => shiftDay(1)} aria-label="Próximo dia">{''}</Btn>
          </div>

          <input
            type="date"
            aria-label="Selecionar data"
            value={date.toISOString().slice(0, 10)}
            onChange={(e) => setDate(startOfDay(new Date(`${e.target.value}T00:00`)))}
            style={{
              height: 30,
              padding: '0 10px',
              borderRadius: T.r.md,
              border: `1px solid ${T.inputBorder}`,
              background: T.inputBg,
              color: T.textPrimary,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 12,
              outline: 'none',
            }}
          />

          <div style={{ minWidth: 220 }}>
            <Select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              aria-label="Filtrar por profissional"
            >
              <option value="all">Todos os profissionais</option>
              {providersQuery.data?.providers?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>

          <span style={{ marginLeft: 'auto' }}>
            <Mono size={9}>{appointments.length} {appointments.length === 1 ? 'AGENDAMENTO' : 'AGENDAMENTOS'}</Mono>
          </span>
        </Glass>
      </div>

      {/* DayGrid container + lateral fila de espera (reference 170px) */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, gap: 12, padding: '0 26px 22px' }}>
        <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          {hasScheduleError ? (
            <Glass style={{ padding: 48, textAlign: 'center' }} role="alert">
              <Mono size={9} color={T.danger}>ERRO AO CARREGAR AGENDA</Mono>
              <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 8 }}>
                {scheduleErrorMessage}
              </p>
              <Btn
                small
                icon="activity"
                style={{ marginTop: 14 }}
                onClick={() => {
                  void providersQuery.refetch();
                  void agendaQuery.refetch();
                }}
              >
                Tentar novamente
              </Btn>
            </Glass>
          ) : isLoadingSchedule ? (
            <Glass style={{ padding: 48, textAlign: 'center' }} role="status" aria-busy="true">
              <Mono size={9} color={T.textMuted}>CARREGANDO AGENDA</Mono>
              <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 8 }}>
                Buscando profissionais e horários do dia.
              </p>
            </Glass>
          ) : providers.length === 0 ? (
            <Glass style={{ padding: 48, textAlign: 'center' }}>
              <Mono size={9} color={T.textMuted}>NENHUM PROFISSIONAL ATIVO</Mono>
              <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 8 }}>
                Cadastre um médico ou enfermeiro para ver a agenda.
              </p>
            </Glass>
          ) : (
            <Glass style={{ padding: 0, overflow: 'hidden' }}>
              <DayGrid
                date={date}
                providers={providers}
                appointments={appointments}
                onCardClick={handleCardClick}
                onEmptyClick={handleEmptyClick}
              />
            </Glass>
          )}
        </div>

        {/* Lateral fila de espera (reference 170px) — mock até Phase 5 ligar `scheduling.queue.list` */}
        <aside
          aria-label="Fila de espera"
          style={{ width: 170, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}
        >
          <Mono size={8} spacing="1.2px">FILA DE ESPERA</Mono>
          {[
            { n: 'Sandra Ramos',   w: '12 min' },
            { n: 'Lucas Teixeira', w: '28 min' },
            { n: 'Beatriz Viana',  w: '41 min' },
          ].map((q) => (
            <Glass key={q.n} style={{ padding: '9px 10px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, marginBottom: 3 }}>{q.n}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Mono size={8}>{q.w}</Mono>
                <Badge variant="warning" dot={false}>Espera</Badge>
              </div>
            </Glass>
          ))}
          <div style={{ marginTop: 'auto' }}>
            <Glass style={{ padding: 10, background: T.primaryBg, border: `1px solid ${T.primaryBorder}` }}>
              <Mono size={8} color={T.primary} spacing="0.8px">PRÓXIMO LIVRE</Mono>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, marginTop: 3 }}>10:00</p>
              <p style={{ fontSize: 10, color: T.textMuted }}>45 min</p>
            </Glass>
          </div>
        </aside>
      </div>

      <AppointmentDetailSheet
        appointment={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMutated={() => { void agendaQuery.refetch(); }}
      />

      <NewAppointmentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        initialDate={date}
        initialProviderId={newSlotProvider ?? (providerFilter !== 'all' ? providerFilter : undefined)}
        initialSlotStart={newSlotStart}
        onCreated={() => { void agendaQuery.refetch(); }}
      />
    </div>
  );
}

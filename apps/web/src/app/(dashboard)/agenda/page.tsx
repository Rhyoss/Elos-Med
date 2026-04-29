'use client';

import * as React from 'react';
import {
  Glass, Btn, Mono, Select, T,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';
import { startOfDay } from '@/lib/agenda-utils';
import { MiniCalendar }      from './_components/mini-calendar';
import { AgendaTimeline }    from './_components/agenda-timeline';
import { AgendaWeekStrip }   from './_components/agenda-week-strip';
import { AgendaQueue, type QueueEntry } from './_components/agenda-queue';
import { DaySummary }        from './_components/day-summary';
import {
  AppointmentDetailSheet,
  type AppointmentCardData,
} from './_components/appointment-detail-sheet';
import { NewAppointmentDialog } from './_components/new-appointment-dialog';

type View = 'dia' | 'semana';

const WDAY_FULL = [
  'Domingo', 'Segunda', 'Terça', 'Quarta',
  'Quinta', 'Sexta', 'Sábado',
];
const MONTH_SHORT = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  // Monday-as-first-day
  const diff = (day + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

function findNextFreeSlot(
  appointments: AppointmentCardData[],
  date: Date,
): { time: string; durationMin: number } | null {
  const now = new Date();
  const sameDay = isSameDay(now, date);
  const startHour = sameDay ? Math.max(7, now.getHours() + 1) : 8;
  for (let h = startHour; h <= 18; h++) {
    const slot = new Date(date);
    slot.setHours(h, 0, 0, 0);
    const conflict = appointments.find((a) => {
      const s = new Date(a.scheduledAt);
      const e = new Date(s.getTime() + (a.durationMin ?? 30) * 60_000);
      return slot >= s && slot < e;
    });
    if (!conflict) {
      return { time: `${h.toString().padStart(2, '0')}:00`, durationMin: 60 };
    }
  }
  return null;
}

export default function AgendaPage() {
  const [view, setView]                   = React.useState<View>('dia');
  const [selDate, setSelDate]             = React.useState<Date>(startOfDay(new Date()));
  const [calMonth, setCalMonth]           = React.useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [providerFilter, setProviderFilter] = React.useState<string>('all');
  const [selected, setSelected]             = React.useState<AppointmentCardData | null>(null);
  const [sheetOpen, setSheetOpen]           = React.useState(false);
  const [newOpen, setNewOpen]               = React.useState(false);
  const [newSlotStart, setNewSlotStart]     = React.useState<Date | undefined>();
  const [newSlotProvider, setNewSlotProvider] = React.useState<string | undefined>();

  const providersQuery = trpc.scheduling.listProviders.useQuery();
  const dayQuery = trpc.scheduling.agendaDay.useQuery({
    date:       selDate,
    providerId: providerFilter === 'all' ? undefined : providerFilter,
  });
  const weekQuery = trpc.scheduling.agendaWeek.useQuery(
    {
      startDate: startOfWeek(selDate),
      providerId: providerFilter === 'all' ? undefined : providerFilter,
    },
    { enabled: view === 'semana' },
  );
  const queueQuery = trpc.scheduling.waitQueue.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  useRealtime(['appointment.created', 'appointment.updated', 'appointment.checked_in'], () => {
    void dayQuery.refetch();
    void queueQuery.refetch();
    if (view === 'semana') void weekQuery.refetch();
  });

  const dayAppointments  = (dayQuery.data?.appointments ?? []) as AppointmentCardData[];
  const weekAppointments = (weekQuery.data?.appointments ?? []) as AppointmentCardData[];

  const queueEntries: QueueEntry[] = (queueQuery.data?.queue ?? []).map((q) => ({
    appointmentId:   q.appointmentId,
    patientName:     q.patientName,
    waitingSinceMin: q.waitingMinutes,
    status:          q.status,
  }));

  /* ── Day-of-month → has-appt set para o MiniCalendar ─────────────────── */
  const apptDays = React.useMemo(() => {
    const set = new Set<number>();
    if (
      calMonth.getFullYear() === selDate.getFullYear() &&
      calMonth.getMonth() === selDate.getMonth() &&
      dayQuery.data?.appointments?.length
    ) {
      // Conhecemos só o dia atual (pegamos via agendaDay). Marca esse dia.
      set.add(selDate.getDate());
    }
    return set;
  }, [calMonth, selDate, dayQuery.data]);

  const weekStart = startOfWeek(selDate);
  const weekCounts: Record<number, number> = React.useMemo(() => {
    const m: Record<number, number> = {};
    for (const a of weekAppointments) {
      const d = new Date(a.scheduledAt);
      const start = startOfWeek(d);
      const idx = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      m[idx] = (m[idx] ?? 0) + 1;
    }
    return m;
  }, [weekAppointments]);

  const dayDow = WDAY_FULL[selDate.getDay()];
  const dateLabel = `${dayDow?.toUpperCase()} · ${selDate.getDate()} ${MONTH_SHORT[selDate.getMonth()]} ${selDate.getFullYear()}`;

  /* ── KPIs ───────────────────────────────────────────────────────────── */
  const total       = dayAppointments.length;
  const confirmados = dayAppointments.filter((a) =>
    a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'in_progress',
  ).length;
  const filaCount   = queueEntries.length;

  function handleMonthChange(delta: number) {
    const next = new Date(calMonth);
    next.setMonth(next.getMonth() + delta);
    setCalMonth(next);
  }

  function handleCardClick(a: AppointmentCardData) {
    setSelected(a);
    setSheetOpen(true);
  }

  function handleEmptyClick(start: Date) {
    setNewSlotProvider(providerFilter !== 'all' ? providerFilter : undefined);
    setNewSlotStart(start);
    setNewOpen(true);
  }

  const nextFree = findNextFreeSlot(dayAppointments, selDate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div
        style={{
          padding: '14px 22px 10px',
          borderBottom: `1px solid ${T.divider}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Mono size={9} spacing="1.2px">{dateLabel}</Mono>
          <p style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, marginTop: 2 }}>
            Agenda Clínica
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { l: 'Hoje',     v: total },
            { l: 'Confirm.', v: confirmados },
            { l: 'Fila',     v: filaCount },
          ].map((k) => (
            <Glass key={k.l} style={{ padding: '5px 10px', textAlign: 'center', borderRadius: T.r.md }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, lineHeight: 1 }}>
                {k.v}
              </p>
              <Mono size={7}>{k.l.toUpperCase()}</Mono>
            </Glass>
          ))}

          <Glass metal style={{ display: 'flex', borderRadius: T.r.md, overflow: 'hidden', padding: 0 }}>
            {(['dia', 'semana'] as View[]).map((v, i) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                style={{
                  padding: '6px 13px',
                  background: view === v ? T.primaryBg : 'transparent',
                  border: 'none',
                  borderRight: i === 0 ? `1px solid ${T.divider}` : 'none',
                  color: view === v ? T.primary : T.textMuted,
                  fontSize: 10,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 500,
                  letterSpacing: '0.6px',
                  cursor: 'pointer',
                }}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </Glass>

          <div style={{ minWidth: 180 }}>
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

          <Btn
            small
            icon="plus"
            onClick={() => {
              setNewSlotStart(undefined);
              setNewSlotProvider(undefined);
              setNewOpen(true);
            }}
          >
            Agendar
          </Btn>
        </div>
      </div>

      {/* Body: Calendar + Timeline + Queue */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Mini calendar sidebar */}
        <div
          style={{
            width: 200,
            borderRight: `1px solid ${T.divider}`,
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            flexShrink: 0,
            overflowY: 'auto',
          }}
        >
          <MiniCalendar
            date={calMonth}
            selected={selDate}
            apptDays={apptDays}
            onDayClick={(d) => setSelDate(startOfDay(d))}
            onMonthChange={handleMonthChange}
          />

          <button
            type="button"
            onClick={() => {
              const today = startOfDay(new Date());
              setSelDate(today);
              const m = new Date(today);
              m.setDate(1);
              setCalMonth(m);
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: T.r.md,
              background: T.primaryBg,
              border: `1px solid ${T.primaryBorder}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <Mono size={9} color={T.primary}>HOJE</Mono>
          </button>

          <DaySummary appointments={dayAppointments} selected={selDate} />
        </div>

        {/* Main timeline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {view === 'semana' && (
            <AgendaWeekStrip
              weekStart={weekStart}
              selected={selDate}
              counts={weekCounts}
              onSelect={(d) => setSelDate(startOfDay(d))}
            />
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px' }}>
            <AgendaTimeline
              appointments={dayAppointments}
              date={selDate}
              onCardClick={handleCardClick}
              onEmptyClick={handleEmptyClick}
            />
          </div>
        </div>

        {/* Queue */}
        <AgendaQueue
          entries={queueEntries}
          nextFree={nextFree}
          onEntryClick={(id) => {
            const ap = dayAppointments.find((a) => a.id === id);
            if (ap) handleCardClick(ap);
          }}
        />
      </div>

      <AppointmentDetailSheet
        appointment={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMutated={() => { void dayQuery.refetch(); void queueQuery.refetch(); }}
      />

      <NewAppointmentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        initialDate={selDate}
        initialProviderId={newSlotProvider ?? (providerFilter !== 'all' ? providerFilter : undefined)}
        initialSlotStart={newSlotStart}
        onCreated={() => { void dayQuery.refetch(); void queueQuery.refetch(); }}
      />
    </div>
  );
}

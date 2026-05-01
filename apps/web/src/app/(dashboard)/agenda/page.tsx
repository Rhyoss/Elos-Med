'use client';

import * as React from 'react';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { cn, useToast } from '@dermaos/ui';
import { Glass, Btn, Ico, Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';
import {
  startOfDay,
  startOfWeek,
  findNextFreeSlot,
  dateFromYOffset,
  viewConfigFor,
  type Density,
} from '@/lib/agenda-utils';

import { AgendaSidebar, type AgendaFilters } from './_components/agenda-sidebar';
import { AgendaDayTimeline } from './_components/agenda-day-timeline';
import { AgendaWeekGrid } from './_components/agenda-week-grid';
import { AgendaMonthGrid } from './_components/agenda-month-grid';
import { AgendaRightPanel, type QueueEntry } from './_components/agenda-right-panel';
import { AppointmentCard } from './_components/appointment-card';
import { AppointmentPopover } from './_components/appointment-popover';
import {
  AppointmentDetailSheet,
  type AppointmentCardData,
} from './_components/appointment-detail-sheet';
import { NewAppointmentDialog } from './_components/new-appointment-dialog';
import { BlockSlotDialog } from './_components/block-slot-dialog';

/* ── Types ───────────────────────────────────────────────────────────────── */

type View = 'dia' | 'semana' | 'mes';

const VIEW_LABELS: Record<View, string> = { dia: 'DIA', semana: 'SEMANA', mes: 'MÊS' };

const DENSITY_LABELS: Record<Density, string> = {
  compact: 'Compacta',
  default: 'Padrão',
  comfortable: 'Confortável',
};

const MONTH_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WDAY_FULL = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AgendaPage() {
  /* ── State ──────────────────────────────────────────────────────────── */
  const [view, setView] = React.useState<View>('dia');
  const [density, setDensity] = React.useState<Density>('default');
  const [selDate, setSelDate] = React.useState<Date>(startOfDay(new Date()));
  const [calMonth, setCalMonth] = React.useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [filters, setFilters] = React.useState<AgendaFilters>({
    providerId: 'all',
    status: 'all',
    type: 'all',
  });

  const [popoverAppt, setPopoverAppt] = React.useState<AppointmentCardData | null>(null);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [popoverPos, setPopoverPos] = React.useState<{ x: number; y: number } | null>(null);
  const [sheetAppt, setSheetAppt] = React.useState<AppointmentCardData | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [newSlotStart, setNewSlotStart] = React.useState<Date | undefined>();
  const [newSlotProvider, setNewSlotProvider] = React.useState<string | undefined>();
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [blockDate, setBlockDate] = React.useState<Date | undefined>();
  const [dragAppt, setDragAppt] = React.useState<AppointmentCardData | null>(null);

  const { toast } = useToast();

  /* ── Data fetching ──────────────────────────────────────────────────── */
  const providerId = filters.providerId === 'all' ? undefined : filters.providerId;
  const providersQuery = trpc.scheduling.listProviders.useQuery();

  const dayQuery = trpc.scheduling.agendaDay.useQuery({
    date: selDate,
    providerId,
  });

  const weekQuery = trpc.scheduling.agendaWeek.useQuery(
    { startDate: startOfWeek(selDate), providerId },
    { enabled: view === 'semana' || view === 'mes' },
  );

  const queueQuery = trpc.scheduling.waitQueue.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const rescheduleMut = trpc.scheduling.reschedule.useMutation();

  useRealtime(
    ['appointment.created', 'appointment.updated', 'appointment.checked_in'],
    () => {
      void dayQuery.refetch();
      void queueQuery.refetch();
      if (view === 'semana' || view === 'mes') void weekQuery.refetch();
    },
  );

  /* ── Derived data ───────────────────────────────────────────────────── */
  const rawDayAppts = (dayQuery.data?.appointments ?? []) as AppointmentCardData[];
  const rawWeekAppts = (weekQuery.data?.appointments ?? []) as AppointmentCardData[];

  const filterAppts = React.useCallback(
    (appts: AppointmentCardData[]) =>
      appts.filter((a) => {
        if (filters.status !== 'all' && a.status !== filters.status) return false;
        if (filters.type !== 'all') {
          const tag = (a.service?.name ?? a.type ?? '').toLowerCase();
          if (!tag.includes(filters.type)) return false;
        }
        return true;
      }),
    [filters],
  );

  const dayAppointments = React.useMemo(() => filterAppts(rawDayAppts), [rawDayAppts, filterAppts]);
  const weekAppointments = React.useMemo(() => filterAppts(rawWeekAppts), [rawWeekAppts, filterAppts]);

  const queueEntries: QueueEntry[] = React.useMemo(
    () =>
      (queueQuery.data?.queue ?? []).map((q) => ({
        appointmentId: q.appointmentId,
        patientName: q.patientName,
        waitingSinceMin: q.waitingMinutes,
        status: q.status,
      })),
    [queueQuery.data],
  );

  const apptDays = React.useMemo(() => {
    const set = new Set<number>();
    if (
      calMonth.getFullYear() === selDate.getFullYear() &&
      calMonth.getMonth() === selDate.getMonth()
    ) {
      for (const a of rawDayAppts) {
        const d = new Date(a.scheduledAt);
        set.add(d.getDate());
      }
    }
    return set;
  }, [calMonth, selDate, rawDayAppts]);

  const nextFree = React.useMemo(
    () => findNextFreeSlot(dayAppointments, selDate),
    [dayAppointments, selDate],
  );

  /* ── Handlers ───────────────────────────────────────────────────────── */
  function handleMonthChange(delta: number) {
    const next = new Date(calMonth);
    next.setMonth(next.getMonth() + delta);
    setCalMonth(next);
  }

  function handleCardClick(a: AppointmentCardData, ev?: React.MouseEvent) {
    setPopoverAppt(a);
    if (ev) {
      const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
      setPopoverPos({ x: rect.right, y: rect.top });
    } else {
      setPopoverPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
    setPopoverOpen(true);
  }

  function handleOpenSheet() {
    setSheetAppt(popoverAppt);
    setPopoverOpen(false);
    setSheetOpen(true);
  }

  function handleEmptyClick(start: Date) {
    setNewSlotProvider(providerId);
    setNewSlotStart(start);
    setNewOpen(true);
  }

  function openNewAppointment() {
    setNewSlotStart(undefined);
    setNewSlotProvider(providerId);
    setNewOpen(true);
  }

  function handleMutated() {
    void dayQuery.refetch();
    void queueQuery.refetch();
    if (view === 'semana' || view === 'mes') void weekQuery.refetch();
  }

  /* ── DnD ────────────────────────────────────────────────────────────── */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function handleDragStart(e: { active: { data: { current?: { appointment?: AppointmentCardData } } } }) {
    const ap = e.active.data.current?.appointment;
    if (ap) setDragAppt(ap);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDragAppt(null);
    const { active, over } = event;
    if (!over || !active.data.current?.appointment) return;

    const ap = active.data.current.appointment as AppointmentCardData;
    const dropId = String(over.id);

    let newDate: Date | null = null;

    if (dropId.startsWith('slot-')) {
      const hhmm = dropId.replace('slot-', '');
      const [hh, mm] = hhmm.split(':').map(Number);
      newDate = new Date(selDate);
      newDate.setHours(hh ?? 0, mm ?? 0, 0, 0);
    } else if (dropId.startsWith('week-')) {
      const parts = dropId.replace('week-', '').split('-');
      const dayIdx = Number(parts[0]);
      const hhmm = parts.slice(1).join(':');
      const [hh, mm] = hhmm.split(':').map(Number);
      const ws = startOfWeek(selDate);
      newDate = new Date(ws);
      newDate.setDate(ws.getDate() + dayIdx);
      newDate.setHours(hh ?? 0, mm ?? 0, 0, 0);
    }

    if (!newDate) return;
    if (newDate.getTime() === new Date(ap.scheduledAt).getTime()) return;

    try {
      await rescheduleMut.mutateAsync({
        id: ap.id,
        newScheduledAt: newDate,
      });
      toast.success('Reagendado', {
        description: `${ap.patient?.name} → ${newDate.getHours().toString().padStart(2, '0')}:${newDate.getMinutes().toString().padStart(2, '0')}`,
      });
      handleMutated();
    } catch (err) {
      toast.error('Conflito ao reagendar', {
        description: err instanceof Error ? err.message : 'Não foi possível reagendar.',
      });
    }
  }

  /* ── Keyboard shortcuts ─────────────────────────────────────────────── */
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          openNewAppointment();
          break;
        case 't':
          e.preventDefault();
          setSelDate(startOfDay(new Date()));
          break;
        case 'd':
          e.preventDefault();
          setView('dia');
          break;
        case 's':
          e.preventDefault();
          setView('semana');
          break;
        case 'm':
          e.preventDefault();
          setView('mes');
          break;
        case 'escape':
          setPopoverOpen(false);
          setSheetOpen(false);
          setNewOpen(false);
          setBlockOpen(false);
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ── Date label ─────────────────────────────────────────────────────── */
  const dateLabel = React.useMemo(() => {
    if (view === 'mes') {
      return `${MONTH_FULL[calMonth.getMonth()]} ${calMonth.getFullYear()}`;
    }
    const dow = WDAY_FULL[selDate.getDay()] ?? '';
    return `${dow}, ${selDate.getDate()} de ${MONTH_FULL[selDate.getMonth()]} ${selDate.getFullYear()}`;
  }, [view, selDate, calMonth]);

  /* ── Navigation ─────────────────────────────────────────────────────── */
  function navigatePrev() {
    if (view === 'dia') {
      const d = new Date(selDate);
      d.setDate(d.getDate() - 1);
      setSelDate(startOfDay(d));
    } else if (view === 'semana') {
      const d = new Date(selDate);
      d.setDate(d.getDate() - 7);
      setSelDate(startOfDay(d));
    } else {
      handleMonthChange(-1);
    }
  }

  function navigateNext() {
    if (view === 'dia') {
      const d = new Date(selDate);
      d.setDate(d.getDate() + 1);
      setSelDate(startOfDay(d));
    } else if (view === 'semana') {
      const d = new Date(selDate);
      d.setDate(d.getDate() + 7);
      setSelDate(startOfDay(d));
    } else {
      handleMonthChange(1);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <header
          className="flex items-center justify-between shrink-0 px-5 py-3"
          style={{ borderBottom: `1px solid ${T.divider}` }}
        >
          {/* Left: date + nav */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={navigatePrev}
                aria-label="Anterior"
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/[0.04]"
              >
                <Ico name="arrowLeft" size={16} color={T.textSecondary} />
              </button>
              <button
                type="button"
                onClick={navigateNext}
                aria-label="Próximo"
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/[0.04]"
              >
                <Ico name="arrowRight" size={16} color={T.textSecondary} />
              </button>
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: T.textPrimary }}>
                {dateLabel}
              </p>
            </div>
          </div>

          {/* Right: view toggle + density + new */}
          <div className="flex items-center gap-2">
            {/* Quick KPIs */}
            {view !== 'mes' && (
              <div className="flex items-center gap-1.5 mr-2">
                {[
                  { l: 'HOJE', v: dayAppointments.length },
                  { l: 'FILA', v: queueEntries.length },
                ].map((k) => (
                  <Glass key={k.l} style={{ padding: '4px 8px', textAlign: 'center', borderRadius: T.r.md }}>
                    <p className="text-sm font-bold leading-none" style={{ color: T.textPrimary }}>
                      {k.v}
                    </p>
                    <Mono size={7}>{k.l}</Mono>
                  </Glass>
                ))}
              </div>
            )}

            {/* View toggle */}
            <Glass metal style={{ display: 'flex', borderRadius: T.r.md, overflow: 'hidden', padding: 0 }}>
              {(['dia', 'semana', 'mes'] as View[]).map((v, i, arr) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className="transition-colors"
                  style={{
                    padding: '5px 12px',
                    background: view === v ? T.primaryBg : 'transparent',
                    borderTop: 'none',
                    borderBottom: 'none',
                    borderLeft: 'none',
                    borderRight: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
                    color: view === v ? T.primary : T.textMuted,
                    fontSize: 10,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 500,
                    letterSpacing: '0.6px',
                    cursor: 'pointer',
                  }}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </Glass>

            {/* Density */}
            {view !== 'mes' && (
              <select
                value={density}
                onChange={(e) => setDensity(e.target.value as Density)}
                aria-label="Densidade"
                className="text-xs cursor-pointer outline-none"
                style={{
                  padding: '5px 8px',
                  borderRadius: T.r.md,
                  background: T.glass,
                  border: `1px solid ${T.glassBorder}`,
                  color: T.textSecondary,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}
              >
                {(['compact', 'default', 'comfortable'] as Density[]).map((d) => (
                  <option key={d} value={d}>{DENSITY_LABELS[d]}</option>
                ))}
              </select>
            )}

            {/* New appointment */}
            <Btn small icon="plus" onClick={openNewAppointment}>
              Agendar
            </Btn>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left sidebar */}
          <AgendaSidebar
            selectedDate={selDate}
            calMonth={calMonth}
            apptDays={apptDays}
            appointments={dayAppointments}
            providers={providersQuery.data?.providers ?? []}
            filters={filters}
            onDateChange={(d) => {
              setSelDate(d);
              const m = new Date(d);
              m.setDate(1);
              setCalMonth(m);
            }}
            onMonthChange={handleMonthChange}
            onFiltersChange={(partial) =>
              setFilters((f) => ({ ...f, ...partial }))
            }
            onNewAppointment={openNewAppointment}
            onBlockSlot={() => setBlockOpen(true)}
          />

          {/* Center: views */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Loading */}
            {(dayQuery.isLoading || (view === 'semana' && weekQuery.isLoading)) && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  <Mono size={10} color={T.textMuted}>CARREGANDO AGENDA…</Mono>
                </div>
              </div>
            )}

            {/* Error */}
            {dayQuery.isError && !dayQuery.isLoading && (
              <div className="flex-1 flex items-center justify-center">
                <div
                  className="flex items-center gap-3 px-5 py-3 rounded-lg"
                  style={{
                    background: 'rgba(154,32,32,0.06)',
                    border: '1px solid rgba(154,32,32,0.18)',
                  }}
                >
                  <Ico name="alert" size={18} color="#9a2020" />
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#9a2020' }}>
                      Erro ao carregar agenda
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>
                      {dayQuery.error?.message ?? 'Verifique sua conexão.'}
                    </p>
                  </div>
                  <Btn variant="ghost" small onClick={() => void dayQuery.refetch()}>
                    Tentar novamente
                  </Btn>
                </div>
              </div>
            )}

            {/* Day view */}
            {!dayQuery.isLoading && !dayQuery.isError && view === 'dia' && (
              <AgendaDayTimeline
                appointments={dayAppointments}
                date={selDate}
                density={density}
                onCardClick={handleCardClick}
                onEmptyClick={handleEmptyClick}
              />
            )}

            {/* Week view */}
            {!weekQuery.isLoading && view === 'semana' && (
              <AgendaWeekGrid
                weekStart={startOfWeek(selDate)}
                appointments={weekAppointments}
                selectedDate={selDate}
                density={density}
                onDaySelect={(d) => setSelDate(startOfDay(d))}
                onCardClick={handleCardClick}
                onEmptyClick={handleEmptyClick}
              />
            )}

            {/* Month view */}
            {view === 'mes' && (
              <AgendaMonthGrid
                year={calMonth.getFullYear()}
                month={calMonth.getMonth()}
                appointments={weekAppointments}
                selectedDate={selDate}
                onDaySelect={(d) => {
                  setSelDate(startOfDay(d));
                  setView('dia');
                }}
                onCardClick={handleCardClick}
              />
            )}
          </main>

          {/* Right panel */}
          {view !== 'mes' && (
            <AgendaRightPanel
              queueEntries={queueEntries}
              appointments={dayAppointments}
              nextFree={nextFree}
              onEntryClick={(id) => {
                const ap = dayAppointments.find((a) => a.id === id);
                if (ap) handleCardClick(ap);
              }}
              onNewAppointment={() => {
                if (nextFree) {
                  setNewSlotStart(nextFree.date);
                  setNewSlotProvider(providerId);
                  setNewOpen(true);
                } else {
                  openNewAppointment();
                }
              }}
            />
          )}
        </div>
      </div>

      {/* ── Drag overlay ───────────────────────────────────────────────── */}
      <DragOverlay>
        {dragAppt && (
          <div className="w-64 opacity-90">
            <AppointmentCard appointment={dragAppt} variant="compact" isDragging />
          </div>
        )}
      </DragOverlay>

      {/* ── Popover (anchor positioned at click coordinates) ───────────── */}
      {popoverAppt && (
        <AppointmentPopover
          appointment={popoverAppt}
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          onMutated={handleMutated}
          onOpenSheet={handleOpenSheet}
          onReschedule={() => {
            setSheetAppt(popoverAppt);
            setSheetOpen(true);
          }}
          onCancel={() => {
            setSheetAppt(popoverAppt);
            setSheetOpen(true);
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'fixed',
              left: popoverPos?.x ?? 0,
              top: popoverPos?.y ?? 0,
              width: 0,
              height: 0,
              pointerEvents: 'none',
            }}
          />
        </AppointmentPopover>
      )}

      {/* ── Detail sheet ───────────────────────────────────────────────── */}
      <AppointmentDetailSheet
        appointment={sheetAppt}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMutated={handleMutated}
      />

      {/* ── New appointment wizard ─────────────────────────────────────── */}
      <NewAppointmentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        initialDate={selDate}
        initialProviderId={newSlotProvider ?? (providerId ?? undefined)}
        initialSlotStart={newSlotStart}
        onCreated={handleMutated}
      />

      {/* ── Block slot dialog ──────────────────────────────────────────── */}
      <BlockSlotDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        initialDate={blockDate ?? selDate}
      />
    </DndContext>
  );
}

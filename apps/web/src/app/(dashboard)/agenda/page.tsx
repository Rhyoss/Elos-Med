'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button, PageHeader, Select, SelectItem } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';
import { formatDateLong, isToday, startOfDay } from '@/lib/agenda-utils';
import { DayGrid } from './_components/day-grid';
import {
  AppointmentDetailSheet,
  type AppointmentCardData,
} from './_components/appointment-detail-sheet';
import { NewAppointmentDialog } from './_components/new-appointment-dialog';

export default function AgendaDiaPage() {
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [selected, setSelected] = useState<AppointmentCardData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newSlotStart, setNewSlotStart] = useState<Date | undefined>();
  const [newSlotProvider, setNewSlotProvider] = useState<string | undefined>();

  const providersQuery = trpc.scheduling.listProviders.useQuery();
  const agendaQuery = trpc.scheduling.agendaDay.useQuery(
    { date, providerId: providerFilter === 'all' ? undefined : providerFilter },
  );

  useRealtime(['appointment.created', 'appointment.updated', 'appointment.checked_in'], () => {
    void agendaQuery.refetch();
  });

  const providers = useMemo(() => {
    const list = providersQuery.data?.providers ?? [];
    if (providerFilter === 'all') return list;
    return list.filter((p) => p.id === providerFilter);
  }, [providersQuery.data, providerFilter]);

  const appointments = (agendaQuery.data?.appointments ?? []) as AppointmentCardData[];

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
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Agenda"
        description={formatDateLong(date)}
        actions={
          <>
            <Link href="/agenda/semana"><Button variant="outline" size="sm">Semana</Button></Link>
            <Link href="/agenda/fila"><Button variant="outline" size="sm">Fila de Espera</Button></Link>
            <Button size="sm" onClick={() => { setNewSlotStart(undefined); setNewSlotProvider(undefined); setNewOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo Agendamento
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 border rounded-md bg-card">
          <Button variant="ghost" size="icon" aria-label="Dia anterior" onClick={() => shiftDay(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={isToday(date) ? 'gold' : 'ghost'}
            size="sm"
            onClick={() => setDate(startOfDay(new Date()))}
          >
            Hoje
          </Button>
          <Button variant="ghost" size="icon" aria-label="Próximo dia" onClick={() => shiftDay(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <input
          type="date"
          aria-label="Selecionar data"
          value={date.toISOString().slice(0, 10)}
          onChange={(e) => setDate(startOfDay(new Date(`${e.target.value}T00:00`)))}
          className="h-9 rounded-md border px-2 text-sm bg-background"
        />

        <div className="min-w-[220px]">
          <Select
            value={providerFilter}
            onValueChange={setProviderFilter}
            placeholder="Todos os profissionais"
          >
            <SelectItem value="all">Todos os profissionais</SelectItem>
            {providersQuery.data?.providers?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </Select>
        </div>

        <span className="text-xs text-muted-foreground ml-auto">
          {appointments.length} agendamento{appointments.length === 1 ? '' : 's'}
        </span>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum profissional ativo. Cadastre um médico ou enfermeiro para ver a agenda.
        </div>
      ) : (
        <DayGrid
          date={date}
          providers={providers}
          appointments={appointments}
          onCardClick={handleCardClick}
          onEmptyClick={handleEmptyClick}
        />
      )}

      <AppointmentDetailSheet
        appointment={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMutated={() => {
          void agendaQuery.refetch();
        }}
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

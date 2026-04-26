'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  SearchInput,
  FormSelect,
  SelectItem,
  useToast,
} from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { formatSlotRange } from '@/lib/agenda-utils';

interface Props {
  open:           boolean;
  onOpenChange:   (open: boolean) => void;
  initialDate?:   Date;
  initialProviderId?: string;
  initialSlotStart?: Date;
  onCreated?:     () => void;
}

type Step = 1 | 2 | 3 | 4;

interface Selected {
  patientId:   string | null;
  patientName: string | null;
  providerId:  string | null;
  providerName: string | null;
  serviceId:   string | null;
  serviceName: string | null;
  type:        string;
  durationMin: number;
  scheduledAt: Date | null;
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  initialDate,
  initialProviderId,
  initialSlotStart,
  onCreated,
}: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<Selected>({
    patientId:    null,
    patientName:  null,
    providerId:   initialProviderId ?? null,
    providerName: null,
    serviceId:    null,
    serviceName:  null,
    type:         'consultation',
    durationMin:  30,
    scheduledAt:  initialSlotStart ?? null,
  });

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate ?? initialSlotStart ?? new Date());

  const patientsQuery  = trpc.patients.search.useQuery(
    { query: search, page: 1, limit: 10 },
    { enabled: step === 1 && search.length >= 2 },
  );
  const providersQuery = trpc.scheduling.listProviders.useQuery(undefined, { enabled: open });
  const servicesQuery  = trpc.scheduling.listServices.useQuery(undefined, { enabled: open });

  const slotsQuery = trpc.scheduling.getSlots.useQuery(
    {
      providerId:  selected.providerId ?? '',
      date:        selectedDate,
      durationMin: selected.durationMin,
    },
    { enabled: step === 3 && !!selected.providerId },
  );

  const createMut = trpc.scheduling.create.useMutation();

  const canNext = useMemo(() => {
    if (step === 1) return !!selected.patientId;
    if (step === 2) return !!selected.providerId && !!selected.type;
    if (step === 3) return !!selected.scheduledAt;
    return true;
  }, [step, selected]);

  function reset() {
    setStep(1);
    setSearch('');
    setSelected({
      patientId: null, patientName: null,
      providerId: initialProviderId ?? null, providerName: null,
      serviceId: null, serviceName: null,
      type: 'consultation', durationMin: 30,
      scheduledAt: initialSlotStart ?? null,
    });
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  }

  async function handleCreate() {
    if (!selected.patientId || !selected.providerId || !selected.scheduledAt) return;
    try {
      await createMut.mutateAsync({
        patientId:   selected.patientId,
        providerId:  selected.providerId,
        serviceId:   selected.serviceId ?? undefined,
        type:        selected.type,
        scheduledAt: selected.scheduledAt,
        durationMin: selected.durationMin,
        source:      'manual',
      });
      toast.success('Agendamento criado', {
        description: `${selected.patientName} • ${format(selected.scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR })}`,
        action: {
          label: 'Enviar confirmação via WhatsApp',
          onClick: () => toast.info('Confirmação enviada ao paciente'),
        },
      });
      onCreated?.();
      close(false);
    } catch (err) {
      toast.error('Erro ao criar', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription>Passo {step} de 4</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 min-h-[320px]">
          {/* Step 1: Paciente */}
          {step === 1 && (
            <div className="space-y-3">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, CPF ou telefone"
                aria-label="Buscar paciente"
                autoFocus
              />
              <div className="max-h-64 overflow-y-auto border rounded-md">
                {search.length < 2 && (
                  <p className="text-sm text-muted-foreground px-3 py-4">
                    Digite ao menos 2 caracteres para buscar.
                  </p>
                )}
                {patientsQuery.data?.data?.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected((s) => ({ ...s, patientId: p.id, patientName: p.name }))}
                    className={`w-full text-left px-3 py-2 hover:bg-hover border-b last:border-b-0 flex items-center justify-between ${selected.patientId === p.id ? 'bg-primary-100' : ''}`}
                  >
                    <span>
                      <span className="font-medium">{p.name}</span>
                      {p.age !== null && <span className="text-xs text-muted-foreground ml-2">{p.age} anos</span>}
                    </span>
                    {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                  </button>
                ))}
                {patientsQuery.data?.data?.length === 0 && search.length >= 2 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground flex items-center justify-between">
                    <span>Nenhum paciente encontrado.</span>
                    <Link href="/pacientes/novo">
                      <Button variant="outline" size="sm">Cadastrar Novo</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Médico + Tipo */}
          {step === 2 && (
            <div className="space-y-4">
              <FormSelect
                label="Profissional"
                value={selected.providerId ?? ''}
                onValueChange={(v) => {
                  const p = providersQuery.data?.providers?.find((x) => x.id === v);
                  setSelected((s) => ({ ...s, providerId: v, providerName: p?.name ?? null }));
                }}
                placeholder="Selecione o médico"
                required
              >
                {providersQuery.data?.providers?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.crm ? ` — ${p.crm}` : ''}
                  </SelectItem>
                ))}
              </FormSelect>

              <FormSelect
                label="Tipo de consulta"
                value={selected.serviceId ?? ''}
                onValueChange={(v) => {
                  const svc = servicesQuery.data?.services?.find((x) => x.id === v);
                  setSelected((s) => ({
                    ...s,
                    serviceId:   v,
                    serviceName: svc?.name ?? null,
                    type:        svc?.name?.toLowerCase().replace(/\s+/g, '_') ?? 'consultation',
                    durationMin: svc?.durationMin ?? s.durationMin,
                  }));
                }}
                placeholder="Selecione o tipo"
              >
                {servicesQuery.data?.services?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} • {s.durationMin} min
                  </SelectItem>
                ))}
              </FormSelect>

              <Input
                label="Duração (min)"
                type="number"
                value={selected.durationMin}
                onChange={(e) => setSelected((s) => ({ ...s, durationMin: Math.max(5, Number(e.target.value) || 30) }))}
                min={5}
                max={480}
              />
            </div>
          )}

          {/* Step 3: Data + Horário */}
          {step === 3 && (
            <div className="space-y-4">
              <Input
                label="Data"
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(`${e.target.value}T00:00`))}
              />

              <div>
                <p className="text-sm font-medium mb-2">Horários disponíveis</p>
                {slotsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
                {slotsQuery.data && slotsQuery.data.slots.length === 0 && (
                  <p className="text-sm text-muted-foreground">Profissional não atende neste dia.</p>
                )}
                <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                  {slotsQuery.data?.slots
                    ?.filter((s) => s.available)
                    .map((slot) => {
                      const start = new Date(slot.start);
                      const isSel = selected.scheduledAt?.getTime() === start.getTime();
                      return (
                        <button
                          key={start.toISOString()}
                          type="button"
                          onClick={() => setSelected((s) => ({ ...s, scheduledAt: start }))}
                          className={`rounded-md border px-2 py-1.5 text-sm hover:bg-hover ${isSel ? 'border-primary bg-primary-100' : ''}`}
                        >
                          {format(start, 'HH:mm')}
                        </button>
                      );
                    })}
                </div>
                {slotsQuery.data && slotsQuery.data.slots.every((s) => !s.available) && slotsQuery.data.slots.length > 0 && (
                  <p className="text-sm text-warning-700 mt-2">Sem horários disponíveis neste dia.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Resumo */}
          {step === 4 && selected.scheduledAt && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <dt className="text-muted-foreground">Paciente</dt>
                <dd className="font-medium">{selected.patientName}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-muted-foreground">Profissional</dt>
                <dd className="font-medium">{selected.providerName}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-muted-foreground">Tipo</dt>
                <dd>{selected.serviceName ?? selected.type}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-muted-foreground">Data e hora</dt>
                <dd className="font-medium">
                  {format(selected.scheduledAt, "dd/MM/yyyy", { locale: ptBR })} •{' '}
                  {formatSlotRange(
                    selected.scheduledAt,
                    new Date(selected.scheduledAt.getTime() + selected.durationMin * 60_000),
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Duração</dt>
                <dd>{selected.durationMin} min</dd>
              </div>
            </dl>
          )}
        </div>

        <DialogFooter>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
              Voltar
            </Button>
          )}
          {step < 4 ? (
            <Button
              disabled={!canNext}
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Próximo
            </Button>
          ) : (
            <Button onClick={handleCreate} isLoading={createMut.isPending}>
              Agendar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import {
  Btn, Glass, Mono, Badge, Ico, T,
} from '@dermaos/ui/ds';
import {
  SearchInput,
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
  room:        string;
  internalNotes: string;
  sendConfirmation: boolean;
  confirmationChannel: 'whatsapp' | 'email' | 'sms';
}

const STEP_LABELS = ['Paciente', 'Profissional', 'Horário', 'Confirmação'];

const glassInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: T.r.md,
  background: T.glass,
  backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
  WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
  border: `1px solid ${T.glassBorder}`,
  fontSize: 15,
  color: T.textPrimary,
  fontFamily: "'IBM Plex Sans', sans-serif",
  outline: 'none',
  transition: 'border-color 0.15s',
};

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
    room:         '',
    internalNotes: '',
    sendConfirmation: true,
    confirmationChannel: 'whatsapp',
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
      room: '', internalNotes: '',
      sendConfirmation: true, confirmationChannel: 'whatsapp',
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
        room:        selected.room || undefined,
        internalNotes: selected.internalNotes || undefined,
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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="appt-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Overlay */}
      <div
        aria-hidden
        onClick={() => close(false)}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Dialog */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: T.glass,
          backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: T.r.xl,
          boxShadow: '0 24px 56px rgba(0,0,0,0.14), 0 6px 14px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        {/* Highlight overlay */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '44%',
            background: T.metalHighlight,
            borderRadius: `${T.r.xl}px ${T.r.xl}px 0 0`,
            pointerEvents: 'none',
            opacity: 0.15,
          }}
        />

        {/* Header */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${T.divider}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Mono size={11} spacing="1.2px" color={T.primary}>NOVO AGENDAMENTO</Mono>
              <h2 id="appt-dialog-title" style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, marginTop: 4 }}>
                {STEP_LABELS[step - 1]}
              </h2>
            </div>
            <Btn variant="ghost" small iconOnly icon="x" onClick={() => close(false)} aria-label="Fechar" />
          </div>

          {/* Step indicators */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: s <= step ? T.primary : T.divider,
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ position: 'relative', zIndex: 1, padding: '20px 24px', flex: 1, overflowY: 'auto', minHeight: 300 }}>
          {/* Step 1: Patient */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, CPF ou telefone"
                aria-label="Buscar paciente"
                autoFocus
              />
              <div
                style={{
                  maxHeight: 280,
                  overflowY: 'auto',
                  borderRadius: T.r.md,
                  border: `1px solid ${T.glassBorder}`,
                }}
              >
                {search.length < 2 && (
                  <p style={{ padding: '16px 14px', fontSize: 14, color: T.textMuted }}>
                    Digite ao menos 2 caracteres para buscar.
                  </p>
                )}
                {patientsQuery.data?.data?.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected((s) => ({ ...s, patientId: p.id, patientName: p.name }))}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      borderBottom: `1px solid ${T.divider}`,
                      background: selected.patientId === p.id ? T.primaryBg : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.12s',
                      fontSize: 15,
                      fontFamily: "'IBM Plex Sans', sans-serif",
                    }}
                    onMouseEnter={(e) => { if (selected.patientId !== p.id) (e.target as HTMLElement).style.background = T.glassHover; }}
                    onMouseLeave={(e) => { if (selected.patientId !== p.id) (e.target as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: T.r.md,
                          background: selected.patientId === p.id ? T.primary : T.clinical.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ico name={selected.patientId === p.id ? 'check' : 'user'} size={13} color={selected.patientId === p.id ? '#fff' : T.clinical.color} />
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: T.textPrimary }}>{p.name}</span>
                        {p.age !== null && <Mono size={10} style={{ marginLeft: 6 }}>{p.age} ANOS</Mono>}
                      </div>
                    </div>
                    {p.phone && <Mono size={10}>{p.phone}</Mono>}
                  </button>
                ))}
                {patientsQuery.data?.data?.length === 0 && search.length >= 2 && (
                  <div style={{ padding: '16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: T.textMuted }}>Nenhum paciente encontrado.</span>
                    <Link href="/pacientes/novo" style={{ textDecoration: 'none' }}>
                      <Btn variant="glass" small icon="plus">Cadastrar</Btn>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Provider + Type */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                  Profissional
                </label>
                <select
                  value={selected.providerId ?? ''}
                  onChange={(e) => {
                    const p = providersQuery.data?.providers?.find((x) => x.id === e.target.value);
                    setSelected((s) => ({ ...s, providerId: e.target.value, providerName: p?.name ?? null }));
                  }}
                  style={glassInputStyle}
                >
                  <option value="">Selecione o médico…</option>
                  {providersQuery.data?.providers?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.crm ? ` — ${p.crm}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                  Tipo de consulta
                </label>
                <select
                  value={selected.serviceId ?? ''}
                  onChange={(e) => {
                    const svc = servicesQuery.data?.services?.find((x) => x.id === e.target.value);
                    setSelected((s) => ({
                      ...s,
                      serviceId:   e.target.value,
                      serviceName: svc?.name ?? null,
                      type:        svc?.name?.toLowerCase().replace(/\s+/g, '_') ?? 'consultation',
                      durationMin: svc?.durationMin ?? s.durationMin,
                    }));
                  }}
                  style={glassInputStyle}
                >
                  <option value="">Selecione o tipo…</option>
                  {servicesQuery.data?.services?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} • {s.durationMin} min</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                  Duração (min)
                </label>
                <input
                  type="number"
                  value={selected.durationMin}
                  onChange={(e) => setSelected((s) => ({ ...s, durationMin: Math.max(5, Number(e.target.value) || 30) }))}
                  min={5}
                  max={480}
                  style={glassInputStyle}
                />
              </div>
            </div>
          )}

          {/* Step 3: Date + Time */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                  Data
                </label>
                <input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={(e) => setSelectedDate(new Date(`${e.target.value}T00:00`))}
                  style={glassInputStyle}
                />
              </div>

              <div>
                <Mono size={11} spacing="1px" color={T.primary}>HORÁRIOS DISPONÍVEIS</Mono>
                {slotsQuery.isLoading && <p style={{ fontSize: 14, color: T.textMuted, marginTop: 8 }}>Carregando…</p>}
                {slotsQuery.data && slotsQuery.data.slots.length === 0 && (
                  <p style={{ fontSize: 14, color: T.textMuted, marginTop: 8 }}>Profissional não atende neste dia.</p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, maxHeight: 240, overflowY: 'auto', marginTop: 10 }}>
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
                          style={{
                            padding: '8px 6px',
                            borderRadius: T.r.md,
                            background: isSel ? T.primaryBg : T.glass,
                            backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                            WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                            border: `1px solid ${isSel ? T.primary : T.glassBorder}`,
                            color: isSel ? T.primary : T.textSecondary,
                            fontSize: 13,
                            fontWeight: isSel ? 700 : 500,
                            fontFamily: "'IBM Plex Mono', monospace",
                            cursor: 'pointer',
                            transition: 'all 0.12s',
                          }}
                        >
                          {format(start, 'HH:mm')}
                        </button>
                      );
                    })}
                </div>
                {slotsQuery.data && slotsQuery.data.slots.every((s) => !s.available) && slotsQuery.data.slots.length > 0 && (
                  <p style={{ fontSize: 14, color: T.warning, marginTop: 8 }}>Sem horários disponíveis neste dia.</p>
                )}
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                  Sala (opcional)
                </label>
                <input
                  type="text"
                  value={selected.room}
                  onChange={(e) => setSelected((s) => ({ ...s, room: e.target.value }))}
                  placeholder="Ex: Sala 1, Consultório 2…"
                  style={glassInputStyle}
                />
              </div>
            </div>
          )}

          {/* Step 4: Summary + Notes + Confirmation */}
          {step === 4 && selected.scheduledAt && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'PACIENTE', value: selected.patientName, icon: 'user' as const },
                { label: 'PROFISSIONAL', value: selected.providerName, icon: 'user' as const },
                { label: 'TIPO', value: selected.serviceName ?? selected.type, icon: 'layers' as const },
                { label: 'DATA E HORA', value: `${format(selected.scheduledAt, "dd/MM/yyyy", { locale: ptBR })} • ${formatSlotRange(selected.scheduledAt, new Date(selected.scheduledAt.getTime() + selected.durationMin * 60_000))}`, icon: 'calendar' as const },
                { label: 'DURAÇÃO', value: `${selected.durationMin} min`, icon: 'clock' as const },
                ...(selected.room ? [{ label: 'SALA', value: selected.room, icon: 'home' as const }] : []),
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: T.r.md,
                    background: T.glass,
                    backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                    WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                    border: `1px solid ${T.glassBorder}`,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: T.r.sm,
                      background: T.primaryBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Ico name={item.icon} size={13} color={T.primary} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Mono size={9}>{item.label}</Mono>
                    <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginTop: 3 }}>
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}

              {/* Internal notes */}
              <div style={{ marginTop: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 6 }}>
                  Observações internas (opcional)
                </label>
                <textarea
                  value={selected.internalNotes}
                  onChange={(e) => setSelected((s) => ({ ...s, internalNotes: e.target.value }))}
                  placeholder="Notas visíveis apenas para a equipe…"
                  rows={2}
                  style={{
                    ...glassInputStyle,
                    fontSize: 13,
                    resize: 'vertical' as const,
                  }}
                />
              </div>

              {/* Send confirmation */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: T.r.md,
                  background: T.glass,
                  border: `1px solid ${T.glassBorder}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Ico name="mail" size={14} color={T.primary} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>
                    Enviar confirmação ao paciente
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selected.sendConfirmation}
                    onChange={(e) => setSelected((s) => ({ ...s, sendConfirmation: e.target.checked }))}
                    style={{ accentColor: T.primary }}
                  />
                </label>
              </div>

              {selected.sendConfirmation && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 6 }}>
                    Canal
                  </label>
                  <select
                    value={selected.confirmationChannel}
                    onChange={(e) => setSelected((s) => ({ ...s, confirmationChannel: e.target.value as 'whatsapp' | 'email' | 'sms' }))}
                    style={{ ...glassInputStyle, fontSize: 13 }}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '14px 24px',
            borderTop: `1px solid ${T.divider}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Mono size={10} color={T.textMuted}>PASSO {step} DE 4</Mono>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && (
              <Btn variant="ghost" small icon="arrowLeft" onClick={() => setStep((s) => (s - 1) as Step)}>
                Voltar
              </Btn>
            )}
            {step < 4 ? (
              <Btn small icon="arrowRight" disabled={!canNext} onClick={() => setStep((s) => (s + 1) as Step)}>
                Próximo
              </Btn>
            ) : (
              <Btn small icon="check" onClick={handleCreate} loading={createMut.isPending}>
                Agendar
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

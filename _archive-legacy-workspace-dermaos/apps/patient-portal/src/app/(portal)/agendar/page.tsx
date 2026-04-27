'use client';
import { useEffect, useState, useCallback } from 'react';
import { format, addDays, isBefore, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { portalAppointments } from '@/lib/api-client';
import { CardSkeleton } from '@/components/ui/skeleton';

type Step = 'provider' | 'date' | 'slot' | 'confirm' | 'done';

type Provider  = { id: string; name: string; specialty: string | null };
type SlotItem  = { start: string; end: string };

export default function AgendarPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('provider');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdExpires, setHoldExpires] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Carregar profissionais
  useEffect(() => {
    setLoading(true);
    portalAppointments.providers().then((res) => {
      setLoading(false);
      if (res.ok && res.data) setProviders(res.data.providers);
    });
  }, []);

  // Gerar próximos 30 dias para seleção
  const today = startOfToday();
  const futureDates = Array.from({ length: 30 }, (_, i) => addDays(today, i));

  // Carregar slots ao selecionar data/profissional
  const loadSlots = useCallback(async (providerId: string, date: string) => {
    setLoading(true);
    setSlots([]);
    const res = await portalAppointments.slots({ providerId, date });
    setLoading(false);
    if (res.ok && res.data) setSlots(res.data.slots);
  }, []);

  const handleProviderSelect = (p: Provider) => {
    setSelectedProvider(p);
    setStep('date');
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    if (selectedProvider) {
      loadSlots(selectedProvider.id, date);
    }
    setStep('slot');
  };

  const handleSlotSelect = async (slot: SlotItem) => {
    if (!selectedProvider) return;
    setError('');
    setLoading(true);
    setSelectedSlot(slot);

    const res = await portalAppointments.createHold({
      providerId:  selectedProvider.id,
      scheduledAt: slot.start,
    });
    setLoading(false);

    if (!res.ok) {
      setError(res.error ?? 'Horário não disponível. Tente outro.');
      setSelectedSlot(null);
      return;
    }

    setHoldId(res.data!.holdId);
    setHoldExpires(new Date(res.data!.expiresAt));
    setStep('confirm');
  };

  const handleBook = async () => {
    if (!holdId) return;
    setError('');
    setLoading(true);

    const res = await portalAppointments.book({ holdId, notes: notes || undefined });
    setLoading(false);

    if (res.ok) {
      setSuccess(true);
      setStep('done');
    } else {
      setError(res.error ?? 'Erro ao confirmar. Por favor, tente novamente.');
      // Se conflito, volta para slots
      if ((res as any).status === 409) {
        setHoldId(null);
        setSelectedSlot(null);
        setStep('slot');
        loadSlots(selectedProvider!.id, selectedDate);
      }
    }
  };

  // Limpar hold ao sair sem confirmar
  useEffect(() => {
    return () => {
      if (holdId) portalAppointments.deleteHold(holdId).catch(() => {});
    };
  }, [holdId]);

  if (step === 'done') {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
          Consulta agendada!
        </h1>
        <p style={{ color: '#525252', marginBottom: '8px' }}>
          {selectedProvider?.name}
        </p>
        <p style={{ fontSize: '18px', fontWeight: 600, color: '#b8860b', marginBottom: '24px' }}>
          {selectedSlot && format(new Date(selectedSlot.start), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
        </p>
        <p style={{ fontSize: '14px', color: '#737373', marginBottom: '24px' }}>
          Você receberá um lembrete antes da consulta.
        </p>
        <button onClick={() => router.push('/consultas')} style={primaryBtn}>
          Ver minhas consultas
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px', color: '#171717' }}>
        Agendar consulta
      </h1>

      {/* Breadcrumb de progresso */}
      <StepIndicator
        steps={['Profissional', 'Data', 'Horário', 'Confirmar']}
        current={['provider', 'date', 'slot', 'confirm'].indexOf(step)}
      />

      {error && (
        <div role="alert" style={alertStyle}>{error}</div>
      )}

      {/* Step 1: Profissional */}
      {step === 'provider' && (
        <div>
          <h2 style={stepTitle}>Escolha o profissional</h2>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <CardSkeleton /><CardSkeleton />
            </div>
          ) : providers.length === 0 ? (
            <p style={{ color: '#737373', textAlign: 'center', padding: '40px 0' }}>
              Nenhum profissional disponível para agendamento online.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderSelect(p)}
                  style={providerCard}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    backgroundColor: '#f3dd99', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#b8860b' }}>
                      {p.name.charAt(0)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '2px' }}>
                      {p.name}
                    </p>
                    {p.specialty && (
                      <p style={{ fontSize: '13px', color: '#737373' }}>{p.specialty}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Data */}
      {step === 'date' && (
        <div>
          <button onClick={() => setStep('provider')} style={backBtn}>← Voltar</button>
          <h2 style={stepTitle}>Escolha a data</h2>
          <div
            className="scroll-hidden"
            style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}
          >
            {futureDates.map((d) => {
              const iso = format(d, 'yyyy-MM-dd');
              const isSelected = iso === selectedDate;
              return (
                <button
                  key={iso}
                  onClick={() => handleDateSelect(iso)}
                  aria-pressed={isSelected}
                  style={{
                    display:         'flex',
                    flexDirection:   'column',
                    alignItems:      'center',
                    padding:         '10px 12px',
                    borderRadius:    '12px',
                    border:          `1.5px solid ${isSelected ? '#b8860b' : '#e5e5e5'}`,
                    backgroundColor: isSelected ? '#b8860b' : '#ffffff',
                    color:           isSelected ? '#ffffff' : '#171717',
                    cursor:          'pointer',
                    minWidth:        '56px',
                    minHeight:       '70px',
                    flexShrink:      0,
                    gap:             '2px',
                  }}
                >
                  <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                    {format(d, 'EEE', { locale: ptBR }).slice(0, 3)}
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 700 }}>{format(d, 'd')}</span>
                  <span style={{ fontSize: '11px' }}>{format(d, 'MMM', { locale: ptBR })}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Horário */}
      {step === 'slot' && (
        <div>
          <button onClick={() => setStep('date')} style={backBtn}>← Voltar</button>
          <h2 style={stepTitle}>
            Horários disponíveis — {selectedDate && format(new Date(selectedDate + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR })}
          </h2>
          {loading ? (
            <CardSkeleton />
          ) : slots.length === 0 ? (
            <p style={{ color: '#737373', textAlign: 'center', padding: '40px 0' }}>
              Nenhum horário disponível nesta data. Tente outra data.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {slots.map((s) => (
                <button
                  key={s.start}
                  onClick={() => handleSlotSelect(s)}
                  disabled={loading}
                  style={{
                    padding:         '10px 16px',
                    borderRadius:    '10px',
                    border:          '1.5px solid #e5e5e5',
                    backgroundColor: '#ffffff',
                    color:           '#171717',
                    cursor:          loading ? 'not-allowed' : 'pointer',
                    fontSize:        '15px',
                    fontWeight:      500,
                    minHeight:       '44px',
                  }}
                >
                  {format(new Date(s.start), 'HH:mm')}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Confirmar */}
      {step === 'confirm' && selectedSlot && selectedProvider && (
        <div>
          <button
            onClick={() => {
              if (holdId) portalAppointments.deleteHold(holdId).catch(() => {});
              setHoldId(null);
              setStep('slot');
            }}
            style={backBtn}
          >
            ← Voltar
          </button>
          <h2 style={stepTitle}>Confirmar agendamento</h2>

          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <Row label="Profissional" value={selectedProvider.name} />
            <Row
              label="Data e hora"
              value={format(new Date(selectedSlot.start), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            />
            {holdExpires && (
              <p style={{ fontSize: '12px', color: '#737373', marginTop: '8px' }}>
                Reserva expira às {format(holdExpires, 'HH:mm:ss')}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="notes" style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
              Observações (opcional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Informe o motivo da consulta ou outras observações..."
              style={{
                width:        '100%',
                minHeight:    '80px',
                padding:      '12px',
                fontSize:     '15px',
                borderRadius: '10px',
                border:       '1.5px solid #d4d4d4',
                resize:       'vertical',
                outline:      'none',
              }}
            />
          </div>

          <button onClick={handleBook} disabled={loading} style={primaryBtn}>
            {loading ? 'Confirmando...' : 'Confirmar agendamento'}
          </button>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div
      role="navigation"
      aria-label="Etapas do agendamento"
      style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}
    >
      {steps.map((s, i) => (
        <div
          key={s}
          style={{
            flex:            1,
            height:          '4px',
            borderRadius:    '2px',
            backgroundColor: i <= current ? '#b8860b' : '#e5e5e5',
            transition:      'background-color 0.3s',
          }}
          aria-label={`Etapa ${i + 1}: ${s}${i === current ? ' (atual)' : i < current ? ' (concluída)' : ''}`}
        />
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
      <span style={{ fontSize: '14px', color: '#737373' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>{value}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f5f5f5',
};

const stepTitle: React.CSSProperties = {
  fontSize: '17px', fontWeight: 600, color: '#171717', marginBottom: '16px',
};

const primaryBtn: React.CSSProperties = {
  width: '100%', height: '52px', backgroundColor: '#b8860b', color: '#ffffff',
  border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
};

const backBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#737373', fontSize: '14px',
  cursor: 'pointer', marginBottom: '16px', padding: '0', minHeight: '44px',
};

const providerCard: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '14px', padding: '16px',
  backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #e5e5e5',
  cursor: 'pointer', textAlign: 'left', minHeight: '72px', width: '100%',
};

const alertStyle: React.CSSProperties = {
  marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fef2f2',
  border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '14px',
};

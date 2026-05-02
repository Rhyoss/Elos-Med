'use client';

import * as React from 'react';
import {
  Glass, Btn, Mono, Ico, Field, Input, Select, Skeleton, Toggle, T,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useAuth } from '@/lib/auth';

const DAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface BusinessHour {
  day_of_week: number;
  is_open: boolean;
  shifts: Array<{ start: string; end: string }>;
}

export function SectionClinica() {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'owner' || user?.role === 'admin';

  const clinicQuery = trpc.settings.clinic.get.useQuery(undefined, { staleTime: 60_000 });
  const hoursQuery = trpc.settings.clinic.getBusinessHours.useQuery(undefined, { staleTime: 60_000 });

  const updateClinic = trpc.settings.clinic.update.useMutation({
    onSuccess: () => {
      void clinicQuery.refetch();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    },
    onError: (err) => {
      setSaveStatus('error');
      setErrorMsg(err.message);
    },
  });

  const updateHours = trpc.settings.clinic.updateBusinessHours.useMutation({
    onSuccess: () => {
      void hoursQuery.refetch();
      setHoursSaveStatus('success');
      setTimeout(() => setHoursSaveStatus(null), 3000);
    },
    onError: (err) => {
      setHoursSaveStatus('error');
      setHoursErrorMsg(err.message);
    },
  });

  const [saveStatus, setSaveStatus] = React.useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [hoursSaveStatus, setHoursSaveStatus] = React.useState<'success' | 'error' | null>(null);
  const [hoursErrorMsg, setHoursErrorMsg] = React.useState('');

  const [form, setForm] = React.useState({
    name: '', email: '', phone: '', cnpj: '', cnes: '',
    dpo_name: '', dpo_email: '',
    street: '', number: '', complement: '', district: '', city: '', state: '', zip: '',
  });
  const [formDirty, setFormDirty] = React.useState(false);

  const [hours, setHours] = React.useState<BusinessHour[]>([]);
  const [hoursDirty, setHoursDirty] = React.useState(false);

  React.useEffect(() => {
    if (clinicQuery.data) {
      const c = clinicQuery.data;
      const addr = c.address ?? {};
      setForm({
        name: c.name ?? '', email: c.email ?? '', phone: c.phone ?? '',
        cnpj: c.cnpj ?? '', cnes: c.cnes ?? '',
        dpo_name: c.dpo_name ?? '', dpo_email: c.dpo_email ?? '',
        street: addr.street ?? '', number: addr.number ?? '',
        complement: addr.complement ?? '', district: addr.district ?? '',
        city: addr.city ?? '', state: addr.state ?? '', zip: addr.zip ?? '',
      });
      setFormDirty(false);
    }
  }, [clinicQuery.data]);

  React.useEffect(() => {
    if (hoursQuery.data && hoursQuery.data.length > 0) {
      setHours(hoursQuery.data.map((h: BusinessHour) => ({
        day_of_week: h.day_of_week,
        is_open: h.is_open,
        shifts: h.shifts?.length > 0 ? h.shifts : [{ start: '08:00', end: '18:00' }],
      })));
    } else {
      setHours(
        Array.from({ length: 7 }, (_, i) => ({
          day_of_week: i,
          is_open: i >= 1 && i <= 5,
          shifts: [{ start: '08:00', end: '18:00' }],
        })),
      );
    }
    setHoursDirty(false);
  }, [hoursQuery.data]);

  function updateField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormDirty(true);
    setSaveStatus(null);
  }

  function handleSaveClinic() {
    const input: Record<string, unknown> = {};
    if (form.name) input.name = form.name;
    if (form.email) input.email = form.email;
    if (form.phone) input.phone = form.phone;
    if (form.cnpj) input.cnpj = form.cnpj;
    if (form.cnes) input.cnes = form.cnes;
    if (form.dpo_name) input.dpo_name = form.dpo_name;
    if (form.dpo_email) input.dpo_email = form.dpo_email;
    if (form.street || form.city) {
      input.address = {
        street: form.street, number: form.number, complement: form.complement || undefined,
        district: form.district, city: form.city, state: form.state, zip: form.zip,
      };
    }
    updateClinic.mutate(input as Parameters<typeof updateClinic.mutate>[0]);
  }

  function handleSaveHours() {
    updateHours.mutate({
      hours: hours.map((h) => ({
        dayOfWeek: h.day_of_week,
        isOpen: h.is_open,
        shifts: h.is_open ? h.shifts : [{ start: '08:00', end: '18:00' }],
      })),
    });
  }

  function toggleDay(idx: number) {
    setHours((prev) => prev.map((h, i) =>
      i === idx ? { ...h, is_open: !h.is_open } : h,
    ));
    setHoursDirty(true);
  }

  function updateShift(dayIdx: number, shiftIdx: number, field: 'start' | 'end', val: string) {
    setHours((prev) => prev.map((h, i) => {
      if (i !== dayIdx) return h;
      const newShifts = h.shifts.map((s, si) =>
        si === shiftIdx ? { start: field === 'start' ? val : s.start, end: field === 'end' ? val : s.end } : s,
      );
      return { ...h, shifts: newShifts };
    }));
    setHoursDirty(true);
  }

  if (clinicQuery.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={48} delay={i * 100} />)}
      </div>
    );
  }

  const cnpjLocked = clinicQuery.data?.cnpj_locked;
  const cnesLocked = clinicQuery.data?.cnes_locked;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Dados Cadastrais */}
      <Glass style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <Mono size={10} spacing="1.1px" color={T.primary}>DADOS CADASTRAIS</Mono>
            <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4 }}>
              Informações legais e de contato da clínica
            </p>
          </div>
          {isPrivileged && (
            <Btn
              small
              icon="check"
              disabled={!formDirty}
              loading={updateClinic.isPending}
              onClick={handleSaveClinic}
            >
              Salvar
            </Btn>
          )}
        </div>

        {saveStatus === 'success' && (
          <div style={{ padding: '10px 14px', borderRadius: T.r.md, background: T.successBg, border: `1px solid ${T.successBorder}`, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico name="check" size={14} color={T.success} />
            <span style={{ fontSize: 13, color: T.success, fontWeight: 500 }}>Dados salvos com sucesso</span>
          </div>
        )}
        {saveStatus === 'error' && (
          <div style={{ padding: '10px 14px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico name="alert" size={14} color={T.danger} />
            <span style={{ fontSize: 13, color: T.danger, fontWeight: 500 }}>{errorMsg || 'Erro ao salvar'}</span>
            <Btn small variant="danger" onClick={handleSaveClinic} style={{ marginLeft: 'auto' }}>Tentar novamente</Btn>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
          <Field label="Nome da Clínica" required icon="home">
            <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} disabled={!isPrivileged} placeholder="Nome da clínica" />
          </Field>
          <Field label="E-mail" icon="mail">
            <Input value={form.email} onChange={(e) => updateField('email', e.target.value)} disabled={!isPrivileged} placeholder="contato@clinica.com" type="email" />
          </Field>
          <Field label="Telefone" icon="phone">
            <Input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} disabled={!isPrivileged} placeholder="11999998888" />
          </Field>
          <Field label={cnpjLocked ? 'CNPJ (bloqueado)' : 'CNPJ'} icon="shield">
            <Input value={form.cnpj} onChange={(e) => updateField('cnpj', e.target.value)} disabled={!isPrivileged || cnpjLocked} placeholder="00.000.000/0000-00" />
          </Field>
          <Field label={cnesLocked ? 'CNES (bloqueado)' : 'CNES'} icon="hash">
            <Input value={form.cnes} onChange={(e) => updateField('cnes', e.target.value)} disabled={!isPrivileged || cnesLocked} placeholder="0000000" />
          </Field>
        </div>

        <div style={{ marginTop: 24 }}>
          <Mono size={10} spacing="1.1px" color={T.textMuted} style={{ marginBottom: 14 }}>ENDEREÇO</Mono>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px 20px' }}>
            <Field label="Logradouro">
              <Input value={form.street} onChange={(e) => updateField('street', e.target.value)} disabled={!isPrivileged} placeholder="Av. Paulista" />
            </Field>
            <Field label="Número">
              <Input value={form.number} onChange={(e) => updateField('number', e.target.value)} disabled={!isPrivileged} placeholder="1000" />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px 20px', marginTop: 16 }}>
            <Field label="Complemento">
              <Input value={form.complement} onChange={(e) => updateField('complement', e.target.value)} disabled={!isPrivileged} placeholder="Sala 101" />
            </Field>
            <Field label="Bairro">
              <Input value={form.district} onChange={(e) => updateField('district', e.target.value)} disabled={!isPrivileged} placeholder="Bela Vista" />
            </Field>
            <Field label="Cidade">
              <Input value={form.city} onChange={(e) => updateField('city', e.target.value)} disabled={!isPrivileged} placeholder="São Paulo" />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', marginTop: 16 }}>
            <Field label="Estado (UF)">
              <Input value={form.state} onChange={(e) => updateField('state', e.target.value)} disabled={!isPrivileged} placeholder="SP" maxLength={2} />
            </Field>
            <Field label="CEP">
              <Input value={form.zip} onChange={(e) => updateField('zip', e.target.value)} disabled={!isPrivileged} placeholder="01310100" />
            </Field>
          </div>
        </div>

        {isPrivileged && (
          <div style={{ marginTop: 24 }}>
            <Mono size={10} spacing="1.1px" color={T.textMuted} style={{ marginBottom: 14 }}>LGPD — ENCARREGADO DE DADOS</Mono>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
              <Field label="Nome do DPO" icon="user">
                <Input value={form.dpo_name} onChange={(e) => updateField('dpo_name', e.target.value)} placeholder="Nome do encarregado" />
              </Field>
              <Field label="E-mail do DPO" icon="mail">
                <Input value={form.dpo_email} onChange={(e) => updateField('dpo_email', e.target.value)} placeholder="dpo@clinica.com" type="email" />
              </Field>
            </div>
          </div>
        )}
      </Glass>

      {/* Horário de Funcionamento */}
      <Glass style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <Mono size={10} spacing="1.1px" color={T.primary}>HORÁRIO DE FUNCIONAMENTO</Mono>
            <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4 }}>
              Define os horários de cada dia da semana para agenda
            </p>
          </div>
          {isPrivileged && (
            <Btn
              small
              icon="check"
              disabled={!hoursDirty}
              loading={updateHours.isPending}
              onClick={handleSaveHours}
            >
              Salvar horários
            </Btn>
          )}
        </div>

        {hoursSaveStatus === 'success' && (
          <div style={{ padding: '10px 14px', borderRadius: T.r.md, background: T.successBg, border: `1px solid ${T.successBorder}`, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico name="check" size={14} color={T.success} />
            <span style={{ fontSize: 13, color: T.success, fontWeight: 500 }}>Horários salvos com sucesso</span>
          </div>
        )}
        {hoursSaveStatus === 'error' && (
          <div style={{ padding: '10px 14px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico name="alert" size={14} color={T.danger} />
            <span style={{ fontSize: 13, color: T.danger, fontWeight: 500 }}>{hoursErrorMsg || 'Erro ao salvar horários'}</span>
            <Btn small variant="danger" onClick={handleSaveHours} style={{ marginLeft: 'auto' }}>Tentar novamente</Btn>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hours.map((h, dayIdx) => (
            <div
              key={h.day_of_week}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px', borderRadius: T.r.md,
                background: h.is_open ? 'transparent' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${T.divider}`,
              }}
            >
              <Toggle
                checked={h.is_open}
                onChange={() => toggleDay(dayIdx)}
                disabled={!isPrivileged}
                label={DAY_LABELS[h.day_of_week]}
              />
              <span style={{
                fontSize: 14, fontWeight: 500, color: h.is_open ? T.textPrimary : T.textMuted,
                width: 80, flexShrink: 0,
              }}>
                {DAY_LABELS[h.day_of_week]}
              </span>
              {h.is_open ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                  {h.shifts.map((shift, sIdx) => (
                    <React.Fragment key={sIdx}>
                      <Input
                        value={shift.start}
                        onChange={(e) => updateShift(dayIdx, sIdx, 'start', e.target.value)}
                        disabled={!isPrivileged}
                        style={{ width: 90, textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}
                        placeholder="08:00"
                      />
                      <span style={{ color: T.textMuted, fontSize: 13 }}>às</span>
                      <Input
                        value={shift.end}
                        onChange={(e) => updateShift(dayIdx, sIdx, 'end', e.target.value)}
                        disabled={!isPrivileged}
                        style={{ width: 90, textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}
                        placeholder="18:00"
                      />
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <Mono size={11} color={T.textMuted}>Fechado</Mono>
              )}
            </div>
          ))}
        </div>
      </Glass>
    </div>
  );
}

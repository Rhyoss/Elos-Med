'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Save, Globe, Clock, User } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { PageHeader } from '@dermaos/ui';
import { updateClinicSchema, updateTimezoneSchema, updateBusinessHoursSchema } from '@dermaos/shared';
import type { UpdateClinicInput, UpdateTimezoneInput, UpdateBusinessHoursInput } from '@dermaos/shared';

const DAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function FieldRow({
  label,
  locked,
  children,
}: {
  label: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b last:border-0">
      <label className="w-44 shrink-0 pt-2 text-sm font-medium text-muted-foreground">
        {label}
        {locked && <Lock className="ml-1 inline h-3 w-3 text-muted-foreground/60" />}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function ConfiguracoesPage() {
  const utils = trpc.useUtils();

  const clinicQuery       = trpc.settings.clinic.get.useQuery();
  const hoursQuery        = trpc.settings.clinic.getBusinessHours.useQuery();
  const updateClinicMut   = trpc.settings.clinic.update.useMutation({ onSuccess: () => utils.settings.clinic.get.invalidate() });
  const updateHoursMut    = trpc.settings.clinic.updateBusinessHours.useMutation({ onSuccess: () => utils.settings.clinic.getBusinessHours.invalidate() });
  const updateTzMut       = trpc.settings.clinic.updateTimezone.useMutation({ onSuccess: () => utils.settings.clinic.get.invalidate() });

  const clinic = clinicQuery.data;
  const hours  = hoursQuery.data;

  const clinicForm = useForm<UpdateClinicInput>({
    resolver: zodResolver(updateClinicSchema),
    values: clinic
      ? {
          name:      clinic.name,
          email:     clinic.email ?? '',
          phone:     clinic.phone ?? '',
          dpo_name:  clinic.dpo_name ?? '',
          dpo_email: clinic.dpo_email ?? '',
        }
      : undefined,
  });

  const tzForm = useForm<UpdateTimezoneInput>({
    resolver: zodResolver(updateTimezoneSchema),
    values: { timezone: clinic?.timezone ?? 'America/Sao_Paulo' },
  });

  const [hoursState, setHoursState] = React.useState<UpdateBusinessHoursInput['hours']>([]);
  React.useEffect(() => {
    if (!hours) return;
    if (hours.length === 7) {
      setHoursState(
        hours.map((h: { day_of_week: number; is_open: boolean; shifts: { start: string; end: string }[] }) => ({
          dayOfWeek: h.day_of_week,
          isOpen:    h.is_open,
          shifts:    h.shifts,
        })),
      );
    } else if (hours.length === 0) {
      setHoursState(
        Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i,
          isOpen:    i > 0 && i < 6,
          shifts:    [{ start: '08:00', end: '18:00' }],
        })),
      );
    }
    // `hours` é a referência de `hoursQuery.data`, estável entre renders enquanto
    // a query não retorna novo valor — evitando loop infinito de setState.
  }, [hours]);

  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoUploading, setLogoUploading] = React.useState(false);
  const [logoError, setLogoError] = React.useState<string | null>(null);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoError(null);
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/settings/clinic/logo', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        setLogoError(err.message ?? 'Falha ao enviar logo.');
      } else {
        utils.settings.clinic.get.invalidate();
      }
    } finally {
      setLogoUploading(false);
    }
  }

  function handleTimezoneChange(tz: string) {
    if (!confirm(`Alterar o timezone afeta horários de agendamento, automações e relatórios.\n\nNovo timezone: ${tz}\n\nConfirmar?`)) return;
    updateTzMut.mutate({ timezone: tz });
  }

  function toggleDay(idx: number) {
    setHoursState((prev) =>
      prev.map((d) => (d.dayOfWeek === idx ? { ...d, isOpen: !d.isOpen } : d)),
    );
  }

  function updateShift(dayIdx: number, shiftIdx: number, field: 'start' | 'end', value: string) {
    setHoursState((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayIdx) return d;
        const shifts = d.shifts.map((s, i) => (i === shiftIdx ? { ...s, [field]: value } : s));
        return { ...d, shifts };
      }),
    );
  }

  const isOwnerOrAdmin = true; // In a real impl, derive from user session

  if (clinicQuery.isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando configurações...</div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Dados da Clínica"
        description="Informações cadastrais, horários e dados regulatórios"
        actions={
          isOwnerOrAdmin ? (
            <button
              type="button"
              onClick={clinicForm.handleSubmit((data) => updateClinicMut.mutate(data))}
              disabled={updateClinicMut.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {updateClinicMut.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          ) : null
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        {/* ── Dados Cadastrais ─────────────────────────────── */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-base font-semibold">Dados Cadastrais</h2>

          <FieldRow label="Logo da Clínica">
            <div className="flex items-center gap-4">
              {clinic?.logo_url && (
                <img
                  src={`/api/assets/${clinic.logo_url}`}
                  alt="Logo"
                  className="h-16 w-16 rounded-md object-contain border"
                />
              )}
              <label className="cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                {logoUploading ? 'Enviando...' : 'Alterar logo'}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.svg,.webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={logoUploading}
                />
              </label>
              {logoError && <p className="text-sm text-destructive">{logoError}</p>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, SVG ou WebP · máx 2MB</p>
          </FieldRow>

          <FieldRow label="Nome da Clínica">
            <input
              {...clinicForm.register('name')}
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {clinicForm.formState.errors.name && (
              <p className="mt-1 text-xs text-destructive">{clinicForm.formState.errors.name.message}</p>
            )}
          </FieldRow>

          <FieldRow label="CNPJ" locked={clinic?.cnpj_locked}>
            <div className="flex items-center gap-2">
              <input
                {...clinicForm.register('cnpj')}
                disabled={clinic?.cnpj_locked}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted"
              />
              {clinic?.cnpj_locked && (
                <span className="text-xs text-muted-foreground">Bloqueado</span>
              )}
            </div>
            {clinicForm.formState.errors.cnpj && (
              <p className="mt-1 text-xs text-destructive">{clinicForm.formState.errors.cnpj.message}</p>
            )}
          </FieldRow>

          <FieldRow label="CNES" locked={clinic?.cnes_locked}>
            <div className="flex items-center gap-2">
              <input
                {...clinicForm.register('cnes')}
                disabled={clinic?.cnes_locked}
                placeholder="0000000"
                className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted"
              />
              {clinic?.cnes_locked && (
                <span className="text-xs text-muted-foreground">Bloqueado</span>
              )}
            </div>
          </FieldRow>

          <FieldRow label="E-mail">
            <input
              {...clinicForm.register('email')}
              type="email"
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </FieldRow>

          <FieldRow label="Telefone">
            <input
              {...clinicForm.register('phone')}
              placeholder="(11) 00000-0000"
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </FieldRow>
        </section>

        {/* ── DPO & Timezone ───────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">DPO — Encarregado LGPD</h2>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Obrigatório para compliance LGPD (RDC 99/2022). Exibido no aviso de privacidade.
            </p>
            <FieldRow label="Nome do DPO">
              <input
                {...clinicForm.register('dpo_name')}
                className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </FieldRow>
            <FieldRow label="E-mail do DPO">
              <input
                {...clinicForm.register('dpo_email')}
                type="email"
                className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </FieldRow>
          </section>

          <section className="rounded-lg border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Timezone</h2>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Altera horários de agendamento, automações e relatórios.
              Apenas o proprietário pode modificar.
            </p>
            <select
              value={tzForm.watch('timezone')}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {[
                'America/Sao_Paulo',
                'America/Manaus',
                'America/Belem',
                'America/Recife',
                'America/Fortaleza',
                'America/Porto_Velho',
                'America/Boa_Vista',
                'America/Rio_Branco',
                'America/Noronha',
              ].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            {updateTzMut.isError && (
              <p className="mt-2 text-xs text-destructive">
                {updateTzMut.error.message}
              </p>
            )}
          </section>
        </div>

        {/* ── Horário de Funcionamento ─────────────────────── */}
        <section className="rounded-lg border bg-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Horário de Funcionamento</h2>
            </div>
            <button
              type="button"
              onClick={() => updateHoursMut.mutate({ hours: hoursState })}
              disabled={updateHoursMut.isPending || hoursState.length === 0}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {updateHoursMut.isPending ? 'Salvando...' : 'Salvar Horários'}
            </button>
          </div>

          <div className="space-y-2">
            {hoursState.map((day) => (
              <div key={day.dayOfWeek} className="flex items-center gap-4 rounded-md border p-3">
                <span className="w-20 text-sm font-medium">{DAY_LABELS[day.dayOfWeek]}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={day.isOpen}
                    onChange={() => toggleDay(day.dayOfWeek)}
                    className="h-4 w-4 rounded border"
                  />
                  {day.isOpen ? 'Aberto' : 'Fechado'}
                </label>
                {day.isOpen && day.shifts.map((shift, si) => (
                  <div key={si} className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      value={shift.start}
                      onChange={(e) => updateShift(day.dayOfWeek, si, 'start', e.target.value)}
                      className="rounded border px-2 py-1 text-xs"
                    />
                    <span className="text-muted-foreground">até</span>
                    <input
                      type="time"
                      value={shift.end}
                      onChange={(e) => updateShift(day.dayOfWeek, si, 'end', e.target.value)}
                      className="rounded border px-2 py-1 text-xs"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {updateHoursMut.isError && (
            <p className="mt-2 text-sm text-destructive">{updateHoursMut.error.message}</p>
          )}
        </section>
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { Checkbox, Input, Select, SelectItem, Button } from '@dermaos/ui';
import type { NextAppointmentHint } from '@dermaos/shared';

interface NextAppointmentProps {
  value:     NextAppointmentHint | null;
  onChange:  (value: NextAppointmentHint) => void;
  patientId: string;
  disabled?: boolean;
}

const PRESETS = [
  { label: '15 dias',         days: 15 },
  { label: '30 dias',         days: 30 },
  { label: '60 dias',         days: 60 },
  { label: '90 dias',         days: 90 },
  { label: 'Personalizado',   days: 0 },
];

export function NextAppointmentSection({
  value,
  onChange,
  patientId,
  disabled,
}: NextAppointmentProps) {
  const enabled = value?.enabled ?? false;
  const currentDays = value?.intervalDays ?? 30;
  const isCustom = !PRESETS.some((p) => p.days === currentDays && p.days > 0);

  function setEnabled(next: boolean) {
    onChange({
      enabled: next,
      intervalDays: value?.intervalDays ?? 30,
      notes: value?.notes,
    });
  }

  function setDays(days: number) {
    onChange({
      enabled: true,
      intervalDays: days,
      notes: value?.notes,
    });
  }

  function setNotes(notes: string) {
    onChange({
      enabled: enabled,
      intervalDays: currentDays,
      notes,
    });
  }

  // URL de pré-preenchimento da agenda
  const preDate = React.useMemo(() => {
    if (!enabled || !currentDays) return null;
    const d = new Date();
    d.setDate(d.getDate() + currentDays);
    return d.toISOString().slice(0, 10);
  }, [enabled, currentDays]);

  return (
    <section aria-labelledby="next-appointment-heading" className="space-y-2">
      <h3 id="next-appointment-heading" className="text-sm font-semibold text-foreground">
        Próxima Consulta
      </h3>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox
          checked={enabled}
          onCheckedChange={(c) => setEnabled(c === true)}
          disabled={disabled}
          aria-label="Agendar retorno"
        />
        Agendar retorno
      </label>
      {enabled && (
        <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
          <label className="block text-xs font-medium text-foreground">
            Intervalo
            <Select
              value={isCustom ? 'custom' : String(currentDays)}
              onValueChange={(v) => {
                if (v === 'custom') {
                  setDays(45);
                } else {
                  setDays(parseInt(v, 10));
                }
              }}
              disabled={disabled}
            >
              {PRESETS.map((p) => (
                <SelectItem key={p.label} value={p.days > 0 ? String(p.days) : 'custom'}>
                  {p.label}
                </SelectItem>
              ))}
            </Select>
          </label>

          {isCustom && (
            <label className="block text-xs font-medium text-foreground">
              Dias (personalizado)
              <Input
                type="number"
                min={1}
                max={730}
                value={currentDays}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setDays(Number.isFinite(n) ? n : 30);
                }}
                aria-label="Intervalo em dias"
                disabled={disabled}
              />
            </label>
          )}

          <label className="block text-xs font-medium text-foreground">
            Observações (opcional)
            <Input
              value={value?.notes ?? ''}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Avaliar resposta ao tratamento"
              aria-label="Observações para próxima consulta"
              disabled={disabled}
              maxLength={500}
            />
          </label>

          <div className="pt-1">
            <Button
              asChild
              size="sm"
              variant="outline"
              disabled={disabled}
            >
              <Link
                href={`/agenda?paciente=${patientId}${preDate ? `&data=${preDate}` : ''}`}
                aria-label={`Abrir agenda pré-preenchida para ${currentDays} dias`}
              >
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                Abrir Agenda
              </Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

'use client';

import * as React from 'react';
import { Input } from '@dermaos/ui';
import type { VitalSignsInput } from '@dermaos/shared';

interface VitalSignsFormProps {
  value:    VitalSignsInput;
  onChange: (value: VitalSignsInput) => void;
  disabled?: boolean;
}

function parseNum(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const normalized = raw.replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : undefined;
}

function computeBmi(weightKg?: number, heightCm?: number): string {
  if (!weightKg || !heightCm || heightCm <= 0) return '—';
  const meters = heightCm / 100;
  const bmi = weightKg / (meters * meters);
  return bmi.toFixed(1);
}

export function VitalSignsForm({ value, onChange, disabled }: VitalSignsFormProps) {
  function set(key: keyof VitalSignsInput, raw: string) {
    const next: VitalSignsInput = { ...value };
    const parsed = parseNum(raw);

    switch (key) {
      case 'notes':
        next.notes = raw;
        break;
      case 'bloodPressureSys':
        next.bloodPressureSys = parsed !== undefined ? Math.round(parsed) : undefined;
        break;
      case 'bloodPressureDia':
        next.bloodPressureDia = parsed !== undefined ? Math.round(parsed) : undefined;
        break;
      case 'heartRate':
        next.heartRate = parsed !== undefined ? Math.round(parsed) : undefined;
        break;
      case 'oxygenSaturation':
        next.oxygenSaturation = parsed !== undefined ? Math.round(parsed) : undefined;
        break;
      case 'temperatureC':
        next.temperatureC = parsed;
        break;
      case 'weightKg':
        next.weightKg = parsed;
        break;
      case 'heightCm':
        next.heightCm = parsed;
        break;
    }
    onChange(next);
  }

  const bmi = computeBmi(value.weightKg, value.heightCm);

  return (
    <fieldset
      className="rounded-md border border-border bg-muted/40 p-3"
      disabled={disabled}
    >
      <legend className="px-1 text-xs font-medium text-muted-foreground">
        Sinais vitais
      </legend>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Field label="PA Sistólica (mmHg)">
          <Input
            type="number"
            inputMode="numeric"
            min={40}
            max={260}
            value={value.bloodPressureSys ?? ''}
            onChange={(e) => set('bloodPressureSys', e.target.value)}
            aria-label="Pressão sistólica em mmHg"
            placeholder="120"
          />
        </Field>
        <Field label="PA Diastólica (mmHg)">
          <Input
            type="number"
            inputMode="numeric"
            min={20}
            max={180}
            value={value.bloodPressureDia ?? ''}
            onChange={(e) => set('bloodPressureDia', e.target.value)}
            aria-label="Pressão diastólica em mmHg"
            placeholder="80"
          />
        </Field>
        <Field label="FC (bpm)">
          <Input
            type="number"
            inputMode="numeric"
            min={20}
            max={250}
            value={value.heartRate ?? ''}
            onChange={(e) => set('heartRate', e.target.value)}
            aria-label="Frequência cardíaca em batimentos por minuto"
            placeholder="72"
          />
        </Field>
        <Field label="SpO₂ (%)">
          <Input
            type="number"
            inputMode="numeric"
            min={50}
            max={100}
            value={value.oxygenSaturation ?? ''}
            onChange={(e) => set('oxygenSaturation', e.target.value)}
            aria-label="Saturação de oxigênio em percentual"
            placeholder="98"
          />
        </Field>
        <Field label="Temperatura (°C)">
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            min={30}
            max={45}
            value={value.temperatureC ?? ''}
            onChange={(e) => set('temperatureC', e.target.value)}
            aria-label="Temperatura em graus Celsius"
            placeholder="36.5"
          />
        </Field>
        <Field label="Peso (kg)">
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            min={0}
            value={value.weightKg ?? ''}
            onChange={(e) => set('weightKg', e.target.value)}
            aria-label="Peso em quilogramas"
            placeholder="70.0"
          />
        </Field>
        <Field label="Altura (cm)">
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            min={0}
            value={value.heightCm ?? ''}
            onChange={(e) => set('heightCm', e.target.value)}
            aria-label="Altura em centímetros"
            placeholder="170.0"
          />
        </Field>
        <Field label="IMC (calculado)">
          <div
            className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground font-mono tabular-nums"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`IMC ${bmi}`}
          >
            {bmi}
          </div>
        </Field>
      </div>
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Glass } from './Glass';
import { Mono } from './Mono';

export interface VitalField {
  key: string;
  label: string;
  unit?: string;
  placeholder?: string;
}

export interface VitalCaptureProps {
  fields: ReadonlyArray<VitalField>;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Use the metallic Glass surface (default true). */
  metal?: boolean;
  /** Heading shown above the inputs. */
  heading?: string;
  /** Number of columns in the input grid (default = fields.length, capped at 5). */
  columns?: number;
  disabled?: boolean;
}

const DEFAULT_FIELDS: ReadonlyArray<VitalField> = [
  { key: 'pa', label: 'PA', unit: 'mmHg', placeholder: '120/80' },
  { key: 'fc', label: 'FC', unit: 'bpm', placeholder: '72' },
  { key: 'spo2', label: 'SpO₂', unit: '%', placeholder: '98' },
  { key: 'temp', label: 'Temp', unit: '°C', placeholder: '36.4' },
  { key: 'peso', label: 'Peso', unit: 'kg', placeholder: '62' },
];

/**
 * Vital signs capture grid. Designed for live consultation entry
 * (ConsultaViva). Pass `fields` to customize, or omit to get the standard
 * 5 (PA / FC / SpO₂ / Temp / Peso).
 */
export function VitalCapture({
  fields = DEFAULT_FIELDS,
  values,
  onChange,
  metal = true,
  heading = 'SINAIS VITAIS',
  columns,
  disabled,
}: VitalCaptureProps) {
  const cols = columns ?? Math.min(fields.length, 5);
  return (
    <Glass metal={metal} style={{ padding: '14px 18px' }}>
      <Mono size={9} spacing="1px" color={T.primary}>
        {heading}
      </Mono>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 10,
          marginTop: 10,
        }}
      >
        {fields.map((f) => (
          <div key={f.key}>
            <Mono size={7} spacing="0.8px">
              {`${f.label}${f.unit ? ` (${f.unit})` : ''}`.toUpperCase()}
            </Mono>
            <input
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              disabled={disabled}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '8px 12px',
                borderRadius: T.r.md,
                background: T.inputBg,
                border: `1px solid ${T.inputBorder}`,
                color: T.textPrimary,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'IBM Plex Mono', monospace",
                outline: 'none',
                textAlign: 'center',
                opacity: disabled ? 0.5 : 1,
              }}
            />
          </div>
        ))}
      </div>
    </Glass>
  );
}

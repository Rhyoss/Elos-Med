'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Badge } from './Badge';
import { Btn } from './Btn';
import { Glass } from './Glass';
import { Ico } from './Ico';
import { Mono } from './Mono';

export interface PrescriptionItem {
  name: string;
  dose: string;
  freq: string;
  duration: string;
}

export interface PrescriptionCardProps {
  id: string;
  date: string;
  doctor?: string;
  items: ReadonlyArray<PrescriptionItem>;
  status?: { label: string; variant?: 'default' | 'success' | 'warning' | 'danger' };
  onPrint?: () => void;
}

/**
 * Prescription record card. Renders header (id/date/doctor + status + PDF
 * button) and a table of medication items. Used in Prontuário > Prescrições
 * tab and in patient summary blocks.
 */
export function PrescriptionCard({
  id,
  date,
  doctor,
  items,
  status,
  onPrint,
}: PrescriptionCardProps) {
  return (
    <Glass style={{ padding: '16px 18px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: T.r.md,
              background: T.primaryBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ico name="file" size={16} color={T.primary} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0 }}>
              {id}
            </p>
            <Mono size={9}>
              {date}
              {doctor && ` · ${doctor}`}
            </Mono>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {status && (
            <Badge variant={status.variant ?? 'default'} dot={false}>
              {status.label}
            </Badge>
          )}
          {onPrint && (
            <Btn variant="ghost" small icon="printer" onClick={onPrint}>
              PDF
            </Btn>
          )}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Medicamento', 'Posologia', 'Frequência', 'Duração'].map((h) => (
              <th
                key={h}
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: 8,
                  fontFamily: "'IBM Plex Mono', monospace",
                  letterSpacing: '1px',
                  color: T.textMuted,
                  fontWeight: 500,
                  borderBottom: `1px solid ${T.divider}`,
                }}
              >
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.divider}` }}>
              <td
                style={{
                  padding: '10px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: T.textPrimary,
                }}
              >
                {item.name}
              </td>
              <td style={{ padding: '10px 12px', fontSize: 11, color: T.textSecondary }}>
                {item.dose}
              </td>
              <td style={{ padding: '10px 12px', fontSize: 11, color: T.textSecondary }}>
                {item.freq}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <Badge variant="default" dot={false}>
                  {item.duration}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Glass>
  );
}

'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Badge } from './Badge';
import { Ico, type IcoName } from './Ico';
import { Mono } from './Mono';

export interface PatientSidebarField {
  label: string;
  value: React.ReactNode;
}

export interface PatientSidebarProps {
  name: string;
  prontuarioId: string;
  age?: number | string;
  status?: { label: string; variant?: 'default' | 'success' | 'warning' | 'danger' };
  /** Optional photo URL — fallback to user icon. */
  photoUrl?: string;
  /** Module-color avatar tint. */
  module?: 'clinical' | 'aiMod' | 'supply' | 'financial' | 'accentMod';
  /** Stack of label/value cards rendered below the header. */
  fields: ReadonlyArray<PatientSidebarField>;
  allergies?: ReadonlyArray<string>;
  address?: string;
  /** Compact variant: 220px wide with smaller paddings; default is 256px. */
  compact?: boolean;
  /** Custom footer slot rendered below the address card. */
  footer?: React.ReactNode;
  /** Optional icon override (defaults to "user"). */
  icon?: IcoName;
}

/**
 * PatientSidebar — left-rail patient summary used in Prontuário and ConsultaViva.
 *
 * Mirrors the reference layout: avatar block + name + status, then a vertical
 * stack of label/value cards, allergies banner (if present), address footer.
 *
 * Use `compact` for the 220px ConsultaViva variant; default 256px width fits
 * the Prontuário layout.
 */
export function PatientSidebar({
  name,
  prontuarioId,
  age,
  status,
  photoUrl,
  module = 'clinical',
  fields,
  allergies,
  address,
  compact = false,
  footer,
  icon = 'user',
}: PatientSidebarProps) {
  const m = T[module];
  const width = compact ? 220 : 256;
  const padX = compact ? 12 : 14;
  const avatarSize = compact ? 42 : 56;
  const avatarRadius = compact ? T.r.lg : T.r.xl;
  const avatarIconSize = compact ? 20 : 28;

  return (
    <aside
      style={{
        width,
        borderRight: `1px solid ${T.divider}`,
        overflowY: 'auto',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: compact ? '14px 12px' : '18px 16px',
          borderBottom: `1px solid ${T.divider}`,
        }}
      >
        <div style={{ display: 'flex', gap: compact ? 10 : 12, marginBottom: 12 }}>
          <div
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarRadius,
              background: m.bg,
              border: `1px solid ${m.color}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              backgroundImage: photoUrl ? `url(${photoUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!photoUrl && <Ico name={icon} size={avatarIconSize} color={m.color} />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                fontSize: compact ? 14 : 16,
                fontWeight: 700,
                color: T.textPrimary,
                lineHeight: 1.2,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {name}
            </p>
            <Mono size={9}>
              {prontuarioId}
              {age !== undefined && ` · ${age} anos`}
            </Mono>
            {status && (
              <div style={{ marginTop: 4 }}>
                <Badge variant={status.variant ?? 'default'}>{status.label}</Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: `12px ${padX}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flex: 1,
        }}
      >
        {fields.map((f) => (
          <div
            key={f.label}
            style={{
              padding: compact ? '6px 8px' : '7px 10px',
              borderRadius: compact ? T.r.sm : T.r.md,
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
            }}
          >
            <Mono size={compact ? 6 : 7} spacing="0.8px">
              {f.label.toUpperCase()}
            </Mono>
            <p
              style={{
                fontSize: compact ? 11 : 12,
                color: T.textPrimary,
                margin: '2px 0 0',
              }}
            >
              {f.value}
            </p>
          </div>
        ))}

        {allergies && allergies.length > 0 && (
          <div
            style={{
              padding: compact ? '6px 8px' : '7px 10px',
              borderRadius: compact ? T.r.sm : T.r.md,
              background: T.dangerBg,
              border: `1px solid ${T.dangerBorder}`,
            }}
          >
            <Mono size={compact ? 6 : 7} spacing="0.8px" color={T.danger}>
              ALERGIAS
            </Mono>
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              {allergies.map((a) => (
                <Badge key={a} variant="danger" dot={false}>
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {address && (
          <div
            style={{
              marginTop: 'auto',
              padding: '8px 10px',
              borderRadius: T.r.md,
              background: T.primaryBg,
              border: `1px solid ${T.primaryBorder}`,
            }}
          >
            <Mono size={7} color={T.primary}>
              ENDEREÇO
            </Mono>
            <p style={{ fontSize: 11, color: T.textSecondary, margin: '2px 0 0' }}>
              {address}
            </p>
          </div>
        )}

        {footer}
      </div>
    </aside>
  );
}

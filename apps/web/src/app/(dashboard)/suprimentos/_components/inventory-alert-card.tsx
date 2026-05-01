'use client';

import * as React from 'react';
import Link from 'next/link';
import { Glass, Mono, Btn, Ico, T } from '@dermaos/ui/ds';
import type { IcoName } from '@dermaos/ui/ds';

/* ──────────────────────────────────────────────────────────────────────────
   InventoryAlertCard
   Bloco compacto de alertas operacionais. Cores derivadas dos tokens
   `T.dangerBg/warningBg/infoBg` para manter coerência com o resto do DS.
   Empty state vira um cartão silencioso ("Tudo sob controle"), nunca quebra
   a página com erro genérico.
   ────────────────────────────────────────────────────────────────────── */

export type AlertTone = 'critical' | 'warning' | 'info';

export interface InventoryAlertSummary {
  /** Identificador estável (ex.: "expired", "expiring_30d", "low_stock"). */
  key:    string;
  tone:   AlertTone;
  icon:   IcoName;
  label:  string;
  /** Quantidade de itens em alerta (mostrada em destaque). */
  count:  number;
  /** Texto auxiliar opcional, e.g. "lotes" ou "produtos". */
  hint?:  string;
  /** Link para detalhe quando aplicável (ex.: `/suprimentos/lotes?...`). */
  href?:  string;
  /** Callback opcional quando o card é clicado e não há href. */
  onClick?: () => void;
}

export interface InventoryAlertCardProps {
  alerts:    InventoryAlertSummary[];
  isLoading: boolean;
  isError:   boolean;
  onRetry?:  () => void;
}

const TONE_TOKENS: Record<AlertTone, { fg: string; bg: string; border: string }> = {
  critical: { fg: T.danger,  bg: T.dangerBg,  border: T.dangerBorder  },
  warning:  { fg: T.warning, bg: T.warningBg, border: T.warningBorder },
  info:     { fg: T.info,    bg: T.infoBg,    border: T.infoBorder    },
};

export function InventoryAlertCard({
  alerts,
  isLoading,
  isError,
  onRetry,
}: InventoryAlertCardProps) {
  if (isLoading) {
    return (
      <Glass style={{ padding: '12px 14px' }}>
        <Mono size={9} color={T.textMuted}>CARREGANDO ALERTAS…</Mono>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 8,
            marginTop: 8,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 56,
                borderRadius: T.r.md,
                background: 'rgba(0,0,0,0.04)',
                animation: 'pulse 1.6s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </Glass>
    );
  }

  if (isError) {
    return (
      <Glass style={{ padding: '12px 14px', border: `1px solid ${T.dangerBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ico name="alert" size={16} color={T.danger} />
          <div style={{ flex: 1 }}>
            <Mono size={9} color={T.danger}>ALERTAS INDISPONÍVEIS</Mono>
            <p style={{ fontSize: 12, color: T.textSecondary, margin: '2px 0 0' }}>
              Não foi possível carregar os alertas de estoque agora.
            </p>
          </div>
          {onRetry && (
            <Btn variant="ghost" small icon="activity" onClick={onRetry}>
              Tentar novamente
            </Btn>
          )}
        </div>
      </Glass>
    );
  }

  const totalActive = alerts.reduce((acc, a) => acc + a.count, 0);

  if (totalActive === 0) {
    return (
      <Glass style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: T.successBg,
              border: `1px solid ${T.successBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ico name="check" size={15} color={T.success} />
          </div>
          <div style={{ flex: 1 }}>
            <Mono size={9} color={T.textMuted}>STATUS OPERACIONAL</Mono>
            <p style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, margin: '1px 0 0' }}>
              Tudo sob controle — sem alertas FEFO ou de ruptura ativos.
            </p>
          </div>
        </div>
      </Glass>
    );
  }

  return (
    <Glass style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Mono size={9} color={T.textMuted}>ALERTAS DE INVENTÁRIO</Mono>
        <Mono size={9} color={T.textMuted}>{totalActive} ITENS</Mono>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 8,
        }}
      >
        {alerts.map((a) => (
          <AlertCell key={a.key} alert={a} />
        ))}
      </div>
    </Glass>
  );
}

function AlertCell({ alert }: { alert: InventoryAlertSummary }) {
  const tone = TONE_TOKENS[alert.tone];
  const dimmed = alert.count === 0;

  const body = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: T.r.md,
        background: dimmed ? 'transparent' : tone.bg,
        border: `1px solid ${dimmed ? T.divider : tone.border}`,
        cursor: dimmed ? 'default' : alert.href || alert.onClick ? 'pointer' : 'default',
        opacity: dimmed ? 0.55 : 1,
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
      }}
      onMouseEnter={(e) => {
        if (!dimmed && (alert.href || alert.onClick)) {
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: T.r.sm,
          background: dimmed ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Ico name={alert.icon} size={16} color={dimmed ? T.textMuted : tone.fg} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Mono size={8} color={T.textMuted} spacing="0.6px">
          {alert.label.toUpperCase()}
        </Mono>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            marginTop: 2,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: dimmed ? T.textSecondary : tone.fg,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {alert.count}
          </span>
          {alert.hint && (
            <Mono size={9} color={T.textMuted}>{alert.hint}</Mono>
          )}
        </div>
      </div>
    </div>
  );

  if (!dimmed && alert.href) {
    return (
      <Link
        href={alert.href}
        aria-label={`${alert.label}: ${alert.count} itens`}
        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      >
        {body}
      </Link>
    );
  }

  if (!dimmed && alert.onClick) {
    return (
      <button
        type="button"
        onClick={alert.onClick}
        aria-label={`${alert.label}: ${alert.count} itens`}
        style={{
          all: 'unset',
          display: 'block',
          width: '100%',
          cursor: 'pointer',
        }}
      >
        {body}
      </button>
    );
  }

  return body;
}

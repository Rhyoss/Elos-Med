'use client';

import * as React from 'react';
import { Ico, Mono, Toggle, Select, T } from '@dermaos/ui/ds';
import type { RoutingConfig } from '../../_lib/wizard-config';

interface ChannelRoutingRulesProps {
  config: RoutingConfig;
  values: Record<string, string | boolean>;
  onChange: (key: string, value: string | boolean) => void;
}

export function ChannelRoutingRules({ config, values, onChange }: ChannelRoutingRulesProps) {
  if (!config.supportsRouting || !config.routingOptions?.length) {
    return (
      <div
        style={{
          padding: '32px 20px',
          borderRadius: T.r.lg,
          background: T.glass,
          border: `1px solid ${T.glassBorder}`,
          textAlign: 'center',
        }}
      >
        <Ico name="layers" size={28} color={T.textMuted} />
        <p style={{ fontSize: 14, color: T.textSecondary, fontWeight: 500, marginTop: 10 }}>
          Roteamento não disponível para este canal.
        </p>
        <p style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
          Conversas serão atribuídas manualmente. Você pode pular esta etapa.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <p style={{ fontSize: 15, color: T.textPrimary, fontWeight: 600, marginBottom: 4 }}>
          Regras de roteamento
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary }}>
          Configure como as conversas recebidas neste canal serão distribuídas na clínica.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {config.routingOptions.map((opt) => {
          const currentValue = values[opt.key];

          return (
            <div
              key={opt.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                padding: '14px 16px',
                borderRadius: T.r.md,
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>
                  {opt.label}
                </p>
                <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                  {opt.description}
                </p>
              </div>

              {opt.type === 'toggle' ? (
                <Toggle
                  checked={currentValue === true}
                  onChange={(v) => onChange(opt.key, v)}
                  label={opt.label}
                />
              ) : (
                <Select
                  value={typeof currentValue === 'string' ? currentValue : ''}
                  onChange={(e) => onChange(opt.key, e.target.value)}
                  style={{ width: 160, flexShrink: 0 }}
                >
                  <option value="">Selecione...</option>
                  {opt.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: '10px 14px',
          borderRadius: T.r.md,
          background: T.infoBg,
          border: `1px solid ${T.infoBorder}`,
          fontSize: 12,
          color: T.info,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <Ico name="alert" size={14} color={T.info} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          As regras de roteamento podem ser alteradas depois em <strong>Configurações &gt; Integrações</strong>.
          Regras avançadas de fila e SLA estarão disponíveis em breve.
        </span>
      </div>
    </div>
  );
}

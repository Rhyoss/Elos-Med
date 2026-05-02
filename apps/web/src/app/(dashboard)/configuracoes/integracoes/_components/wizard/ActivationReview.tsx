'use client';

import * as React from 'react';
import { Glass, Btn, Ico, Mono, Badge, T } from '@dermaos/ui/ds';
import type { WizardStatus, ConnectionMethodId, ChannelWizardConfig } from '../../_lib/wizard-config';

interface ActivationReviewProps {
  config: ChannelWizardConfig;
  connectionMethod: ConnectionMethodId | null;
  credentialValues: Record<string, string>;
  selectedEvents: string[];
  routingValues: Record<string, string | boolean>;
  wizardStatus: WizardStatus;
  onActivate: () => void;
  isActivating: boolean;
  hasBackendSupport: boolean;
}

export function ActivationReview({
  config,
  connectionMethod,
  credentialValues,
  selectedEvents,
  routingValues,
  wizardStatus,
  onActivate,
  isActivating,
  hasBackendSupport,
}: ActivationReviewProps) {
  const method = config.connectionMethods.find((m) => m.id === connectionMethod);
  const fields = connectionMethod ? config.credentialFields[connectionMethod] : [];
  const filledFields = fields.filter((f) => credentialValues[f.key]?.trim());
  const routingEntries = Object.entries(routingValues).filter(([, v]) => v !== '' && v !== false);
  const isReady = wizardStatus === 'ready';
  const isActivated = wizardStatus === 'activated';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <p style={{ fontSize: 15, color: T.textPrimary, fontWeight: 600, marginBottom: 4 }}>
          Revisão e ativação
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary }}>
          Revise as configurações antes de ativar o canal.
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SummaryRow label="Canal" value={config.label} icon={config.icon} />
        <SummaryRow label="Método" value={method?.label ?? '—'} icon={method?.icon ?? 'link'} />
        <SummaryRow
          label="Credenciais"
          value={`${filledFields.length} de ${fields.length} campos preenchidos`}
          icon="lock"
        />
        {config.webhook.supportsWebhook && (
          <SummaryRow
            label="Eventos"
            value={selectedEvents.length > 0 ? `${selectedEvents.length} evento(s) ativo(s)` : 'Nenhum evento selecionado'}
            icon="zap"
          />
        )}
        {config.routing.supportsRouting && (
          <SummaryRow
            label="Roteamento"
            value={routingEntries.length > 0 ? `${routingEntries.length} regra(s) configurada(s)` : 'Roteamento padrão'}
            icon="layers"
          />
        )}
      </div>

      {/* Status indicator */}
      <Glass
        style={{
          padding: '20px 22px',
          textAlign: 'center',
          borderLeft: `3px solid ${
            isActivated ? T.success : isReady ? T.primary : T.warning
          }`,
        }}
      >
        {isActivated ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Ico name="check" size={28} color={T.success} />
            <p style={{ fontSize: 15, fontWeight: 600, color: T.success }}>Canal ativado</p>
            <p style={{ fontSize: 13, color: T.textSecondary }}>
              {config.label} está pronto para receber e enviar mensagens.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: T.r.pill,
                background: isReady ? T.successBg : T.warningBg,
                border: `1px solid ${isReady ? T.successBorder : T.warningBorder}`,
              }}
            >
              <Ico name={isReady ? 'check' : 'clock'} size={13} color={isReady ? T.success : T.warning} />
              <span style={{ fontSize: 12, fontWeight: 500, color: isReady ? T.success : T.warning }}>
                {isReady ? 'Pronto para ativar' : 'Teste de conexão pendente'}
              </span>
            </div>

            {!hasBackendSupport && (
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: T.r.md,
                  background: T.warningBg,
                  border: `1px solid ${T.warningBorder}`,
                  fontSize: 12,
                  color: T.warning,
                }}
              >
                {/* TODO: Remove when backend supports facebook + custom channel types */}
                Este canal ainda não possui suporte completo no backend. A configuração será salva como rascunho.
              </div>
            )}

            <Btn
              variant="primary"
              icon="check"
              onClick={onActivate}
              loading={isActivating}
              disabled={!isReady || isActivating}
            >
              {hasBackendSupport ? 'Ativar Canal' : 'Salvar Rascunho'}
            </Btn>

            {!isReady && (
              <Mono size={10} color={T.textMuted}>
                Complete o teste de conexão na etapa anterior para ativar.
              </Mono>
            )}
          </div>
        )}
      </Glass>
    </div>
  );
}

function SummaryRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: T.r.md,
        background: T.glass,
        border: `1px solid ${T.glassBorder}`,
      }}
    >
      <Ico name={icon as any} size={16} color={T.textMuted} />
      <Mono size={10} color={T.textMuted} style={{ width: 90, flexShrink: 0 }}>
        {label.toUpperCase()}
      </Mono>
      <span style={{ fontSize: 13, color: T.textPrimary, flex: 1 }}>{value}</span>
    </div>
  );
}

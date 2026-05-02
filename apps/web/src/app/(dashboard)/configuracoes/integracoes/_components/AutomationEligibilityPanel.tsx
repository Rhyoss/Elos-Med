'use client';

import * as React from 'react';
import { Glass, Btn, Mono, Ico, Toggle, Badge, type IcoName } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import type { ChannelType } from '../_lib/channel-adapter';

// ── Types ──────────────────────────────────────────────────────────

export type AutomationType =
  | 'lembrete_consulta'
  | 'confirmacao'
  | 'pos_procedimento'
  | 'retorno'
  | 'recuperacao_lead'
  | 'aniversario'
  | 'campanha'
  | 'aviso_documentos';

export interface AutomationConfig {
  type: AutomationType;
  isActive: boolean;
  isEligible: boolean;
  ineligibleReason?: string;
  triggerDescription?: string;
  lastTriggered?: Date;
  totalSent?: number;
}

interface AutomationEligibilityPanelProps {
  channel: ChannelType;
  automations: AutomationConfig[];
  onToggle?: (type: AutomationType, active: boolean) => void;
  onConfigure?: (type: AutomationType) => void;
  isOwner?: boolean;
}

// ── Constants ──────────────────────────────────────────────────────

const AUTOMATION_DEFS: {
  type: AutomationType;
  label: string;
  description: string;
  icon: IcoName;
  triggerDefault: string;
}[] = [
  {
    type: 'lembrete_consulta',
    label: 'Lembrete de Consulta',
    description: 'Envia lembrete automático antes da consulta agendada.',
    icon: 'clock',
    triggerDefault: '24h e 2h antes da consulta',
  },
  {
    type: 'confirmacao',
    label: 'Confirmação de Agendamento',
    description: 'Solicita confirmação do paciente após agendar consulta.',
    icon: 'check',
    triggerDefault: 'Imediatamente após agendamento',
  },
  {
    type: 'pos_procedimento',
    label: 'Pós-Procedimento',
    description: 'Envia orientações de cuidados após realização de procedimento.',
    icon: 'activity',
    triggerDefault: '2h após o procedimento',
  },
  {
    type: 'retorno',
    label: 'Retorno',
    description: 'Convida o paciente para agendar retorno no período indicado.',
    icon: 'calendar',
    triggerDefault: 'Na data indicada pelo médico',
  },
  {
    type: 'recuperacao_lead',
    label: 'Recuperação de Lead',
    description: 'Contato automático com leads que não agendaram após interesse.',
    icon: 'zap',
    triggerDefault: '48h após primeiro contato sem agendamento',
  },
  {
    type: 'aniversario',
    label: 'Aniversário',
    description: 'Mensagem de felicitação no aniversário do paciente.',
    icon: 'star',
    triggerDefault: 'No dia do aniversário, às 9h',
  },
  {
    type: 'campanha',
    label: 'Campanha',
    description: 'Disparo segmentado de campanhas de marketing ou conteúdo.',
    icon: 'zap',
    triggerDefault: 'Conforme agendamento da campanha',
  },
  {
    type: 'aviso_documentos',
    label: 'Aviso de Documentos/Termos',
    description: 'Notifica paciente sobre documentos pendentes ou termos a assinar.',
    icon: 'file',
    triggerDefault: 'Quando documento requer assinatura',
  },
];

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Component ──────────────────────────────────────────────────────

export function AutomationEligibilityPanel({
  channel,
  automations,
  onToggle,
  onConfigure,
  isOwner,
}: AutomationEligibilityPanelProps) {
  const autoMap = React.useMemo(() => {
    const map = new Map<AutomationType, AutomationConfig>();
    for (const a of automations) map.set(a.type, a);
    return map;
  }, [automations]);

  const activeCount = automations.filter((a) => a.isActive).length;
  const eligibleCount = automations.filter((a) => a.isEligible).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
          Automações
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
          Configure disparos automáticos de mensagens neste canal. Cada automação requer template ativo e conformidade LGPD.
        </p>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div
          style={{
            flex: '1 1 0',
            minWidth: 120,
            padding: '10px 14px',
            borderRadius: T.r.md,
            background: T.successBg,
            border: `1px solid ${T.successBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700, color: T.success }}>{activeCount}</span>
          <Mono size={10} color={T.success}>ATIVAS</Mono>
        </div>
        <div
          style={{
            flex: '1 1 0',
            minWidth: 120,
            padding: '10px 14px',
            borderRadius: T.r.md,
            background: T.primaryBg,
            border: `1px solid ${T.primaryBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700, color: T.primary }}>{eligibleCount}</span>
          <Mono size={10} color={T.primary}>ELEGÍVEIS</Mono>
        </div>
        <div
          style={{
            flex: '1 1 0',
            minWidth: 120,
            padding: '10px 14px',
            borderRadius: T.r.md,
            background: T.glass,
            border: `1px solid ${T.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textMuted }}>{AUTOMATION_DEFS.length}</span>
          <Mono size={10} color={T.textMuted}>TOTAL</Mono>
        </div>
      </div>

      {/* Automation list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {AUTOMATION_DEFS.map((def) => {
          const config = autoMap.get(def.type);
          const isActive = config?.isActive ?? false;
          const isEligible = config?.isEligible ?? false;

          return (
            <Glass
              key={def.type}
              style={{
                padding: '16px 18px',
                opacity: isEligible ? 1 : 0.7,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: T.r.md,
                    background: isActive ? T.successBg : isEligible ? T.primaryBg : T.glass,
                    border: `1px solid ${isActive ? T.successBorder : isEligible ? T.primaryBorder : T.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ico
                    name={def.icon}
                    size={16}
                    color={isActive ? T.success : isEligible ? T.primary : T.textMuted}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                      {def.label}
                    </span>
                    {isActive && <Badge variant="success">Ativa</Badge>}
                    {!isActive && isEligible && <Badge variant="default">Disponível</Badge>}
                    {!isEligible && <Badge variant="warning">Indisponível</Badge>}
                  </div>

                  <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 3, lineHeight: 1.5 }}>
                    {def.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Ico name="clock" size={11} color={T.textMuted} />
                      <Mono size={10} color={T.textMuted}>
                        {config?.triggerDescription ?? def.triggerDefault}
                      </Mono>
                    </div>
                    {config?.lastTriggered && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Ico name="activity" size={11} color={T.textMuted} />
                        <Mono size={10} color={T.textMuted}>
                          Último: {formatDate(config.lastTriggered)}
                        </Mono>
                      </div>
                    )}
                    {config?.totalSent != null && config.totalSent > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Ico name="mail" size={11} color={T.textMuted} />
                        <Mono size={10} color={T.textMuted}>
                          {config.totalSent} enviado{config.totalSent !== 1 ? 's' : ''}
                        </Mono>
                      </div>
                    )}
                  </div>

                  {!isEligible && config?.ineligibleReason && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '6px 10px',
                        borderRadius: T.r.sm,
                        background: T.warningBg,
                        border: `1px solid ${T.warningBorder}`,
                        fontSize: 12,
                        color: T.warning,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Ico name="alert" size={12} color={T.warning} />
                      {config.ineligibleReason}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {isEligible && isOwner && (
                    <Btn
                      small
                      variant="ghost"
                      icon="settings"
                      iconOnly
                      onClick={() => onConfigure?.(def.type)}
                      aria-label={`Configurar ${def.label}`}
                    />
                  )}
                  <Toggle
                    checked={isActive}
                    onChange={() => onToggle?.(def.type, !isActive)}
                    label={`Ativar ${def.label}`}
                    disabled={!isEligible || !isOwner}
                  />
                </div>
              </div>
            </Glass>
          );
        })}
      </div>
    </div>
  );
}

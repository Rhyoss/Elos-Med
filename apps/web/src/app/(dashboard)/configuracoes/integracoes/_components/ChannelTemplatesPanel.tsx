'use client';

import * as React from 'react';
import { Glass, Btn, Mono, Ico, Toggle, Badge, Input, type IcoName } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import type { ChannelType } from '../_lib/channel-adapter';

// ── Types ──────────────────────────────────────────────────────────

export type TemplateCategory =
  | 'confirmacao_consulta'
  | 'lembrete'
  | 'pos_procedimento'
  | 'retorno'
  | 'cobranca'
  | 'campanha'
  | 'fora_horario'
  | 'primeira_resposta';

export interface ChannelTemplate {
  id: string;
  category: TemplateCategory;
  name: string;
  body: string;
  variables: string[];
  isActive: boolean;
  sensitiveVarsBlocked: boolean;
}

interface ChannelTemplatesPanelProps {
  channel: ChannelType;
  templates: ChannelTemplate[];
  onToggle?: (templateId: string, active: boolean) => void;
  onEdit?: (template: ChannelTemplate) => void;
  isOwner?: boolean;
}

// ── Constants ──────────────────────────────────────────────────────

const TEMPLATE_DEFS: { category: TemplateCategory; label: string; description: string; icon: IcoName }[] = [
  { category: 'confirmacao_consulta', label: 'Confirmação de Consulta',  description: 'Enviada após agendamento para confirmar data, hora e local.',           icon: 'check' },
  { category: 'lembrete',            label: 'Lembrete',                  description: 'Lembrete enviado 24h e 2h antes da consulta agendada.',                   icon: 'clock' },
  { category: 'pos_procedimento',    label: 'Pós-Procedimento',          description: 'Orientações de cuidados e acompanhamento após o procedimento.',           icon: 'activity' },
  { category: 'retorno',             label: 'Retorno',                   description: 'Convite para agendar retorno após período recomendado pelo médico.',      icon: 'calendar' },
  { category: 'cobranca',            label: 'Cobrança',                  description: 'Aviso de cobrança pendente ou envio de link de pagamento.',               icon: 'creditCard' },
  { category: 'campanha',            label: 'Campanha',                  description: 'Comunicação promocional, novos serviços ou conteúdo educativo.',          icon: 'zap' },
  { category: 'fora_horario',        label: 'Fora do Horário',           description: 'Resposta automática quando a clínica está fechada.',                      icon: 'clock' },
  { category: 'primeira_resposta',   label: 'Primeira Resposta',         description: 'Mensagem de boas-vindas para o primeiro contato do paciente.',            icon: 'message' },
];

const SENSITIVE_VARS = ['cpf', 'rg', 'diagnostico', 'cid', 'prescricao', 'exame_resultado', 'laudo', 'medicamento'];

const SAFE_VARS = ['nome_paciente', 'nome_medico', 'data_consulta', 'hora_consulta', 'nome_clinica', 'endereco', 'telefone_clinica', 'link_confirmacao', 'link_pagamento'];

// ── Component ──────────────────────────────────────────────────────

export function ChannelTemplatesPanel({
  channel,
  templates,
  onToggle,
  onEdit,
  isOwner,
}: ChannelTemplatesPanelProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const templatesByCategory = React.useMemo(() => {
    const map = new Map<TemplateCategory, ChannelTemplate | undefined>();
    for (const def of TEMPLATE_DEFS) {
      map.set(def.category, templates.find((t) => t.category === def.category));
    }
    return map;
  }, [templates]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
            Templates de Mensagem
          </p>
          <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
            Configure os modelos de mensagem para cada tipo de comunicação neste canal.
          </p>
        </div>
      </div>

      {/* Sensitive vars warning */}
      <div
        style={{
          padding: '10px 14px',
          borderRadius: T.r.md,
          background: T.warningBg,
          border: `1px solid ${T.warningBorder}`,
          fontSize: 12,
          color: T.warning,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <Ico name="shield" size={14} color={T.warning} style={{ marginTop: 1, flexShrink: 0 }} />
        <div>
          <span style={{ fontWeight: 600 }}>Variáveis clínicas sensíveis bloqueadas por padrão.</span>{' '}
          Dados como CPF, diagnóstico, CID, prescrição e resultados de exames não podem ser incluídos em templates
          sem aprovação explícita do DPO. Isso garante conformidade com a LGPD e CFM.
        </div>
      </div>

      {/* Template list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TEMPLATE_DEFS.map((def) => {
          const tmpl = templatesByCategory.get(def.category);
          const isExpanded = expandedId === (tmpl?.id ?? def.category);
          const hasTemplate = !!tmpl;
          const hasSensitiveVars = tmpl?.variables.some((v) => SENSITIVE_VARS.includes(v));

          return (
            <Glass
              key={def.category}
              style={{ padding: 0, overflow: 'hidden' }}
            >
              {/* Row header */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : (tmpl?.id ?? def.category))}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: T.r.md,
                    background: hasTemplate ? T.primaryBg : T.glass,
                    border: `1px solid ${hasTemplate ? T.primaryBorder : T.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ico name={def.icon} size={16} color={hasTemplate ? T.primary : T.textMuted} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                      {def.label}
                    </span>
                    {hasTemplate && tmpl.isActive && (
                      <Badge variant="success">Ativo</Badge>
                    )}
                    {hasTemplate && !tmpl.isActive && (
                      <Badge variant="warning">Inativo</Badge>
                    )}
                    {!hasTemplate && (
                      <Badge variant="default">Não configurado</Badge>
                    )}
                    {hasSensitiveVars && tmpl?.sensitiveVarsBlocked && (
                      <Badge variant="danger">Vars sensíveis bloqueadas</Badge>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                    {def.description}
                  </p>
                </div>

                <Ico
                  name={isExpanded ? 'chevDown' : 'chevDown'}
                  size={16}
                  color={T.textMuted}
                  style={isExpanded ? { transform: 'rotate(180deg)' } : undefined}
                />
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div
                  style={{
                    padding: '0 18px 18px',
                    borderTop: `1px solid ${T.divider}`,
                  }}
                >
                  {hasTemplate ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 14 }}>
                      {/* Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: T.textSecondary }}>Template ativo</span>
                        <Toggle
                          checked={tmpl.isActive}
                          onChange={() => onToggle?.(tmpl.id, !tmpl.isActive)}
                          label={`Ativar template ${def.label}`}
                          disabled={!isOwner}
                        />
                      </div>

                      {/* Body preview */}
                      <div>
                        <Mono size={10} color={T.textMuted} style={{ marginBottom: 6, display: 'block' }}>
                          CORPO DA MENSAGEM
                        </Mono>
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: T.r.md,
                            background: 'rgba(0,0,0,0.025)',
                            border: `1px solid ${T.divider}`,
                            fontSize: 13,
                            color: T.textPrimary,
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                        >
                          {tmpl.body}
                        </div>
                      </div>

                      {/* Variables */}
                      <div>
                        <Mono size={10} color={T.textMuted} style={{ marginBottom: 6, display: 'block' }}>
                          VARIÁVEIS UTILIZADAS
                        </Mono>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {tmpl.variables.map((v) => {
                            const isSensitive = SENSITIVE_VARS.includes(v);
                            return (
                              <span
                                key={v}
                                style={{
                                  padding: '3px 10px',
                                  borderRadius: T.r.pill,
                                  background: isSensitive ? T.dangerBg : T.primaryBg,
                                  border: `1px solid ${isSensitive ? T.dangerBorder : T.primaryBorder}`,
                                  fontSize: 11,
                                  fontFamily: "'IBM Plex Mono', monospace",
                                  color: isSensitive ? T.danger : T.primary,
                                }}
                              >
                                {'{{' + v + '}}'}
                                {isSensitive && (
                                  <Ico name="lock" size={10} color={T.danger} style={{ marginLeft: 4 }} />
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Edit button */}
                      {isOwner && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Btn small variant="glass" icon="edit" onClick={() => onEdit?.(tmpl)}>
                            Editar template
                          </Btn>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '20px 0', textAlign: 'center' }}>
                      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>
                        Nenhum template configurado para {def.label.toLowerCase()}.
                      </p>
                      {isOwner && (
                        <Btn small variant="primary" icon="plus">
                          Criar template
                        </Btn>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Glass>
          );
        })}
      </div>

      {/* Safe variables reference */}
      <Glass style={{ padding: '14px 18px' }}>
        <Mono size={10} color={T.textMuted} style={{ marginBottom: 8, display: 'block' }}>
          VARIÁVEIS SEGURAS DISPONÍVEIS
        </Mono>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SAFE_VARS.map((v) => (
            <span
              key={v}
              style={{
                padding: '3px 10px',
                borderRadius: T.r.pill,
                background: T.successBg,
                border: `1px solid ${T.successBorder}`,
                fontSize: 11,
                fontFamily: "'IBM Plex Mono', monospace",
                color: T.success,
              }}
            >
              {'{{' + v + '}}'}
            </span>
          ))}
        </div>
      </Glass>
    </div>
  );
}

'use client';

import * as React from 'react';
import { Btn, Badge, Input, Mono, Ico, T } from '@dermaos/ui/ds';
import { formatRelativeTime } from '../_lib/relative-time';

export interface ContactContext {
  id:        string;
  patientId: string | null;
  type:      'lead' | 'patient' | 'other' | string;
  name:      string;
  phone:     string | null;
  email:     string | null;
  tags:      string[];
  leadScore: number | null;
  patient:   {
    id:            string;
    name:          string;
    totalVisits:   number;
    lastVisitAt:   Date | null;
    recentEncounters: Array<{
      id:            string;
      encounteredAt: Date;
      summary:       string | null;
    }>;
    nextAppointment: {
      id:          string;
      scheduledAt: Date;
      type:        string;
    } | null;
  } | null;
}

export interface ContactPanelProps {
  context:          ContactContext;
  onUpdateTags:     (tags: string[]) => void;
  onLinkToPatient:  () => void;
  isUpdatingTags?:  boolean;
}

const SECTION: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: `1px solid ${T.divider}`,
};

const SECTION_LABEL: React.CSSProperties = {
  marginBottom: 8,
};

export function ContactPanel({
  context,
  onUpdateTags,
  onLinkToPatient,
  isUpdatingTags,
}: ContactPanelProps) {
  const [newTag, setNewTag] = React.useState('');
  const [localTags, setLocalTags] = React.useState(context.tags);

  React.useEffect(() => {
    setLocalTags(context.tags);
  }, [context.tags]);

  function addTag() {
    const trimmed = newTag.trim();
    if (!trimmed || localTags.includes(trimmed) || localTags.length >= 20) return;
    const next = [...localTags, trimmed];
    setLocalTags(next);
    setNewTag('');
    onUpdateTags(next);
  }

  function removeTag(tag: string) {
    const next = localTags.filter((t) => t !== tag);
    setLocalTags(next);
    onUpdateTags(next);
  }

  const isLead = !context.patientId;

  return (
    <aside
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        borderLeft: `1px solid ${T.divider}`,
        background: 'rgba(255,255,255,0.30)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <header style={SECTION}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: T.primaryBg,
              border: `1px solid ${T.primaryBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ico name="user" size={18} color={T.primary} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: T.textPrimary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.25,
              }}
            >
              {context.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              {isLead ? <Badge dot={false}>Lead</Badge> : <Badge variant="success" dot={false}>Paciente</Badge>}
              {context.leadScore != null && (
                <Badge variant="info" dot={false}>Score {context.leadScore}</Badge>
              )}
            </div>
          </div>
        </div>

        <dl style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {context.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.textSecondary }}>
              <Ico name="phone" size={11} color={T.textMuted} />
              <dd>{context.phone}</dd>
            </div>
          )}
          {context.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.textSecondary }}>
              <Ico name="mail" size={11} color={T.textMuted} />
              <dd
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {context.email}
              </dd>
            </div>
          )}
        </dl>
      </header>

      {/* Tags */}
      <section style={SECTION}>
        <div style={SECTION_LABEL}>
          <Mono size={8} spacing="1.1px">TAGS</Mono>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {localTags.length === 0 ? (
            <Mono size={9}>SEM TAGS</Mono>
          ) : (
            localTags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: T.r.pill,
                  background: T.primaryBg,
                  border: `1px solid ${T.primaryBorder}`,
                  color: T.primary,
                  fontSize: 10,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 500,
                }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remover tag ${tag}`}
                  disabled={isUpdatingTags}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: T.primary,
                    opacity: isUpdatingTags ? 0.4 : 0.7,
                  }}
                >
                  <Ico name="x" size={10} color="currentColor" />
                </button>
              </span>
            ))
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Nova tag…"
            maxLength={50}
            disabled={isUpdatingTags || localTags.length >= 20}
            style={{ fontSize: 11, padding: '6px 10px' }}
          />
          <Btn
            variant="glass"
            small
            icon="plus"
            iconOnly
            onClick={addTag}
            disabled={!newTag.trim() || isUpdatingTags}
            aria-label="Adicionar tag"
          />
        </div>
      </section>

      {/* Paciente */}
      {context.patient ? (
        <>
          <section style={SECTION}>
            <div style={SECTION_LABEL}>
              <Mono size={8} spacing="1.1px">HISTÓRICO CLÍNICO</Mono>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <Mono size={7}>CONSULTAS</Mono>
                <dd style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginTop: 2 }}>
                  {context.patient.totalVisits}
                </dd>
              </div>
              <div>
                <Mono size={7}>ÚLTIMA VISITA</Mono>
                <dd style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, marginTop: 2 }}>
                  {context.patient.lastVisitAt
                    ? formatRelativeTime(context.patient.lastVisitAt)
                    : 'nunca'}
                </dd>
              </div>
            </dl>
          </section>

          {context.patient.nextAppointment && (
            <section style={SECTION}>
              <div style={SECTION_LABEL}>
                <Mono size={8} spacing="1.1px" color={T.clinical.color}>PRÓXIMA CONSULTA</Mono>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                {new Intl.DateTimeFormat('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(context.patient.nextAppointment.scheduledAt)}
              </p>
              <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                {context.patient.nextAppointment.type}
              </p>
            </section>
          )}

          {context.patient.recentEncounters.length > 0 && (
            <section style={SECTION}>
              <div style={SECTION_LABEL}>
                <Mono size={8} spacing="1.1px">ATENDIMENTOS RECENTES</Mono>
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {context.patient.recentEncounters.map((e) => (
                  <li
                    key={e.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 6,
                      fontSize: 11,
                    }}
                  >
                    <span
                      style={{
                        color: T.textPrimary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}
                    >
                      {e.summary ?? 'sem resumo'}
                    </span>
                    <time>
                      <Mono size={8}>{formatRelativeTime(e.encounteredAt)}</Mono>
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <section style={SECTION}>
          <p style={{ fontSize: 11, color: T.textSecondary, marginBottom: 10, lineHeight: 1.5 }}>
            Este contato ainda é um <strong>lead</strong>. Vincule-o a um paciente do
            cadastro para unificar o histórico clínico.
          </p>
          <Btn variant="glass" small icon="user" onClick={onLinkToPatient} style={{ width: '100%' }}>
            Vincular a paciente
          </Btn>
        </section>
      )}
    </aside>
  );
}

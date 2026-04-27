'use client';

import * as React from 'react';
import { Badge, Button, Input } from '@dermaos/ui';
import { User, Phone, Mail, UserPlus, X } from 'lucide-react';
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
    <aside className="flex h-full flex-col overflow-y-auto border-l border-border bg-background">
      <header className="border-b border-border p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium text-foreground">{context.name}</h3>
            <div className="flex items-center gap-1">
              {isLead ? (
                <Badge variant="neutral" size="sm">Lead</Badge>
              ) : (
                <Badge variant="success" size="sm">Paciente</Badge>
              )}
              {context.leadScore != null && (
                <Badge variant="info" size="sm">Score {context.leadScore}</Badge>
              )}
            </div>
          </div>
        </div>

        <dl className="space-y-1 text-xs">
          {context.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3 w-3" aria-hidden="true" />
              <dd>{context.phone}</dd>
            </div>
          )}
          {context.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3 w-3" aria-hidden="true" />
              <dd className="truncate">{context.email}</dd>
            </div>
          )}
        </dl>
      </header>

      {/* Tags */}
      <section className="border-b border-border p-4">
        <h4 className="mb-2 text-xs font-medium text-muted-foreground">Tags</h4>
        <div className="mb-2 flex flex-wrap gap-1">
          {localTags.length === 0 ? (
            <span className="text-xs text-muted-foreground">Sem tags</span>
          ) : (
            localTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remover tag ${tag}`}
                  className="hover:text-danger-600"
                  disabled={isUpdatingTags}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
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
            className="h-8 text-xs"
            disabled={isUpdatingTags || localTags.length >= 20}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={addTag}
            disabled={!newTag.trim() || isUpdatingTags}
          >
            Adicionar
          </Button>
        </div>
      </section>

      {/* Paciente / Lead */}
      {context.patient ? (
        <>
          <section className="border-b border-border p-4">
            <h4 className="mb-2 text-xs font-medium text-muted-foreground">Histórico clínico</h4>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Consultas</dt>
                <dd className="font-medium">{context.patient.totalVisits}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Última visita</dt>
                <dd className="font-medium">
                  {context.patient.lastVisitAt
                    ? formatRelativeTime(context.patient.lastVisitAt)
                    : 'nunca'}
                </dd>
              </div>
            </dl>
          </section>

          {context.patient.nextAppointment && (
            <section className="border-b border-border p-4">
              <h4 className="mb-2 text-xs font-medium text-muted-foreground">Próxima consulta</h4>
              <p className="text-sm font-medium">
                {new Intl.DateTimeFormat('pt-BR', {
                  day:   '2-digit',
                  month: '2-digit',
                  year:  'numeric',
                  hour:  '2-digit',
                  minute:'2-digit',
                }).format(context.patient.nextAppointment.scheduledAt)}
              </p>
              <p className="text-xs text-muted-foreground">{context.patient.nextAppointment.type}</p>
            </section>
          )}

          {context.patient.recentEncounters.length > 0 && (
            <section className="border-b border-border p-4">
              <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                Atendimentos recentes
              </h4>
              <ul className="space-y-2 text-xs">
                {context.patient.recentEncounters.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span className="truncate">{e.summary ?? 'sem resumo'}</span>
                    <time className="flex-none text-muted-foreground">
                      {formatRelativeTime(e.encounteredAt)}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <section className="border-b border-border p-4">
          <p className="mb-2 text-xs text-muted-foreground">
            Este contato ainda é um lead. Vincule-o a um paciente do cadastro
            para unificar o histórico clínico.
          </p>
          <Button size="sm" variant="outline" onClick={onLinkToPatient} className="w-full">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Vincular a paciente
          </Button>
        </section>
      )}
    </aside>
  );
}

'use client';

import * as React from 'react';
import { Switch, Badge, Button } from '@dermaos/ui';
import { Pencil, Trash2, Clock, CheckCircle2, XCircle, SkipForward } from 'lucide-react';
import { triggerLabel } from './trigger-info';
import type { AutomationRow } from '@/lib/types/automation';

interface AutomationTableProps {
  automations:  AutomationRow[];
  isLoading:    boolean;
  onToggle:     (id: string, isActive: boolean) => void;
  onDelete:     (id: string, name: string) => void;
  togglingId:   string | null;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'outline' }> = {
  sent:       { label: 'Enviado',   variant: 'success' },
  skipped:    { label: 'Ignorado',  variant: 'warning' },
  failed:     { label: 'Falha',     variant: 'destructive' },
  processing: { label: 'Pendente',  variant: 'outline' },
};

const CHANNEL_BADGE: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms:      'SMS',
  email:    'E-mail',
};

export function AutomationTable({
  automations,
  isLoading,
  onToggle,
  onDelete,
  togglingId,
}: AutomationTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4" aria-busy="true" aria-label="Carregando automações">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (automations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Clock className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
        <div>
          <p className="font-medium">Nenhuma automação configurada</p>
          <p className="text-sm text-muted-foreground">Crie sua primeira regra de automação.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" role="region" aria-label="Lista de automações">
      <table className="w-full text-sm" aria-label="Automações">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
            <th scope="col" className="px-4 py-3">Nome</th>
            <th scope="col" className="px-4 py-3">Gatilho</th>
            <th scope="col" className="px-4 py-3">Canal</th>
            <th scope="col" className="px-4 py-3">Template</th>
            <th scope="col" className="px-4 py-3">Última Execução</th>
            <th scope="col" className="px-4 py-3 text-center">Ativo</th>
            <th scope="col" className="px-4 py-3 sr-only">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {automations.map((auto) => (
            <AutomationRow
              key={auto.id}
              automation={auto}
              onToggle={onToggle}
              onDelete={onDelete}
              isToggling={togglingId === auto.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface RowProps {
  automation:  AutomationRow;
  onToggle:    (id: string, isActive: boolean) => void;
  onDelete:    (id: string, name: string) => void;
  isToggling:  boolean;
}

function AutomationRow({ automation: a, onToggle, onDelete, isToggling }: RowProps) {
  function handleToggle(checked: boolean) {
    if (!checked) {
      if (!confirm('Desativar esta automação? Jobs pendentes serão cancelados.')) return;
    }
    onToggle(a.id, checked);
  }

  const lastExec = (a as { last_exec_at?: string | null }).last_exec_at;
  const lastExecStatus = (a as { last_exec_status?: string | null }).last_exec_status;

  return (
    <tr className="group hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-medium">{a.name}</td>
      <td className="px-4 py-3">
        <span className="text-muted-foreground">{triggerLabel(a.trigger)}</span>
      </td>
      <td className="px-4 py-3">
        {a.channel_type ? (
          <Badge variant="outline" size="sm">{CHANNEL_BADGE[a.channel_type] ?? a.channel_type}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 max-w-[160px] truncate text-muted-foreground">
        {a.template_name ?? <span className="italic">Sem template</span>}
      </td>
      <td className="px-4 py-3">
        {lastExec ? (
          <div className="flex items-center gap-1.5">
            <ExecStatusIcon status={lastExecStatus ?? ''} />
            <span className="text-xs text-muted-foreground">
              {new Date(lastExec).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Nunca executada</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <Switch
          checked={a.is_active}
          onCheckedChange={handleToggle}
          disabled={isToggling}
          aria-label={a.is_active ? `Desativar ${a.name}` : `Ativar ${a.name}`}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Excluir ${a.name}`}
            onClick={() => onDelete(a.id, a.name)}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ExecStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sent':       return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />;
    case 'failed':     return <XCircle      className="h-3.5 w-3.5 text-destructive"   aria-hidden="true" />;
    case 'skipped':    return <SkipForward  className="h-3.5 w-3.5 text-amber-500"     aria-hidden="true" />;
    default:           return <Clock       className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />;
  }
}

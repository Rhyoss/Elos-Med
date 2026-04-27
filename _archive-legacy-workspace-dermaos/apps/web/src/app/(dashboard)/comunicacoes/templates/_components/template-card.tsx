'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge, Button } from '@dermaos/ui';
import { Pencil, Trash2, MessageSquare, Mail, Phone } from 'lucide-react';
import type { TemplateRow } from '@/lib/types/template';
import { previewTemplate } from '@/lib/template-preview';

interface TemplateCardProps {
  template:  TemplateRow;
  onDelete?: (id: string, name: string) => void;
}

const CHANNEL_ICON: Record<string, React.ElementType> = {
  whatsapp: MessageSquare,
  sms:      Phone,
  email:    Mail,
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms:      'SMS',
  email:    'E-mail',
};

const CHANNEL_COLOR: Record<string, string> = {
  whatsapp: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  sms:      'text-blue-600 bg-blue-50 border-blue-200',
  email:    'text-violet-600 bg-violet-50 border-violet-200',
};

export function TemplateCard({ template: t, onDelete }: TemplateCardProps) {
  const Icon = CHANNEL_ICON[t.channel_type ?? 'whatsapp'] ?? MessageSquare;
  const colorClass = CHANNEL_COLOR[t.channel_type ?? 'whatsapp'] ?? CHANNEL_COLOR['whatsapp']!;
  const preview = previewTemplate(t.body);
  const truncated = preview.length > 120 ? `${preview.slice(0, 119)}…` : preview;

  return (
    <article
      className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
      aria-label={`Template ${t.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}>
            <Icon className="h-3 w-3" aria-hidden="true" />
            {CHANNEL_LABEL[t.channel_type ?? ''] ?? t.channel_type}
          </span>
          {t.is_default && (
            <Badge variant="outline" size="sm" className="text-xs">
              Padrão
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/comunicacoes/templates/${t.id}`} aria-label={`Editar ${t.name}`}>
            <Button size="icon-sm" variant="ghost" asChild={false}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Link>
          {!t.is_default && onDelete && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Excluir ${t.name}`}
              onClick={() => onDelete(t.id, t.name)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Nome */}
      <h3 className="line-clamp-1 text-sm font-medium leading-snug">
        <Link
          href={`/comunicacoes/templates/${t.id}`}
          className="hover:text-primary transition-colors after:absolute after:inset-0"
          aria-label={`Abrir template ${t.name}`}
        >
          {t.name}
        </Link>
      </h3>

      {/* Preview */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
        {truncated}
      </p>

      {/* Footer */}
      <p className="text-xs text-muted-foreground">
        Editado {new Date(t.updated_at).toLocaleDateString('pt-BR', {
          day: '2-digit', month: 'short', year: 'numeric',
        })}
      </p>
    </article>
  );
}

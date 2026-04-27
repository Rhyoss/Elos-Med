import * as React from 'react';
import { cn } from '../utils';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  titleId?: string;
}

/* ── Componente ──────────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  tabs,
  badge,
  className,
  titleId,
}: PageHeaderProps) {
  const headingId = titleId ?? `page-title-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Linha principal: título + ações */}
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1
              id={headingId}
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {actions}
          </div>
        )}
      </div>

      {/* Tabs abaixo do cabeçalho */}
      {tabs && (
        <div className="px-6 border-b border-border -mt-1">
          {tabs}
        </div>
      )}
    </div>
  );
}

/* ── Seção com título interno de página ──────────────────────────────────── */

export interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

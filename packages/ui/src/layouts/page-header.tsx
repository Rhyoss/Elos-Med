import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../utils';
import type { BreadcrumbItem as TopBarBreadcrumb } from './top-bar';

/* ── Breadcrumb item ─────────────────────────────────────────────────────── */

/** Trilha de navegação para PageHeader. Estende o `BreadcrumbItem` do TopBar
 *  adicionando o flag `current` (página atual, não-clicável). Mantém um
 *  único shape canônico de breadcrumb na superfície pública do pacote.   */
export interface PageBreadcrumbItem extends TopBarBreadcrumb {
  current?: boolean;
}

/* ── PageHeader ─────────────────────────────────────────────────────────── */

export interface PageHeaderProps {
  /** Texto curto em mono acima do título (módulo, contexto, breadcrumb-light). */
  eyebrow?: string;
  /** Trilhas de navegação. Renderizadas acima do título com chevron divisor. */
  breadcrumbs?: PageBreadcrumbItem[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  titleId?: string;
}

function Breadcrumbs({ items }: { items: PageBreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Trilha de navegação" className="flex items-center gap-1.5 text-[13px]">
      <ol className="flex items-center gap-1.5 flex-wrap">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          const isCurrent = item.current ?? isLast;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {item.href && !isCurrent ? (
                <a
                  href={item.href}
                  className={cn(
                    'text-muted-foreground hover:text-foreground transition-colors',
                    'focus-visible:outline-none focus-visible:underline focus-visible:text-foreground rounded',
                  )}
                >
                  {item.label}
                </a>
              ) : (
                <span
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  eyebrow,
  breadcrumbs,
  title,
  description,
  actions,
  tabs,
  badge,
  className,
  titleId,
}: PageHeaderProps) {
  const headingId = titleId ?? `page-title-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const hasEyebrowSlot = breadcrumbs?.length || eyebrow;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Linha principal: título + ações */}
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div className="flex flex-col gap-1.5 min-w-0">
          {hasEyebrowSlot ? (
            breadcrumbs?.length ? (
              <Breadcrumbs items={breadcrumbs} />
            ) : (
              <span className="font-mono text-[11px] uppercase tracking-[1px] text-muted-foreground">
                {eyebrow}
              </span>
            )
          ) : null}

          <div className="flex items-center gap-2.5 flex-wrap">
            <h1
              id={headingId}
              className="text-2xl font-semibold tracking-tight text-foreground"
            >
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-[15px] text-muted-foreground leading-relaxed max-w-2xl">
              {description}
            </p>
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
  /** Eyebrow em mono — útil para subseções de prontuário e dashboard. */
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ eyebrow, title, description, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="flex flex-col gap-0.5">
        {eyebrow && (
          <span className="font-mono text-[11px] uppercase tracking-[1px] text-muted-foreground">
            {eyebrow}
          </span>
        )}
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{title}</h2>
        {description && (
          <p className="text-[14px] text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

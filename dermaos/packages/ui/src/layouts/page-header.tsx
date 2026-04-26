import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../utils';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface PageHeaderMeta {
  /** Texto pequeno acima do título — geralmente o módulo ("Pacientes", "Suprimentos") */
  eyebrow?: string;
  /** Botão de voltar */
  back?: { label?: string; href?: string; onClick?: () => void };
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  badge?: React.ReactNode;
  /** Meta extras: eyebrow + back link */
  eyebrow?: string;
  back?: { label?: string; href?: string; onClick?: () => void };
  /** Ícone do domínio (renderiza dentro de pill colorido) */
  icon?: React.ReactNode;
  iconTone?: 'primary' | 'clinical' | 'financial' | 'supply' | 'ai' | 'gold';
  /** Conteúdo arbitrário antes das ações (ex.: filtros, status, métricas inline) */
  meta?: React.ReactNode;
  /** Variante visual */
  variant?: 'default' | 'tight' | 'spacious';
  className?: string;
  titleId?: string;
}

const iconToneClass: Record<NonNullable<PageHeaderProps['iconTone']>, string> = {
  primary:   'bg-primary-100 text-primary-700 dark:bg-primary-100/10',
  clinical:  'bg-clinical-100 text-clinical-700 dark:bg-clinical-100/10',
  financial: 'bg-financial-100 text-financial-700 dark:bg-financial-100/10',
  supply:    'bg-supply-100 text-supply-700 dark:bg-supply-100/10',
  ai:        'bg-ai-100 text-ai-700 dark:bg-ai-100/10',
  gold:      'bg-gold-100 text-gold-700 dark:bg-gold-100/10',
};

/* ── Componente ──────────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  tabs,
  badge,
  eyebrow,
  back,
  icon,
  iconTone = 'primary',
  meta,
  variant = 'default',
  className,
  titleId,
}: PageHeaderProps) {
  const headingId = titleId ?? `page-title-${title.toLowerCase().replace(/\s+/g, '-')}`;

  const verticalSpacing = {
    default:  'py-5',
    tight:    'py-3',
    spacious: 'py-7',
  }[variant];

  return (
    <div className={cn('flex flex-col bg-card border-b border-border/70', className)}>
      {/* Linha principal: ícone + título + ações */}
      <div className={cn('flex items-start justify-between gap-4 px-6', verticalSpacing)}>
        <div className="flex items-start gap-4 min-w-0">
          {icon && (
            <span
              className={cn(
                'domain-icon h-11 w-11 [&_svg]:size-5 mt-0.5',
                iconToneClass[iconTone],
              )}
              aria-hidden="true"
            >
              {icon}
            </span>
          )}

          <div className="flex flex-col gap-1 min-w-0">
            {/* Eyebrow / back */}
            {(eyebrow || back) && (
              <div className="flex items-center gap-2 mb-0.5">
                {back && (
                  back.href ? (
                    <a
                      href={back.href}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1 -mx-1"
                    >
                      <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                      {back.label ?? 'Voltar'}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={back.onClick}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1 -mx-1"
                    >
                      <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                      {back.label ?? 'Voltar'}
                    </button>
                  )
                )}
                {eyebrow && (
                  <span className="text-[11px] uppercase tracking-[0.10em] font-semibold text-muted-foreground">
                    {eyebrow}
                  </span>
                )}
              </div>
            )}

            {/* Título + badge */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1
                id={headingId}
                className="text-xl sm:text-[1.375rem] font-semibold tracking-tight text-foreground leading-tight"
              >
                {title}
              </h1>
              {badge}
            </div>

            {/* Descrição */}
            {description && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {description}
              </p>
            )}

            {/* Meta extras */}
            {meta && (
              <div className="mt-2 flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
                {meta}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {actions}
          </div>
        )}
      </div>

      {/* Tabs abaixo do cabeçalho */}
      {tabs && (
        <div className="px-6 -mt-1">
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
  /** Renderiza um divisor visual */
  bordered?: boolean;
  className?: string;
}

export function SectionHeader({ title, description, actions, bordered, className }: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4',
        bordered && 'pb-3 border-b border-border/70',
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
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

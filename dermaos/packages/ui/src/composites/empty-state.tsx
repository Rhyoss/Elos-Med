import * as React from 'react';
import { cn } from '../utils';
import { Button } from '../primitives/button';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Visual: 'soft' (default) renderiza com background sutil, 'plain' apenas centralizado */
  variant?: 'soft' | 'plain';
  /** Tamanho do bloco */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/* SVG genérico — refinado, com gradiente de marca discreto */
function DefaultEmptyIllustration() {
  return (
    <svg
      width="112"
      height="88"
      viewBox="0 0 112 88"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="emptyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary-200))" stopOpacity="0.5" />
          <stop offset="100%" stopColor="hsl(var(--primary-400))" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <rect x="8" y="14" width="96" height="68" rx="10" fill="url(#emptyGrad)" />
      <rect x="8" y="14" width="96" height="68" rx="10" stroke="hsl(var(--primary) / 0.20)" strokeWidth="1" />
      <rect x="22" y="30" width="44" height="4" rx="2" fill="hsl(var(--muted-foreground) / 0.45)" />
      <rect x="22" y="42" width="32" height="4" rx="2" fill="hsl(var(--muted-foreground) / 0.30)" />
      <rect x="22" y="54" width="38" height="4" rx="2" fill="hsl(var(--muted-foreground) / 0.30)" />
      <circle cx="84" cy="48" r="14" stroke="hsl(var(--primary) / 0.55)" strokeWidth="1.5" fill="hsl(var(--card))" />
      <path d="M84 42v6M84 52h.01" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const sizeClass = {
  sm: 'py-8 px-4 gap-3',
  md: 'py-12 px-6 gap-4',
  lg: 'py-16 px-6 gap-5',
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'plain',
  size = 'md',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-lg',
        sizeClass[size],
        variant === 'soft' && 'bg-muted/30 border border-dashed border-border',
        className,
      )}
      role="region"
      aria-label={title}
    >
      <div className={cn(
        'flex items-center justify-center',
        icon ? 'h-14 w-14 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-100/10' : '',
      )}>
        {icon ?? <DefaultEmptyIllustration />}
      </div>

      <div className="flex flex-col gap-1.5 max-w-sm">
        <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 flex-wrap justify-center pt-1">
          {action && (
            action.href ? (
              <Button variant="primary" size="md" asChild>
                <a href={action.href}>
                  {action.icon}
                  {action.label}
                </a>
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={action.onClick}>
                {action.icon}
                {action.label}
              </Button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Button variant="outline" size="md" asChild>
                <a href={secondaryAction.href}>
                  {secondaryAction.icon}
                  {secondaryAction.label}
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="md" onClick={secondaryAction.onClick}>
                {secondaryAction.icon}
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}

import * as React from 'react';
import { cn } from '../utils';
import { Button } from '../primitives/button';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

/* SVG genérico para estado vazio */
function DefaultEmptyIllustration() {
  return (
    <svg
      width="120"
      height="96"
      viewBox="0 0 120 96"
      fill="none"
      aria-hidden="true"
      className="text-muted-foreground/30"
    >
      <rect x="10" y="16" width="100" height="72" rx="8" stroke="currentColor" strokeWidth="2" />
      <rect x="24" y="32" width="48" height="4" rx="2" fill="currentColor" />
      <rect x="24" y="44" width="32" height="4" rx="2" fill="currentColor" />
      <rect x="24" y="56" width="40" height="4" rx="2" fill="currentColor" />
      <circle cx="88" cy="52" r="16" stroke="currentColor" strokeWidth="2" />
      <path d="M88 46v6M88 54h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 px-6 text-center',
        className,
      )}
      role="region"
      aria-label={title}
    >
      <div className="text-muted-foreground/40">
        {icon ?? <DefaultEmptyIllustration />}
      </div>

      <div className="flex flex-col gap-1.5 max-w-md">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
        {description && (
          <p className="text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {action && (
            <Button
              variant="primary"
              size="md"
              onClick={action.onClick}
              {...(action.href ? { asChild: true } : {})}
            >
              {action.href ? (
                <a href={action.href}>{action.label}</a>
              ) : (
                action.label
              )}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              size="md"
              onClick={secondaryAction.onClick}
              {...(secondaryAction.href ? { asChild: true } : {})}
            >
              {secondaryAction.href ? (
                <a href={secondaryAction.href}>{secondaryAction.label}</a>
              ) : (
                secondaryAction.label
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

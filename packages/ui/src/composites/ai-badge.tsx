import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../utils';
import { Tooltip } from '../primitives/tooltip';

export interface AiBadgeProps {
  size?: 'inline' | 'standalone';
  className?: string;
  tooltipContent?: string;
}

export function AiBadge({
  size = 'standalone',
  className,
  tooltipContent = 'Sugerido por inteligência artificial — revisar antes de aceitar',
}: AiBadgeProps) {
  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium border border-ai/30 bg-ai-100 text-ai-700',
        'dark:bg-ai-100/10 dark:text-ai-700',
        size === 'inline'
          ? 'px-1.5 py-0.5 text-xs'
          : 'px-2 py-0.5 text-xs',
        className,
      )}
      aria-label="Gerado por IA"
    >
      <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
      IA
    </span>
  );

  return (
    <Tooltip content={tooltipContent} side="top">
      {badge}
    </Tooltip>
  );
}

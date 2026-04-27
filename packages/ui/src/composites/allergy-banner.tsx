'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../utils';

export interface AllergyBannerProps {
  allergies: string[];
  className?: string;
}

export function AllergyBanner({ allergies, className }: AllergyBannerProps) {
  if (allergies.length === 0) return null;

  const allergyList = allergies.join(', ');

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={cn(
        'sticky top-0 flex items-center gap-2 px-4 py-2.5 bg-danger-500 text-white text-sm font-semibold',
        'select-none',
        className,
      )}
      style={{ zIndex: 'var(--z-critical-alert)' }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        ALERGIAS:{' '}
        <span className="font-bold uppercase tracking-wide">{allergyList}</span>
      </span>
    </div>
  );
}

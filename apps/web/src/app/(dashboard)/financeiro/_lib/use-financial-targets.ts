'use client';

import * as React from 'react';
import { useAuthStore } from '@/stores/auth-store';

export interface FinancialTargets {
  /** Total revenue target for the month (cents). */
  totalRevenue: number;
  /** Per-provider monthly target (cents). */
  perProvider: Record<string, number>;
  /** Per-method monthly target (cents). */
  perMethod: Partial<Record<string, number>>;
  /** When the target was last edited (ISO). */
  updatedAt: string | null;
}

const EMPTY: FinancialTargets = {
  totalRevenue: 0,
  perProvider:  {},
  perMethod:    {},
  updatedAt:    null,
};

function storageKey(clinicId: string, monthIso: string) {
  return `dermaos:financial-targets:${clinicId}:${monthIso}`;
}

/**
 * Persists per-clinic, per-month financial targets in `localStorage`.
 *
 * Note: this is intentionally client-side persisted — there is no `goals`
 * backend yet. When the API gains it, replace this hook in place; the UI
 * layer above does not need to change.
 */
export function useFinancialTargets(monthIso: string): {
  targets: FinancialTargets;
  setTargets: (next: FinancialTargets) => void;
  reset: () => void;
} {
  const clinicId = useAuthStore((s) => s.clinic?.id ?? 'unknown');
  const key = React.useMemo(
    () => storageKey(clinicId, monthIso),
    [clinicId, monthIso],
  );

  const [targets, setTargetsState] = React.useState<FinancialTargets>(EMPTY);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as FinancialTargets;
        setTargetsState({ ...EMPTY, ...parsed });
      } else {
        setTargetsState(EMPTY);
      }
    } catch {
      setTargetsState(EMPTY);
    }
  }, [key]);

  const setTargets = React.useCallback(
    (next: FinancialTargets) => {
      const updated = { ...next, updatedAt: new Date().toISOString() };
      setTargetsState(updated);
      try {
        window.localStorage.setItem(key, JSON.stringify(updated));
      } catch {
        /* quota exhausted — ignore */
      }
    },
    [key],
  );

  const reset = React.useCallback(() => {
    setTargetsState(EMPTY);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);

  return { targets, setTargets, reset };
}

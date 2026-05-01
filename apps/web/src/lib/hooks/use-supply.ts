/**
 * use-supply.ts
 *
 * Hooks tipados para produtos, lotes, FEFO, kits e consumo.
 *
 * Endpoints consumidos:
 *   trpc.supply.products.search       → useProductSearch
 *   trpc.supply.products.getById      → useProduct
 *   trpc.supply.lots.list             → useLots
 *   trpc.supply.lots.fefoSuggest      → useFefoSuggestion
 *   trpc.supply.kits.list             → useKits
 *   trpc.supply.kits.getById          → useKit
 *   trpc.supply.kits.availability→ useKitAvailability
 *   trpc.supply.consumption.consume   → useConsumeKit
 *   trpc.supply.consumption.list      → useConsumptions
 */

'use client';

import { trpc } from '@/lib/trpc-provider';

/* ── Products ──────────────────────────────────────────────────────────── */

export function useProductSearch(query: string, page = 1, perPage = 20) {
  return trpc.supply.products.search.useQuery(
    { query, page, perPage },
    { enabled: query.length >= 2, staleTime: 30_000 },
  );
}

export function useProduct(productId: string) {
  return trpc.supply.products.getById.useQuery(
    { id: productId },
    { enabled: !!productId, staleTime: 60_000 },
  );
}

export function useProducts(search?: string, page = 1) {
  return trpc.supply.products.list.useQuery(
    { search, page, limit: 50 },
    { staleTime: 30_000 },
  );
}

/* ── Lots ──────────────────────────────────────────────────────────────── */

export function useLots(productId?: string, page = 1) {
  return trpc.supply.lots.list.useQuery(
    { productId, page, limit: 50, includeConsumed: false },
    { enabled: !!productId, staleTime: 15_000 },
  );
}

export function useFefoSuggestion(productId: string, quantity: number) {
  return trpc.supply.lots.fefoSuggest.useQuery(
    { productId, quantity },
    { enabled: !!productId && quantity > 0, staleTime: 10_000 },
  );
}

/* ── Kits ──────────────────────────────────────────────────────────────── */

export function useKits(search?: string, page = 1) {
  return trpc.supply.kits.list.useQuery(
    { search, page, limit: 50 },
    { staleTime: 30_000 },
  );
}

export function useKit(kitId: string) {
  return trpc.supply.kits.getById.useQuery(
    { id: kitId },
    { enabled: !!kitId, staleTime: 30_000 },
  );
}

export function useKitAvailability(kitId: string) {
  return trpc.supply.kits.availability.useQuery(
    { kitId },
    { enabled: !!kitId, staleTime: 10_000 },
  );
}

/* ── Consumption ──────────────────────────────────────────────────────── */

export function useConsumeKit(patientId: string) {
  const utils = trpc.useUtils();

  return trpc.supply.consumption.consume.useMutation({
    onSuccess: () => {
      void utils.supply.consumption.list.invalidate();
      void utils.supply.kits.availability.invalidate();
      void utils.supply.lots.list.invalidate();
      void utils.supply.lots.fefoSuggest.invalidate();
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
    },
  });
}

export function useConsumptions(patientId?: string, page = 1) {
  return trpc.supply.consumption.list.useQuery(
    { patientId, page, limit: 50 },
    { enabled: !!patientId, staleTime: 30_000 },
  );
}

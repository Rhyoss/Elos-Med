/**
 * WebSocket connection tracking for Socket.io room management.
 *
 * Internal Map<tenantId, count> keeps per-tenant counts for socket room
 * operations. Prometheus metrics intentionally do NOT include tenant_id as a
 * label (would cause memory explosion with many tenants).
 * Only the aggregate total is exposed via getTotalConnections(), which
 * prometheus.ts calls when rendering the active_connections gauge.
 */

const activeConnections = new Map<string, number>();

export function incrementConnections(tenantId: string): void {
  activeConnections.set(tenantId, (activeConnections.get(tenantId) ?? 0) + 1);
}

export function decrementConnections(tenantId: string): void {
  const next = Math.max(0, (activeConnections.get(tenantId) ?? 0) - 1);
  if (next === 0) activeConnections.delete(tenantId);
  else            activeConnections.set(tenantId, next);
}

export function getTotalConnections(): number {
  let total = 0;
  for (const count of activeConnections.values()) total += count;
  return total;
}

export function getConnectionsForTenant(tenantId: string): number {
  return activeConnections.get(tenantId) ?? 0;
}

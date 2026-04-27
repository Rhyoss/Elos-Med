'use client';

/**
 * Backward-compatible re-exports from the new use-socket module.
 * Existing consumers of useRealtime / getRealtimeSocket continue to work unchanged.
 */
export { useSocket as useRealtime, getSocket as getRealtimeSocket } from './use-socket';

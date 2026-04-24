import type { Pool } from 'pg';
import type { Logger } from 'pino';

/**
 * Limpa holds expirados em shared.scheduling_holds (Anexo A §A.2.3).
 * Repeatable job BullMQ — executa a cada 60s.
 *
 * Roda no role do worker (dermaos_worker) — não depende de RLS; é uma
 * varredura global por `expires_at < NOW()`.
 */
export function buildSchedulingHoldsCleanupProcessor(
  workerDb: Pool,
  logger:   Logger,
) {
  return async function processCleanup(): Promise<void> {
    const result = await workerDb.query<{ hold_token: string }>(
      `DELETE FROM shared.scheduling_holds
        WHERE expires_at < NOW()
      RETURNING hold_token`,
    );
    if (result.rowCount && result.rowCount > 0) {
      logger.info(
        { queue: 'scheduling-holds-cleanup', deleted: result.rowCount },
        'scheduling_holds.expired_cleanup',
      );
    }
  };
}

/**
 * Setup por arquivo de teste de integração.
 * Expõe um cliente de banco de dados conectado e fornece
 * helpers para isolamento por transação.
 */
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

let pool: Pool;
let txClient: PoolClient;

// ── Pool global por arquivo de teste ─────────────────────────────────────────

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
});

afterAll(async () => {
  await pool.end();
});

// ── Isolamento: cada teste em sua própria transação com rollback ──────────────

beforeEach(async () => {
  txClient = await pool.connect();
  await txClient.query('BEGIN');
  // Expõe o cliente transacional globalmente para factories e helpers
  (globalThis as Record<string, unknown>).__TX_CLIENT__ = txClient;
});

afterEach(async () => {
  await txClient.query('ROLLBACK');
  txClient.release();
  (globalThis as Record<string, unknown>).__TX_CLIENT__ = undefined;
});

// ── Helpers exportados ────────────────────────────────────────────────────────

/** Retorna o PoolClient da transação corrente do teste. */
export function getTxClient(): PoolClient {
  const client = (globalThis as Record<string, unknown>).__TX_CLIENT__ as PoolClient | undefined;
  if (!client) throw new Error('[db-setup] getTxClient chamado fora de contexto de teste');
  return client;
}

/** Pool sem transação — para operações que precisam de auto-commit (raro). */
export { pool as testPool };

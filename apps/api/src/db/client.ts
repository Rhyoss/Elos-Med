import { Pool, type PoolClient } from 'pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export const db = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

db.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

db.on('connect', () => {
  logger.debug('PostgreSQL connection acquired from pool');
});

/**
 * Executa callback dentro de uma transação com clinic_id setado no contexto da sessão.
 * Garante que RLS aplica corretamente o isolamento multi-tenant.
 */
export async function withClinicContext<T>(
  clinicId: string,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // SET não aceita placeholders — usa set_config(name, value, is_local).
    // Variável lida pela função shared.current_clinic_id() nas policies RLS.
    await client.query(`SELECT set_config('app.current_clinic_id', $1, true)`, [clinicId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verifica se o banco de dados está acessível (usado no readiness check).
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

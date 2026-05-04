import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient } from 'pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/* ─────────────────────────────────────────────────────────────────────────
   SEC-02 — Multi-tenant isolation por AsyncLocalStorage
   ─────────────────────────────────────────────────────────────────────────
   O middleware tRPC `withClinicScope` adquire um PoolClient por requisição,
   abre transação, faz `SET LOCAL app.current_clinic_id` e roda o handler
   dentro de `clientStorage.run(client, ...)`. O proxy `db` exportado abaixo
   roteia QUALQUER `db.query(...)` que aconteça durante a request para esse
   client scoped — RLS é aplicada automaticamente, sem precisar refatorar
   centenas de chamadas.

   Para procedures públicas (sem clinicId no JWT), `clientStorage.getStore()`
   retorna undefined e o proxy delega ao pool. Procedures públicas que
   precisam ler tabelas com RLS habilitada devem usar funções
   `SECURITY DEFINER` (ver `db/init/100_security_definer_functions.sql`).
   ───────────────────────────────────────────────────────────────────────── */

export const clientStorage = new AsyncLocalStorage<PoolClient>();

/** Retorna o client scoped da request atual (ou null se fora de scope). */
export function getScopedClient(): PoolClient | null {
  return clientStorage.getStore() ?? null;
}

// Cloud SQL Unix socket (/cloudsql/...) tem `:` no path e quebra URLs.
// Usamos config-objeto do pg, que aceita socket nativamente quando host começa
// com `/`. Para conexão TCP comum, mantemos `connectionString`.
function buildPoolConfig() {
  if (env.DATABASE_URL) return { connectionString: env.DATABASE_URL };
  return {
    host:     env.POSTGRES_HOST!,
    port:     env.POSTGRES_PORT,
    user:     env.POSTGRES_APP_USER,
    password: env.POSTGRES_APP_PASSWORD!,
    database: env.POSTGRES_DB,
  };
}

const realPool = new Pool({
  ...buildPoolConfig(),
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

realPool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

realPool.on('connect', () => {
  logger.debug('PostgreSQL connection acquired from pool');
});

/**
 * Pool "puro", sem roteamento ALS. Reservado para casos específicos
 * (health checks, withClinicContext fora de tRPC, e funções SD que
 * precisam ouvir bypass explícito). NÃO use em código de domínio.
 */
export const pool = realPool;

/**
 * Proxy do Pool: `db.query(...)` prefere o client scoped da request quando
 * existe; só cai no pool global quando não há scope (rotas públicas).
 *
 * Mantém a API `Pool` original — toda chamada como `db.connect()`,
 * `db.end()`, `db.on(...)` continua funcionando.
 */
export const db: Pool = new Proxy(realPool, {
  get(target, prop, receiver) {
    if (prop === 'query') {
      return (sql: unknown, params?: unknown) => {
        const scoped = clientStorage.getStore();
        // pg type permite os mesmos overloads em PoolClient e Pool
        const runner = (scoped ?? target) as Pool;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (runner.query as any)(sql, params);
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});

/**
 * Executa callback dentro de uma transação com `app.current_clinic_id`
 * setado e o client publicado via AsyncLocalStorage.
 *
 * Usado por:
 *   - middleware tRPC `withClinicScope` (cobre toda procedure protegida)
 *   - workers e setImmediate (que perdem o ALS context da request original)
 */
export async function withClinicContext<T>(
  clinicId: string,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await realPool.connect();
  try {
    await client.query('BEGIN');
    // SEC-02 + main: usa `set_config(name, value, is_local=true)` que aceita
    // parâmetros via protocolo (mais robusto que `SET LOCAL ... = $1`, que
    // não passa parâmetros no protocolo de prepared statements). O efeito
    // é o mesmo: GUC válido apenas até o fim da transação corrente.
    await client.query('SELECT set_config($1, $2, true)', [
      'app.current_clinic_id',
      clinicId,
    ]);
    return await clientStorage.run(client, async () => {
      try {
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      }
    });
  } finally {
    client.release();
  }
}

/**
 * Verifica se o banco de dados está acessível (usado no readiness check).
 * Usa o pool puro — não exige escopo de clínica.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await realPool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

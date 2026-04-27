/**
 * Global setup para testes de integração.
 * Executa UMA VEZ antes de todos os testes: inicia containers PG + Redis,
 * roda migrations e expõe URLs via process.env para os testes.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __PG_CONTAINER__: StartedPostgreSqlContainer;
  // eslint-disable-next-line no-var
  var __REDIS_CONTAINER__: StartedRedisContainer;
}

const DB_INIT_DIR = resolve(process.cwd(), '../../db/init');

async function runMigrations(connectionString: string): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const files = readdirSync(DB_INIT_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // ordem numérica garante execução correta

    for (const file of files) {
      const sql = readFileSync(resolve(DB_INIT_DIR, file), 'utf8');
      console.log(`[migration] running ${file}...`);
      await client.query(sql);
    }
    console.log(`[migration] completed ${files.length} files`);
  } finally {
    await client.end();
  }
}

export async function setup(): Promise<void> {
  console.log('[global-setup] starting testcontainers...');

  // Versão deve ser igual à produção (ver docker-compose.yml)
  const [pgContainer, redisContainer] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('dermaos_test')
      .withUsername('dermaos')
      .withPassword('dermaos_test_pass')
      .withReuse() // reutiliza container entre runs locais — acelera feedback loop
      .start(),
    new RedisContainer('redis:7-alpine')
      .withReuse()
      .start(),
  ]);

  globalThis.__PG_CONTAINER__   = pgContainer;
  globalThis.__REDIS_CONTAINER__ = redisContainer;

  const pgUrl    = pgContainer.getConnectionUri();
  const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getFirstMappedPort()}`;

  // Expõe via process.env para que modules como db/client.ts possam ler
  process.env['DATABASE_URL'] = pgUrl;
  process.env['REDIS_URL']    = redisUrl;
  // Env vars mínimas para modules que lêem env.ts ao importar
  process.env['NODE_ENV']               = 'test';
  process.env['JWT_SECRET']             = 'integration-test-jwt-secret-min-32-chars!';
  process.env['JWT_REFRESH_SECRET']     = 'integration-test-refresh-secret-32chars!';
  process.env['MASTER_ENCRYPTION_KEY']  = 'a'.repeat(64);
  process.env['MASTER_KEY_VERSION']     = '1';
  process.env['ENCRYPTION_KEY']         = 'b'.repeat(64);
  process.env['TENANT_HMAC_SECRET']     = 'integration-test-hmac-secret-min-32chars!';
  process.env['MINIO_ENDPOINT']         = 'localhost';
  process.env['MINIO_ACCESS_KEY']       = 'minioadmin';
  process.env['MINIO_SECRET_KEY']       = 'minioadmin';
  process.env['TYPESENSE_HOST']         = 'localhost';
  process.env['TYPESENSE_API_KEY']      = 'test-key';

  await runMigrations(pgUrl);

  console.log(`[global-setup] PG ready at ${pgUrl}`);
  console.log(`[global-setup] Redis ready at ${redisUrl}`);
}

export async function teardown(): Promise<void> {
  console.log('[global-teardown] stopping containers...');
  await Promise.all([
    globalThis.__PG_CONTAINER__?.stop(),
    globalThis.__REDIS_CONTAINER__?.stop(),
  ]);
}

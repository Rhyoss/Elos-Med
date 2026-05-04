#!/usr/bin/env node
/**
 * Migration runner — executa `db/init/*.sql` em ordem, rastreando o estado
 * na tabela `public.schema_migrations`. Idempotente: pula arquivos já aplicados.
 *
 * Env vars (injetadas pelo Cloud Run Job):
 *   POSTGRES_ADMIN_USER, POSTGRES_ADMIN_PASSWORD
 *   POSTGRES_HOST (Cloud SQL socket: /cloudsql/project:region:instance)
 *   POSTGRES_PORT, POSTGRES_DB
 */

import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

// SQL files live at <project-root>/db/init/ — two levels up from dist/db/
const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/init');

function buildConnectionConfig() {
  const host = process.env['POSTGRES_HOST'] ?? 'localhost';
  const isSocket = host.startsWith('/');

  return {
    user: process.env['POSTGRES_ADMIN_USER'] ?? 'dermaos_admin',
    password: process.env['POSTGRES_ADMIN_PASSWORD'] ?? '',
    database: process.env['POSTGRES_DB'] ?? 'dermaos',
    port: parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
    // Cloud SQL Unix socket: pg accepts it via `host` when it starts with /
    ...(isSocket ? { host } : { host }),
    ssl: false,
    connectionTimeoutMillis: 30_000,
    statement_timeout: 300_000, // 5 min — migrations podem ser longas
  };
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name       TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getApplied(client: Client): Promise<Set<string>> {
  const { rows } = await client.query<{ name: string }>(
    'SELECT name FROM public.schema_migrations ORDER BY name',
  );
  return new Set(rows.map((r) => r.name));
}

function getSqlFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations dir not found: ${MIGRATIONS_DIR}`);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function applyMigration(client: Client, file: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(filePath, 'utf-8');

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'INSERT INTO public.schema_migrations (name) VALUES ($1)',
      [file],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════');
  console.log(' DermaOS — Migration Runner');
  console.log('═══════════════════════════════════════');

  const config = buildConnectionConfig();
  console.log(`Connecting to ${config.database} as ${config.user}...`);

  const client = new Client(config);
  await client.connect();
  console.log('Connected.\n');

  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    const files = getSqlFiles();

    console.log(`Found ${files.length} migration files, ${applied.size} already applied.\n`);

    let ran = 0;
    let skipped = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  ✓ skip  ${file}`);
        skipped++;
        continue;
      }

      process.stdout.write(`  ▶ apply ${file} ... `);
      const t0 = Date.now();
      await applyMigration(client, file);
      console.log(`done (${Date.now() - t0}ms)`);
      ran++;
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(` Applied: ${ran} | Skipped: ${skipped}`);
    console.log(`═══════════════════════════════════════`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n✗ Migration failed:', err.message ?? err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});

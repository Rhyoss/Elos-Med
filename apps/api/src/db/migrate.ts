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
  const isProd = process.env['NODE_ENV'] === 'production';
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => {
      if (!f.endsWith('.sql')) return false;
      // Seed data é apenas para desenvolvimento local
      if (isProd && f.includes('seed')) return false;
      return true;
    })
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

async function printDiagnostics(client: Client): Promise<void> {
  console.log('\n── DIAGNOSTICS ────────────────────────────────');

  // Current user and PG version
  const { rows: info } = await client.query<{ current_user: string; version: string }>(
    'SELECT current_user, version()',
  );
  console.log(`  current_user : ${info[0]?.current_user}`);
  console.log(`  pg_version   : ${info[0]?.version}`);

  // Schema owners
  const { rows: schemas } = await client.query<{ nspname: string; owner: string }>(
    `SELECT nspname, pg_get_userbyid(nspowner) AS owner
       FROM pg_namespace
      WHERE nspname IN ('shared','clinical','omni','supply','financial','analytics','audit','public')
      ORDER BY nspname`,
  );
  console.log('  Schema owners:');
  for (const r of schemas) console.log(`    ${r.nspname.padEnd(12)} owner=${r.owner}`);

  // Role attributes for key roles
  const { rows: roles } = await client.query<{
    rolname: string; rolsuper: boolean; rolbypassrls: boolean; rolcanlogin: boolean;
  }>(
    `SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
       FROM pg_roles
      WHERE rolname IN ('dermaos_admin','dermaos_authn','dermaos_app','dermaos_worker')
      ORDER BY rolname`,
  );
  console.log('  Role attributes:');
  for (const r of roles) {
    console.log(`    ${r.rolname.padEnd(20)} super=${r.rolsuper} bypassrls=${r.rolbypassrls} canlogin=${r.rolcanlogin}`);
  }

  // dermaos_admin membership in dermaos_authn
  const { rows: membership } = await client.query<{ is_member: boolean }>(
    `SELECT pg_has_role('dermaos_admin', 'dermaos_authn', 'MEMBER') AS is_member`,
  );
  console.log(`  dermaos_admin member of dermaos_authn: ${membership[0]?.is_member}`);

  // Schema privileges for dermaos_admin
  const schemaNames = ['shared', 'omni', 'clinical', 'supply', 'financial', 'analytics', 'audit'];
  console.log('  dermaos_admin schema privileges:');
  for (const s of schemaNames) {
    const { rows: privs } = await client.query<{ usage: boolean; create: boolean }>(
      `SELECT has_schema_privilege('dermaos_admin', $1, 'USAGE') AS usage,
              has_schema_privilege('dermaos_admin', $1, 'CREATE') AS create`,
      [s],
    );
    const p = privs[0];
    if (p) console.log(`    ${s.padEnd(12)} usage=${p.usage} create=${p.create}`);
  }

  // dermaos_authn schema privileges
  console.log('  dermaos_authn schema privileges:');
  for (const s of ['shared', 'omni']) {
    const { rows: privs } = await client.query<{ usage: boolean }>(
      `SELECT has_schema_privilege('dermaos_authn', $1, 'USAGE') AS usage`,
      [s],
    );
    const p = privs[0];
    if (p) console.log(`    ${s.padEnd(12)} usage=${p.usage}`);
  }

  // Table privileges for dermaos_authn
  const tables = [
    ['shared', 'users'],
    ['shared', 'clinics'],
    ['omni', 'channels'],
  ];
  console.log('  dermaos_authn table privileges:');
  for (const [schema, table] of tables) {
    const { rows: privs } = await client.query<{ select: boolean; update: boolean }>(
      `SELECT has_table_privilege('dermaos_authn', $1, 'SELECT') AS select,
              has_table_privilege('dermaos_authn', $1, 'UPDATE') AS update`,
      [`${schema}.${table}`],
    );
    const p = privs[0];
    if (p) console.log(`    ${schema}.${table.padEnd(10)} select=${p.select} update=${p.update}`);
  }

  console.log('── END DIAGNOSTICS ────────────────────────────\n');
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════');
  console.log(' DermaOS — Migration Runner');
  console.log('═══════════════════════════════════════');

  const config = buildConnectionConfig();
  console.log(`Connecting to ${config.database} as ${config.user}...`);

  const client = new Client(config);
  client.on('notice', (msg) => console.log(`  [PG] ${msg.severity}: ${msg.message}`));
  await client.connect();
  console.log('Connected.\n');

  try {
    await printDiagnostics(client);
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

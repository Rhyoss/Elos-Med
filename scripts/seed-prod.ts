#!/usr/bin/env tsx
/**
 * seed-prod.ts — Seed mínimo de produção: 1 clínica + 1 usuário owner.
 *
 * Uso:
 *   DATABASE_ADMIN_URL="postgres://..." \
 *   CLINIC_NAME="Clínica Elos" \
 *   CLINIC_SLUG="elos" \
 *   ADMIN_EMAIL="admin@elos.com.br" \
 *   ADMIN_PASSWORD="SenhaForte123!" \
 *   pnpm tsx scripts/seed-prod.ts
 *
 * Requer conexão com usuário que tenha BYPASSRLS (dermaos_admin ou superuser).
 * Para Cloud SQL via proxy local: DATABASE_ADMIN_URL="postgres://dermaos_admin:<pw>@localhost:5432/dermaos"
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import argon2 from 'argon2';
import pg from 'pg';

const { Pool } = pg;

// ─── helpers ────────────────────────────────────────────────────────────────

function env(key: string): string | undefined {
  return process.env[key];
}

async function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  // Aceita URL completa OU componentes separados (evita encoding de caracteres especiais na URL)
  const databaseUrl = env('DATABASE_ADMIN_URL');
  const pgHost     = env('POSTGRES_ADMIN_HOST') ?? 'localhost';
  const pgPort     = parseInt(env('POSTGRES_ADMIN_PORT') ?? '5432', 10);
  const pgUser     = env('POSTGRES_ADMIN_USER') ?? 'dermaos_admin';
  const pgPassword = env('POSTGRES_ADMIN_PASSWORD');
  const pgDb       = env('POSTGRES_ADMIN_DB') ?? 'dermaos';

  if (!databaseUrl && !pgPassword) {
    console.error('❌  Defina DATABASE_ADMIN_URL ou POSTGRES_ADMIN_PASSWORD.');
    console.error('    Requer usuário com BYPASSRLS (dermaos_admin ou superuser).');
    process.exit(1);
  }

  const poolConfig = databaseUrl
    ? { connectionString: databaseUrl }
    : { host: pgHost, port: pgPort, user: pgUser, password: pgPassword!, database: pgDb };

  const rl = createInterface({ input: stdin, output: stdout });

  const clinicName  = env('CLINIC_NAME')     || await prompt(rl, 'Nome da clínica: ');
  const clinicSlug  = env('CLINIC_SLUG')     || await prompt(rl, 'Slug (subdomínio, ex: elos): ');
  const adminEmail  = env('ADMIN_EMAIL')     || await prompt(rl, 'E-mail do admin: ');
  const adminName   = env('ADMIN_NAME')      || await prompt(rl, 'Nome completo do admin: ');
  const adminPass   = env('ADMIN_PASSWORD')  || await prompt(rl, 'Senha do admin (min 12 chars): ');

  rl.close();

  if (adminPass.length < 12) {
    console.error('❌  Senha deve ter pelo menos 12 caracteres.');
    process.exit(1);
  }

  if (!/^[a-z0-9-]+$/.test(clinicSlug)) {
    console.error('❌  Slug deve conter apenas letras minúsculas, números e hífens.');
    process.exit(1);
  }

  console.log('\n🔐  Gerando hash da senha (argon2id)...');
  const passwordHash = await argon2.hash(adminPass, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const pool = new Pool(poolConfig);

  try {
    const client = await pool.connect();
    console.log('✅  Conectado ao banco.');

    try {
      await client.query('BEGIN');

      // ── 1. Clínica ──────────────────────────────────────────────────────
      const clinicRes = await client.query<{ id: string }>(
        `INSERT INTO shared.clinics (name, slug, plan, plan_limits, trial_ends_at, onboarded_at)
         VALUES ($1, $2, 'professional', '{"max_patients":9999,"max_users":50}', NULL, NOW())
         RETURNING id`,
        [clinicName, clinicSlug],
      );
      const clinicId = clinicRes.rows[0].id;
      console.log(`✅  Clínica criada: ${clinicName} (id=${clinicId})`);

      // ── 2. Usuário owner ─────────────────────────────────────────────────
      const userRes = await client.query<{ id: string }>(
        `INSERT INTO shared.users
           (clinic_id, name, email, password_hash, role, is_active, is_email_verified, password_changed_at)
         VALUES ($1, $2, $3, $4, 'owner', true, true, NOW())
         RETURNING id`,
        [clinicId, adminName, adminEmail, passwordHash],
      );
      const userId = userRes.rows[0].id;
      console.log(`✅  Usuário owner criado: ${adminEmail} (id=${userId})`);

      await client.query('COMMIT');

      console.log('\n─────────────────────────────────────────────');
      console.log('🎉  Seed concluído com sucesso!');
      console.log(`    Clínica : ${clinicName} (slug="${clinicSlug}")`);
      console.log(`    Login   : ${adminEmail}`);
      console.log(`    Senha   : [a que você digitou]`);
      console.log('─────────────────────────────────────────────');
      console.log('\n⚠️   Guarde as credenciais em local seguro (1Password, etc.).');

    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }

  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌  Seed falhou:', err.message ?? err);
  process.exit(1);
});

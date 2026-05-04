#!/usr/bin/env node
/**
 * Production seed — cria 1 clínica + 1 usuário owner.
 * Idempotente: re-rodar não duplica nem altera (só imprime as credenciais).
 *
 * Env vars (Cloud Run Job):
 *   POSTGRES_ADMIN_USER, POSTGRES_ADMIN_PASSWORD,
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB
 *   SEED_CLINIC_SLUG (default: demo)
 *   SEED_CLINIC_NAME (default: DermaOS Demo)
 *   SEED_ADMIN_EMAIL (required)
 *   SEED_ADMIN_NAME  (default: Admin)
 *   SEED_ADMIN_PASSWORD (default: gera senha forte aleatória)
 */

import argon2 from 'argon2';
import crypto from 'node:crypto';
import { Client } from 'pg';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

function buildConnectionConfig() {
  return {
    user: process.env['POSTGRES_ADMIN_USER'] ?? 'dermaos_admin',
    password: process.env['POSTGRES_ADMIN_PASSWORD'] ?? '',
    database: process.env['POSTGRES_DB'] ?? 'dermaos',
    host: process.env['POSTGRES_HOST'] ?? 'localhost',
    port: parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
    ssl: false,
    connectionTimeoutMillis: 30_000,
  };
}

function generatePassword(): string {
  // 24 chars: alpha + digits + symbols, atende exigência SEC-12 (>=12 chars)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const buf = crypto.randomBytes(24);
  return Array.from(buf, (b) => alphabet[b % alphabet.length]).join('');
}

async function main(): Promise<void> {
  const adminEmail = process.env['SEED_ADMIN_EMAIL']?.toLowerCase().trim();
  if (!adminEmail) {
    console.error('SEED_ADMIN_EMAIL é obrigatório');
    process.exit(1);
  }
  const clinicSlug = (process.env['SEED_CLINIC_SLUG'] ?? 'demo').toLowerCase().trim();
  const clinicName = process.env['SEED_CLINIC_NAME'] ?? 'DermaOS Demo';
  const adminName = process.env['SEED_ADMIN_NAME'] ?? 'Admin';
  const adminPasswordEnv = process.env['SEED_ADMIN_PASSWORD'];

  console.log('═══════════════════════════════════════');
  console.log(' DermaOS — Production Seed');
  console.log('═══════════════════════════════════════');

  const client = new Client(buildConnectionConfig());
  await client.connect();
  console.log(`Connected as ${(await client.query('SELECT current_user')).rows[0].current_user}`);

  // Conceder INSERT/UPDATE/DELETE em clinics+users a dermaos_authn (apenas
  // necessário aqui; produção usa SD functions que já têm o necessário).
  // dermaos_admin é o owner das tabelas, então pode fazer GRANT.
  await client.query(`
    GRANT INSERT, UPDATE, DELETE ON shared.clinics TO dermaos_authn;
    GRANT INSERT,         DELETE ON shared.users   TO dermaos_authn;
  `);

  // dermaos_authn tem BYPASSRLS — necessário p/ inserir sem clinic_id GUC
  await client.query('SET ROLE dermaos_authn');

  const diag = await client.query<{
    current_user: string; bypass: boolean;
    sel_clinics: boolean; ins_clinics: boolean; ins_users: boolean;
  }>(
    `SELECT current_user,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            has_table_privilege(current_user, 'shared.clinics', 'SELECT') AS sel_clinics,
            has_table_privilege(current_user, 'shared.clinics', 'INSERT') AS ins_clinics,
            has_table_privilege(current_user, 'shared.users',   'INSERT') AS ins_users`,
  );
  console.log('Diagnostics:', diag.rows[0]);

  try {
    // ─── Clínica (idempotente por slug) ──────────────────────────────────────
    const existingClinic = await client.query<{ id: string }>(
      'SELECT id FROM shared.clinics WHERE slug = $1',
      [clinicSlug],
    );

    let clinicId: string;
    if (existingClinic.rowCount && existingClinic.rows[0]) {
      clinicId = existingClinic.rows[0].id;
      console.log(`✓ Clínica '${clinicSlug}' já existe (id=${clinicId})`);
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO shared.clinics (slug, name, plan, is_active)
         VALUES ($1, $2, 'trial', true)
         RETURNING id`,
        [clinicSlug, clinicName],
      );
      clinicId = inserted.rows[0]!.id;
      console.log(`+ Clínica criada: ${clinicName} (slug=${clinicSlug}, id=${clinicId})`);
    }

    // ─── Usuário admin (idempotente por email) ───────────────────────────────
    const existingUser = await client.query<{ id: string; clinic_id: string }>(
      'SELECT id, clinic_id FROM shared.users WHERE email = $1',
      [adminEmail],
    );

    if (existingUser.rowCount && existingUser.rows[0]) {
      const u = existingUser.rows[0];
      console.log(`✓ Usuário '${adminEmail}' já existe (id=${u.id}, clinic=${u.clinic_id})`);
      console.log('  (não alterando senha — re-rode com SEED_ADMIN_PASSWORD para resetar)');
    } else {
      const password = adminPasswordEnv ?? generatePassword();
      const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO shared.users
           (clinic_id, name, email, password_hash, role, is_active, is_email_verified, password_changed_at)
         VALUES ($1, $2, $3, $4, 'owner', true, true, NOW())
         RETURNING id`,
        [clinicId, adminName, adminEmail, passwordHash],
      );
      console.log(`+ Usuário owner criado: ${adminName} <${adminEmail}> (id=${inserted.rows[0]!.id})`);
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('  CREDENCIAIS — guarde agora!');
      console.log('═══════════════════════════════════════');
      console.log(`  Email   : ${adminEmail}`);
      console.log(`  Senha   : ${password}`);
      console.log(`  Clínica : ${clinicSlug}`);
      console.log('═══════════════════════════════════════');
    }
  } finally {
    await client.query('RESET ROLE').catch(() => undefined);
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err.message ?? err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});

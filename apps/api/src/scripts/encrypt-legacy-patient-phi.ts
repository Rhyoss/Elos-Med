import path from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';

config({ path: path.resolve(process.cwd(), '../../.env') });
config();

type PatientNameRow = {
  id: string;
  clinic_id: string;
  name: string;
  name_search: string;
};

const CIPHER_TEXT_PATTERN = /^[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$/;

function isCipherLike(value: string): boolean {
  return CIPHER_TEXT_PATTERN.test(value);
}

/**
 * Resolve a connection string com bypass de RLS:
 *   1. DATABASE_ADMIN_URL (preferida — admin user, BYPASSRLS)
 *   2. DATABASE_URL (fallback — pode ser app user e ser bloqueado por RLS)
 *
 * Se DATABASE_URL estiver apontando pro app user (sem BYPASSRLS), o scan
 * vai retornar 0 mesmo com pacientes legados existindo. O script detecta
 * isso e instrui o operador a setar DATABASE_ADMIN_URL.
 */
function resolveConnectionString(): { url: string; source: 'admin' | 'app' } {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (adminUrl) return { url: adminUrl, source: 'admin' };

  const appUrl = process.env.DATABASE_URL;
  if (!appUrl) {
    throw new Error('Nem DATABASE_ADMIN_URL nem DATABASE_URL definidos no ambiente.');
  }
  return { url: appUrl, source: 'app' };
}

async function main(): Promise<void> {
  const [{ decryptOptional, encrypt }, { logger }] = await Promise.all([
    import('../lib/crypto.js'),
    import('../lib/logger.js'),
  ]);

  const { url, source } = resolveConnectionString();

  // Pool direto, sem o proxy ALS de db/client.ts — esse script roda fora
  // do contexto de request tRPC e precisa enxergar TODAS as clínicas.
  const pool = new Pool({ connectionString: url, max: 2 });

  const client = await pool.connect();
  let encryptedCount = 0;
  let skippedCipherCount = 0;
  let totalCount = 0;

  try {
    await client.query('BEGIN');

    const result = await client.query<PatientNameRow>(
      `SELECT id, clinic_id, name, name_search
       FROM shared.patients
       WHERE name IS NOT NULL
       ORDER BY clinic_id, id
       FOR UPDATE`,
    );
    totalCount = result.rowCount ?? result.rows.length;

    // Detecção de RLS bloqueando: o app user tem RLS ativa e sem GUC de
    // clinic_id seteado o SELECT retorna 0 mesmo com pacientes existentes.
    // Como o probe via SELECT também é bloqueado, qualquer scan vazio
    // rodando como `app` é um falso positivo provável — abortamos com
    // instrução clara.
    if (totalCount === 0 && source === 'app') {
      await client.query('ROLLBACK');
      logger.error(
        'Scan retornou 0 linhas usando DATABASE_URL (app user). Como o app user tem RLS ativa, esse resultado pode ser falso. Defina DATABASE_ADMIN_URL apontando pro user admin (BYPASSRLS) e rode novamente. Se realmente não existem pacientes, exporte SKIP_RLS_CHECK=1 para silenciar este aviso.',
      );
      if (process.env.SKIP_RLS_CHECK !== '1') {
        process.exitCode = 1;
        return;
      }
    }

    for (const row of result.rows) {
      const decrypted = decryptOptional(row.name);
      if (decrypted) continue;

      if (isCipherLike(row.name)) {
        skippedCipherCount += 1;
        logger.warn(
          { patientId: row.id, clinicId: row.clinic_id },
          'patient PHI repair skipped undecryptable cipher-like name',
        );
        continue;
      }

      await client.query(
        `UPDATE shared.patients
         SET name = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [encrypt(row.name), row.id],
      );
      encryptedCount += 1;
    }

    await client.query('COMMIT');
    logger.info(
      {
        connectionSource: source,
        scanned: totalCount,
        encrypted: encryptedCount,
        skippedCipherLike: skippedCipherCount,
      },
      'patient PHI repair completed',
    );
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'patient PHI repair failed');
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();

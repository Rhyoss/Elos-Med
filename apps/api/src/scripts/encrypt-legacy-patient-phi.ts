import path from 'node:path';
import { config } from 'dotenv';

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

async function main(): Promise<void> {
  const [{ db }, { decryptOptional, encrypt }, { logger }] = await Promise.all([
    import('../db/client.js'),
    import('../lib/crypto.js'),
    import('../lib/logger.js'),
  ]);

  const client = await db.connect();
  let encryptedCount = 0;
  let skippedCipherCount = 0;

  try {
    await client.query('BEGIN');

    const result = await client.query<PatientNameRow>(
      `SELECT id, clinic_id, name, name_search
       FROM shared.patients
       WHERE name IS NOT NULL
       ORDER BY clinic_id, id
       FOR UPDATE`,
    );

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
        scanned: result.rowCount ?? result.rows.length,
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
    await db.end();
  }
}

void main();

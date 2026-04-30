/**
 * One-shot: encrypts plaintext PII columns left over from the SQL seed.
 *
 * Run with: docker exec dermaos-api sh -c "cd /app/apps/api && npx tsx src/scripts/encrypt-seed-pii.ts"
 *
 * Idempotent: rows whose `name` already looks like a cipher (iv:tag:data) are skipped.
 */
import { pool } from '../db/client.js';
import { encrypt } from '../lib/crypto.js';

const CIPHER_RE = /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;

async function main() {
  // Usa o pool puro (sem ALS) e descobre todas as clínicas para iterar com
  // `set_config` por escopo. RLS bloqueia consultas sem clinic_id setado.
  const clinicsRes = await pool.query<{ id: string }>(
    `SELECT id FROM shared.clinics`,
  );
  const clinics = clinicsRes.rows;
  console.log(`Found ${clinics.length} clinic(s).`);

  let encrypted = 0;
  let skipped = 0;
  let total = 0;

  for (const clinic of clinics) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_clinic_id', $1, true)`, [clinic.id]);

      const { rows } = await client.query<{ id: string; name: string | null }>(
        `SELECT id, name FROM shared.patients WHERE name IS NOT NULL`,
      );
      total += rows.length;

      for (const row of rows) {
        if (!row.name || CIPHER_RE.test(row.name)) {
          skipped++;
          continue;
        }
        const cipher = encrypt(row.name);
        await client.query(
          `UPDATE shared.patients SET name = $1 WHERE id = $2`,
          [cipher, row.id],
        );
        encrypted++;
        console.log(`  encrypted ${row.id}: "${row.name}"`);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(`\nDone. encrypted=${encrypted} skipped=${skipped} total=${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

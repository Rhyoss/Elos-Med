/**
 * One-shot: encrypts plaintext PII columns left over from the SQL seed.
 *
 * Run with: docker exec dermaos-api sh -c "cd /app/apps/api && npx tsx src/scripts/encrypt-seed-pii.ts"
 *
 * Idempotent: rows whose `name` already looks like a cipher (iv:tag:data) are skipped.
 */
import { db } from '../db/client.js';
import { encrypt } from '../lib/crypto.js';

const CIPHER_RE = /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;

async function main() {
  const { rows } = await db.query<{ id: string; name: string | null }>(
    `SELECT id, name FROM shared.patients WHERE name IS NOT NULL`,
  );

  let encrypted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.name || CIPHER_RE.test(row.name)) {
      skipped++;
      continue;
    }
    const cipher = encrypt(row.name);
    await db.query(
      `UPDATE shared.patients SET name = $1 WHERE id = $2`,
      [cipher, row.id],
    );
    encrypted++;
    console.log(`  encrypted ${row.id}: "${row.name}"`);
  }

  console.log(`\nDone. encrypted=${encrypted} skipped=${skipped} total=${rows.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

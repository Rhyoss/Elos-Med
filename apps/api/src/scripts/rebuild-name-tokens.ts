/**
 * SEC-13 — Backfill de `shared.patients.name_search_tokens`.
 *
 * Re-gera os tokens HMAC do blind-index para todos os pacientes de todas
 * as clínicas. Necessário em deploys que tinham pacientes ANTES da
 * migração `db/init/111_blind_index_name_search.sql` (deploys novos não
 * precisam — INSERT/UPDATE já populam tokens em runtime).
 *
 * Características:
 *   - Idempotente: pode rodar várias vezes sem efeito colateral.
 *   - `--dry-run`: imprime o que faria sem gravar.
 *   - `--clinic <uuid>`: limita a uma clínica específica.
 *   - `--batch <N>`: tamanho do lote (default 500).
 *   - Multi-tenant correto: usa `withClinicContext` por clínica → RLS.
 *
 * Como rodar (operador, com DATABASE_URL apontando ao **admin**, pois
 * precisa listar todas as clínicas):
 *
 *     DATABASE_URL=postgresql://dermaos_admin:...@host:5432/dermaos \
 *       pnpm tsx apps/api/src/scripts/rebuild-name-tokens.ts --dry-run
 *     # confira os números, então rode sem --dry-run
 *
 * Em GCP, rodar como Cloud Build job ou Cloud Run Job com a env vinda do
 * Secret Manager. Idempotente — seguro para re-execução em pipeline.
 */

import 'dotenv/config';
import { setTimeout as sleep } from 'node:timers/promises';
import type { PoolClient } from 'pg';
import { pool, withClinicContext } from '../db/client.js';
import { decryptOptional } from '../lib/crypto.js';
import { buildNameSearchTokens } from '../lib/search-index.js';
import { logger } from '../lib/logger.js';

interface CliArgs {
  dryRun:    boolean;
  clinicId:  string | null;
  batchSize: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, clinicId: null, batchSize: 500 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--clinic' && argv[i + 1]) { args.clinicId = argv[++i]!; }
    else if (a === '--batch'  && argv[i + 1]) { args.batchSize = parseInt(argv[++i]!, 10) || 500; }
    else if (a === '--help' || a === '-h') {
      // eslint-disable-next-line no-console
      console.log(`Uso: rebuild-name-tokens.ts [--dry-run] [--clinic <uuid>] [--batch <N>]`);
      process.exit(0);
    }
  }
  return args;
}

async function listClinics(client: PoolClient, only: string | null): Promise<string[]> {
  const sql = only
    ? `SELECT id FROM shared.clinics WHERE id = $1`
    : `SELECT id FROM shared.clinics ORDER BY created_at ASC`;
  const params = only ? [only] : [];
  const r = await client.query<{ id: string }>(sql, params);
  return r.rows.map((row) => row.id);
}

interface ClinicStats {
  clinicId:    string;
  scanned:     number;
  updated:     number;
  skippedSame: number;
  skippedNoName: number;
  errored:     number;
}

async function backfillClinic(
  clinicId: string,
  args:     CliArgs,
): Promise<ClinicStats> {
  const stats: ClinicStats = {
    clinicId,
    scanned: 0,
    updated: 0,
    skippedSame: 0,
    skippedNoName: 0,
    errored: 0,
  };

  // Cursor por id (UUID ascendente). Estável; permite resumir em caso de falha.
  let lastId = '00000000-0000-0000-0000-000000000000';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Cada lote roda em UMA transação curta com SET LOCAL app.current_clinic_id.
    // Retorna o tamanho do lote processado; se < batchSize, terminamos.
    const batchInfo = await withClinicContext<{ size: number; lastId: string }>(
      clinicId,
      async (client) => {
        const r = await client.query<{
          id:           string;
          name_cipher:  string | null;
          existing:     string[] | null;
        }>(
          `SELECT id, name AS name_cipher, name_search_tokens AS existing
             FROM shared.patients
            WHERE clinic_id = $1
              AND deleted_at IS NULL
              AND id > $2
            ORDER BY id ASC
            LIMIT $3`,
          [clinicId, lastId, args.batchSize],
        );

        if (r.rows.length === 0) return { size: 0, lastId };

        let cursorEnd = lastId;
        for (const row of r.rows) {
          stats.scanned++;
          cursorEnd = row.id;

          const plainName = decryptOptional(row.name_cipher);
          if (!plainName) {
            stats.skippedNoName++;
            continue;
          }

          const tokens = buildNameSearchTokens(plainName);

          // Idempotência: se os tokens já casam, pula o UPDATE.
          if (sameSet(tokens, row.existing ?? [])) {
            stats.skippedSame++;
            continue;
          }

          if (args.dryRun) {
            stats.updated++; // contagem prevista
            continue;
          }

          try {
            await client.query(
              `UPDATE shared.patients
                  SET name_search_tokens = $2::text[]
                WHERE id = $1 AND clinic_id = $3`,
              [row.id, tokens, clinicId],
            );
            stats.updated++;
          } catch (err) {
            stats.errored++;
            logger.warn({ err, patientId: row.id, clinicId }, 'rebuild-name-tokens: update failed');
          }
        }

        return { size: r.rows.length, lastId: cursorEnd };
      },
    );

    if (batchInfo.size === 0) break;
    lastId = batchInfo.lastId;

    // Lote menor que batchSize → atingiu o fim.
    if (batchInfo.size < args.batchSize) break;

    // Backpressure leve para não saturar pool/CPU.
    await sleep(20);
  }

  return stats;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((t) => set.has(t));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // eslint-disable-next-line no-console
  console.log(
    `[rebuild-name-tokens] start — dryRun=${args.dryRun} ` +
    `clinic=${args.clinicId ?? 'all'} batch=${args.batchSize}`,
  );

  // Listagem de clínicas: precisa de role com BYPASSRLS ou admin.
  // Se a env DATABASE_URL apontar ao dermaos_app, isto retorna [].
  const adminClient = await pool.connect();
  let clinicIds: string[];
  try {
    clinicIds = await listClinics(adminClient, args.clinicId);
  } finally {
    adminClient.release();
  }

  if (clinicIds.length === 0) {
    // eslint-disable-next-line no-console
    console.error(
      '[rebuild-name-tokens] nenhuma clínica visível — DATABASE_URL deve apontar ' +
      'a uma role com BYPASSRLS (ex.: dermaos_admin / cloudsqlsuperuser).',
    );
    process.exit(2);
  }

  // eslint-disable-next-line no-console
  console.log(`[rebuild-name-tokens] processando ${clinicIds.length} clínica(s)`);

  const totals: ClinicStats = {
    clinicId: 'TOTAL',
    scanned: 0, updated: 0, skippedSame: 0, skippedNoName: 0, errored: 0,
  };

  for (const cid of clinicIds) {
    const stats = await backfillClinic(cid, args);
    // eslint-disable-next-line no-console
    console.log(
      `[rebuild-name-tokens] clinic=${cid} scanned=${stats.scanned} ` +
      `updated=${stats.updated} skipSame=${stats.skippedSame} ` +
      `skipNoName=${stats.skippedNoName} err=${stats.errored}`,
    );
    totals.scanned       += stats.scanned;
    totals.updated       += stats.updated;
    totals.skippedSame   += stats.skippedSame;
    totals.skippedNoName += stats.skippedNoName;
    totals.errored       += stats.errored;
  }

  // eslint-disable-next-line no-console
  console.log(
    `[rebuild-name-tokens] DONE — total scanned=${totals.scanned} ` +
    `updated=${totals.updated} skipSame=${totals.skippedSame} ` +
    `skipNoName=${totals.skippedNoName} err=${totals.errored}` +
    (args.dryRun ? ' (DRY RUN — nada foi escrito)' : ''),
  );

  await pool.end();
  process.exit(totals.errored > 0 ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[rebuild-name-tokens] fatal:', err);
  process.exit(1);
});

/**
 * SEC-23 — Backfill: cifra campos sensíveis em `omni.channels.config`.
 *
 * Antes do fix, credenciais de canais omni (accessToken, appSecret,
 * botToken, signingKey, webhookSecret) ficavam em texto plano dentro do
 * JSONB `config`. Esta migração re-grava cada canal substituindo cada
 * campo sensível por sua versão cifrada (AES-256-GCM, mesma chave do
 * EncryptionService), com sufixo `_enc`.
 *
 * O caminho de runtime já cuida de canais novos (`encryptChannelConfig`
 * é chamado nos pontos de gravação em settings/integrations.service.ts).
 *
 * Características:
 *   - Idempotente: se um campo já foi cifrado (`*_enc` presente, plain
 *     ausente), pula. Re-rodar é seguro.
 *   - `--dry-run`: imprime o que faria sem gravar.
 *   - `--clinic <uuid>`: limita a uma clínica.
 *   - `--channel <uuid>`: limita a um canal específico.
 *
 * Como rodar:
 *
 *     DATABASE_URL=postgresql://dermaos_admin:...@host:5432/dermaos \
 *     ENCRYPTION_KEY=<64-hex>  \
 *       pnpm tsx apps/api/src/scripts/encrypt-channels-config.ts --dry-run
 */

import 'dotenv/config';
import type { PoolClient } from 'pg';
import { pool, withClinicContext } from '../db/client.js';
import {
  encryptChannelConfig,
  type ChannelConfigPlain,
} from '../modules/omni/channels/channel-config.js';
import { logger } from '../lib/logger.js';

const SENSITIVE_FIELDS = [
  'accessToken',
  'appSecret',
  'botToken',
  'signingKey',
  'webhookSecret',
] as const;

interface CliArgs {
  dryRun:    boolean;
  clinicId:  string | null;
  channelId: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, clinicId: null, channelId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--clinic'  && argv[i + 1]) args.clinicId  = argv[++i]!;
    else if (a === '--channel' && argv[i + 1]) args.channelId = argv[++i]!;
    else if (a === '--help' || a === '-h') {
      // eslint-disable-next-line no-console
      console.log(
        `Uso: encrypt-channels-config.ts [--dry-run] ` +
        `[--clinic <uuid>] [--channel <uuid>]`,
      );
      process.exit(0);
    }
  }
  return args;
}

interface ChannelRowMin {
  id:        string;
  clinic_id: string;
  config:    ChannelConfigPlain | null;
  type:      string;
  name:      string;
}

/**
 * Determina se a config tem QUALQUER campo sensível em texto plano.
 * Idempotência: se nenhum campo plaintext está presente, não há trabalho.
 */
function needsEncryption(config: ChannelConfigPlain | null): boolean {
  if (!config) return false;
  for (const f of SENSITIVE_FIELDS) {
    const plain = config[f];
    if (typeof plain === 'string' && plain.length > 0) return true;
  }
  return false;
}

/**
 * Conta quais campos sensíveis estão em texto plano (para auditoria do log).
 */
function plaintextFields(config: ChannelConfigPlain | null): string[] {
  if (!config) return [];
  return SENSITIVE_FIELDS.filter((f) => {
    const v = config[f];
    return typeof v === 'string' && v.length > 0;
  });
}

interface Stats {
  scanned: number;
  updated: number;
  skipped: number;
  errored: number;
  fieldsCifradosTotal: number;
}

async function listClinicsForBackfill(client: PoolClient, only: string | null): Promise<string[]> {
  const sql = only
    ? `SELECT id FROM shared.clinics WHERE id = $1`
    : `SELECT id FROM shared.clinics ORDER BY created_at ASC`;
  const params = only ? [only] : [];
  const r = await client.query<{ id: string }>(sql, params);
  return r.rows.map((row) => row.id);
}

async function backfillClinic(
  clinicId: string,
  args:     CliArgs,
  totals:   Stats,
): Promise<void> {
  await withClinicContext(clinicId, async (client) => {
    const filters: string[] = [`clinic_id = $1`];
    const values: unknown[] = [clinicId];
    let idx = 2;

    if (args.channelId) {
      filters.push(`id = $${idx++}`);
      values.push(args.channelId);
    }

    const r = await client.query<ChannelRowMin>(
      `SELECT id, clinic_id, type::text AS type, name, config
         FROM omni.channels
        WHERE ${filters.join(' AND ')}
        ORDER BY created_at ASC`,
      values,
    );

    for (const row of r.rows) {
      totals.scanned++;

      if (!needsEncryption(row.config)) {
        totals.skipped++;
        continue;
      }

      const fields = plaintextFields(row.config);
      const newConfig = encryptChannelConfig(row.config ?? {});

      if (args.dryRun) {
        // eslint-disable-next-line no-console
        console.log(
          `[encrypt-channels-config] dry: would encrypt ` +
          `clinic=${clinicId} channel=${row.id} (${row.type}/${row.name}) ` +
          `fields=${fields.join(',')}`,
        );
        totals.updated++;
        totals.fieldsCifradosTotal += fields.length;
        continue;
      }

      try {
        await client.query(
          `UPDATE omni.channels
              SET config     = $2::jsonb,
                  updated_at = NOW()
            WHERE id = $1 AND clinic_id = $3`,
          [row.id, JSON.stringify(newConfig), clinicId],
        );
        totals.updated++;
        totals.fieldsCifradosTotal += fields.length;
        // eslint-disable-next-line no-console
        console.log(
          `[encrypt-channels-config] OK clinic=${clinicId} channel=${row.id} ` +
          `fields=${fields.join(',')}`,
        );
      } catch (err) {
        totals.errored++;
        logger.warn({ err, channelId: row.id, clinicId }, 'encrypt-channels-config: update failed');
      }
    }
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // eslint-disable-next-line no-console
  console.log(
    `[encrypt-channels-config] start — dryRun=${args.dryRun} ` +
    `clinic=${args.clinicId ?? 'all'} channel=${args.channelId ?? 'all'}`,
  );

  // Listagem de clínicas exige role com BYPASSRLS (admin).
  const adminClient = await pool.connect();
  let clinicIds: string[];
  try {
    clinicIds = await listClinicsForBackfill(adminClient, args.clinicId);
  } finally {
    adminClient.release();
  }

  if (clinicIds.length === 0) {
    // eslint-disable-next-line no-console
    console.error(
      '[encrypt-channels-config] nenhuma clínica visível — DATABASE_URL deve ' +
      'apontar a uma role com BYPASSRLS (ex.: dermaos_admin / cloudsqlsuperuser).',
    );
    process.exit(2);
  }

  // eslint-disable-next-line no-console
  console.log(`[encrypt-channels-config] ${clinicIds.length} clínica(s) a processar`);

  const totals: Stats = {
    scanned: 0, updated: 0, skipped: 0, errored: 0, fieldsCifradosTotal: 0,
  };

  for (const cid of clinicIds) {
    await backfillClinic(cid, args, totals);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[encrypt-channels-config] DONE — scanned=${totals.scanned} ` +
    `updated=${totals.updated} skipped=${totals.skipped} ` +
    `err=${totals.errored} fieldsCifrados=${totals.fieldsCifradosTotal}` +
    (args.dryRun ? ' (DRY RUN — nada foi escrito)' : ''),
  );

  await pool.end();
  process.exit(totals.errored > 0 ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[encrypt-channels-config] fatal:', err);
  process.exit(1);
});

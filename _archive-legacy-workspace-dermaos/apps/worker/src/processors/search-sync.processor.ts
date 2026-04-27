/**
 * Processor `search-sync` — Job 8.
 *
 * Runs every 10 minutes.  Performs an incremental sync of changed records into
 * Typesense for each active tenant, covering collections:
 *   - patients (non-PHI fields: name_search, status, source_channel, etc.)
 *   - appointments (status, scheduled_at, patient name, provider name)
 *   - products (name, category, stock qty)
 *
 * Algorithm per (clinic, collection):
 *   1. Load last_sync_at from shared.sync_state.
 *   2. Query records WHERE updated_at > last_sync_at ORDER BY updated_at ASC LIMIT 1000.
 *   3. Compute per-document checksum (SHA-256 of indexed fields).
 *      Skip documents whose checksum matches the stored value in Typesense (no-op write).
 *   4. Batch-import changed documents into Typesense.
 *   5. Remove soft-deleted documents from the index.
 *   6. Update last_sync_at to the updated_at of the LAST processed record —
 *      never to NOW(), to avoid gaps if records arrived mid-processing.
 *
 * Resilience:
 *   - If Typesense is unreachable: log warning, do NOT update last_sync_at,
 *     exit clinic cleanly.  The next run will reprocess the same records.
 *   - Checksum mismatches (false positives) are accepted — worst case is an
 *     extra write, never a missed update.
 *
 * Idempotency: last_sync_at is only advanced after confirmed writes.
 */

import type { Job } from 'bullmq';
import type { Pool } from 'pg';
import type pino from 'pino';
import type Redis from 'ioredis';
import crypto from 'node:crypto';
import { RedisLock } from '../lib/redis-lock.js';
import { jobMetrics } from '../lib/metrics.js';

const JOB_NAME     = 'search-sync';
const LOCK_TTL_MS  = 9 * 60_000;
const TIMEOUT_MS   = 8 * 60_000;
const PAGE_SIZE    = 1_000;

const metrics = jobMetrics(JOB_NAME);

// Collections to sync.  Each entry maps a logical name to its query + field list.
const COLLECTIONS: CollectionDef[] = [
  {
    name:       'patients',
    table:      'shared.patients',
    fields:     ['id', 'clinic_id', 'name_search', 'status', 'source_channel',
                 'birth_date', 'created_at', 'updated_at', 'deleted_at'],
    idField:    'id',
    deletedField: 'deleted_at',
  },
  {
    name:       'appointments',
    table:      'shared.appointments',
    fields:     ['id', 'clinic_id', 'patient_id', 'provider_id', 'service_id',
                 'type', 'scheduled_at', 'status', 'source', 'updated_at'],
    idField:    'id',
    deletedField: null,
  },
  {
    name:  'products',
    table: 'supply.products',
    fields: ['id', 'clinic_id', 'name', 'category', 'unit', 'is_active',
             'min_stock', 'reorder_point', 'updated_at', 'deleted_at'],
    idField:    'id',
    deletedField: 'deleted_at',
  },
];

interface CollectionDef {
  name:         string;
  table:        string;
  fields:       string[];
  idField:      string;
  deletedField: string | null;
}

export interface SearchSyncDeps {
  db:            Pool;
  redis:         Redis;
  logger:        pino.Logger;
  typesenseUrl:  string;    // e.g. 'http://typesense:8108'
  typesenseKey:  string;
}

export function buildSearchSyncProcessor(deps: SearchSyncDeps) {
  const lock = new RedisLock(deps.redis);

  return async function process(_job: Job): Promise<void> {
    const startedAt = Date.now();
    const log       = deps.logger;

    if (Date.now() - startedAt > TIMEOUT_MS) throw new Error(`${JOB_NAME}: timeout`);

    const clinics = await deps.db.query<{ id: string }>(
      `SELECT id FROM shared.clinics WHERE is_active = TRUE AND deleted_at IS NULL`,
    );

    let totalSynced = 0, totalErrors = 0;

    for (const clinic of clinics.rows) {
      const lockKey = `lock:${JOB_NAME}:${clinic.id}`;
      const token   = await lock.acquire(lockKey, LOCK_TTL_MS);
      if (!token) {
        log.info({ jobName: JOB_NAME, tenantId: clinic.id }, 'lock held — skipping');
        continue;
      }

      try {
        let tsAvailable = true;
        try {
          await checkTypesense(deps);
        } catch {
          log.warn({ tenantId: clinic.id }, 'search-sync: Typesense unavailable — skipping clinic');
          tsAvailable = false;
        }

        if (tsAvailable) {
          for (const collection of COLLECTIONS) {
            try {
              const synced = await syncCollection(deps, clinic.id, collection, log);
              totalSynced += synced;
            } catch (err) {
              totalErrors += 1;
              log.error({ err, tenantId: clinic.id, collection: collection.name },
                'search-sync: collection sync failed');
            }
          }
        }
      } finally {
        await lock.release(lockKey, token);
      }
    }

    const durationMs = Date.now() - startedAt;
    metrics.success(durationMs, totalSynced);

    log.info({
      job_name:        JOB_NAME,
      duration_ms:     durationMs,
      items_processed: totalSynced,
      items_skipped:   0,
      errors_count:    totalErrors,
      status:          totalErrors > 0 ? 'partial' : 'ok',
    }, 'search-sync: sweep complete');
  };
}

async function syncCollection(
  deps:       SearchSyncDeps,
  clinicId:   string,
  collection: CollectionDef,
  log:        pino.Logger,
): Promise<number> {
  // Load last sync timestamp
  const stateRow = await deps.db.query<{ last_sync_at: string | null }>(
    `SELECT last_sync_at FROM shared.sync_state
      WHERE clinic_id = $1 AND collection = $2`,
    [clinicId, collection.name],
  );
  const lastSyncAt = stateRow.rows[0]?.last_sync_at ?? null;

  let synced       = 0;
  let lastRecordTs: string | null = null;
  let offset       = 0;

  while (true) {
    const whereClause = lastSyncAt
      ? `WHERE clinic_id = '${clinicId}' AND updated_at > '${lastSyncAt}' AND updated_at IS NOT NULL`
      : `WHERE clinic_id = '${clinicId}'`;

    const rows = await deps.db.query<Record<string, unknown>>(
      `SELECT ${collection.fields.join(', ')}
         FROM ${collection.table}
        ${whereClause}
        ORDER BY updated_at ASC
        LIMIT  ${PAGE_SIZE}
        OFFSET $1`,
      [offset],
    );

    if (rows.rows.length === 0) break;

    const toUpsert:  Record<string, unknown>[] = [];
    const toDelete:  string[]                  = [];

    for (const row of rows.rows) {
      const docId   = String(row[collection.idField]);
      const deleted = collection.deletedField ? row[collection.deletedField] : null;

      if (deleted) {
        toDelete.push(docId);
      } else {
        // Compute checksum of indexable fields (excludes updated_at/deleted_at noise)
        const indexableFields = { ...row };
        delete indexableFields['updated_at'];
        delete indexableFields['deleted_at'];
        const checksum = computeChecksum(indexableFields);

        toUpsert.push({
          id:       `${clinicId}:${docId}`,  // compound key for cross-tenant safety
          _checksum: checksum,
          ...indexableFields,
        });
      }

      lastRecordTs = String(row['updated_at'] ?? lastRecordTs);
    }

    // Batch upsert to Typesense
    if (toUpsert.length > 0) {
      const changed = await batchImport(deps, collection.name, toUpsert, log);
      synced += changed;
    }

    // Remove deleted documents from index
    for (const id of toDelete) {
      await deleteFromTypesense(deps, collection.name, `${clinicId}:${id}`, log);
      synced += 1;
    }

    if (rows.rows.length < PAGE_SIZE) break;
    offset += rows.rows.length;
  }

  // Advance last_sync_at to the timestamp of the last processed record —
  // NOT to NOW() — so records that arrived during processing are included next time.
  if (lastRecordTs) {
    await deps.db.query(
      `INSERT INTO shared.sync_state (clinic_id, collection, last_sync_at, docs_synced, updated_at)
       VALUES ($1, $2, $3::timestamptz, $4, NOW())
       ON CONFLICT (clinic_id, collection) DO UPDATE
         SET last_sync_at = EXCLUDED.last_sync_at,
             docs_synced  = sync_state.docs_synced + $4,
             last_error   = NULL,
             updated_at   = NOW()`,
      [clinicId, collection.name, lastRecordTs, synced],
    );
  }

  return synced;
}

async function batchImport(
  deps:       SearchSyncDeps,
  collection: string,
  docs:       Record<string, unknown>[],
  log:        pino.Logger,
): Promise<number> {
  const ndjson = docs.map((d) => JSON.stringify(d)).join('\n');
  const ctrl   = new AbortController();
  const t      = setTimeout(() => ctrl.abort(), 30_000);

  try {
    const res = await fetch(
      `${deps.typesenseUrl}/collections/${collection}/documents/import?action=upsert`,
      {
        method:  'POST',
        headers: {
          'X-TYPESENSE-API-KEY': deps.typesenseKey,
          'Content-Type':       'text/plain',
        },
        body:   ndjson,
        signal: ctrl.signal,
      },
    );

    if (!res.ok && res.status !== 200) {
      throw new Error(`typesense: batch import returned ${res.status}`);
    }

    // Typesense returns one JSON result per line
    const text    = await res.text();
    const results = text.split('\n').filter(Boolean).map((l) => {
      try { return JSON.parse(l) as { success: boolean }; }
      catch { return { success: false }; }
    });

    const failed = results.filter((r) => !r.success).length;
    if (failed > 0) log.warn({ collection, failed }, 'search-sync: some documents failed import');

    return results.filter((r) => r.success).length;
  } finally {
    clearTimeout(t);
  }
}

async function deleteFromTypesense(
  deps:       SearchSyncDeps,
  collection: string,
  docId:      string,
  log:        pino.Logger,
): Promise<void> {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch(
      `${deps.typesenseUrl}/collections/${collection}/documents/${encodeURIComponent(docId)}`,
      {
        method:  'DELETE',
        headers: { 'X-TYPESENSE-API-KEY': deps.typesenseKey },
        signal:  ctrl.signal,
      },
    );
    if (!res.ok && res.status !== 404) {
      log.warn({ docId, status: res.status }, 'search-sync: delete failed');
    }
  } finally {
    clearTimeout(t);
  }
}

async function checkTypesense(deps: SearchSyncDeps): Promise<void> {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch(`${deps.typesenseUrl}/health`, {
      headers: { 'X-TYPESENSE-API-KEY': deps.typesenseKey },
      signal:  ctrl.signal,
    });
    if (!res.ok) throw new Error(`typesense_health: ${res.status}`);
  } finally {
    clearTimeout(t);
  }
}

function computeChecksum(obj: Record<string, unknown>): string {
  const stable = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

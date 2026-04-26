/**
 * Processor `supply-forecast` — Job 7.
 *
 * Runs weekly on Mondays at 04:00 UTC.
 * For each tenant, calls the AI service /predict/supply-stockout for every
 * active product and saves the forecast result to analytics.supply_forecasts.
 *
 * Parallelism: max 5 concurrent AI calls per tenant (semaphore).
 * Products are processed in batches of 20 to control memory footprint.
 *
 * Resilience rules:
 *   - If AI service is unavailable: skip tenant with a warning (NOT a DLQ error).
 *   - If product has < 14 days of consumption history: skip with info log.
 *   - Individual product failures don't abort the tenant loop.
 *   - Timeout per AI call: 45s.
 *
 * Idempotency: UPSERT on (clinic_id, product_id, forecast_date) —
 * running the job twice on the same Monday overwrites with fresh data.
 */

import type { Job } from 'bullmq';
import type { Pool } from 'pg';
import type pino from 'pino';
import type Redis from 'ioredis';
import { RedisLock } from '../lib/redis-lock.js';
import { jobMetrics } from '../lib/metrics.js';
import { notifyAdminDlq } from '../lib/dlq-notify.js';

const JOB_NAME         = 'supply-forecast';
const LOCK_TTL_MS      = 2 * 60 * 60_000;   // 2 hours
const TIMEOUT_MS       = 90 * 60_000;        // 90 minutes
const BATCH_SIZE       = 20;
const MAX_CONCURRENCY  = 5;
const AI_CALL_TIMEOUT  = 45_000;
const MIN_HISTORY_DAYS = 14;

const metrics = jobMetrics(JOB_NAME);

export interface SupplyForecastDeps {
  db:           Pool;
  redis:        Redis;
  logger:       pino.Logger;
  aiServiceUrl: string;   // e.g. 'http://ai:8000'
}

interface ProductRow {
  id:          string;
  name:        string;
  clinic_id:   string;
  history_days: number;
}

interface ForecastResult {
  predicted_consumption:  number;
  confidence_interval:    { lower: number; upper: number };
  stockout_date:          string | null;
  confidence_score:       number;
  model_version:          string;
}

export function buildSupplyForecastProcessor(deps: SupplyForecastDeps) {
  const lock = new RedisLock(deps.redis);

  return async function process(job: Job): Promise<void> {
    const startedAt  = Date.now();
    const log        = deps.logger;
    const forecastDate = todayIso();

    if (Date.now() - startedAt > TIMEOUT_MS) throw new Error(`${JOB_NAME}: timeout`);

    const clinics = await deps.db.query<{ id: string }>(
      `SELECT id FROM shared.clinics WHERE is_active = TRUE AND deleted_at IS NULL`,
    );

    let totalUpserted = 0, totalSkipped = 0, totalErrors = 0;

    for (const clinic of clinics.rows) {
      const lockKey = `lock:${JOB_NAME}:${clinic.id}`;
      const token   = await lock.acquire(lockKey, LOCK_TTL_MS);
      if (!token) {
        log.info({ jobName: JOB_NAME, tenantId: clinic.id }, 'lock held — skipping');
        continue;
      }

      try {
        const r = await processClinic(deps, clinic.id, forecastDate, log);
        totalUpserted += r.upserted;
        totalSkipped  += r.skipped;
        totalErrors   += r.errors;
      } catch (err) {
        totalErrors += 1;
        const msg = err instanceof Error ? err.message : String(err);

        if (/ai.service.unavailable|ECONNREFUSED|ECONNRESET|timeout/i.test(msg)) {
          // AI service down — not a DLQ error, next week will retry
          log.warn({ err: msg, tenantId: clinic.id }, 'supply-forecast: AI service unavailable — skipping tenant');
        } else {
          log.error({ err, jobName: JOB_NAME, tenantId: clinic.id }, 'supply-forecast: clinic failed');
          const isLast = job.attemptsMade >= (job.opts.attempts ?? 3) - 1;
          if (isLast) {
            await notifyAdminDlq({ db: deps.db, logger: log, jobName: JOB_NAME,
              jobId: job.id, clinicId: clinic.id, error: err });
          }
        }
      } finally {
        await lock.release(lockKey, token);
      }
    }

    const durationMs = Date.now() - startedAt;
    metrics.success(durationMs, totalUpserted);

    log.info({
      job_name:        JOB_NAME,
      job_id:          job.id,
      duration_ms:     durationMs,
      items_processed: totalUpserted,
      items_skipped:   totalSkipped,
      errors_count:    totalErrors,
      status:          'ok',
      forecast_date:   forecastDate,
    }, 'supply-forecast: run complete');
  };
}

async function processClinic(
  deps:         SupplyForecastDeps,
  clinicId:     string,
  forecastDate: string,
  log:          pino.Logger,
): Promise<{ upserted: number; skipped: number; errors: number }> {
  let upserted = 0, skipped = 0, errors = 0;
  let offset = 0;

  // Verify AI service is available before iterating products
  await checkAiService(deps.aiServiceUrl);

  while (true) {
    const products = await deps.db.query<ProductRow>(
      `SELECT p.id, p.name, p.clinic_id,
              COALESCE(
                (SELECT COUNT(DISTINCT DATE(im.performed_at))
                   FROM supply.inventory_movements im
                  WHERE im.clinic_id  = p.clinic_id
                    AND im.product_id = p.id
                    AND im.type IN ('saida','uso_paciente')
                    AND im.performed_at >= NOW() - INTERVAL '${MIN_HISTORY_DAYS} days'
                ), 0
              )::int AS history_days
         FROM supply.products p
        WHERE p.clinic_id = $1 AND p.is_active = TRUE AND p.deleted_at IS NULL
        ORDER BY p.id
        LIMIT  ${BATCH_SIZE}
        OFFSET $2`,
      [clinicId, offset],
    );

    if (products.rows.length === 0) break;

    // Semaphore: max MAX_CONCURRENCY concurrent AI calls
    const sem = new Semaphore(MAX_CONCURRENCY);
    const tasks = products.rows.map(async (product) => {
      if (product.history_days < MIN_HISTORY_DAYS) {
        log.info({ clinicId, productId: product.id, historyDays: product.history_days },
          'supply-forecast: insufficient history — skipping product');
        skipped += 1;
        return;
      }

      await sem.acquire();
      try {
        const forecast = await callAiService(deps.aiServiceUrl, product, clinicId, log);
        if (forecast) {
          await upsertForecast(deps.db, clinicId, product.id, forecastDate, forecast, log);
          upserted += 1;
        } else {
          skipped += 1;
        }
      } catch (err) {
        errors += 1;
        log.warn({ err, clinicId, productId: product.id }, 'supply-forecast: product forecast failed');
      } finally {
        sem.release();
      }
    });

    await Promise.all(tasks);

    if (products.rows.length < BATCH_SIZE) break;
    offset += products.rows.length;
  }

  return { upserted, skipped, errors };
}

async function checkAiService(baseUrl: string): Promise<void> {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`ai_service_unavailable: status ${res.status}`);
  } finally {
    clearTimeout(t);
  }
}

async function callAiService(
  baseUrl:   string,
  product:   ProductRow,
  clinicId:  string,
  log:       pino.Logger,
): Promise<ForecastResult | null> {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), AI_CALL_TIMEOUT);

  try {
    const res = await fetch(`${baseUrl}/predict/supply-stockout`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Tenant-Id':     clinicId,
        'X-Internal-API-Key': process.env['AI_INTERNAL_API_KEY'] ?? '',
      },
      body: JSON.stringify({
        product_id: product.id,
        clinic_id:  clinicId,
      }),
      signal: ctrl.signal,
    });

    if (res.status === 404 || res.status === 422) {
      log.info({ productId: product.id, status: res.status }, 'supply-forecast: product not forecastable');
      return null;
    }
    if (!res.ok) {
      throw new Error(`ai_service: ${res.status}`);
    }

    const data = await res.json() as {
      predicted_consumption:  number;
      confidence_lower:       number;
      confidence_upper:       number;
      stockout_date:          string | null;
      confidence_score:       number;
      model_version:          string;
    };

    return {
      predicted_consumption: data.predicted_consumption,
      confidence_interval:   { lower: data.confidence_lower, upper: data.confidence_upper },
      stockout_date:         data.stockout_date ?? null,
      confidence_score:      data.confidence_score,
      model_version:         data.model_version ?? 'unknown',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('AbortError') || msg.includes('abort')) {
      throw new Error('ai_service_timeout');
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

async function upsertForecast(
  db:           Pool,
  clinicId:     string,
  productId:    string,
  forecastDate: string,
  forecast:     ForecastResult,
  log:          pino.Logger,
): Promise<void> {
  await db.query(
    `INSERT INTO analytics.supply_forecasts
       (clinic_id, product_id, forecast_date,
        predicted_consumption, confidence_interval, stockout_date,
        confidence_score, model_version, generated_at, computed_at)
     VALUES ($1, $2, $3::date, $4, $5::jsonb, $6::date, $7, $8, NOW(), NOW())
     ON CONFLICT (clinic_id, product_id, forecast_date) DO UPDATE
       SET predicted_consumption = EXCLUDED.predicted_consumption,
           confidence_interval   = EXCLUDED.confidence_interval,
           stockout_date         = EXCLUDED.stockout_date,
           confidence_score      = EXCLUDED.confidence_score,
           model_version         = EXCLUDED.model_version,
           generated_at          = EXCLUDED.generated_at,
           computed_at           = NOW()`,
    [
      clinicId,
      productId,
      forecastDate,
      forecast.predicted_consumption,
      JSON.stringify(forecast.confidence_interval),
      forecast.stockout_date,
      forecast.confidence_score,
      forecast.model_version,
    ],
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private readonly max: number) {}

  acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.running < this.max) {
        this.running += 1;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.running = Math.max(0, this.running - 1);
    }
  }
}

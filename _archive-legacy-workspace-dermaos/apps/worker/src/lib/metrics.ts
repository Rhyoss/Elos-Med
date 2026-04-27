/**
 * Prometheus metrics for DermaOS worker jobs.
 *
 * Metrics:
 *   job_duration_seconds (histogram, label: job_name)
 *   job_items_processed_total (counter, labels: job_name, status: success|skipped|error)
 *   job_last_success_timestamp (gauge, label: job_name)
 *
 * No high-cardinality labels (no tenant_id, no user_id).
 * Buckets match long-running batch jobs (up to 300 s).
 */

const DURATION_BUCKETS = [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300] as const;

interface JobHistogram {
  buckets: Map<number, number>;
  sum:     number;
  count:   number;
}

interface JobMetrics {
  histogram:      JobHistogram;
  itemsSuccess:   number;
  itemsSkipped:   number;
  itemsError:     number;
  lastSuccessTs:  number; // Unix seconds, 0 = never ran
}

const store = new Map<string, JobMetrics>();

function getOrCreate(jobName: string): JobMetrics {
  let m = store.get(jobName);
  if (!m) {
    const buckets = new Map<number, number>();
    for (const le of DURATION_BUCKETS) buckets.set(le, 0);
    m = {
      histogram:    { buckets, sum: 0, count: 0 },
      itemsSuccess: 0,
      itemsSkipped: 0,
      itemsError:   0,
      lastSuccessTs: 0,
    };
    store.set(jobName, m);
  }
  return m;
}

function observeHistogram(h: JobHistogram, valueS: number): void {
  for (const le of DURATION_BUCKETS) {
    if (valueS <= le) h.buckets.set(le, (h.buckets.get(le) ?? 0) + 1);
  }
  h.sum   += valueS;
  h.count += 1;
}

// ─── Public recording API ─────────────────────────────────────────────────────

/**
 * Record a successful job run.
 * @param itemsProcessed Number of items successfully processed (default 0).
 * @param itemsSkipped   Number of items skipped (default 0).
 */
export function recordJobSuccess(
  jobName:        string,
  durationMs:     number,
  itemsProcessed: number,
  itemsSkipped    = 0,
): void {
  const m = getOrCreate(jobName);
  observeHistogram(m.histogram, durationMs / 1_000);
  m.itemsSuccess  += itemsProcessed;
  m.itemsSkipped  += itemsSkipped;
  m.lastSuccessTs  = Math.floor(Date.now() / 1_000);
}

/** Record item-level errors within an otherwise-running job. */
export function recordJobError(jobName: string, count = 1): void {
  getOrCreate(jobName).itemsError += count;
}

export function getJobLastSuccessTs(jobName: string): number {
  return store.get(jobName)?.lastSuccessTs ?? 0;
}

// ─── Convenience wrapper ──────────────────────────────────────────────────────

/**
 * Returns bound helpers for a single job so processors don't need to pass
 * the job name on every call.
 *
 * Usage:
 *   const m = jobMetrics('search-sync-incremental');
 *   m.success(durationMs, { processed: 40, skipped: 2 });
 *   m.error(3);
 */
export function jobMetrics(jobName: string) {
  getOrCreate(jobName); // ensure entry exists before first run
  return {
    success: (
      durationMs: number,
      counts: { processed?: number; skipped?: number } = {},
    ) => recordJobSuccess(jobName, durationMs, counts.processed ?? 0, counts.skipped ?? 0),
    error: (count = 1) => recordJobError(jobName, count),
  };
}

// ─── Staleness configuration ──────────────────────────────────────────────────

/**
 * Expected maximum seconds between successful runs for each job.
 * If job_last_success_timestamp is older than this threshold, status = 'stale'.
 * If it's 0 (never ran), status = 'never_ran'.
 */
export const JOB_STALE_THRESHOLDS_SECONDS: Record<string, number> = {
  'scheduling-holds-cleanup-1m':   120,
  'automations-birthday-cron-1h':  7_200,
  'supply-stock-daily-dispatcher': 1_800,
  'analytics-nightly-2am':         2 * 86_400,   // 2 days (daily job)
  'monthly-cohort-03am':           7 * 86_400,   // 7 days
  'appointment-reminders-15m':     1_800,
  'automation-queue-5m':           600,
  'patient-reactivation-30m':      3_600,
  'supply-forecast-mon-4am':       14 * 86_400,  // 14 days (weekly job)
  'search-sync-10m':               1_200,
};

type WorkerStatus = 'ok' | 'stale' | 'never_ran';

export function getWorkerStatuses(): Record<string, WorkerStatus> {
  const now     = Math.floor(Date.now() / 1_000);
  const result: Record<string, WorkerStatus> = {};

  for (const [jobId, thresholdS] of Object.entries(JOB_STALE_THRESHOLDS_SECONDS)) {
    const lastSuccess = store.get(jobId)?.lastSuccessTs ?? 0;
    if (lastSuccess === 0)                     result[jobId] = 'never_ran';
    else if (now - lastSuccess > thresholdS)   result[jobId] = 'stale';
    else                                       result[jobId] = 'ok';
  }

  return result;
}

// ─── Prometheus text renderer ─────────────────────────────────────────────────

export function formatPrometheus(): string {
  const lines: string[] = [];

  // ── job_duration_seconds (histogram) ────────────────────────────────────
  lines.push(
    '# HELP job_duration_seconds Job execution duration in seconds',
    '# TYPE job_duration_seconds histogram',
  );
  for (const [name, m] of store) {
    const h   = m.histogram;
    const lbl = `job_name="${name}"`;
    let cumulative = 0;
    for (const le of DURATION_BUCKETS) {
      cumulative += h.buckets.get(le) ?? 0;
      lines.push(`job_duration_seconds_bucket{${lbl},le="${le}"} ${cumulative}`);
    }
    lines.push(`job_duration_seconds_bucket{${lbl},le="+Inf"} ${h.count}`);
    lines.push(`job_duration_seconds_sum{${lbl}} ${h.sum.toFixed(3)}`);
    lines.push(`job_duration_seconds_count{${lbl}} ${h.count}`);
  }

  // ── job_items_processed_total (counter with status label) ───────────────
  lines.push(
    '',
    '# HELP job_items_processed_total Items processed by status',
    '# TYPE job_items_processed_total counter',
  );
  for (const [name, m] of store) {
    const n = `job_name="${name}"`;
    lines.push(`job_items_processed_total{${n},status="success"} ${m.itemsSuccess}`);
    lines.push(`job_items_processed_total{${n},status="skipped"} ${m.itemsSkipped}`);
    lines.push(`job_items_processed_total{${n},status="error"} ${m.itemsError}`);
  }

  // ── job_last_success_timestamp (gauge) ───────────────────────────────────
  lines.push(
    '',
    '# HELP job_last_success_timestamp Unix timestamp of last successful job run (0 = never)',
    '# TYPE job_last_success_timestamp gauge',
  );
  for (const [name, m] of store) {
    lines.push(`job_last_success_timestamp{job_name="${name}"} ${m.lastSuccessTs}`);
  }

  return lines.join('\n') + '\n';
}

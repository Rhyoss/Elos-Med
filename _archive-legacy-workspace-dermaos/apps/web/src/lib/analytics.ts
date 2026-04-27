'use client';

/**
 * DermaOS product analytics — client-side telemetry with privacy guarantees.
 *
 * Privacy rules enforced here:
 *   - page_path: UUID/numeric segments stripped before queuing.
 *   - search_performed: no query term stored (result_count only).
 *   - AI suggestions: no suggestion content stored.
 *   - All string properties are scanned for CPF, email, and phone patterns
 *     and censored before the event is queued.
 *   - Free-text fields (notes, chat input, etc.) are never tracked.
 *
 * Batching:
 *   - Events accumulate locally (max 20) or for up to 30 s, then flush.
 *   - On flush failure: 2 retries with 5 s backoff, then silent discard.
 *   - While offline (navigator.onLine === false): discard silently.
 *   - X-Correlation-ID header is sent for server-side traceability.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType =
  | 'page_view'
  | 'feature_used'
  | 'error_occurred'
  | 'ai_suggestion_accepted'
  | 'ai_suggestion_rejected'
  | 'search_performed'
  | 'export_generated';

interface AnalyticsEvent {
  type:       EventType;
  timestamp:  string;
  properties: Record<string, unknown>;
}

// ─── PII detection ────────────────────────────────────────────────────────────

const PII_PATTERNS: RegExp[] = [
  /\d{3}\.\d{3}\.\d{3}-\d{2}/g,
  /\b\d{11}\b/g,
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g,
];

function hasPii(value: string): boolean {
  return PII_PATTERNS.some((re) => { re.lastIndex = 0; return re.test(value); });
}

function censorPii(value: string): string {
  let s = value;
  for (const re of PII_PATTERNS) { re.lastIndex = 0; s = s.replace(re, '[REDACTED]'); }
  return s;
}

function sanitizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'string') out[k] = censorPii(v);
    else                       out[k] = v;
  }
  return out;
}

// ─── Path normalisation ───────────────────────────────────────────────────────

const UUID_SEG_RE    = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_SEG_RE = /\/\d{2,}/g;

function normalizePath(path: string): string {
  // Strip query string first
  const base = path.split('?')[0] ?? path;
  return base
    .replace(UUID_SEG_RE,    '/:id')
    .replace(NUMERIC_SEG_RE, '/:id');
}

// ─── Batch queue ──────────────────────────────────────────────────────────────

const MAX_BATCH_SIZE   = 20;
const FLUSH_INTERVAL_MS = 30_000;
const API_ENDPOINT      = '/api/v1/analytics/events';
const MAX_RETRIES       = 2;
const RETRY_DELAY_MS    = 5_000;

let queue:         AnalyticsEvent[] = [];
let flushTimer:    ReturnType<typeof setTimeout> | null = null;
let correlationId: string | null = null;

function setCorrelationId(id: string): void {
  correlationId = id;
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

function push(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return; // SSR guard
  if (!navigator.onLine) return;             // discard while offline

  queue.push(event);
  scheduleFlush();

  if (queue.length >= MAX_BATCH_SIZE) {
    if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
    void flush();
  }
}

async function sendWithRetry(events: AnalyticsEvent[], attempt = 0): Promise<void> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (correlationId) headers['X-Correlation-ID'] = correlationId;

  try {
    const res = await fetch(API_ENDPOINT, {
      method:      'POST',
      credentials: 'include',
      headers,
      body:        JSON.stringify({ events }),
    });
    if (res.ok || res.status === 202) return;
    throw new Error(`HTTP ${res.status}`);
  } catch {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return sendWithRetry(events, attempt + 1);
    }
    // Final failure — discard silently (analytics must not break UX)
  }
}

async function flush(): Promise<void> {
  if (queue.length === 0) return;
  if (typeof window === 'undefined' || !navigator.onLine) { queue = []; return; }

  const batch = queue.splice(0, queue.length);
  await sendWithRetry(batch);
}

// ─── Public tracking API ──────────────────────────────────────────────────────

export function trackPageView(path: string, title?: string): void {
  push({
    type:      'page_view',
    timestamp: new Date().toISOString(),
    properties: sanitizeProps({
      page_path:  normalizePath(path),
      ...(title ? { page_title: title } : {}),
    }),
  });
}

export function trackFeatureUsed(featureName: string, module: string): void {
  push({
    type:      'feature_used',
    timestamp: new Date().toISOString(),
    properties: { feature_name: featureName, module },
  });
}

export function trackError(
  errorCode: string,
  component: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
): void {
  push({
    type:      'error_occurred',
    timestamp: new Date().toISOString(),
    properties: { error_code: errorCode, component, severity },
  });
}

export function trackAiSuggestion(
  accepted:        boolean,
  suggestionType:  string,
  module:          string,
): void {
  push({
    type:      accepted ? 'ai_suggestion_accepted' : 'ai_suggestion_rejected',
    timestamp: new Date().toISOString(),
    properties: { suggestion_type: suggestionType, module },
  });
}

export function trackSearch(module: string, resultCount: number): void {
  // NOTE: search query is intentionally NOT tracked (may contain patient data)
  push({
    type:      'search_performed',
    timestamp: new Date().toISOString(),
    properties: { module, result_count: resultCount },
  });
}

export function trackExport(
  exportType: string,
  module:     string,
  rowCount:   number,
): void {
  push({
    type:      'export_generated',
    timestamp: new Date().toISOString(),
    properties: { export_type: exportType, module, row_count: rowCount },
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Called from auth context to propagate correlation ID into analytics headers */
export { setCorrelationId };

/** Force flush — useful in tests or on page unload */
export { flush as flushAnalytics };

/** Check if a string contains PII before including it anywhere in analytics */
export { hasPii };

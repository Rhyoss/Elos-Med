/**
 * Prometheus-compatible in-process metrics for the DermaOS API.
 *
 * Design constraints enforced here:
 *   - No high-cardinality labels (no user_id, patient_id, tenant_id, or raw UUIDs).
 *   - Routes are normalised before being used as labels (UUIDs + numeric IDs → :id).
 *   - /metrics is protected at the route level (see index.ts).
 */

// ─── Shared types ────────────────────────────────────────────────────────────

type LabelSet = Record<string, string>;

const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5] as const;

interface Histogram {
  // cumulative count per upper-bound bucket (le)
  buckets: Map<number, number>;
  sum:     number;
  count:   number;
}

interface HistogramEntry {
  labels:    LabelSet;
  histogram: Histogram;
}

function mkHistogram(): Histogram {
  const buckets = new Map<number, number>();
  for (const le of DURATION_BUCKETS) buckets.set(le, 0);
  return { buckets, sum: 0, count: 0 };
}

function observe(h: Histogram, value: number): void {
  for (const le of DURATION_BUCKETS) {
    if (value <= le) h.buckets.set(le, (h.buckets.get(le) ?? 0) + 1);
  }
  h.sum   += value;
  h.count += 1;
}

// ─── Route normalisation ─────────────────────────────────────────────────────

const UUID_SEGMENT   = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_SEGMENT = /\/\d{2,}/g; // 2+ digits to avoid stripping single-char path segments

export function normalizeRoute(path: string): string {
  return path
    .replace(UUID_SEGMENT,    '/:id')
    .replace(NUMERIC_SEGMENT, '/:id')
    .replace(/\/{2,}/g,       '/');
}

// ─── HTTP metrics ─────────────────────────────────────────────────────────────

// key: `${METHOD}|${normalizedRoute}|${statusGroup}`
const httpDurationMap = new Map<string, HistogramEntry>();
// key: `${METHOD}|${normalizedRoute}|${exactStatusCode}`
const httpCounterMap  = new Map<string, { labels: LabelSet; value: number }>();

export function recordHttpRequest(
  method:     string,
  path:       string,
  statusCode: number,
  durationS:  number,
): void {
  const route       = normalizeRoute(path);
  const statusGroup = `${Math.floor(statusCode / 100)}xx`;
  const histKey     = `${method}|${route}|${statusGroup}`;
  const countKey    = `${method}|${route}|${statusCode}`;

  // Histogram (duration, grouped status)
  let he = httpDurationMap.get(histKey);
  if (!he) {
    he = { labels: { method, route, status_code: statusGroup }, histogram: mkHistogram() };
    httpDurationMap.set(histKey, he);
  }
  observe(he.histogram, durationS);

  // Counter (exact status code)
  let ce = httpCounterMap.get(countKey);
  if (!ce) {
    ce = { labels: { method, route, status_code: String(statusCode) }, value: 0 };
    httpCounterMap.set(countKey, ce);
  }
  ce.value++;
}

// ─── Active connections ───────────────────────────────────────────────────────

let activeHttpConns = 0;
let activeWsConns   = 0;

export function setWsConnectionCount(n: number): void { activeWsConns = n; }
export function incHttpConnections(): void  { activeHttpConns++; }
export function decHttpConnections(): void  { activeHttpConns = Math.max(0, activeHttpConns - 1); }

// ─── Cache metrics ───────────────────────────────────────────────────────────

interface CacheCounters {
  get_hit: number; get_miss: number;
  set_ok: number;  del_ok: number;
  error: number;
}

const cacheCounters = new Map<string, CacheCounters>();
const cacheWindows  = new Map<string, Array<{ ts: number; hit: boolean }>>();

export function recordCacheOp(
  cacheType: string,
  operation: 'get' | 'set' | 'del',
  result:    'hit' | 'miss' | 'error',
): void {
  let c = cacheCounters.get(cacheType);
  if (!c) {
    c = { get_hit: 0, get_miss: 0, set_ok: 0, del_ok: 0, error: 0 };
    cacheCounters.set(cacheType, c);
  }
  if (result === 'error') { c.error++;         return; }
  if (operation === 'get') result === 'hit' ? c.get_hit++   : c.get_miss++;
  if (operation === 'set') c.set_ok++;
  if (operation === 'del') c.del_ok++;

  // Sliding window for ratio calculation
  if (operation === 'get') {
    let w = cacheWindows.get(cacheType);
    if (!w) { w = []; cacheWindows.set(cacheType, w); }
    w.push({ ts: Date.now(), hit: result === 'hit' });
  }
}

function cacheHitRatio(cacheType: string): number {
  const now    = Date.now();
  const WINDOW = 5 * 60_000;
  const w      = cacheWindows.get(cacheType);
  if (!w || w.length === 0) return 0;
  const recent = w.filter(e => now - e.ts <= WINDOW);
  // Replace array in-place to free old entries
  w.splice(0, w.length, ...recent);
  if (recent.length === 0) return 0;
  return recent.filter(e => e.hit).length / recent.length;
}

// ─── AI inference metrics ─────────────────────────────────────────────────────

// key: model name (e.g. 'claude-sonnet', 'prophet', 'bert-sentiment')
const aiHistograms = new Map<string, HistogramEntry>();

export function recordAiInference(model: string, durationS: number): void {
  let he = aiHistograms.get(model);
  if (!he) {
    he = { labels: { model }, histogram: mkHistogram() };
    aiHistograms.set(model, he);
  }
  observe(he.histogram, durationS);
}

// ─── Business metrics ─────────────────────────────────────────────────────────

let activeTenants24h = 0;
const appointmentsTotal   = new Map<string, number>(); // source -> count
const aiConversations     = new Map<string, number>(); // `${channel}|${resolution}` -> count

export function setActiveTenants(count: number): void { activeTenants24h = count; }
export function recordAppointmentCreated(source: 'web' | 'patient_portal' | 'aura_ai'): void {
  appointmentsTotal.set(source, (appointmentsTotal.get(source) ?? 0) + 1);
}
export function recordAiConversation(
  channel:    string,
  resolution: 'resolved_by_ai' | 'escalated_to_human',
): void {
  const k = `${channel}|${resolution}`;
  aiConversations.set(k, (aiConversations.get(k) ?? 0) + 1);
}

// ─── Prometheus text format renderer ─────────────────────────────────────────

function labelStr(ls: LabelSet): string {
  return Object.entries(ls)
    .map(([k, v]) => `${k}="${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',');
}

function renderHistograms(
  name: string,
  help: string,
  type: string,
  map:  Map<string, HistogramEntry>,
): string[] {
  const lines = [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} ${type}`,
  ];
  for (const [, { labels, histogram }] of map) {
    const base = labelStr(labels);
    let cumulative = 0;
    for (const le of DURATION_BUCKETS) {
      cumulative += histogram.buckets.get(le) ?? 0;
      lines.push(`${name}_bucket{${base},le="${le}"} ${cumulative}`);
    }
    lines.push(`${name}_bucket{${base},le="+Inf"} ${histogram.count}`);
    lines.push(`${name}_sum{${base}} ${histogram.sum.toFixed(6)}`);
    lines.push(`${name}_count{${base}} ${histogram.count}`);
  }
  return lines;
}

/**
 * Renders all API metrics in Prometheus text exposition format (v0.0.4).
 * wsConnectionsFn is injected to avoid a circular import with realtime/metrics.ts.
 */
export function renderPrometheusMetrics(wsConnectionsFn: () => number): string {
  const activeWs = wsConnectionsFn();
  const lines: string[] = [];

  // ── HTTP request duration ────────────────────────────────────────────────
  lines.push(
    ...renderHistograms(
      'http_request_duration_seconds',
      'HTTP request latency in seconds',
      'histogram',
      httpDurationMap,
    ),
  );

  // ── HTTP requests total ─────────────────────────────────────────────────
  lines.push(
    '',
    '# HELP http_requests_total Total HTTP requests',
    '# TYPE http_requests_total counter',
  );
  for (const [, { labels, value }] of httpCounterMap) {
    lines.push(`http_requests_total{${labelStr(labels)}} ${value}`);
  }

  // ── Active connections ───────────────────────────────────────────────────
  lines.push(
    '',
    '# HELP active_connections Active connections by protocol',
    '# TYPE active_connections gauge',
    `active_connections{protocol="http"} ${activeHttpConns}`,
    `active_connections{protocol="websocket"} ${activeWs}`,
  );

  // ── Cache hit ratio ──────────────────────────────────────────────────────
  lines.push(
    '',
    '# HELP cache_hit_ratio GET hit ratio in last 5 minutes',
    '# TYPE cache_hit_ratio gauge',
  );
  for (const [cacheType] of cacheCounters) {
    const ratio = cacheHitRatio(cacheType);
    lines.push(`cache_hit_ratio{cache_type="${cacheType}"} ${ratio.toFixed(4)}`);
  }

  // ── Cache operations total ───────────────────────────────────────────────
  lines.push(
    '',
    '# HELP cache_operations_total Cache operation counter',
    '# TYPE cache_operations_total counter',
  );
  for (const [cacheType, c] of cacheCounters) {
    lines.push(`cache_operations_total{cache_type="${cacheType}",operation="get",result="hit"} ${c.get_hit}`);
    lines.push(`cache_operations_total{cache_type="${cacheType}",operation="get",result="miss"} ${c.get_miss}`);
    lines.push(`cache_operations_total{cache_type="${cacheType}",operation="set",result="ok"} ${c.set_ok}`);
    lines.push(`cache_operations_total{cache_type="${cacheType}",operation="del",result="ok"} ${c.del_ok}`);
    lines.push(`cache_operations_total{cache_type="${cacheType}",operation="any",result="error"} ${c.error}`);
  }

  // ── AI inference duration ────────────────────────────────────────────────
  lines.push(
    '',
    ...renderHistograms(
      'ai_inference_duration_seconds',
      'AI model inference latency in seconds',
      'histogram',
      aiHistograms,
    ),
  );

  // ── Business metrics ─────────────────────────────────────────────────────
  lines.push(
    '',
    '# HELP active_tenants Tenants with activity in last 24h',
    '# TYPE active_tenants gauge',
    `active_tenants ${activeTenants24h}`,

    '',
    '# HELP appointments_created_total Appointments created by source',
    '# TYPE appointments_created_total counter',
  );
  for (const [source, count] of appointmentsTotal) {
    lines.push(`appointments_created_total{source="${source}"} ${count}`);
  }

  lines.push(
    '',
    '# HELP ai_conversations_total AI conversations by channel and resolution',
    '# TYPE ai_conversations_total counter',
  );
  for (const [key, count] of aiConversations) {
    const [channel, resolution_type] = key.split('|');
    lines.push(
      `ai_conversations_total{channel="${channel}",resolution_type="${resolution_type}"} ${count}`,
    );
  }

  return lines.join('\n') + '\n';
}

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { redis } from '../../db/redis.js';
import { logger } from '../../lib/logger.js';
import type { JwtUser } from '../auth/auth.types.js';

// ─── Allowed event types (whitelist) ─────────────────────────────────────────

const EVENT_TYPES = [
  'page_view',
  'feature_used',
  'error_occurred',
  'ai_suggestion_accepted',
  'ai_suggestion_rejected',
  'search_performed',
  'export_generated',
] as const;

type EventType = (typeof EVENT_TYPES)[number];

// ─── Property schemas per event type ─────────────────────────────────────────

const propertySchemas: Record<EventType, z.ZodTypeAny> = {
  page_view: z.object({
    page_path:  z.string().max(500),
    page_title: z.string().max(200).optional(),
  }),
  feature_used: z.object({
    feature_name: z.string().max(100),
    module:       z.string().max(100),
  }),
  error_occurred: z.object({
    error_code: z.string().max(100),
    component:  z.string().max(100),
    severity:   z.enum(['low', 'medium', 'high', 'critical']),
  }),
  ai_suggestion_accepted: z.object({
    suggestion_type: z.string().max(100),
    module:          z.string().max(100),
  }),
  ai_suggestion_rejected: z.object({
    suggestion_type: z.string().max(100),
    module:          z.string().max(100),
  }),
  search_performed: z.object({
    // Deliberately no 'query' field — search terms may contain patient data
    module:       z.string().max(100),
    result_count: z.number().int().min(0),
  }),
  export_generated: z.object({
    export_type: z.string().max(100),
    module:      z.string().max(100),
    row_count:   z.number().int().min(0),
  }),
};

// ─── PII patterns — strip these from property values ─────────────────────────

const PII_PATTERNS = [
  /\d{3}\.\d{3}\.\d{3}-\d{2}/g,              // CPF formatted
  /\b\d{11}\b/g,                               // CPF unformatted
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, // email
  /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g, // BR phone
];

const UUID_PATH_RE   = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_SEG_RE = /\/\d{2,}/g;

function sanitizePath(path: string): string {
  return path
    .replace(UUID_PATH_RE,    '/:id')
    .replace(NUMERIC_SEG_RE,  '/:id');
}

function sanitizeProperties(
  eventType: EventType,
  rawProps: Record<string, unknown>,
): Record<string, unknown> {
  const schema = propertySchemas[eventType];
  const parsed = schema.safeParse(rawProps);
  const base: Record<string, unknown> = parsed.success ? parsed.data : {};

  // Sanitize page_path in page_view
  if (eventType === 'page_view' && typeof base['page_path'] === 'string') {
    let p = sanitizePath(base['page_path']);
    for (const re of PII_PATTERNS) { p = p.replace(re, '[REDACTED]'); re.lastIndex = 0; }
    base['page_path'] = p;
  }

  // Strip any string value that matches a PII pattern in all properties
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === 'string') {
      let s = v;
      for (const re of PII_PATTERNS) { s = s.replace(re, '[REDACTED]'); re.lastIndex = 0; }
      base[k] = s;
    }
  }

  return base;
}

// ─── Rate limit helper ────────────────────────────────────────────────────────

const ANALYTICS_RATE_MAX    = 10;
const ANALYTICS_RATE_WINDOW = 60; // seconds

async function checkAnalyticsRateLimit(userId: string): Promise<boolean> {
  const key   = `rate:analytics:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, ANALYTICS_RATE_WINDOW);
  return count <= ANALYTICS_RATE_MAX;
}

// ─── Batch event schema ───────────────────────────────────────────────────────

const eventSchema = z.object({
  type:       z.enum(EVENT_TYPES),
  timestamp:  z.string().datetime(),
  properties: z.record(z.unknown()).default({}),
});

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(50),
});

// ─── Route registration ───────────────────────────────────────────────────────

export async function registerAnalyticsEventsRoute(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/v1/analytics/events',
    async (req: FastifyRequest, reply: FastifyReply) => {
      // ── Auth ────────────────────────────────────────────────────────────
      let user: JwtUser;
      try {
        user = await req.jwtVerify<JwtUser>();
      } catch {
        return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
      }

      if (!user.clinicId) {
        return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Clinic not identified.' });
      }

      // ── Rate limit: 10 batches / 60 s per user ───────────────────────
      const allowed = await checkAnalyticsRateLimit(user.sub).catch(() => true);
      if (!allowed) {
        return reply.status(429).send({ code: 'RATE_LIMIT', message: 'Analytics rate limit exceeded.' });
      }

      // ── Parse body ───────────────────────────────────────────────────
      const parsed = batchSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() });
      }

      // Respond 202 immediately — processing is async
      void reply.status(202).send({ accepted: parsed.data.events.length });

      // ── Background processing ────────────────────────────────────────
      processEventsBatch(
        user.sub,
        user.clinicId,
        parsed.data.events,
        req.correlationId,
      ).catch((err) => {
        logger.error({ err, userId: user.sub, tenantId: user.clinicId }, 'Analytics batch processing failed');
      });
    },
  );
}

// ─── Async batch processor ────────────────────────────────────────────────────

interface RawEvent {
  type:       EventType;
  timestamp:  string;
  properties: Record<string, unknown>;
}

async function processEventsBatch(
  userId:        string,
  tenantId:      string,
  events:        RawEvent[],
  correlationId: string,
): Promise<void> {
  const rows = events.map((e) => ({
    type:       e.type,
    timestamp:  e.timestamp,
    properties: sanitizeProperties(e.type, e.properties),
  }));

  // Bulk insert via unnest
  const types   = rows.map((r) => r.type);
  const tss     = rows.map((r) => r.timestamp);
  const props   = rows.map((r) => JSON.stringify(r.properties));

  await db.query(
    `INSERT INTO analytics.product_events (tenant_id, user_id, event_type, properties, event_ts)
     SELECT $1, $2, unnest($3::text[]), unnest($4::jsonb[]), unnest($5::timestamptz[])`,
    [tenantId, userId, types, props, tss],
  );

  logger.info(
    { correlation_id: correlationId, userId, tenantId, count: rows.length },
    'Analytics events stored',
  );
}

import pino from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface CorrelationContext {
  correlationId: string;
  userId?: string;
  tenantId?: string;
}

/**
 * AsyncLocalStorage propagates correlation_id + auth context across the full
 * async call chain (HTTP handler → tRPC → service → DB query).
 * Set via correlationStore.enterWith() in the onRequest hook.
 */
export const correlationStore = new AsyncLocalStorage<CorrelationContext>();

/** Mask last IPv4 octet or last 4 IPv6 groups — LGPD compliance */
function maskIp(ip: string | undefined): string {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return 'localhost';
  const ipv4 = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/;
  const m4 = ipv4.exec(ip);
  if (m4) return `${m4[1]}.xxx`;
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return [...parts.slice(0, 4), 'xxxx', 'xxxx', 'xxxx', 'xxxx'].join(':');
  }
  return ip;
}

/** Strip query string to prevent logging sensitive query param values */
function sanitizePath(url: string | undefined): string {
  if (!url) return '/';
  const qi = url.indexOf('?');
  return qi === -1 ? url : url.slice(0, qi);
}

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',

  // Pino fast-redact: censors these paths in every log record.
  // Applied AFTER serializers, so it catches nested/renamed fields too.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'body.password',
      'body.token',
      'body.cpf',
      'body.card_number',
      'body.secret',
      'body.api_key',
      '*.password',
      '*.secret',
      '*.api_key',
      '*.token',
      '*.cpf',
    ],
    censor: '[REDACTED]',
  },

  serializers: {
    // req: include only safe subset of headers; mask IP; strip query string
    req(req: {
      method?: string;
      url?: string;
      headers?: Record<string, string | string[] | undefined>;
      remoteAddress?: string;
      ip?: string;
    }) {
      return {
        method: req.method,
        url: sanitizePath(req.url),
        headers: {
          'user-agent': req.headers?.['user-agent'],
          'x-correlation-id': req.headers?.['x-correlation-id'],
          'content-type': req.headers?.['content-type'],
        },
        ip: maskIp(req.remoteAddress ?? (req.ip as string | undefined)),
      };
    },

    // res: only statusCode (responseTime is logged separately as duration_ms)
    res(res: { statusCode?: number }) {
      return { statusCode: res.statusCode };
    },

    // err: structured error without exposing internal connection strings etc.
    err(err: Error & { code?: string }) {
      return {
        type: err?.constructor?.name ?? 'Error',
        message: err?.message,
        code: (err as NodeJS.ErrnoException)?.code,
        stack: err?.stack,
      };
    },
  },

  // Inject correlation context into every log record from the current async scope.
  // Works across module boundaries without passing ctx explicitly.
  mixin() {
    const ctx = correlationStore.getStore();
    if (!ctx) return {};
    return {
      correlation_id: ctx.correlationId,
      ...(ctx.userId   ? { userId:   ctx.userId   } : {}),
      ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
    };
  },

  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {
        formatters: { level: (label: string) => ({ level: label }) },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

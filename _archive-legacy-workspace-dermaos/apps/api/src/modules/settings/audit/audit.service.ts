import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../../db/client.js';
import { logger } from '../../../lib/logger.js';
import type { ListAuditLogsInput, ExportAuditLogsInput } from '@dermaos/shared';

const SENSITIVE_FIELD_NAMES = new Set([
  'token', 'secret', 'password', 'credentials', 'api_key',
  'access_token', 'refresh_token', 'webhook_secret',
]);

function sanitizeDiffValue(key: string, value: unknown): unknown {
  if (SENSITIVE_FIELD_NAMES.has(key.toLowerCase())) {
    return '*** (alterado)';
  }
  return value;
}

function sanitizePayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map((v) => sanitizePayload(v));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
    if (SENSITIVE_FIELD_NAMES.has(key.toLowerCase())) {
      out[key] = '*** (alterado)';
    } else if (val && typeof val === 'object' && ('old' in val || 'new' in val)) {
      const nested = val as { old?: unknown; new?: unknown };
      out[key] = {
        old: sanitizeDiffValue(key, nested.old),
        new: sanitizeDiffValue(key, nested.new),
      };
    } else {
      out[key] = sanitizePayload(val);
    }
  }
  return out;
}

export async function listAuditLogs(clinicId: string, input: ListAuditLogsInput) {
  const periodMs = input.dateFrom && input.dateTo
    ? input.dateTo.getTime() - input.dateFrom.getTime()
    : null;
  const ninetyDaysMs = 90 * 24 * 3600 * 1000;

  const suggestExport = periodMs !== null && periodMs > ninetyDaysMs;

  return withClinicContext(clinicId, async (client) => {
    const where: string[] = ['e.clinic_id = $1'];
    const params: unknown[] = [clinicId];
    let idx = 2;

    if (input.userId) {
      where.push(`e.metadata->>'user_id' = $${idx}`);
      params.push(input.userId);
      idx++;
    }

    if (input.action) {
      where.push(`e.event_type ILIKE $${idx}`);
      params.push(`%${input.action}%`);
      idx++;
    }

    // Cursor-based pagination: cursor is an ISO timestamp
    if (input.cursor) {
      where.push(`e.occurred_at < $${idx}::timestamptz`);
      params.push(input.cursor);
      idx++;
    }

    if (input.dateFrom) {
      where.push(`e.occurred_at >= $${idx}::timestamptz`);
      params.push(input.dateFrom.toISOString());
      idx++;
    }

    if (input.dateTo) {
      where.push(`e.occurred_at <= $${idx}::timestamptz`);
      params.push(input.dateTo.toISOString());
      idx++;
    }

    // Enforce 1-year max period
    where.push(`e.occurred_at >= NOW() - INTERVAL '1 year'`);

    params.push(input.limit + 1); // fetch one extra to determine if there's a next page

    const { rows } = await client.query(
      `SELECT e.id, e.aggregate_type, e.aggregate_id, e.event_type,
              e.occurred_at, e.metadata,
              u.name AS user_name, u.email AS user_email
         FROM audit.domain_events e
         LEFT JOIN shared.users u ON u.id = (e.metadata->>'user_id')::uuid
         WHERE ${where.join(' AND ')}
         ORDER BY e.occurred_at DESC
         LIMIT $${idx}`,
      params,
    );

    const hasMore = rows.length > input.limit;
    const events  = rows.slice(0, input.limit);
    const nextCursor = hasMore ? events[events.length - 1]?.occurred_at?.toISOString() : null;

    return {
      events,
      nextCursor,
      hasMore,
      suggestExport,
    };
  });
}

export async function getAuditLogDetail(clinicId: string, eventId: string) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT e.id, e.aggregate_type, e.aggregate_id, e.event_type,
              e.payload, e.metadata, e.occurred_at,
              u.name AS user_name, u.email AS user_email
         FROM audit.domain_events e
         LEFT JOIN shared.users u ON u.id = (e.metadata->>'user_id')::uuid
         WHERE e.id = $1 AND e.clinic_id = $2`,
      [eventId, clinicId],
    );

    const event = rows[0];
    if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Evento de auditoria não encontrado.' });

    // Sanitize sensitive fields before returning
    return {
      ...event,
      payload:  sanitizePayload(event.payload),
      metadata: sanitizePayload(event.metadata),
    };
  });
}

function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  // CSV injection prevention: prefix with ' if starts with =, +, -, @, tab, CR
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
  return str;
}

export async function exportAuditLogs(
  clinicId: string,
  userId: string,
  input: ExportAuditLogsInput,
): Promise<string> {
  const where: string[] = ['clinic_id = $1'];
  const params: unknown[] = [clinicId];
  let idx = 2;

  if (input.userId) {
    where.push(`metadata->>'user_id' = $${idx}`);
    params.push(input.userId);
    idx++;
  }
  if (input.action) {
    where.push(`event_type ILIKE $${idx}`);
    params.push(`%${input.action}%`);
    idx++;
  }
  if (input.dateFrom) {
    where.push(`occurred_at >= $${idx}::timestamptz`);
    params.push(input.dateFrom.toISOString());
    idx++;
  }
  if (input.dateTo) {
    where.push(`occurred_at <= $${idx}::timestamptz`);
    params.push(input.dateTo.toISOString());
    idx++;
  }

  where.push(`occurred_at >= NOW() - INTERVAL '1 year'`);

  const { rows } = await db.query(
    `SELECT id, aggregate_type, aggregate_id, event_type,
            metadata->>'user_id' AS user_id, occurred_at
       FROM audit.domain_events
       WHERE ${where.join(' AND ')}
       ORDER BY occurred_at DESC
       LIMIT 50000`,
    params,
  );

  const headers = ['id', 'data', 'tipo_evento', 'entidade', 'entidade_id', 'usuario_id'];
  const csvRows = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((r) =>
      [r.id, r.occurred_at, r.event_type, r.aggregate_type, r.aggregate_id, r.user_id]
        .map(escapeCsvField)
        .join(','),
    ),
  ];

  // Record the export in audit log
  setImmediate(async () => {
    try {
      await db.query(
        `INSERT INTO audit.domain_events
           (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
         VALUES ($1, 'settings', $1::uuid, 'settings.audit_exported', $2, $3)`,
        [
          clinicId,
          JSON.stringify({ rows: rows.length }),
          JSON.stringify({ user_id: userId }),
        ],
      );
    } catch (err) {
      logger.error({ err }, 'Audit export self-log failed');
    }
  });

  return csvRows.join('\n');
}

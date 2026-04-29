import crypto from 'node:crypto';
import { t } from '../trpc.js';
import { withClinicContext } from '../../db/client.js';
import { logger } from '../../lib/logger.js';

const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'password_hash', 'token', 'refreshToken',
  'secret', 'apiKey', 'api_key', 'credentials', 'mfa_secret',
]);

function maskSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => maskSensitive(v, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.has(key) ? '[REDACTED]' : maskSensitive(value, depth + 1);
  }
  return result;
}

function inferAction(path: string, isOk: boolean): string {
  if (!isOk) return 'error';
  const last = path.split('.').pop() ?? '';
  if (last.startsWith('create') || last === 'register') return 'create';
  if (last.startsWith('update') || last.startsWith('edit') || last === 'changePassword') return 'update';
  if (last.startsWith('delete') || last.startsWith('remove')) return 'delete';
  if (last === 'export') return 'export';
  return 'read';
}

/**
 * Intercepta mutations e registra em audit.domain_events.
 * Não bloqueia a resposta em caso de falha de auditoria.
 */
export const auditMutation = t.middleware(async ({ ctx, path, type, input, next }) => {
  const correlationId = crypto.randomUUID();
  const startedAt = Date.now();

  const result = await next({ ctx });

  // Audita apenas mutations com usuário autenticado
  if (type !== 'mutation' || !ctx.user || !ctx.clinicId) return result;

  const durationMs = Date.now() - startedAt;
  const action = inferAction(path, result.ok);

  // SEC-02: capturar dados localmente antes do setImmediate quebrar o ALS.
  const clinicId = ctx.clinicId;
  const userId   = ctx.user.sub;
  const ip       = ctx.req.ip;
  const ua       = ctx.req.headers['user-agent'];
  const aggregate = path.split('.')[0] ?? 'unknown';
  const maskedInput = maskSensitive(input);
  const eventType = path.replace(/\./g, '_').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

  setImmediate(async () => {
    try {
      // Abre uma transação curta com SET LOCAL app.current_clinic_id — RLS
      // aplica corretamente o INSERT em audit.domain_events.
      await withClinicContext(clinicId, async (client) => {
        await client.query(
          `INSERT INTO audit.domain_events
             (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            clinicId,
            aggregate,
            userId,
            eventType,
            JSON.stringify({ input: maskedInput, ok: result.ok }),
            JSON.stringify({
              user_id: userId,
              clinic_id: clinicId,
              ip,
              user_agent: ua,
              correlation_id: correlationId,
              duration_ms: durationMs,
              path,
              action,
            }),
          ],
        );
      });
    } catch (err) {
      // Falha no audit nunca quebra a operação principal
      logger.error({ err, path }, 'Audit log write failed');
    }
  });

  return result;
});

/**
 * Registra acesso a dados PHI em audit.access_log.
 * Usar em procedures que retornam dados sensíveis de pacientes.
 */
export const auditPHIAccess = t.middleware(async ({ ctx, path, next }) => {
  const result = await next({ ctx });

  if (!ctx.user || !ctx.clinicId) return result;

  // SEC-02: capturar antes do setImmediate.
  const clinicId    = ctx.clinicId;
  const userId      = ctx.user.sub;
  const ip          = ctx.req.ip;
  const ua          = ctx.req.headers['user-agent'] ?? null;
  const resourceType = path.split('.')[0] ?? 'unknown';
  const action      = result.ok ? 'read' : 'error';

  setImmediate(async () => {
    try {
      await withClinicContext(clinicId, async (client) => {
        await client.query(
          `INSERT INTO audit.access_log
             (clinic_id, user_id, resource_type, resource_id, action, ip_address, user_agent, request_path)
           VALUES ($1, $2, $3, $4, $5, $6::inet, $7, $8)`,
          [clinicId, userId, resourceType, userId, action, ip, ua, path],
        );
      });
    } catch (err) {
      logger.error({ err, path }, 'PHI access log write failed');
    }
  });

  return result;
});

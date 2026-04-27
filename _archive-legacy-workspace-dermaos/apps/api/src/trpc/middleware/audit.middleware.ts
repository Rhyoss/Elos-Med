import crypto from 'node:crypto';
import { t } from '../trpc.js';
import { db } from '../../db/client.js';
import { logger } from '../../lib/logger.js';

/**
 * Conjunto canônico de chaves a serem redatadas em audit logs.
 * Importante: sinônimos camelCase + snake_case e variantes em PT/EN.
 * Logs jamais devem conter senha, token, segredo, hash de campo PHI ou conteúdo
 * descriptografado (name, cpf, email, phone, content de mensagens, SOAP).
 */
const SENSITIVE_KEYS = new Set([
  // Auth
  'password', 'passwordHash', 'password_hash', 'newPassword', 'currentPassword',
  'token', 'accessToken', 'refreshToken', 'refresh_token', 'access_token',
  'jwt', 'jti',
  'secret', 'apiKey', 'api_key', 'credentials', 'mfa_secret',
  // PHI direto / criptografado
  'name', 'cpf', 'cpf_encrypted', 'cpf_hash', 'email_encrypted', 'email_hash',
  'phone', 'phone_encrypted', 'phone_secondary_encrypted',
  'address', 'birth_date', 'birthDate',
  // SOAP / clinical content
  'subjective', 'objective', 'assessment', 'plan',
  's', 'o', 'a', 'p',
  // Comunicação
  'content', 'message', 'body',
  // Outros
  'authorization',
]);

function maskSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => maskSensitive(v, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.has(key) ? '***REDACTED***' : maskSensitive(value, depth + 1);
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
function getCorrelationId(headers: Record<string, string | string[] | undefined>): string {
  const headerValue = headers['x-correlation-id'] ?? headers['x-request-id'];
  if (typeof headerValue === 'string' && /^[A-Za-z0-9\-_]{6,128}$/.test(headerValue)) {
    return headerValue;
  }
  return crypto.randomUUID();
}

export const auditMutation = t.middleware(async ({ ctx, path, type, input, next }) => {
  const correlationId = getCorrelationId(ctx.req.headers);
  // Propaga para a resposta — o frontend e SDKs externos podem correlacionar
  try { ctx.res.header('X-Correlation-ID', correlationId); } catch { /* noop */ }
  const startedAt = Date.now();

  const result = await next({ ctx });

  // Audita apenas mutations com usuário autenticado
  if (type !== 'mutation' || !ctx.user || !ctx.clinicId) return result;

  const durationMs = Date.now() - startedAt;
  const action = inferAction(path, result.ok);

  setImmediate(async () => {
    try {
      const aggregate = path.split('.')[0] ?? 'unknown';
      const maskedInput = maskSensitive(input);

      await db.query(
        `INSERT INTO audit.domain_events
           (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata, correlation_id, new_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7::uuid, $8)`,
        [
          ctx.clinicId,
          aggregate,
          ctx.user?.sub ?? 'unknown',
          // Converte path tRPC para formato event_type compatível com CHECK constraint
          path.replace(/\./g, '_').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
          JSON.stringify({ input: maskedInput, ok: result.ok }),
          JSON.stringify({
            user_id: ctx.user?.sub,
            clinic_id: ctx.clinicId,
            ip: ctx.req.ip,
            user_agent: ctx.req.headers['user-agent'],
            correlation_id: correlationId,
            duration_ms: durationMs,
            path,
            action,
          }),
          // correlation_id também na coluna dedicada (índice direto)
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(correlationId) ? correlationId : null,
          JSON.stringify({ input: maskedInput }),
        ],
      );
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
  const correlationId = getCorrelationId(ctx.req.headers);
  try { ctx.res.header('X-Correlation-ID', correlationId); } catch { /* noop */ }
  const result = await next({ ctx });

  if (!ctx.user || !ctx.clinicId) return result;

  setImmediate(async () => {
    try {
      await db.query(
        `INSERT INTO audit.access_log
           (clinic_id, user_id, resource_type, resource_id, action, ip_address, user_agent, request_path, session_id)
         VALUES ($1, $2, $3, $4, $5, $6::inet, $7, $8, $9)`,
        [
          ctx.clinicId,
          ctx.user?.sub,
          path.split('.')[0] ?? 'unknown',
          ctx.user?.sub ?? 'unknown',
          result.ok ? 'read' : 'error',
          ctx.req.ip,
          ctx.req.headers['user-agent'] ?? null,
          path,
          correlationId,
        ],
      );
    } catch (err) {
      logger.error({ err, path }, 'PHI access log write failed');
    }
  });

  return result;
});

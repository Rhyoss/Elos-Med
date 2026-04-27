import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Database
  DATABASE_URL: z.string().url().startsWith('postgresql://'),

  // Redis
  REDIS_URL: z.string().url(),

  // MinIO / Object Storage
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),

  // Typesense
  TYPESENSE_HOST: z.string().min(1),
  TYPESENSE_PORT: z.coerce.number().int().positive().default(8108),
  TYPESENSE_API_KEY: z.string().min(1),

  // Ollama (IA local para dados PHI)
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Criptografia AES-256 (64 chars hex = 32 bytes)
  // Mantida para retrocompatibilidade (lib/crypto.ts). Nova app usa MASTER_ENCRYPTION_KEY versionado.
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/i),

  // Master key versionada (Prompt 20 — EncryptionService)
  MASTER_ENCRYPTION_KEY:    z.string().length(64).regex(/^[0-9a-f]+$/i),
  MASTER_KEY_VERSION:       z.coerce.number().int().positive().default(1),
  // Chaves de versões anteriores: MASTER_KEY_V1, MASTER_KEY_V2, ... (hex 64 chars).
  // Resolvidas dinamicamente em lib/encryption.ts via process.env.

  // Segredo de tenant para HMAC determinístico (lookups por hash).
  TENANT_HMAC_SECRET:       z.string().min(32),

  // Chaves do JWT por audiência (revisar — patient-portal usa secret distinto)
  PORTAL_JWT_SECRET:        z.string().min(32).optional(),

  // Sessão
  SESSION_IDLE_TIMEOUT_SEC: z.coerce.number().int().positive().default(1_800), // 30 min

  // Claude API (dados não-PHI)
  CLAUDE_API_KEY: z.string().startsWith('sk-ant-').optional(),

  // SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  // Patient Portal
  PORTAL_URL: z.string().url().default('http://localhost:3002'),
  PORTAL_CAPTCHA_SECRET: z.string().optional(),        // hCaptcha ou Cloudflare Turnstile secret
  PORTAL_VAPID_PUBLIC_KEY: z.string().optional(),      // Web Push VAPID
  PORTAL_VAPID_PRIVATE_KEY: z.string().optional(),
  PORTAL_VAPID_SUBJECT: z.string().optional(),         // ex: "mailto:noreply@dermaos.com.br"

  // Prometheus /metrics protection (IP allowlist OR Basic Auth; at least one must be set in prod)
  METRICS_ALLOWED_IPS: z.string().optional(),   // comma-separated, e.g. "10.0.0.1,10.0.0.2"
  METRICS_USERNAME:    z.string().optional(),   // Basic Auth username
  METRICS_PASSWORD:    z.string().optional(),   // Basic Auth password
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const message = Object.entries(errors)
      .map(([field, msgs]) => `  ${field}: ${msgs?.join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${message}`);
  }

  return result.data;
}

// Singleton — parse once at startup
export const env = parseEnv();
export type Env = typeof env;

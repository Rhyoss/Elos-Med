import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Database — accepts full URL or constructed from POSTGRES_* parts
  DATABASE_URL: z.string().min(1).optional(),
  POSTGRES_HOST: z.string().optional(),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().default('dermaos'),
  POSTGRES_APP_USER: z.string().default('dermaos_app'),
  POSTGRES_APP_PASSWORD: z.string().optional(),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Google Cloud Storage
  GCS_PROJECT_ID: z.string().optional(),
  GCS_BUCKET_PREFIX: z.string().default(''),

  // Typesense
  TYPESENSE_HOST: z.string().default('localhost'),
  TYPESENSE_PORT: z.coerce.number().int().positive().default(8108),
  TYPESENSE_API_KEY: z.string().default(''),

  // Ollama (IA local para dados PHI)
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),

  // Auth
  // SEC-06: JWT_SECRET (access) e JWT_REFRESH_SECRET DEVEM ser distintos.
  // SEC-07: COOKIE_SECRET é separado dos dois para evitar key reuse.
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // SEC-08: lista CSV de origins permitidos em produção, ex.:
  // "https://app.dermaos.com.br,https://portal.dermaos.com.br"
  CORS_ORIGINS: z.string().default(''),

  // SEC-21: URL pública para construir links em emails (reset, invite, etc.)
  APP_URL: z.string().url().default('http://localhost:3000'),

  // Criptografia AES-256 (64 chars hex = 32 bytes)
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/i),

  // SEC-13: blind index key — chave HMAC-SHA256 separada para gerar
  // tokens determinísticos de busca em campos cifrados (ex.: nome do
  // paciente). Distinta da ENCRYPTION_KEY para que comprometer uma não
  // comprometa o outro.
  SEARCH_INDEX_KEY: z.string().length(64).regex(/^[0-9a-f]+$/i),

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

  // SEC-06/07: refusa segredos repetidos
  const data = result.data;
  if (data.JWT_SECRET === data.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET e JWT_REFRESH_SECRET devem ser distintos (SEC-06)');
  }
  if (data.JWT_SECRET === data.COOKIE_SECRET || data.JWT_REFRESH_SECRET === data.COOKIE_SECRET) {
    throw new Error('COOKIE_SECRET deve ser distinto dos JWT secrets (SEC-07)');
  }

  // Validate that we can build a DB connection. Cloud SQL Unix sockets
  // (/cloudsql/PROJECT:REGION:INSTANCE) don't fit URL syntax safely — the
  // pg client handles them via the object-form config (see db/client.ts).
  if (!data.DATABASE_URL) {
    const host = data.POSTGRES_HOST;
    const password = data.POSTGRES_APP_PASSWORD;
    if (!host || !password) {
      throw new Error('Either DATABASE_URL or POSTGRES_HOST + POSTGRES_APP_PASSWORD must be set');
    }
  }

  // Em produção, REDIS_URL deve vir do Secret Manager (`redis-url`) já com
  // esquema `rediss://` para forçar TLS contra o Memorystore (transit
  // encryption SERVER_AUTHENTICATION). Recusar fallback inseguro evita que
  // um deploy mal configurado abra Redis em texto puro.
  if (!data.REDIS_URL) {
    if (data.NODE_ENV === 'production') {
      throw new Error(
        'REDIS_URL é obrigatório em produção (esperado rediss://...). Verifique o secret redis-url.',
      );
    }
    const auth = data.REDIS_PASSWORD ? `:${encodeURIComponent(data.REDIS_PASSWORD)}@` : '';
    (data as Record<string, unknown>).REDIS_URL =
      `redis://${auth}${data.REDIS_HOST}:${data.REDIS_PORT}`;
  }

  return data as typeof data & { DATABASE_URL?: string; REDIS_URL: string };
}

// Singleton — parse once at startup
export const env = parseEnv();
export type Env = typeof env;

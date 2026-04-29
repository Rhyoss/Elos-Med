import pino from 'pino';
import { env } from '../config/env.js';

/**
 * SEC-12 — Pino com redact paths.
 * Qualquer objeto/campo que case com os paths abaixo é substituído por
 * `[REDACTED]` antes do log ser emitido. Isto cobre:
 *   - Headers de auth (Authorization, Cookie)
 *   - Tokens (access/refresh, reset, invite, webhook secrets)
 *   - Senhas e hashes
 *   - PII em texto plano (CPF, email, phone) e cifrados (campos *_encrypted)
 *   - Configurações sensíveis de canais (appSecret, accessToken, botToken, ...)
 *
 * O caminho com `*` casa em qualquer chave do objeto raiz; `[*]` casa em
 * arrays. Em caso de dúvida, conferir
 * https://github.com/pinojs/pino/blob/master/docs/redaction.md
 */
const REDACT_PATHS: string[] = [
  // HTTP
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',

  // Tokens / segredos genéricos (raiz e profundidade 1)
  'token',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'jwt',
  'JWT',
  'apiKey',
  'api_key',
  'secret',
  'secretKey',
  'password',
  'passwordHash',
  'password_hash',
  'webhookSecret',
  'webhook_secret',
  'webhook_secret_enc',
  'signingKey',
  'appSecret',
  'app_secret',
  'verifyToken',
  'botToken',
  'mfa_secret',

  // Variantes em sub-objetos comuns
  '*.password',
  '*.passwordHash',
  '*.password_hash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.appSecret',
  '*.signingKey',
  '*.webhookSecret',
  '*.botToken',
  '*.apiKey',
  '*.secret',
  '*.mfa_secret',
  '*.verifyToken',
  'config.*',           // omni.channels.config — credenciais por provider
  'data.config.*',
  'channel.config.*',

  // PII (texto plano)
  '*.cpf',
  '*.email',
  '*.phone',
  '*.phoneSecondary',

  // PII (cifrada — sem PII direto, mas leak de ciphertext + IV não ajuda)
  '*.cpf_encrypted',
  '*.email_encrypted',
  '*.phone_encrypted',
  '*.phone_secondary_encrypted',
  '*.cpf_hash',

  // Body inteiro de webhooks — pode conter mensagens de pacientes
  'rawBody',
  'body.entry',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
    remove: false,
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // Structured JSON em produção para ingestão em log aggregator
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

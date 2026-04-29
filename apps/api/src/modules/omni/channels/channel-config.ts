import { encrypt, decrypt } from '../../../lib/crypto.js';
import type { ChannelRow } from '../omni.types.js';

/**
 * SEC-23 — Cifra/decifra credenciais sensíveis em `omni.channels.config`.
 *
 * O JSONB `config` em si não é criptografado (precisa ser legível para
 * routing — `phoneNumberId`, `pageId`, `verifyToken` lookup), mas os
 * campos sensíveis (`accessToken`, `appSecret`, `botToken`, `signingKey`,
 * `webhookSecret`) ficam cifrados em AES-256-GCM antes de persistir.
 *
 * Padrão: campo cifrado vai com sufixo `_enc`. Ex.: `accessToken` em
 * memória vira `accessToken_enc` no banco. Ao ler do banco, decifra na
 * borda e devolve o objeto ChannelRow já em "claro" (mas só para uso
 * dentro da API — nunca enviar para clientes).
 *
 * `EncryptionService` (lib/crypto.ts) é o mesmo usado em
 * `shared.webhook_configs.webhook_secret_enc` e nos campos de paciente.
 */

const SENSITIVE_FIELDS = [
  'accessToken',
  'appSecret',
  'botToken',
  'signingKey',
  'webhookSecret',
] as const;

type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

export type ChannelConfigEncrypted = Record<string, unknown>;
export type ChannelConfigPlain     = Record<string, unknown>;

/** Cifra os campos sensíveis ANTES de gravar no banco. */
export function encryptChannelConfig(plain: ChannelConfigPlain): ChannelConfigEncrypted {
  const out: ChannelConfigEncrypted = { ...plain };
  for (const field of SENSITIVE_FIELDS) {
    const value = plain[field];
    if (typeof value === 'string' && value.length > 0) {
      out[`${field}_enc`] = encrypt(value);
      delete out[field]; // remove o plaintext
    }
  }
  return out;
}

/** Decifra os campos sensíveis ao ler do banco. */
export function decryptChannelConfig(stored: ChannelConfigEncrypted): ChannelConfigPlain {
  const out: ChannelConfigPlain = { ...stored };
  for (const field of SENSITIVE_FIELDS) {
    const encField = `${field}_enc`;
    const enc = stored[encField];
    if (typeof enc === 'string' && enc.length > 0) {
      try {
        out[field] = decrypt(enc);
      } catch {
        out[field] = null;
      }
      delete out[encField];
    }
  }
  return out;
}

/** Hidrata um ChannelRow vindo do banco. Use sempre antes de consumir os drivers. */
export function hydrateChannel(row: ChannelRow): ChannelRow {
  return {
    ...row,
    config: decryptChannelConfig(row.config ?? {}) as ChannelRow['config'],
  };
}

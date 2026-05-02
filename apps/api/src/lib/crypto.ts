import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm' as const;
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32 bytes

const CIPHER_FORMAT_RE = /^[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$/;

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-delimited base64url string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV — recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString('base64url')).join(':');
}

/**
 * Decrypts a value produced by `encrypt()`.
 * Throws if the ciphertext is malformed or the auth tag doesn't match.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Malformed ciphertext');
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const iv      = Buffer.from(ivB64,  'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const data    = Buffer.from(dataB64, 'base64url');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function encryptOptional(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return encrypt(value);
}

export function decryptOptional(ciphertext: string | null | undefined): string | null {
  if (ciphertext == null || ciphertext === '') return null;

  // Defesa: se o valor armazenado não respeita o formato `iv:authTag:ciphertext`,
  // ele é PHI plaintext que vazou pra coluna cifrada (regressão do bug 2026-05-02
  // "Nome indisponível"). Logamos warn ruidoso em vez de mascarar com null —
  // assim observabilidade pega antes do usuário final perceber.
  if (!CIPHER_FORMAT_RE.test(ciphertext)) {
    logger.warn(
      { sample: ciphertext.slice(0, 8), length: ciphertext.length },
      'decryptOptional: valor PHI fora do formato AES-GCM (provável plaintext em coluna cifrada). Rode `pnpm --filter @dermaos/api patient-phi:encrypt-legacy`.',
    );
    return null;
  }

  try {
    return decrypt(ciphertext);
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, sample: ciphertext.slice(0, 8) },
      'decryptOptional: falha ao decifrar valor PHI bem-formado (chave incorreta? auth tag inválida?).',
    );
    return null;
  }
}

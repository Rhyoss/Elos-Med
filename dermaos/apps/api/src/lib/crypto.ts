import crypto from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm' as const;
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32 bytes

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
  try {
    return decrypt(ciphertext);
  } catch {
    return null;
  }
}

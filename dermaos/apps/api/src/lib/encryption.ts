import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * EncryptionService — AES-256-GCM versionado por tenant
 *
 * Formato do ciphertext: v{N}:{iv_b64url}:{tag_b64url}:{ct_b64url}
 *   N        — versão da master key (permite rotação sem migração em batch)
 *   iv       — IV aleatório de 12 bytes (NUNCA reutilizar)
 *   tag      — auth tag GCM (16 bytes)
 *   ct       — ciphertext
 *
 * AAD obrigatório: clinic_id em UTF-8.
 *   Previne reutilização de ciphertext entre tenants — mesmo se um atacante
 *   copiar bytes de uma clínica para outra, a verificação de tag falha.
 *
 * Derivação de chave:
 *   masterKey(version) → HKDF-SHA256(info='dermaos-clinic-key-v1' + clinic_id)
 *   → 32 bytes per-tenant. Determinístico, sem estado a persistir.
 *
 * Hash determinístico (lookups):
 *   HMAC-SHA256(value_normalizado, TENANT_HMAC_SECRET) → hex lowercase.
 *   Usado em campos como cpf_hash / email_hash para busca sem descriptografar.
 */

const ALGO = 'aes-256-gcm' as const;
const IV_LEN = 12;          // 96 bits — recomendado para GCM
const KEY_LEN = 32;         // 256 bits
const HKDF_INFO_PREFIX = 'dermaos-clinic-key-v1';

class EncryptionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

function loadMasterKey(version: number): Buffer {
  // Versão atual vem de env. Versões anteriores via MASTER_KEY_V{N}.
  const candidates: Array<[string, string | undefined]> = [
    [`MASTER_KEY_V${version}`, process.env[`MASTER_KEY_V${version}`]],
  ];
  if (version === env.MASTER_KEY_VERSION) {
    candidates.push(['MASTER_ENCRYPTION_KEY', env.MASTER_ENCRYPTION_KEY]);
  }
  for (const [, value] of candidates) {
    if (value && /^[0-9a-fA-F]{64}$/.test(value)) {
      return Buffer.from(value, 'hex');
    }
  }
  throw new EncryptionError(
    'master_key_missing',
    `Chave mestra v${version} não disponível para descriptografia`,
  );
}

function deriveTenantKey(version: number, clinicId: string): Buffer {
  const masterKey = loadMasterKey(version);
  // HKDF: extract+expand. Sem salt explícito (master já é random); info é determinístico.
  const info = Buffer.from(`${HKDF_INFO_PREFIX}:${clinicId}`, 'utf8');
  const okm = crypto.hkdfSync('sha256', masterKey, Buffer.alloc(0), info, KEY_LEN);
  return Buffer.from(okm);
}

export interface EncryptOptions {
  clinicId: string;
  /** Override de versão — usado apenas em rotação/testes. Default = current. */
  version?: number;
}

/** Criptografa plaintext UTF-8 usando AES-256-GCM com AAD = clinic_id. */
export function encrypt(plaintext: string, opts: EncryptOptions): string {
  if (!opts.clinicId) {
    throw new EncryptionError('missing_clinic_id', 'clinicId é obrigatório para AAD');
  }
  const version = opts.version ?? env.MASTER_KEY_VERSION;
  const key = deriveTenantKey(version, opts.clinicId);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(opts.clinicId, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    `v${version}`,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ct.toString('base64url'),
  ].join(':');
}

interface DecryptResult {
  plaintext: string;
  /** True quando o ciphertext usa versão antiga — caller deve re-encrypt-on-read. */
  staleVersion: boolean;
  version: number;
}

/** Descriptografa. Lança EncryptionError em qualquer falha (jamais retorna null). */
export function decrypt(ciphertext: string, opts: EncryptOptions): DecryptResult {
  if (!opts.clinicId) {
    throw new EncryptionError('missing_clinic_id', 'clinicId é obrigatório para AAD');
  }
  const parts = ciphertext.split(':');
  if (parts.length !== 4 || !parts[0]?.startsWith('v')) {
    logger.warn({ clinicId: opts.clinicId }, '[encryption] decrypt_failed: malformed_ciphertext');
    throw new EncryptionError('malformed', 'Ciphertext mal formado');
  }
  const version = Number.parseInt(parts[0]!.slice(1), 10);
  if (!Number.isFinite(version) || version <= 0) {
    throw new EncryptionError('invalid_version', 'Versão de chave inválida');
  }

  let iv: Buffer; let tag: Buffer; let ct: Buffer;
  try {
    iv  = Buffer.from(parts[1]!, 'base64url');
    tag = Buffer.from(parts[2]!, 'base64url');
    ct  = Buffer.from(parts[3]!, 'base64url');
  } catch {
    throw new EncryptionError('malformed', 'Ciphertext mal formado (base64url)');
  }
  if (iv.length !== IV_LEN || tag.length !== 16) {
    throw new EncryptionError('malformed', 'IV ou tag com tamanho inválido');
  }

  const key = deriveTenantKey(version, opts.clinicId);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAAD(Buffer.from(opts.clinicId, 'utf8'));
  decipher.setAuthTag(tag);

  let plaintextBuf: Buffer;
  try {
    plaintextBuf = Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch {
    // GCM auth tag falhou — pode ser tampering ou clinic_id errado.
    logger.warn(
      { clinicId: opts.clinicId, version },
      '[encryption] decrypt_failed: auth_tag_invalid',
    );
    throw new EncryptionError('auth_failed', 'Falha de autenticação (tampering ou tenant errado)');
  }

  return {
    plaintext: plaintextBuf.toString('utf8'),
    staleVersion: version !== env.MASTER_KEY_VERSION,
    version,
  };
}

/** Helpers tolerantes a null — usados em maps de DB → DTO. */
export function encryptOptional(value: string | null | undefined, opts: EncryptOptions): string | null {
  if (value == null || value === '') return null;
  return encrypt(value, opts);
}

export function decryptOptional(ciphertext: string | null | undefined, opts: EncryptOptions): string | null {
  if (ciphertext == null || ciphertext === '') return null;
  try {
    return decrypt(ciphertext, opts).plaintext;
  } catch (err) {
    logger.error(
      { err, clinicId: opts.clinicId },
      '[encryption] decrypt_optional_failed',
    );
    return null;
  }
}

/** Re-encrypt-on-read: se versão divergente, devolve novo ciphertext na versão atual. */
export function reEncryptIfStale(ciphertext: string, opts: EncryptOptions): string | null {
  const result = decrypt(ciphertext, opts);
  if (!result.staleVersion) return null;
  return encrypt(result.plaintext, opts);
}

// ─── Hashing determinístico (lookups) ─────────────────────────────────────────

function normalizeForHash(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

/**
 * HMAC-SHA256(value_normalizado, TENANT_HMAC_SECRET) → hex lowercase.
 * Uso típico: cpf_hash, email_hash. Determinístico para que WHERE … = HMAC(input) funcione.
 * O segredo nunca sai do servidor — sem ele, ataques rainbow table com dump do banco
 * não conseguem reverter o hash.
 */
export function deterministicHash(value: string): string {
  return crypto
    .createHmac('sha256', env.TENANT_HMAC_SECRET)
    .update(normalizeForHash(value))
    .digest('hex');
}

/** Hash de IP para shared.users.known_ip_hashes (sem expor IP em texto puro). */
export function hashIp(ip: string): string {
  return deterministicHash(`ip:${ip}`);
}

export { EncryptionError };

import crypto from 'node:crypto';

/**
 * Worker-side decrypt — espelha o EncryptionService da API para evitar
 * acoplamento de runtime. Mesmo formato:
 *
 *   v{N}:{iv_b64url}:{tag_b64url}:{ct_b64url}
 *
 * Lê master keys de:
 *   MASTER_ENCRYPTION_KEY      (versão atual, default v1)
 *   MASTER_KEY_V{N}            (versões anteriores)
 *
 * AAD = clinic_id (UTF-8). HKDF-SHA256(info='dermaos-clinic-key-v1:<clinic>').
 */

const ALGO = 'aes-256-gcm' as const;
const IV_LEN = 12;
const KEY_LEN = 32;
const HKDF_INFO_PREFIX = 'dermaos-clinic-key-v1';

function loadMasterKey(version: number): Buffer {
  const candidates: Array<string | undefined> = [process.env[`MASTER_KEY_V${version}`]];
  const currentVersion = Number(process.env['MASTER_KEY_VERSION'] ?? 1);
  if (version === currentVersion) candidates.push(process.env['MASTER_ENCRYPTION_KEY']);
  for (const value of candidates) {
    if (value && /^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, 'hex');
  }
  throw new Error(`[worker:encryption] master key v${version} indisponível`);
}

function deriveTenantKey(version: number, clinicId: string): Buffer {
  const masterKey = loadMasterKey(version);
  const info = Buffer.from(`${HKDF_INFO_PREFIX}:${clinicId}`, 'utf8');
  const okm = crypto.hkdfSync('sha256', masterKey, Buffer.alloc(0), info, KEY_LEN);
  return Buffer.from(okm);
}

export function decryptOptional(
  ciphertext: string | null | undefined,
  clinicId: string,
): string | null {
  if (!ciphertext || !clinicId) return null;
  const parts = ciphertext.split(':');
  if (parts.length !== 4 || !parts[0]?.startsWith('v')) return null;
  const version = Number.parseInt(parts[0]!.slice(1), 10);
  if (!Number.isFinite(version) || version <= 0) return null;
  try {
    const iv  = Buffer.from(parts[1]!, 'base64url');
    const tag = Buffer.from(parts[2]!, 'base64url');
    const ct  = Buffer.from(parts[3]!, 'base64url');
    if (iv.length !== IV_LEN || tag.length !== 16) return null;
    const key = deriveTenantKey(version, clinicId);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAAD(Buffer.from(clinicId, 'utf8'));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Fila local de consumos offline.
 * Persistência em localStorage com criptografia leve via Web Crypto (AES-GCM)
 * usando uma chave derivada do usuário autenticado (stored em sessionStorage).
 *
 * Esta camada NÃO substitui a encriptação do backend — é defesa em profundidade
 * contra acesso físico ao dispositivo entre sessões.
 */

import type { ConsumeKitInput } from '@dermaos/shared';

const STORAGE_KEY = 'dermaos.offline.consumptions';
const KEY_STORAGE = 'dermaos.offline.key';

interface StoredConsumption {
  id:           string;   // local id
  idempotencyKey: string;
  payload:      ConsumeKitInput;
  createdAt:    string;
  attempts:     number;
  lastError?:   string;
}

/* ── Crypto helpers (AES-GCM with device-scoped key) ───────────────────── */

async function getOrCreateKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined') throw new Error('offline-queue: browser only');
  const raw = sessionStorage.getItem(KEY_STORAGE);
  if (raw) {
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exported = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  sessionStorage.setItem(KEY_STORAGE, btoa(String.fromCharCode(...exported)));
  return key;
}

async function encryptString(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const ct  = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0); out.set(ct, iv.length);
  return btoa(String.fromCharCode(...out));
}

async function decryptString(ciphertext: string): Promise<string> {
  const key = await getOrCreateKey();
  const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

/* ── Queue API ─────────────────────────────────────────────────────────── */

async function readQueue(): Promise<StoredConsumption[]> {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const decrypted = await decryptString(raw);
    return JSON.parse(decrypted) as StoredConsumption[];
  } catch {
    // Chave mudou (novo login) ou dado corrompido → descarta
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

async function writeQueue(q: StoredConsumption[]): Promise<void> {
  if (typeof window === 'undefined') return;
  if (q.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const enc = await encryptString(JSON.stringify(q));
  localStorage.setItem(STORAGE_KEY, enc);
}

export async function listPending(): Promise<StoredConsumption[]> {
  return readQueue();
}

export async function enqueue(payload: ConsumeKitInput): Promise<StoredConsumption> {
  const q = await readQueue();
  const entry: StoredConsumption = {
    id:             crypto.randomUUID(),
    idempotencyKey: payload.idempotencyKey,
    payload,
    createdAt:      new Date().toISOString(),
    attempts:       0,
  };
  // Dedup por idempotencyKey
  const existing = q.findIndex((e) => e.idempotencyKey === payload.idempotencyKey);
  if (existing >= 0) {
    q[existing] = entry;
  } else {
    q.push(entry);
  }
  await writeQueue(q);
  return entry;
}

export async function remove(id: string): Promise<void> {
  const q = await readQueue();
  await writeQueue(q.filter((e) => e.id !== id));
}

export async function markAttempt(id: string, error?: string): Promise<void> {
  const q = await readQueue();
  const e = q.find((x) => x.id === id);
  if (!e) return;
  e.attempts += 1;
  e.lastError = error;
  await writeQueue(q);
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function onConnectivityChange(cb: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const on  = () => cb(true);
  const off = () => cb(false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  return () => {
    window.removeEventListener('online', on);
    window.removeEventListener('offline', off);
  };
}

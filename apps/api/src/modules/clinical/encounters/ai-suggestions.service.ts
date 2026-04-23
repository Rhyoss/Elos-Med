import crypto from 'node:crypto';
import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import { redis } from '../../../db/redis.js';
import { searchCid10 } from './encounters.service.js';
import type { AiCidSuggestion } from '@dermaos/shared';

/* ── Config ──────────────────────────────────────────────────────────────── */

const OLLAMA_MODEL = process.env['OLLAMA_MEDICAL_MODEL'] ?? 'llama3.1';
const OLLAMA_TIMEOUT_MS = 10_000;
const CID_CACHE_TTL_SECONDS = 1_800; // 30 minutos
const SOAP_CACHE_TTL_SECONDS = 600;  //  10 minutos

/* ── Ollama client ───────────────────────────────────────────────────────── */

interface OllamaGenerateResponse {
  response: string;
  done:     boolean;
}

async function callOllama(prompt: string, options: { format?: 'json'; temperature?: number } = {}): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:  OLLAMA_MODEL,
        prompt,
        stream: false,
        format: options.format,
        options: {
          temperature: options.temperature ?? 0.2,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'Ollama responded with non-200');
      return null;
    }

    const data = (await res.json()) as OllamaGenerateResponse;
    return data.response ?? null;
  } catch (err) {
    logger.warn({ err }, 'Ollama call failed — returning empty suggestions');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ── Cache helpers ───────────────────────────────────────────────────────── */

function hashCacheKey(prefix: string, payload: string): string {
  const hash = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 24);
  return `${prefix}:${hash}`;
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.debug({ err }, 'Cache get failed');
    return null;
  }
}

async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    logger.debug({ err }, 'Cache set failed');
  }
}

/* ── JSON parser tolerante ───────────────────────────────────────────────── */

function extractJsonArray(raw: string): unknown[] | null {
  // Tenta parse direto primeiro
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fallthrough */
  }
  // Tenta extrair primeiro array JSON no texto
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/* ── CID suggestions ─────────────────────────────────────────────────────── */

/**
 * Sugere até 3 CIDs com base em texto clínico via Ollama.
 * Valida cada código contra a tabela clinical.cid10_codes para evitar
 * alucinação (modelo pode inventar códigos que não existem).
 */
export async function suggestCIDs(soapText: string): Promise<AiCidSuggestion[]> {
  const trimmed = soapText.trim();
  if (trimmed.length < 10) return [];

  const cacheKey = hashCacheKey('ai:cid', trimmed);
  const cached   = await cacheGet<AiCidSuggestion[]>(cacheKey);
  if (cached) return cached;

  const prompt = [
    'Você é um assistente médico especialista em dermatologia.',
    'Com base no texto clínico abaixo, sugira os 3 códigos CID-10 mais prováveis.',
    'Responda APENAS com um array JSON no formato:',
    '[{"cid": "L70.0", "description": "Acne vulgar", "confidence": 0.82}]',
    'Regras:',
    '- Use apenas códigos CID-10 brasileiros reais',
    '- confidence é um número entre 0 e 1',
    '- Não escreva nada além do JSON',
    '',
    'Texto clínico:',
    trimmed.slice(0, 12_000),
  ].join('\n');

  const raw = await callOllama(prompt, { format: 'json', temperature: 0.1 });
  if (!raw) return [];

  const parsed = extractJsonArray(raw);
  if (!parsed) {
    logger.warn({ raw: raw.slice(0, 200) }, 'CID suggestions: failed to parse Ollama output');
    return [];
  }

  const candidates: AiCidSuggestion[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const code = typeof record['cid'] === 'string' ? (record['cid'] as string).trim().toUpperCase() : null;
    if (!code) continue;
    const desc = typeof record['description'] === 'string' ? (record['description'] as string) : '';
    const rawConf = record['confidence'];
    let confidence = typeof rawConf === 'number' ? rawConf : parseFloat(String(rawConf ?? '0'));
    if (!Number.isFinite(confidence)) confidence = 0;
    confidence = Math.max(0, Math.min(1, confidence));
    candidates.push({ cid: code, description: desc, confidence });
    if (candidates.length >= 3) break;
  }

  // Valida cada código contra o catálogo — descarta alucinações
  const validated: AiCidSuggestion[] = [];
  for (const c of candidates) {
    const matches = await searchCid10(c.cid, 1);
    if (matches.length > 0 && matches[0]!.code.toUpperCase() === c.cid) {
      validated.push({
        cid:         matches[0]!.code,
        description: matches[0]!.description,
        confidence:  c.confidence,
      });
    }
  }

  await cacheSet(cacheKey, validated, CID_CACHE_TTL_SECONDS);
  return validated;
}

/* ── SOAP suggestion ─────────────────────────────────────────────────────── */

export interface SoapDraft {
  subjective: string;
  objective:  string;
  assessment: string;
  plan:       string;
  aiGenerated: true;
  model:       string;
}

export async function suggestSOAP(
  chiefComplaint: string,
  patientHistory?: string,
): Promise<SoapDraft | null> {
  const cc = chiefComplaint.trim();
  if (cc.length < 2) return null;

  const cacheKey = hashCacheKey('ai:soap', `${cc}||${patientHistory ?? ''}`);
  const cached   = await cacheGet<SoapDraft>(cacheKey);
  if (cached) return cached;

  const prompt = [
    'Você é um dermatologista assistente elaborando um rascunho de SOAP.',
    'IMPORTANTE: este é apenas um RASCUNHO SUGERIDO. O médico responsável fará a revisão completa.',
    'Seja cauteloso: não invente achados que não constam nas informações.',
    'Se faltar informação, use frases como "a confirmar no exame" ou "aguardar dados adicionais".',
    '',
    'Responda APENAS com um objeto JSON no formato:',
    '{',
    '  "subjective": "...",',
    '  "objective": "...",',
    '  "assessment": "...",',
    '  "plan": "..."',
    '}',
    '',
    `Queixa principal: ${cc}`,
    patientHistory ? `Histórico relevante: ${patientHistory.slice(0, 4_000)}` : '',
  ].join('\n');

  const raw = await callOllama(prompt, { format: 'json', temperature: 0.3 });
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const r = parsed as Record<string, unknown>;

  const draft: SoapDraft = {
    subjective:  typeof r['subjective'] === 'string' ? (r['subjective'] as string) : '',
    objective:   typeof r['objective']  === 'string' ? (r['objective']  as string) : '',
    assessment:  typeof r['assessment'] === 'string' ? (r['assessment'] as string) : '',
    plan:        typeof r['plan']       === 'string' ? (r['plan']       as string) : '',
    aiGenerated: true,
    model:       OLLAMA_MODEL,
  };

  await cacheSet(cacheKey, draft, SOAP_CACHE_TTL_SECONDS);
  return draft;
}

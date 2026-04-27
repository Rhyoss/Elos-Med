/**
 * Fallback chain de reasoners — Anexo A §A.3.3.
 *
 * Ordem:
 *   1. Anthropic (tool-use completo) — breaker `anthropic`.
 *   2. Ollama    (fallback text-only) — breaker `ollama`.
 *   3. `null`    — o `AuroraService` cai em B.3.7 + transferência humana.
 *
 * Este módulo expõe apenas a função `buildAuroraReasoner(...)` — uma fábrica
 * que devolve a `AuroraReasonFn` já costurada com a cadeia de fallback e
 * pronta para ser passada em `AuroraService.handleMessage({ reason })`.
 */

import { getBreakerState } from '../../../lib/circuit-breaker.js';
import { logger } from '../../../lib/logger.js';
import {
  ANTHROPIC_BREAKER_NAME,
  buildAnthropicReasoner,
  type AnthropicReasonerOptions,
} from './anthropic-reasoner.js';
import {
  buildOllamaReasoner,
  type OllamaReasonerOptions,
} from './ollama-reasoner.js';
import type {
  AuroraReasonFn,
  AuroraReasonInput,
  AuroraReasonOutput,
} from '../aurora.service.js';

export interface ReasonerChainOptions {
  anthropic: AnthropicReasonerOptions;
  ollama:    OllamaReasonerOptions;
}

export function buildAuroraReasoner(options: ReasonerChainOptions): AuroraReasonFn {
  const anthropic = buildAnthropicReasoner(options.anthropic);
  const ollama    = buildOllamaReasoner(options.ollama);

  return async function reason(input: AuroraReasonInput): Promise<AuroraReasonOutput | null> {
    // 1. Anthropic — pulamos direto para Ollama se breaker já aberto.
    const anthropicState = getBreakerState(ANTHROPIC_BREAKER_NAME);
    if (anthropicState !== 'open') {
      try {
        const out = await anthropic(input);
        if (out) return out;
        logger.debug('anthropic reasoner returned null — falling to ollama');
      } catch (err) {
        logger.warn({ err }, 'anthropic reasoner threw — falling to ollama');
      }
    } else {
      logger.info({ breaker: 'anthropic', state: 'open' }, 'skipping anthropic — breaker open');
    }

    // 2. Ollama — idem.
    try {
      const out = await ollama(input);
      if (out) return out;
    } catch (err) {
      logger.warn({ err }, 'ollama reasoner threw — final fallback');
    }

    // 3. null → AuroraService cai em B.3.7 + transferência.
    return null;
  };
}

export { buildAnthropicReasoner, ANTHROPIC_BREAKER_NAME } from './anthropic-reasoner.js';
export { buildOllamaReasoner, OLLAMA_BREAKER_NAME } from './ollama-reasoner.js';
export {
  consumeAuroraToken,
  AURORA_RATE_LIMIT_PER_MINUTE,
  type RateLimitResult,
} from './rate-limit.js';
export {
  readContextCache,
  writeContextCache,
  invalidateContextCache,
  AURORA_CONTEXT_TTL_SECONDS,
  AURORA_CONTEXT_LIMIT,
  type CachedMessage,
} from './context-cache.js';

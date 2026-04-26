import CircuitBreaker from 'opossum';
import { logger } from './logger.js';

/**
 * Circuit breaker wrapper — Anexo A §A.3
 *
 * Config padrão (obrigatória para toda chamada externa: Anthropic/Ollama/Meta):
 *   errorThresholdPercentage: 50
 *   resetTimeout:             30000 ms
 *   volumeThreshold:          10
 *   timeout:                  12000 ms
 *
 * Estados expostos via `getBreakerState(name)`:
 *   'closed' | 'half-open' | 'open'
 *
 * Em estado `open` o chamador deve degradar graciosamente:
 *   Anthropic  → Ollama
 *   Ollama     → mensagem B.3.7 + transferência humana
 *   Meta Graph → enfileirar com backoff exponencial
 */

export type BreakerState = 'closed' | 'half-open' | 'open';

export interface BreakerDefaults {
  errorThresholdPercentage: number;
  resetTimeout:             number;
  volumeThreshold:          number;
  timeout:                  number;
}

export const DEFAULT_BREAKER_OPTIONS: BreakerDefaults = {
  errorThresholdPercentage: 50,
  resetTimeout:             30_000,
  volumeThreshold:          10,
  timeout:                  12_000,
};

export type BreakerOptions = Partial<BreakerDefaults> & {
  /** Nome lógico (usado em métricas e logs). Obrigatório e único. */
  name: string;
};

type AsyncFn<Args extends unknown[], R> = (...args: Args) => Promise<R>;

interface BreakerEntry {
  breaker: CircuitBreaker<unknown[], unknown>;
  name:    string;
}

const breakers = new Map<string, BreakerEntry>();

function attachLifecycle(name: string, b: CircuitBreaker<unknown[], unknown>): void {
  b.on('open',     () => logger.warn({ breaker: name, state: 'open' },      'Circuit breaker opened'));
  b.on('halfOpen', () => logger.info({ breaker: name, state: 'half-open' }, 'Circuit breaker half-open'));
  b.on('close',    () => logger.info({ breaker: name, state: 'closed' },    'Circuit breaker closed'));
  b.on('timeout',  () => logger.warn({ breaker: name },                     'Circuit breaker timeout'));
  b.on('reject',   () => logger.debug({ breaker: name },                    'Circuit breaker rejected (open)'));
  b.on('fallback', () => logger.debug({ breaker: name },                    'Circuit breaker fallback invoked'));
}

/**
 * Cria (ou retorna existente) um circuit breaker nomeado em torno de `fn`.
 * A mesma instância é reaproveitada para o mesmo `name` — importante para que
 * chamadas distribuídas pelo código compartilhem o mesmo estado de saúde.
 */
export function createBreaker<Args extends unknown[], R>(
  fn:      AsyncFn<Args, R>,
  options: BreakerOptions,
): CircuitBreaker<Args, R> {
  const existing = breakers.get(options.name);
  if (existing) {
    return existing.breaker as unknown as CircuitBreaker<Args, R>;
  }

  const { name, ...overrides } = options;
  const breaker = new CircuitBreaker<Args, R>(fn, {
    ...DEFAULT_BREAKER_OPTIONS,
    ...overrides,
    name,
  });

  attachLifecycle(name, breaker as unknown as CircuitBreaker<unknown[], unknown>);
  breakers.set(name, {
    breaker: breaker as unknown as CircuitBreaker<unknown[], unknown>,
    name,
  });
  return breaker;
}

/**
 * Executa `fn` protegida por um breaker nomeado. Se o breaker estiver `open`,
 * a chamada falha imediatamente com `Error('Breaker is open')` (mensagem do
 * opossum). O chamador decide o fallback.
 */
export function runWithBreaker<Args extends unknown[], R>(
  fn:      AsyncFn<Args, R>,
  options: BreakerOptions,
  ...args: Args
): Promise<R> {
  return createBreaker(fn, options).fire(...args) as Promise<R>;
}

/** Retorna o estado textual atual do breaker nomeado, ou 'closed' se inexistente. */
export function getBreakerState(name: string): BreakerState {
  const entry = breakers.get(name);
  if (!entry) return 'closed';
  const b = entry.breaker;
  if (b.opened)   return 'open';
  if (b.halfOpen) return 'half-open';
  return 'closed';
}

export interface BreakerSnapshot {
  name:    string;
  state:   BreakerState;
  stats:   CircuitBreaker.Stats;
}

/** Exporta estado + estatísticas de todos os breakers registrados. */
export function listBreakers(): BreakerSnapshot[] {
  return Array.from(breakers.values()).map(({ name, breaker }) => ({
    name,
    state: getBreakerState(name),
    stats: breaker.stats,
  }));
}

/** Limpa todos os breakers registrados. Usado apenas em testes. */
export function __resetBreakersForTests(): void {
  for (const { breaker } of breakers.values()) {
    breaker.shutdown();
  }
  breakers.clear();
}

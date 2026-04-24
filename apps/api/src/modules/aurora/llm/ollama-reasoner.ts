/**
 * Reasoner Ollama — fallback local quando Anthropic está indisponível
 * (breaker `anthropic` em `open`) — Anexo A §A.3.3 e §A.4.2 passo 8e.
 *
 * Ollama local NÃO suporta o tool-use do Anthropic SDK. Aqui tomamos uma
 * postura defensiva: o fallback é TEXT-ONLY, sem tool-use, e a Aurora fica
 * restrita a recusar/oferecer transferência via B.3.x. Se o modelo local
 * tentar chamar tools, ignoramos — o texto bruto retorna ao service, que
 * roda os guardrails de saída normalmente.
 *
 * Em caso de falha total (timeout, 500, breaker `ollama` open), devolvemos
 * `null`. O caller (`llm/index.ts`) então retorna `null` ao `AuroraService`,
 * que cai no fallback B.3.7 + transferência humana.
 */

import { runWithBreaker } from '../../../lib/circuit-breaker.js';
import { logger } from '../../../lib/logger.js';
import type {
  AuroraReasonFn,
  AuroraReasonInput,
  AuroraReasonOutput,
} from '../aurora.service.js';

export const OLLAMA_BREAKER_NAME = 'ollama';
export const OLLAMA_MODEL = 'llama3';
export const OLLAMA_TIMEOUT_MS = 12_000;

export interface OllamaReasonerOptions {
  baseUrl:    string;
  model?:     string;
  /** fetch injetável (útil em testes). */
  fetchImpl?: typeof fetch;
}

interface OllamaChatResponse {
  message?: { role: string; content: string };
  done?: boolean;
  eval_count?: number;       // tokens de saída
  prompt_eval_count?: number; // tokens de entrada
}

export function buildOllamaReasoner(options: OllamaReasonerOptions): AuroraReasonFn {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const model = options.model ?? OLLAMA_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;

  return async function reason(input: AuroraReasonInput): Promise<AuroraReasonOutput | null> {
    // Constrói mensagens — Ollama aceita role='system'|'user'|'assistant'.
    const messages = [
      {
        role: 'system',
        content:
          `Você é Aurora, assistente da clínica ${input.auroraVars['clinic.name'] ?? ''}. ` +
          'Você NUNCA diagnostica, prescreve ou promete resultados. Em dúvida, ' +
          'ofereça transferência para a equipe humana. Use português do Brasil, ' +
          'tom acolhedor, frases curtas. Não cite nomes de remédios, dosagens, ' +
          'não prometa cura ou prazos. Apenas auxilie com agendamento, horários, ' +
          'endereço e serviços. Esta é uma resposta de FALLBACK — seja breve.',
      },
      ...input.redactedHistory.map((m) => ({
        role:    m.role === 'system' ? 'user' : m.role,
        content: m.role === 'system' ? `[SISTEMA] ${m.content}` : m.content,
      })),
    ];

    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || last.content !== input.redactedNewMessage) {
      messages.push({ role: 'user', content: input.redactedNewMessage });
    }

    try {
      const result = await runWithBreaker(
        async (args: { url: string; model: string; messages: Array<{ role: string; content: string }> }) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
          try {
            const res = await fetchImpl(`${args.url}/api/chat`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                model:    args.model,
                messages: args.messages,
                stream:   false,
              }),
              signal: controller.signal,
            });
            if (!res.ok) {
              throw new Error(`ollama_http_${res.status}`);
            }
            return (await res.json()) as OllamaChatResponse;
          } finally {
            clearTimeout(timeout);
          }
        },
        { name: OLLAMA_BREAKER_NAME, timeout: OLLAMA_TIMEOUT_MS + 1_000 },
        { url: baseUrl, model, messages },
      );

      const text = result.message?.content?.trim();
      if (!text) {
        logger.warn({ model }, 'ollama reasoner: empty response');
        return null;
      }

      return {
        text,
        breakerState: 'closed',
        model:        `ollama:${model}`,
        ...(result.prompt_eval_count !== undefined ? { tokensIn:  result.prompt_eval_count } : {}),
        ...(result.eval_count        !== undefined ? { tokensOut: result.eval_count        } : {}),
      };
    } catch (err) {
      logger.warn({ err, model }, 'ollama reasoner failed');
      return null;
    }
  };
}

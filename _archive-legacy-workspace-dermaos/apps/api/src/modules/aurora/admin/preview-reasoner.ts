/**
 * Reasoner descartável para o preview do painel (§3.2).
 *
 * Motivação: o botão "Testar" do editor de agente roda uma simulação curta.
 * Rodar isso contra Anthropic gastaria quota a cada tentativa de ajuste de
 * prompt — o que é frequente. Aqui chamamos Ollama local (ou o serviço que
 * `OLLAMA_BASE_URL` apontar) e ignoramos o modelo configurado no agente:
 * o preview é apenas uma aproximação do tom/estilo.
 *
 * Retorna o texto bruto ou `null` se o modelo local falhar. O service trata
 * o null devolvendo uma mensagem amigável no lugar do preview.
 */

import { logger } from '../../../lib/logger.js';

const OLLAMA_BASE_URL = process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env['OLLAMA_PREVIEW_MODEL'] ?? 'llama3';
const TIMEOUT_MS = 15_000;

interface OllamaChatResponse {
  message?: { role: string; content: string };
  done?:    boolean;
}

export async function runPreviewReasoner(args: {
  systemPrompt: string;
  model:        string;
  temperature:  number;
  maxTokens:    number;
  messages:     Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_BASE_URL.replace(/\/+$/, '')}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:  OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: args.systemPrompt },
          ...args.messages,
        ],
        options: {
          temperature: args.temperature,
          num_predict: args.maxTokens,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'preview-reasoner: ollama http error');
      return null;
    }

    const json = (await res.json()) as OllamaChatResponse;
    const text = json.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    logger.warn({ err }, 'preview-reasoner: ollama request failed');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

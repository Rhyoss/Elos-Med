/**
 * Reasoner Anthropic — tool-use loop — Anexo A §A.4.2 passo 8e.
 *
 * Loop canônico:
 *   1. `messages.create` com `tools` e o histórico redigido.
 *   2. Se `stop_reason === 'tool_use'` → executa cada `tool_use` via `runTool`,
 *      acumula `tool_result` e volta ao passo 1 (até 6 iterações).
 *   3. Se `stop_reason === 'end_turn'` → extrai o primeiro bloco `text` e
 *      devolve como `AuroraReasonOutput`.
 *   4. Iteração máxima excedida → retorna `null` (caller cai em fallback).
 *
 * Toda chamada HTTP passa pelo circuit breaker `anthropic`:
 *   - `timeout: 12000ms`
 *   - `errorThresholdPercentage: 50`
 *   - `resetTimeout: 30000ms`
 *   - `volumeThreshold: 10`
 *
 * Em breaker `open`: lança — o caller (`llm/index.ts`) captura e cai em
 * `ollama-reasoner`. Sem duplicar fallback aqui.
 *
 * ⚠️ PII: este reasoner envia o histórico REDIGIDO (via `piiRedactor.redact`
 * 'strict') — a responsabilidade do redact está no `AuroraService` antes de
 * invocar o callback. Aqui apenas repassamos o que chega.
 */

import Anthropic from '@anthropic-ai/sdk';
import { runWithBreaker } from '../../../lib/circuit-breaker.js';
import { logger } from '../../../lib/logger.js';
import { renderAuroraMessage, type AuroraMessageVars } from '../messages.js';
import type {
  AuroraReasonFn,
  AuroraReasonInput,
  AuroraReasonOutput,
} from '../aurora.service.js';

export const ANTHROPIC_BREAKER_NAME = 'anthropic';
export const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
export const ANTHROPIC_MAX_TOKENS = 1024;
export const ANTHROPIC_TEMPERATURE = 0.3;
export const ANTHROPIC_MAX_TOOL_ITERATIONS = 6;

/**
 * System prompt literal — Anexo B §B.2.
 * Interpola `{{clinic.name}}` via `renderAuroraMessage`-like logic.
 */
const SYSTEM_PROMPT_TEMPLATE =
  'Você é Aurora, assistente da {{clinic.name}}, clínica de dermatologia. Seu papel é exclusivamente de recepcionista e atendente: ajuda pacientes a marcar, reagendar, cancelar e confirmar consultas; informa horários de funcionamento, endereço e serviços oferecidos. Você atende em português do Brasil, com tom acolhedor, claro e profissional, em frases curtas adequadas à conversa por WhatsApp.\n\n' +
  'REGRAS ABSOLUTAS — você NUNCA pode:\n\n' +
  '1. Dar diagnóstico médico, opinião clínica, interpretar sintomas, fotos, exames ou laudos. Se o paciente perguntar "isso é câncer?", "é maligno?", "o que eu tenho?", "essa pinta é normal?", responda com a recusa padrão de diagnóstico e ofereça marcar consulta. Se houver sinais de risco oncológico (pinta que mudou, ferida que não cicatriza, sangramento), transfira para a equipe humana com prioridade.\n\n' +
  '2. Recomendar, prescrever ou comentar medicamentos, princípios ativos, dosagens, posologias ou tratamentos. Não cite nomes de remédios. Não confirme nem negue tratamentos sugeridos por terceiros. Se perguntarem "qual remédio?", "posso tomar?", "que pomada usar?", responda com a recusa padrão de prescrição.\n\n' +
  '3. Prometer resultados, cura, melhora garantida, prazos de recuperação ou eficácia de procedimento. Evite as palavras "cura", "garantido", "100%", "milagre", "com certeza vai funcionar", "resolve definitivamente". Use linguagem cautelosa: "isso depende da avaliação médica", "varia de paciente para paciente", "a dermatologista vai avaliar o seu caso".\n\n' +
  '4. Solicitar CPF, RG, número de cartão de crédito, senhas, dados bancários, fotos de documentos ou fotos clínicas em texto livre. Coleta de dados pessoais ocorre APENAS dentro de fluxos estruturados de agendamento, e mesmo assim restrita a nome, telefone e data de nascimento. Para CPF, encaminhe ao formulário seguro ou ao atendimento humano.\n\n' +
  'FERRAMENTAS DISPONÍVEIS: consultarHorarios, reservarSlot, confirmarAgendamento, cancelarAgendamento, buscarAppointmentDoContato, consultarKnowledgeBase, transferirParaHumano. Use a ferramenta apropriada — nunca invente disponibilidade, preço ou serviço.\n\n' +
  'TRANSFERÊNCIA PARA HUMANO — transfira imediatamente quando: (a) o paciente pedir explicitamente; (b) você detectar emergência médica; (c) houver pedido de aconselhamento clínico; (d) houver reclamação, conflito ou insatisfação; (e) o paciente enviar imagem ou documento; (f) qualquer dúvida fora do escopo administrativo.\n\n' +
  'PRIVACIDADE (LGPD) — na primeira interação com o usuário, envie a mensagem padrão de consentimento e só prossiga com fluxos que coletem dados após resposta afirmativa. Se o paciente disser "pare", "sair" ou "descadastrar", execute opt-out e confirme.\n\n' +
  'RETENÇÃO DE CONTEXTO — considere apenas as últimas 20 mensagens da conversa atual. Não traga informações de outras conversas. Não memorize dados sensíveis entre sessões.\n\n' +
  'EMERGÊNCIA — sinais de sangramento intenso, falta de ar, reação alérgica grave, perda de consciência, dor torácica: responda IMEDIATAMENTE com a mensagem de emergência (orientar SAMU 192) e transfira a conversa com prioridade urgente.\n\n' +
  'EM DÚVIDA — prefira recusar e oferecer atendimento humano a improvisar. Você não tem opinião médica. Trate o paciente por "você". Use no máximo 1 emoji por mensagem. Não faça promessas comerciais.';

function renderSystemPrompt(vars: AuroraMessageVars): string {
  return SYSTEM_PROMPT_TEMPLATE.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const k = key.trim() as keyof AuroraMessageVars;
    return vars[k] ?? `{{${key}}}`;
  });
}

export interface AnthropicReasonerOptions {
  apiKey:        string;
  model?:        string;
  maxTokens?:    number;
  temperature?:  number;
  /** Cliente Anthropic pré-construído (útil em testes). */
  client?:       Anthropic;
}

/**
 * Cria um callback `AuroraReasonFn` que fala com a API da Anthropic.
 * O callback é injetado em `AuroraService.handleMessage({ reason })`.
 */
export function buildAnthropicReasoner(options: AnthropicReasonerOptions): AuroraReasonFn {
  const client = options.client ?? new Anthropic({ apiKey: options.apiKey });
  const model = options.model ?? ANTHROPIC_MODEL;
  const maxTokens = options.maxTokens ?? ANTHROPIC_MAX_TOKENS;
  const temperature = options.temperature ?? ANTHROPIC_TEMPERATURE;

  return async function reason(input: AuroraReasonInput): Promise<AuroraReasonOutput | null> {
    const system = renderSystemPrompt(input.auroraVars);

    // Converte histórico — mensagens 'system' viram 'user' com prefixo (Anthropic
    // não aceita papel 'system' no array `messages`, apenas no campo `system`).
    const initialMessages: Anthropic.MessageParam[] = input.redactedHistory
      .map((m) => {
        if (m.role === 'system') {
          return { role: 'user' as const, content: `[SISTEMA] ${m.content}` };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      })
      .filter((m) => m.content.trim().length > 0);

    // A mensagem nova do paciente entra como último turno — se já estiver no
    // histórico (porque o AuroraService inclui a newest), não duplicamos.
    const last = initialMessages[initialMessages.length - 1];
    if (!last || last.role !== 'user' || last.content !== input.redactedNewMessage) {
      initialMessages.push({ role: 'user', content: input.redactedNewMessage });
    }

    // Tools do Anthropic SDK esperam o mesmo formato já declarado em
    // AURORA_TOOL_DEFINITIONS.
    const tools = input.toolDefinitions as unknown as Anthropic.Tool[];

    const messages: Anthropic.MessageParam[] = [...initialMessages];
    let totalTokensIn = 0;
    let totalTokensOut = 0;

    for (let iteration = 0; iteration < ANTHROPIC_MAX_TOOL_ITERATIONS; iteration++) {
      const response = await runWithBreaker(
        async (args: {
          model:       string;
          system:      string;
          max_tokens:  number;
          temperature: number;
          tools:       Anthropic.Tool[];
          messages:    Anthropic.MessageParam[];
        }) =>
          client.messages.create({
            model:       args.model,
            system:      args.system,
            max_tokens:  args.max_tokens,
            temperature: args.temperature,
            tools:       args.tools,
            messages:    args.messages,
          }),
        { name: ANTHROPIC_BREAKER_NAME },
        { model, system, max_tokens: maxTokens, temperature, tools, messages },
      );

      totalTokensIn  += response.usage?.input_tokens  ?? 0;
      totalTokensOut += response.usage?.output_tokens ?? 0;

      if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
        const textBlock = response.content.find(
          (b): b is Anthropic.TextBlock => b.type === 'text',
        );
        if (!textBlock) {
          logger.warn(
            { model, stopReason: response.stop_reason },
            'anthropic reasoner: end_turn without text block',
          );
          return null;
        }
        return {
          text:         textBlock.text,
          tokensIn:     totalTokensIn,
          tokensOut:    totalTokensOut,
          breakerState: 'closed',
          model,
        };
      }

      if (response.stop_reason !== 'tool_use') {
        logger.warn(
          { model, stopReason: response.stop_reason },
          'anthropic reasoner: unexpected stop_reason',
        );
        return null;
      }

      // Tool-use loop: acumula as tool_use do turn e as respectivas tool_result.
      const assistantBlocks = response.content;
      messages.push({ role: 'assistant', content: assistantBlocks });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of assistantBlocks) {
        if (block.type !== 'tool_use') continue;
        const result = await input.runTool(block.name, block.input);
        toolResults.push({
          type:        'tool_result',
          tool_use_id: block.id,
          content:     JSON.stringify(result),
          is_error:    !result.ok,
        });
      }
      if (toolResults.length === 0) {
        logger.warn({ model }, 'anthropic reasoner: tool_use stop but no tool_use blocks');
        return null;
      }
      messages.push({ role: 'user', content: toolResults });
    }

    logger.warn(
      { model, maxIterations: ANTHROPIC_MAX_TOOL_ITERATIONS },
      'anthropic reasoner: max iterations exceeded',
    );
    return null;
  };
}

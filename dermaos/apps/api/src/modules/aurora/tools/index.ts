/**
 * Registro de tools da Aurora — Anexo A §A.4.2.8e.
 *
 * Cada entrada aqui é consumida por dois pontos do pipeline:
 *   1. `aurora.service.ts` transforma `AURORA_TOOL_DEFINITIONS` em
 *      `Anthropic.Tool[]` na chamada `messages.create`.
 *   2. Quando o LLM devolve `tool_use` com um `name`, o service procura
 *      `AURORA_TOOL_HANDLERS[name]` para executar o wrapper, passando o
 *      `AuroraToolContext` atual.
 *
 * Testabilidade: cada handler é importável isolado e aceita `rawInput: unknown`
 * para validação Zod — permite mocks simples dos serviços abaixo
 * (scheduling.service, omni pubsub, db client).
 */

import {
  consultarHorariosTool,
  runConsultarHorarios,
} from './consultar-horarios.tool.js';
import {
  reservarSlotTool,
  runReservarSlot,
} from './reservar-slot.tool.js';
import {
  confirmarAgendamentoTool,
  runConfirmarAgendamento,
} from './confirmar-agendamento.tool.js';
import {
  cancelarAgendamentoTool,
  runCancelarAgendamento,
} from './cancelar-agendamento.tool.js';
import {
  buscarAppointmentDoContatoTool,
  runBuscarAppointmentDoContato,
} from './buscar-appointment-do-contato.tool.js';
import {
  consultarKnowledgeBaseTool,
  runConsultarKnowledgeBase,
} from './consultar-knowledge-base.tool.js';
import {
  transferirParaHumanoTool,
  runTransferirParaHumano,
} from './transferir-para-humano.tool.js';
import type {
  AuroraToolContext,
  AuroraToolDefinition,
  AuroraToolResult,
} from './tool-context.js';

export type AuroraToolName =
  | 'consultarHorarios'
  | 'reservarSlot'
  | 'confirmarAgendamento'
  | 'cancelarAgendamento'
  | 'buscarAppointmentDoContato'
  | 'consultarKnowledgeBase'
  | 'transferirParaHumano';

export type AuroraToolHandler =
  (rawInput: unknown, ctx: AuroraToolContext) => Promise<AuroraToolResult<unknown>>;

export const AURORA_TOOL_DEFINITIONS: AuroraToolDefinition[] = [
  consultarHorariosTool,
  reservarSlotTool,
  confirmarAgendamentoTool,
  cancelarAgendamentoTool,
  buscarAppointmentDoContatoTool,
  consultarKnowledgeBaseTool,
  transferirParaHumanoTool,
];

export const AURORA_TOOL_HANDLERS: Record<AuroraToolName, AuroraToolHandler> = {
  consultarHorarios:          runConsultarHorarios,
  reservarSlot:               runReservarSlot,
  confirmarAgendamento:       runConfirmarAgendamento,
  cancelarAgendamento:        runCancelarAgendamento,
  buscarAppointmentDoContato: runBuscarAppointmentDoContato,
  consultarKnowledgeBase:     runConsultarKnowledgeBase,
  transferirParaHumano:       runTransferirParaHumano,
};

export function isAuroraToolName(name: string): name is AuroraToolName {
  return name in AURORA_TOOL_HANDLERS;
}

/**
 * Executa uma tool-call vinda do LLM. Faz dispatch + validação + invocação.
 * Retorna sempre um `AuroraToolResult<unknown>` — nunca lança (erros internos
 * viram `{ ok:false, error:{code:'internal_error', ...} }`).
 */
export async function executeAuroraTool(
  name:     string,
  rawInput: unknown,
  ctx:      AuroraToolContext,
): Promise<AuroraToolResult<unknown>> {
  if (!isAuroraToolName(name)) {
    return {
      ok:    false,
      error: { code: 'unknown_tool', message: `Tool desconhecida: ${name}` },
    };
  }
  try {
    return await AURORA_TOOL_HANDLERS[name](rawInput, ctx);
  } catch (err) {
    return {
      ok:    false,
      error: {
        code:    'internal_error',
        message: err instanceof Error ? err.message : 'erro interno',
      },
    };
  }
}

export type {
  AuroraToolContext,
  AuroraToolDefinition,
  AuroraToolResult,
} from './tool-context.js';

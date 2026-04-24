/**
 * Tool `reservarSlot` — etapa intermediária do fluxo `agendar_consulta` (§B.1).
 *
 * Wrapper sobre `reserveTentativeSlot(input)`. Cria um hold efêmero
 * (TTL padrão 180s) ANTES de confirmar com o paciente, evitando condições de
 * corrida entre múltiplas conversas competindo pelo mesmo horário.
 *
 * Se der conflito (slot já ocupado ou hold ativo de outra conversa), devolve
 * `ok:false` com código 'slot_conflict' para a Aurora re-consultar horários.
 */

import { z } from 'zod';
import {
  reserveTentativeSlot,
  SchedulingHoldConflictError,
} from '../../scheduling/scheduling.service.js';
import type {
  AuroraToolContext,
  AuroraToolDefinition,
  AuroraToolResult,
} from './tool-context.js';

export const reservarSlotInputSchema = z.object({
  providerId:  z.string().uuid(),
  scheduledAt: z.coerce.date(),
  durationMin: z.number().int().min(5).max(480).default(30),
  ttlSeconds:  z.number().int().min(30).max(600).default(180),
});

export type ReservarSlotInput = z.infer<typeof reservarSlotInputSchema>;

export interface ReservarSlotOutput {
  holdToken:   string;
  expiresAt:   string;   // ISO
  providerId:  string;
  scheduledAt: string;
  durationMin: number;
}

export const reservarSlotTool: AuroraToolDefinition = {
  name: 'reservarSlot',
  description:
    'Reserva temporariamente um horário (hold de ~3 min) ANTES de confirmar com ' +
    'o paciente. Obrigatório antes de `confirmarAgendamento`.',
  input_schema: {
    type: 'object',
    properties: {
      providerId:  { type: 'string', description: 'UUID da dermatologista.' },
      scheduledAt: { type: 'string', description: 'Início do slot em ISO-8601 (UTC).' },
      durationMin: { type: 'number', description: 'Duração em minutos (padrão 30).' },
      ttlSeconds:  { type: 'number', description: 'TTL do hold em segundos (padrão 180, máx 600).' },
    },
    required: ['providerId', 'scheduledAt'],
  },
};

export async function runReservarSlot(
  rawInput: unknown,
  ctx:      AuroraToolContext,
): Promise<AuroraToolResult<ReservarSlotOutput>> {
  const parsed = reservarSlotInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok:    false,
      error: { code: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'entrada inválida' },
    };
  }
  const { providerId, scheduledAt, durationMin, ttlSeconds } = parsed.data;

  try {
    const result = await reserveTentativeSlot({
      providerId,
      scheduledAt,
      durationMin,
      ttlSeconds,
      clinicId:       ctx.clinicId,
      conversationId: ctx.conversationId,
    });
    return {
      ok: true,
      data: {
        holdToken:   result.holdToken,
        expiresAt:   result.expiresAt.toISOString(),
        providerId,
        scheduledAt: scheduledAt.toISOString(),
        durationMin,
      },
    };
  } catch (err) {
    if (err instanceof SchedulingHoldConflictError) {
      return {
        ok:    false,
        error: { code: 'slot_conflict', message: 'Horário indisponível — selecione outro' },
      };
    }
    throw err;
  }
}

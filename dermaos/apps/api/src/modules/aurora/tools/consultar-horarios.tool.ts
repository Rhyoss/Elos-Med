/**
 * Tool `consultarHorarios` — mapeia para a intenção `consultar_horarios` (§B.1).
 *
 * Wrapper sobre `getAvailableSlots(providerId, date, durationMin, clinicId)`.
 * Devolve apenas os slots LIVRES, formatados em HH:mm (horário local da clínica
 * será tratado em Phase 3 — aqui retornamos ISO para o LLM).
 */

import { z } from 'zod';
import { getAvailableSlots } from '../../scheduling/scheduling.service.js';
import type {
  AuroraToolContext,
  AuroraToolDefinition,
  AuroraToolResult,
} from './tool-context.js';

export const consultarHorariosInputSchema = z.object({
  providerId:  z.string().uuid(),
  date:        z.coerce.date(),
  durationMin: z.number().int().min(5).max(480).default(30),
});

export type ConsultarHorariosInput = z.infer<typeof consultarHorariosInputSchema>;

export interface ConsultarHorariosOutput {
  providerId:  string;
  date:        string;        // ISO yyyy-mm-dd
  durationMin: number;
  slots: Array<{
    start: string;            // ISO datetime
    end:   string;
  }>;
}

export const consultarHorariosTool: AuroraToolDefinition = {
  name: 'consultarHorarios',
  description:
    'Lista horários DISPONÍVEIS para uma dermatologista em uma data. Use antes ' +
    'de oferecer opções ao paciente. Retorna apenas slots livres.',
  input_schema: {
    type: 'object',
    properties: {
      providerId: {
        type:        'string',
        description: 'UUID da dermatologista. Se o paciente não especificou, use a primeira ativa.',
      },
      date: {
        type:        'string',
        description: 'Data em formato YYYY-MM-DD.',
      },
      durationMin: {
        type:        'number',
        description: 'Duração desejada em minutos (padrão 30).',
      },
    },
    required: ['providerId', 'date'],
  },
};

export async function runConsultarHorarios(
  rawInput: unknown,
  ctx:      AuroraToolContext,
): Promise<AuroraToolResult<ConsultarHorariosOutput>> {
  const parsed = consultarHorariosInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok:    false,
      error: { code: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'entrada inválida' },
    };
  }
  const { providerId, date, durationMin } = parsed.data;

  const windows = await getAvailableSlots(providerId, date, durationMin, ctx.clinicId);
  const slots   = windows
    .filter((s) => s.available)
    .map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() }));

  const isoDate = date.toISOString().slice(0, 10);

  return {
    ok:   true,
    data: { providerId, date: isoDate, durationMin, slots },
  };
}

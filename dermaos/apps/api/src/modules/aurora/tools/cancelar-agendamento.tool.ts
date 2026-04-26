/**
 * Tool `cancelarAgendamento` — mapeia para `cancelar_consulta` (§B.1).
 *
 * Wrapper sobre `cancelAppointment(input, clinicId, userId)`. Usa o
 * `ctx.auroraUserId` como ator da ação. Emite `appointment.cancelled`.
 *
 * Pré-requisito: o appointment precisa estar em `scheduled|confirmed|waiting`.
 * Estados finais (`completed`, `cancelled`, `no_show`) retornam 'invalid_state'.
 */

import { z } from 'zod';
import { cancelAppointment } from '../../scheduling/scheduling.service.js';
import type {
  AuroraToolContext,
  AuroraToolDefinition,
  AuroraToolResult,
} from './tool-context.js';

export const cancelarAgendamentoInputSchema = z.object({
  appointmentId: z.string().uuid(),
  reason:        z.string().min(1).max(500).default('Cancelado pelo paciente via Aurora'),
});

export type CancelarAgendamentoInput = z.infer<typeof cancelarAgendamentoInputSchema>;

export interface CancelarAgendamentoOutput {
  appointmentId: string;
  status:        string;
  cancelledAt:   string | null;
}

export const cancelarAgendamentoTool: AuroraToolDefinition = {
  name: 'cancelarAgendamento',
  description:
    'Cancela um agendamento existente. Só funciona para appointments em ' +
    '`scheduled`, `confirmed` ou `waiting`. Gera evento e notifica a equipe.',
  input_schema: {
    type: 'object',
    properties: {
      appointmentId: { type: 'string', description: 'UUID do appointment a cancelar.' },
      reason:        { type: 'string', description: 'Motivo informado pelo paciente (obrigatório).' },
    },
    required: ['appointmentId', 'reason'],
  },
};

export async function runCancelarAgendamento(
  rawInput: unknown,
  ctx:      AuroraToolContext,
): Promise<AuroraToolResult<CancelarAgendamentoOutput>> {
  const parsed = cancelarAgendamentoInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok:    false,
      error: { code: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'entrada inválida' },
    };
  }
  const { appointmentId, reason } = parsed.data;

  try {
    const appt = await cancelAppointment(
      { id: appointmentId, reason },
      ctx.clinicId,
      ctx.auroraUserId,
    );
    return {
      ok: true,
      data: {
        appointmentId: appt.id,
        status:        appt.status,
        cancelledAt:   appt.cancelledAt ? appt.cancelledAt.toISOString() : null,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // `transition` lança TRPCError quando estado é inválido; devolvemos
    // um código estável ao LLM para ele decidir como reagir.
    return {
      ok:    false,
      error: { code: 'invalid_state', message: msg },
    };
  }
}

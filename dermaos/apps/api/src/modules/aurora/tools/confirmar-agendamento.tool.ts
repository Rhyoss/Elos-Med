/**
 * Tool `confirmarAgendamento` — etapa final do fluxo `agendar_consulta` (§B.1).
 *
 * Consome um hold (criado por `reservarSlot`) e converte em Appointment
 * definitivo. Emite `appointment.created_via_aurora` internamente.
 *
 * Pré-requisito: ctx.patientId definido. Paciente sem cadastro → Aurora
 * precisa antes coletar dados mínimos (flow fora deste wrapper).
 */

import { z } from 'zod';
import {
  confirmHeldSlot,
  SchedulingHoldConflictError,
  SchedulingHoldExpiredError,
  SchedulingHoldNotFoundError,
} from '../../scheduling/scheduling.service.js';
import type {
  AuroraToolContext,
  AuroraToolDefinition,
  AuroraToolResult,
} from './tool-context.js';

export const confirmarAgendamentoInputSchema = z.object({
  holdToken: z.string().uuid(),
  serviceId: z.string().uuid(),
});

export type ConfirmarAgendamentoInput = z.infer<typeof confirmarAgendamentoInputSchema>;

export interface ConfirmarAgendamentoOutput {
  appointmentId: string;
  patientId:     string;
  providerId:    string;
  scheduledAt:   string;   // ISO
  durationMin:   number;
  status:        string;
}

export const confirmarAgendamentoTool: AuroraToolDefinition = {
  name: 'confirmarAgendamento',
  description:
    'Confirma um hold (criado por reservarSlot) em agendamento definitivo. ' +
    'Exige `holdToken` válido e paciente já vinculado ao contato.',
  input_schema: {
    type: 'object',
    properties: {
      holdToken: { type: 'string', description: 'Hold token devolvido por reservarSlot.' },
      serviceId: { type: 'string', description: 'UUID do serviço (consulta, procedimento, etc.).' },
    },
    required: ['holdToken', 'serviceId'],
  },
};

export async function runConfirmarAgendamento(
  rawInput: unknown,
  ctx:      AuroraToolContext,
): Promise<AuroraToolResult<ConfirmarAgendamentoOutput>> {
  const parsed = confirmarAgendamentoInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok:    false,
      error: { code: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'entrada inválida' },
    };
  }

  if (!ctx.patientId) {
    return {
      ok:    false,
      error: { code: 'patient_not_linked', message: 'Contato ainda não vinculado a um paciente' },
    };
  }

  const { holdToken, serviceId } = parsed.data;

  try {
    const appt = await confirmHeldSlot({
      holdToken,
      serviceId,
      clinicId:       ctx.clinicId,
      patientId:      ctx.patientId,
      conversationId: ctx.conversationId,
    });
    return {
      ok: true,
      data: {
        appointmentId: appt.id,
        patientId:     appt.patientId,
        providerId:    appt.providerId,
        scheduledAt:   appt.scheduledAt.toISOString(),
        durationMin:   appt.durationMin,
        status:        appt.status,
      },
    };
  } catch (err) {
    if (err instanceof SchedulingHoldNotFoundError) {
      return { ok: false, error: { code: 'hold_not_found', message: 'Reserva não encontrada' } };
    }
    if (err instanceof SchedulingHoldExpiredError) {
      return { ok: false, error: { code: 'hold_expired',   message: 'Reserva expirou — selecione outro horário' } };
    }
    if (err instanceof SchedulingHoldConflictError) {
      return { ok: false, error: { code: 'slot_conflict',  message: 'Horário ocupado — selecione outro' } };
    }
    throw err;
  }
}

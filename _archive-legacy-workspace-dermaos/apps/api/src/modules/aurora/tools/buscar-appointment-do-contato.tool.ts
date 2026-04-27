/**
 * Tool `buscarAppointmentDoContato` — usada pelos fluxos `reagendar_consulta`,
 * `cancelar_consulta`, `confirmar_presenca` (§B.1).
 *
 * Busca agendamentos ATIVOS do paciente vinculado ao contato. Lê direto do
 * banco via `withClinicContext` para respeitar RLS por clínica.
 *
 * Retorna no máximo os 5 mais recentes — evita payload grande para o LLM.
 */

import { z } from 'zod';
import { withClinicContext } from '../../../db/client.js';
import type {
  AuroraToolContext,
  AuroraToolDefinition,
  AuroraToolResult,
} from './tool-context.js';

export const buscarAppointmentDoContatoInputSchema = z.object({
  /** Quando true, inclui appointments já concluídos/cancelados nos últimos 30 dias. */
  includePast: z.boolean().default(false),
});

export type BuscarAppointmentDoContatoInput = z.infer<typeof buscarAppointmentDoContatoInputSchema>;

export interface AppointmentSummary {
  id:           string;
  providerId:   string;
  providerName: string;
  scheduledAt:  string;   // ISO
  durationMin:  number;
  status:       string;
  serviceName:  string | null;
}

export interface BuscarAppointmentDoContatoOutput {
  patientLinked: boolean;
  appointments:  AppointmentSummary[];
}

export const buscarAppointmentDoContatoTool: AuroraToolDefinition = {
  name: 'buscarAppointmentDoContato',
  description:
    'Lista os próximos agendamentos ATIVOS do paciente vinculado a este contato. ' +
    'Use antes de reagendar, cancelar ou confirmar presença.',
  input_schema: {
    type: 'object',
    properties: {
      includePast: {
        type:        'boolean',
        description: 'Se true, inclui também appointments dos últimos 30 dias (default false).',
      },
    },
    required: [],
  },
};

const ACTIVE_STATUSES = ['scheduled', 'confirmed', 'waiting', 'in_progress'];

export async function runBuscarAppointmentDoContato(
  rawInput: unknown,
  ctx:      AuroraToolContext,
): Promise<AuroraToolResult<BuscarAppointmentDoContatoOutput>> {
  const parsed = buscarAppointmentDoContatoInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok:    false,
      error: { code: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'entrada inválida' },
    };
  }
  const { includePast } = parsed.data;

  if (!ctx.patientId) {
    return {
      ok:   true,
      data: { patientLinked: false, appointments: [] },
    };
  }

  const rows = await withClinicContext(ctx.clinicId, async (client) => {
    const result = await client.query<{
      id:            string;
      provider_id:   string;
      provider_name: string;
      scheduled_at:  string;
      duration_min:  number;
      status:        string;
      service_name:  string | null;
    }>(
      `SELECT a.id,
              a.provider_id,
              u.name        AS provider_name,
              a.scheduled_at,
              a.duration_min,
              a.status,
              s.name        AS service_name
         FROM shared.appointments a
         JOIN shared.users    u ON u.id = a.provider_id
         LEFT JOIN shared.services s ON s.id = a.service_id
        WHERE a.clinic_id  = $1
          AND a.patient_id = $2
          AND (
            a.status = ANY($3::shared.appointment_status[])
            OR ($4::boolean AND a.scheduled_at >= NOW() - INTERVAL '30 days')
          )
        ORDER BY a.scheduled_at DESC
        LIMIT 5`,
      [ctx.clinicId, ctx.patientId, ACTIVE_STATUSES, includePast],
    );
    return result.rows;
  });

  return {
    ok: true,
    data: {
      patientLinked: true,
      appointments:  rows.map((r) => ({
        id:           r.id,
        providerId:   r.provider_id,
        providerName: r.provider_name,
        scheduledAt:  new Date(r.scheduled_at).toISOString(),
        durationMin:  r.duration_min,
        status:       r.status,
        serviceName:  r.service_name,
      })),
    },
  };
}

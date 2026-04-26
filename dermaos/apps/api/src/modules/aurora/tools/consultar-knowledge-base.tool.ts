/**
 * Tool `consultarKnowledgeBase` — cobre `consultar_servicos_e_precos`,
 * `obter_endereco_clinica` e `consultar_horarios` (em sua vertente de
 * horário de atendimento da clínica, não de slots de provider) (§B.1).
 *
 * Leitura SOMENTE do cadastro da clínica. Não acessa dados clínicos (PHI).
 *
 * Topics suportados:
 *   • `services`  — lista de serviços/procedimentos + preços públicos.
 *   • `providers` — dermatologistas ativos.
 *   • `address`   — endereço, bairro, cidade, estacionamento.
 *   • `hours`     — horário de funcionamento (de/até, dias da semana).
 *
 * Campos são derivados do schema `shared.clinics` + `shared.services` +
 * `shared.users`. Fallback a null quando a clínica não tem o campo preenchido
 * (a Aurora deve admitir "não tenho essa informação — posso verificar").
 */

import { z } from 'zod';
import { withClinicContext } from '../../../db/client.js';
import { listServices, listProviders } from '../../scheduling/scheduling.service.js';
import type {
  AuroraToolContext,
  AuroraToolDefinition,
  AuroraToolResult,
} from './tool-context.js';

export const consultarKnowledgeBaseInputSchema = z.object({
  topic: z.enum(['services', 'providers', 'address', 'hours']),
});

export type ConsultarKnowledgeBaseInput = z.infer<typeof consultarKnowledgeBaseInputSchema>;

export interface KbServicesOutput {
  topic:    'services';
  services: Array<{ id: string; name: string; durationMin: number; price: number | null; category: string | null }>;
}

export interface KbProvidersOutput {
  topic:     'providers';
  providers: Array<{ id: string; name: string; role: string; crm: string | null }>;
}

export interface KbAddressOutput {
  topic:          'address';
  address:        string | null;
  neighborhood:   string | null;
  city:           string | null;
  state:          string | null;
  hasParking:     boolean | null;
  clinicName:     string;
}

export interface KbHoursOutput {
  topic:      'hours';
  /** Ex.: "Segunda a Sexta, 8h às 19h, Sábado 9h às 13h". */
  humanText:  string | null;
  /** Estruturado — mon..sun → { start, end } | null. */
  structured: Record<string, { start: string; end: string } | null> | null;
}

export type ConsultarKnowledgeBaseOutput =
  | KbServicesOutput
  | KbProvidersOutput
  | KbAddressOutput
  | KbHoursOutput;

export const consultarKnowledgeBaseTool: AuroraToolDefinition = {
  name: 'consultarKnowledgeBase',
  description:
    'Consulta dados públicos da clínica: serviços, dermatologistas, endereço ' +
    'ou horário de funcionamento. NUNCA retorna dados clínicos de pacientes.',
  input_schema: {
    type: 'object',
    properties: {
      topic: {
        type:        'string',
        enum:        ['services', 'providers', 'address', 'hours'],
        description: 'Qual faceta da clínica consultar.',
      },
    },
    required: ['topic'],
  },
};

export async function runConsultarKnowledgeBase(
  rawInput: unknown,
  ctx:      AuroraToolContext,
): Promise<AuroraToolResult<ConsultarKnowledgeBaseOutput>> {
  const parsed = consultarKnowledgeBaseInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok:    false,
      error: { code: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'entrada inválida' },
    };
  }
  const { topic } = parsed.data;

  switch (topic) {
    case 'services': {
      const services = await listServices(ctx.clinicId);
      return {
        ok:   true,
        data: {
          topic:    'services',
          services: services.map((s) => ({
            id:          s.id,
            name:        s.name,
            durationMin: s.durationMin,
            price:       s.price,
            category:    s.category,
          })),
        },
      };
    }
    case 'providers': {
      const providers = await listProviders(ctx.clinicId);
      return {
        ok:   true,
        data: { topic: 'providers', providers },
      };
    }
    case 'address': {
      const row = await withClinicContext(ctx.clinicId, async (client) => {
        const r = await client.query<{
          name:         string;
          address:      string | null;
          neighborhood: string | null;
          city:         string | null;
          state:        string | null;
          metadata:     Record<string, unknown> | null;
        }>(
          `SELECT name, address, neighborhood, city, state, metadata
             FROM shared.clinics
            WHERE id = $1`,
          [ctx.clinicId],
        );
        return r.rows[0] ?? null;
      });

      if (!row) {
        return { ok: false, error: { code: 'clinic_not_found', message: 'Clínica não encontrada' } };
      }

      const hasParking =
        typeof row.metadata === 'object' && row.metadata && 'has_parking' in row.metadata
          ? Boolean((row.metadata as Record<string, unknown>).has_parking)
          : null;

      return {
        ok:   true,
        data: {
          topic:        'address',
          clinicName:   row.name,
          address:      row.address,
          neighborhood: row.neighborhood,
          city:         row.city,
          state:        row.state,
          hasParking,
        },
      };
    }
    case 'hours': {
      const row = await withClinicContext(ctx.clinicId, async (client) => {
        const r = await client.query<{
          operating_hours:      Record<string, { start: string; end: string } | null> | null;
          operating_hours_text: string | null;
        }>(
          `SELECT operating_hours, operating_hours_text
             FROM shared.clinics
            WHERE id = $1`,
          [ctx.clinicId],
        );
        return r.rows[0] ?? null;
      });

      if (!row) {
        return { ok: false, error: { code: 'clinic_not_found', message: 'Clínica não encontrada' } };
      }

      return {
        ok:   true,
        data: {
          topic:      'hours',
          humanText:  row.operating_hours_text,
          structured: row.operating_hours,
        },
      };
    }
  }
}

/**
 * Tool `transferirParaHumano` — mapeia para `solicitar_atendimento_humano` e
 * é usada também como saída forçada de guardrails (oncológico, prescrição
 * bloqueada pós-regenerate, emergência).
 *
 * Marca a conversa como humana: define `assigned_to = NULL` + metadata
 * `aurora_state.handler='human'` + priority baseado no motivo. NÃO atribui
 * a um usuário específico — apenas desengaja a Aurora. Um atendente pega
 * pelo `omni.assignConversation` depois.
 *
 * Motivos canônicos (`reason`):
 *   • `pedido_do_paciente`     → priority 'normal'
 *   • `guardrail_oncologico`   → priority 'high'
 *   • `guardrail_prescricao`   → priority 'high'
 *   • `emergencia_medica`      → priority 'urgent'
 *   • `aurora_nao_conseguiu`   → priority 'normal'
 *   • `fora_horario`           → priority 'normal'
 *
 * Emite `aurora.transfer_to_human` + `conversation.escalated`.
 */

import { z } from 'zod';
import { withClinicContext } from '../../../db/client.js';
import { eventBus } from '../../../events/event-bus.js';
import { emitToClinic } from '../../../lib/socket.js';
import type { AuroraTransferPriority } from '../types.js';
import type {
  AuroraToolContext,
  AuroraToolDefinition,
  AuroraToolResult,
} from './tool-context.js';

export const TRANSFER_REASONS = [
  'pedido_do_paciente',
  'guardrail_oncologico',
  'guardrail_prescricao',
  'emergencia_medica',
  'aurora_nao_conseguiu',
  'fora_horario',
] as const;

export type TransferReason = (typeof TRANSFER_REASONS)[number];

export const transferirParaHumanoInputSchema = z.object({
  reason: z.enum(TRANSFER_REASONS),
  note:   z.string().max(500).optional(),
});

export type TransferirParaHumanoInput = z.infer<typeof transferirParaHumanoInputSchema>;

export interface TransferirParaHumanoOutput {
  conversationId: string;
  handler:        'human';
  priority:       AuroraTransferPriority;
  reason:         TransferReason;
}

const PRIORITY_BY_REASON: Record<TransferReason, AuroraTransferPriority> = {
  pedido_do_paciente:   'normal',
  guardrail_oncologico: 'high',
  guardrail_prescricao: 'high',
  emergencia_medica:    'urgent',
  aurora_nao_conseguiu: 'normal',
  fora_horario:         'normal',
};

export const transferirParaHumanoTool: AuroraToolDefinition = {
  name: 'transferirParaHumano',
  description:
    'Encerra o atendimento da Aurora e enfileira a conversa para um atendente ' +
    'humano. Use quando o paciente pede, quando guardrails bloqueiam ou em ' +
    'emergências médicas. Sempre retorna imediatamente.',
  input_schema: {
    type: 'object',
    properties: {
      reason: {
        type:        'string',
        enum:        [...TRANSFER_REASONS],
        description: 'Motivo canônico da transferência (controla prioridade).',
      },
      note: {
        type:        'string',
        description: 'Observação livre (sem PHI). Vai para `conversation.escalated.reason`.',
      },
    },
    required: ['reason'],
  },
};

export async function runTransferirParaHumano(
  rawInput: unknown,
  ctx:      AuroraToolContext,
): Promise<AuroraToolResult<TransferirParaHumanoOutput>> {
  const parsed = transferirParaHumanoInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok:    false,
      error: { code: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'entrada inválida' },
    };
  }
  const { reason, note } = parsed.data;
  const priority = PRIORITY_BY_REASON[reason];

  await withClinicContext(ctx.clinicId, async (client) => {
    // 1. Atualiza conversation: handler=human, priority apropriado.
    await client.query(
      `UPDATE omni.conversations
          SET assigned_to = NULL,
              priority    = $3,
              metadata    = COALESCE(metadata, '{}'::jsonb)
                            || jsonb_build_object(
                                 'aurora_state',
                                 COALESCE(metadata -> 'aurora_state', '{}'::jsonb)
                                 || jsonb_build_object(
                                      'handler',           'human',
                                      'transferred_at',    NOW(),
                                      'transferred_reason', $4::text
                                    )
                               ),
              updated_at  = NOW()
        WHERE id = $1 AND clinic_id = $2`,
      [ctx.conversationId, ctx.clinicId, priority, reason],
    );

    // 2. Mensagem de sistema (is_internal_note=TRUE para não ir ao paciente).
    await client.query(
      `INSERT INTO omni.messages
         (clinic_id, conversation_id, sender_type, content_type, content, status, sent_at, is_internal_note)
       VALUES ($1, $2, 'system', 'text', $3, 'sent', NOW(), TRUE)`,
      [
        ctx.clinicId,
        ctx.conversationId,
        `— Aurora transferiu para humano (${reason})${note ? `: ${note}` : ''}`,
      ],
    );
  });

  // 3. Audit + realtime (best-effort, fora da transação).
  setImmediate(() => {
    void eventBus
      .publish(
        'aurora.transfer_to_human',
        ctx.clinicId,
        ctx.conversationId,
        { reason, priority, conversationId: ctx.conversationId, note: note ?? null },
      )
      .catch(() => undefined);

    void eventBus
      .publish(
        'conversation.escalated',
        ctx.clinicId,
        ctx.conversationId,
        { to: null, reason, by: ctx.auroraUserId },
      )
      .catch(() => undefined);

    emitToClinic(ctx.clinicId, 'conversation_assigned', {
      conversationId: ctx.conversationId,
      assigneeId:     null,
      escalated:      true,
    });
  });

  return {
    ok: true,
    data: {
      conversationId: ctx.conversationId,
      handler:        'human',
      priority,
      reason,
    },
  };
}

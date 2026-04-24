/**
 * Schemas da Aurora — painel de gestão (Fase 4).
 *
 * Contratos validados tanto no backend (tRPC + Fastify) quanto no frontend
 * (react-hook-form). Mantidos em `@dermaos/shared` para que ambos compartilhem
 * exatamente a mesma definição.
 *
 * Referências:
 *   - Anexo A §A.1.2 — modelos `AiAgent`, `AiKnowledgeBase`, `Channel`
 *   - Anexo B §B.1   — taxonomia de intenções e tools
 *   - Prompt Fase 4  — §1.1, §1.2, §1.3, §1.4, §3.5
 */

import { z } from 'zod';
import { channelTypeSchema } from './omni.schema.js';

/* ── Enums da Aurora ────────────────────────────────────────────────────── */

export const aiAgentTypeSchema = z.enum([
  'receptionist',
  'scheduler',
  'follow_up',
  'support',
  'custom',
]);
export type AiAgentType = z.infer<typeof aiAgentTypeSchema>;

export const aiAgentModelSchema = z.enum([
  'claude-haiku-4-5',
  'claude-sonnet-4-20250514',
  'ollama:llama3.1:8b',
]);
export type AiAgentModel = z.infer<typeof aiAgentModelSchema>;

export const aiAgentToolSchema = z.enum([
  'consultarHorarios',
  'reservarSlot',
  'confirmarAgendamento',
  'cancelarAgendamento',
  'buscarAppointmentDoContato',
  'consultarKnowledgeBase',
  'transferirParaHumano',
]);
export type AiAgentTool = z.infer<typeof aiAgentToolSchema>;

export const auroraIntentSchema = z.enum([
  'saudacao',
  'agendar_consulta',
  'remarcar_consulta',
  'cancelar_consulta',
  'confirmar_consulta',
  'consultar_horarios',
  'informacoes_clinica',
  'duvida_procedimento',
  'pos_atendimento',
  'emergencia',
  'fora_de_escopo',
]);
export type AuroraIntent = z.infer<typeof auroraIntentSchema>;

export const embeddingStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
]);
export type EmbeddingStatus = z.infer<typeof embeddingStatusSchema>;

/* ── Horário de operação ────────────────────────────────────────────────── */

/**
 * Formato canônico: `HH:mm-HH:mm` (ex: "08:00-18:00"). `null` = dia fechado.
 * Chaves aceitas — Anexo B §B.1.2:
 *   mon, tue, wed, thu, fri, sat, sun (dias individuais)
 *   mon-fri (atalho — substitui os 5 dias)
 */
const timeRangeRegex = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

export const operatingHoursSchema = z
  .object({
    'mon-fri': z.string().regex(timeRangeRegex).nullable().optional(),
    mon:       z.string().regex(timeRangeRegex).nullable().optional(),
    tue:       z.string().regex(timeRangeRegex).nullable().optional(),
    wed:       z.string().regex(timeRangeRegex).nullable().optional(),
    thu:       z.string().regex(timeRangeRegex).nullable().optional(),
    fri:       z.string().regex(timeRangeRegex).nullable().optional(),
    sat:       z.string().regex(timeRangeRegex).nullable().optional(),
    sun:       z.string().regex(timeRangeRegex).nullable().optional(),
  })
  .strict()
  .default({});
export type OperatingHours = z.infer<typeof operatingHoursSchema>;

/* ── Regras de escalação ────────────────────────────────────────────────── */

export const escalationConditionSchema = z.object({
  type: z.enum([
    'sentiment',
    'intent',
    'keyword',
    'time_of_day',
    'unresolved_messages',
  ]),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'greater_than',
  ]),
  value: z.union([z.string().min(1).max(200), z.number()]),
});
export type EscalationCondition = z.infer<typeof escalationConditionSchema>;

export const escalationActionSchema = z.object({
  type: z.enum([
    'escalate_to_role',
    'mark_urgent',
    'notify_internal',
  ]),
  target_role: z
    .enum(['receptionist', 'dermatologist', 'admin'])
    .optional(),
  notify_channel: z
    .enum(['socket', 'email'])
    .optional(),
});
export type EscalationAction = z.infer<typeof escalationActionSchema>;

export const escalationRuleSchema = z.object({
  id:         z.string().uuid(),
  priority:   z.number().int().min(1).max(99),
  name:       z.string().min(1).max(120),
  isActive:   z.boolean().default(true),
  conditions: z.array(escalationConditionSchema).min(1).max(10),
  action:     escalationActionSchema,
});
export type EscalationRule = z.infer<typeof escalationRuleSchema>;

/* ── config JSONB do agente ─────────────────────────────────────────────── */

export const aiAgentConfigSchema = z.object({
  operating_hours:   operatingHoursSchema.optional(),
  escalation_rules:  z.array(escalationRuleSchema).default([]),
  /** SLA em minutos para resposta humana após escalar. */
  sla_minutes:       z.number().int().min(1).max(1440).optional(),
});
export type AiAgentConfig = z.infer<typeof aiAgentConfigSchema>;

/* ── CRUD Agents ────────────────────────────────────────────────────────── */

const nameField = z.string().trim().min(3).max(100);
const systemPromptField = z.string().max(16_000).optional();

export const createAgentSchema = z.object({
  name:          nameField,
  type:          aiAgentTypeSchema,
  model:         aiAgentModelSchema,
  systemPrompt:  systemPromptField,
  temperature:   z.number().min(0).max(1).default(0.30),
  maxTokens:     z.number().int().min(100).max(2000).default(800),
  toolsEnabled:  z.array(aiAgentToolSchema).default([]),
  config:        aiAgentConfigSchema.optional(),
});
export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = createAgentSchema.partial().extend({
  id: z.string().uuid(),
});
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export const toggleAgentSchema = z.object({
  id:       z.string().uuid(),
  isActive: z.boolean(),
});

export const deleteAgentSchema = z.object({ id: z.string().uuid() });

export const getAgentSchema = z.object({ id: z.string().uuid() });

export const listAgentsSchema = z.object({}).optional();

/* ── Canais ─────────────────────────────────────────────────────────────── */

export const linkChannelSchema = z.object({
  agentId:   z.string().uuid(),
  channelId: z.string().uuid(),
});

export const unlinkChannelSchema = z.object({
  channelId: z.string().uuid(),
});

/* ── Preview ────────────────────────────────────────────────────────────── */

const previewMessageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
});

export const previewAgentSchema = z.object({
  id:       z.string().uuid(),
  messages: z.array(previewMessageSchema).min(1).max(20),
});
export type PreviewAgentInput = z.infer<typeof previewAgentSchema>;

/* ── Knowledge base ─────────────────────────────────────────────────────── */

export const listKnowledgeSchema = z.object({
  agentId: z.string().uuid(),
});

export const getKnowledgeSchema = z.object({
  agentId: z.string().uuid(),
  id:      z.string().uuid(),
});

export const deleteKnowledgeSchema = z.object({
  agentId: z.string().uuid(),
  id:      z.string().uuid(),
});

export const reembedKnowledgeSchema = z.object({
  agentId: z.string().uuid(),
  id:      z.string().uuid(),
});

/** Para o preview de upload — volta do endpoint multipart. */
export const uploadPreviewSchema = z.object({
  documentId:     z.string().uuid(),
  title:          z.string().max(200),
  extractedText:  z.string().max(50_000),
  originalFilename: z.string().max(255),
  fileSizeBytes:  z.number().int().nonnegative(),
  mimeType:       z.string().max(100),
});
export type UploadPreview = z.infer<typeof uploadPreviewSchema>;

export const confirmEmbeddingSchema = z.object({
  agentId:    z.string().uuid(),
  documentId: z.string().uuid(),
  title:      z.string().trim().min(1).max(200).optional(),
});

/* ── Métricas ───────────────────────────────────────────────────────────── */

export const metricsPeriodSchema = z.enum(['7d', '30d', '90d']);
export type MetricsPeriod = z.infer<typeof metricsPeriodSchema>;

export const metricsInputSchema = z.object({
  agentId: z.string().uuid(),
  period:  metricsPeriodSchema.default('7d'),
});

/* ── Teste de escalação ─────────────────────────────────────────────────── */

export const testEscalationSchema = z.object({
  agentId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
});

/* ── Tipos de retorno mais usados no frontend ───────────────────────────── */

export interface AiAgentSummary {
  id:             string;
  name:           string;
  type:           AiAgentType;
  model:          AiAgentModel;
  isActive:       boolean;
  channelIds:     string[];
  lastActivityAt: string | null;
  createdAt:      string;
}

export interface AiAgentDetail extends AiAgentSummary {
  systemPrompt: string | null;
  temperature:  number;
  maxTokens:    number;
  toolsEnabled: AiAgentTool[];
  config:       AiAgentConfig;
}

export interface KnowledgeItem {
  id:               string;
  agentId:          string;
  title:            string;
  contentPreview:   string;
  originalFilename: string | null;
  mimeType:         string | null;
  fileSizeBytes:    number | null;
  embeddingStatus:  EmbeddingStatus;
  embeddingError:   string | null;
  createdAt:        string;
}

export interface AgentMetrics {
  period:                 MetricsPeriod;
  totalConversations:     number;
  resolutionRate:         number;  // 0..100
  escalationRate:         number;  // 0..100
  avgResponseSeconds:     number | null;
  guardrailsTriggered: {
    diagnostico: number;
    prescricao:  number;
    promessa:    number;
  };
  intents: Array<{ intent: AuroraIntent; count: number }>;
  circuitBreakerOpens:    number;
}

export interface AgentMetricsTimeline {
  period: MetricsPeriod;
  points: Array<{
    date:       string;   // ISO yyyy-mm-dd
    aurora:     number;   // conversas resolvidas pela Aurora
    escalated:  number;   // escaladas p/ humano
  }>;
}

export interface EscalationTestResult {
  matchedRule:   EscalationRule | null;
  intent:        AuroraIntent;
  sentiment:     'negativo' | 'muito_negativo' | 'neutro' | 'positivo';
  wouldEscalate: boolean;
}

/* ── Re-exports úteis ───────────────────────────────────────────────────── */

export { channelTypeSchema };

/**
 * tRPC router `aurora.admin` — painel de gestão (Fase 4).
 *
 * Todos os procedures exigem `omni:ai_config` (owner/admin). Este é o único
 * ponto de entrada do frontend DermaOS para configurar a Aurora.
 */

import { router } from '../../../trpc/trpc.js';
import { protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../../trpc/middleware/rbac.middleware.js';
import {
  createAgentSchema,
  deleteAgentSchema,
  getAgentSchema,
  linkChannelSchema,
  unlinkChannelSchema,
  previewAgentSchema,
  toggleAgentSchema,
  updateAgentSchema,
  listKnowledgeSchema,
  getKnowledgeSchema,
  deleteKnowledgeSchema,
  reembedKnowledgeSchema,
  confirmEmbeddingSchema,
  metricsInputSchema,
  testEscalationSchema,
} from '@dermaos/shared';
import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  toggleAgent,
  deleteAgent,
  linkChannel,
  unlinkChannel,
  previewAgent,
  listKnowledge,
  getKnowledge,
  deleteKnowledge,
  getMetrics,
  getMetricsTimeline,
  testEscalation,
  markKnowledgeStatus,
  confirmKnowledgeEmbedding,
} from './aurora-admin.service.js';
import { enqueueEmbeddingJob } from './embedding-queue.js';
import { runPreviewReasoner } from './preview-reasoner.js';

const requireAiConfig = requirePermission('omni', 'ai_config');
const requireOmniRead = requirePermission('omni', 'read');

export const auroraAdminRouter = router({
  /* ── Agents ─────────────────────────────────────────────────────────── */

  list: protectedProcedure
    .use(requireOmniRead)
    .query(async ({ ctx }) => {
      const agents = await listAgents(ctx.clinicId!);
      return { agents };
    }),

  get: protectedProcedure
    .use(requireOmniRead)
    .input(getAgentSchema)
    .query(async ({ input, ctx }) => {
      const agent = await getAgent(ctx.clinicId!, input.id);
      return { agent };
    }),

  create: protectedProcedure
    .use(requireAiConfig)
    .input(createAgentSchema)
    .mutation(async ({ input, ctx }) => {
      const agent = await createAgent(ctx.clinicId!, ctx.user!.sub, input);
      return { agent };
    }),

  update: protectedProcedure
    .use(requireAiConfig)
    .input(updateAgentSchema)
    .mutation(async ({ input, ctx }) => {
      const agent = await updateAgent(ctx.clinicId!, input);
      return { agent };
    }),

  toggle: protectedProcedure
    .use(requireAiConfig)
    .input(toggleAgentSchema)
    .mutation(async ({ input, ctx }) => {
      const agent = await toggleAgent(ctx.clinicId!, input.id, input.isActive);
      return { agent };
    }),

  delete: protectedProcedure
    .use(requireAiConfig)
    .input(deleteAgentSchema)
    .mutation(async ({ input, ctx }) => {
      await deleteAgent(ctx.clinicId!, input.id);
      return { ok: true };
    }),

  /* ── Channels link/unlink ───────────────────────────────────────────── */

  linkChannel: protectedProcedure
    .use(requireAiConfig)
    .input(linkChannelSchema)
    .mutation(async ({ input, ctx }) => {
      await linkChannel(ctx.clinicId!, input.agentId, input.channelId);
      return { ok: true };
    }),

  unlinkChannel: protectedProcedure
    .use(requireAiConfig)
    .input(unlinkChannelSchema)
    .mutation(async ({ input, ctx }) => {
      await unlinkChannel(ctx.clinicId!, input.channelId);
      return { ok: true };
    }),

  /* ── Preview ────────────────────────────────────────────────────────── */

  preview: protectedProcedure
    .use(requireAiConfig)
    .input(previewAgentSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await previewAgent(ctx.clinicId!, input, runPreviewReasoner);
      return result;
    }),

  /* ── Knowledge base ─────────────────────────────────────────────────── */

  listKnowledge: protectedProcedure
    .use(requireOmniRead)
    .input(listKnowledgeSchema)
    .query(async ({ input, ctx }) => {
      const items = await listKnowledge(ctx.clinicId!, input.agentId);
      return { items };
    }),

  getKnowledge: protectedProcedure
    .use(requireOmniRead)
    .input(getKnowledgeSchema)
    .query(async ({ input, ctx }) => {
      const doc = await getKnowledge(ctx.clinicId!, input.agentId, input.id);
      return { doc };
    }),

  deleteKnowledge: protectedProcedure
    .use(requireAiConfig)
    .input(deleteKnowledgeSchema)
    .mutation(async ({ input, ctx }) => {
      await deleteKnowledge(ctx.clinicId!, input.agentId, input.id);
      return { ok: true };
    }),

  reembedKnowledge: protectedProcedure
    .use(requireAiConfig)
    .input(reembedKnowledgeSchema)
    .mutation(async ({ input, ctx }) => {
      await markKnowledgeStatus(ctx.clinicId!, input.id, 'pending');
      await enqueueEmbeddingJob(ctx.clinicId!, input.agentId, input.id);
      return { ok: true };
    }),

  confirmEmbedding: protectedProcedure
    .use(requireAiConfig)
    .input(confirmEmbeddingSchema)
    .mutation(async ({ input, ctx }) => {
      const item = await confirmKnowledgeEmbedding(
        ctx.clinicId!,
        input.agentId,
        input.documentId,
        input.title,
      );
      await enqueueEmbeddingJob(ctx.clinicId!, input.agentId, input.documentId);
      return { item };
    }),

  /* ── Metrics ────────────────────────────────────────────────────────── */

  metrics: protectedProcedure
    .use(requireOmniRead)
    .input(metricsInputSchema)
    .query(async ({ input, ctx }) => {
      const metrics = await getMetrics(ctx.clinicId!, input.agentId, input.period);
      return { metrics };
    }),

  metricsTimeline: protectedProcedure
    .use(requireOmniRead)
    .input(metricsInputSchema)
    .query(async ({ input, ctx }) => {
      const timeline = await getMetricsTimeline(ctx.clinicId!, input.agentId, input.period);
      return { timeline };
    }),

  /* ── Teste de escalação (simulação) ─────────────────────────────────── */

  testEscalation: protectedProcedure
    .use(requireAiConfig)
    .input(testEscalationSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await testEscalation(ctx.clinicId!, input.agentId, input.message);
      return result;
    }),
});

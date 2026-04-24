import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  submitOrderSchema,
  approveOrderSchema,
  rejectOrderSchema,
  returnOrderSchema,
  sendOrderSchema,
  receiveOrderSchema,
  listOrdersSchema,
  getOrderSchema,
  parseNfeSchema,
  listSuggestionsSchema,
  getPurchaseSettingsSchema,
} from '@dermaos/shared';
import {
  createOrder,
  updateOrder,
  submitOrder,
  approveOrder,
  rejectOrder,
  returnOrder,
  sendOrder,
  receiveOrder,
  listOrders,
  getOrder,
  getPurchaseSettings,
} from './purchase-orders.service.js';
import { listPurchaseSuggestions } from './purchase-suggestions.service.js';
import { parseNfeXml } from './nfe-parser.js';
import { TRPCError } from '@trpc/server';

export const purchaseOrdersRouter = router({

  /* ── Sugestões automáticas ──────────────────────────────────────────────── */

  suggestions: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listSuggestionsSchema)
    .query(async ({ input, ctx }) => {
      return listPurchaseSuggestions(input, ctx.clinicId!);
    }),

  /* ── CRUD de pedidos ────────────────────────────────────────────────────── */

  list: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listOrdersSchema)
    .query(async ({ input, ctx }) => {
      return listOrders(input, ctx.clinicId!);
    }),

  get: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(getOrderSchema)
    .query(async ({ input, ctx }) => {
      return getOrder(input, ctx.clinicId!);
    }),

  create: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(createPurchaseOrderSchema)
    .mutation(async ({ input, ctx }) => {
      return createOrder(input, {
        clinicId: ctx.clinicId!,
        userId:   ctx.user!.sub,
        ipOrigin: ctx.req.ip ?? null,
      });
    }),

  update: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(updatePurchaseOrderSchema)
    .mutation(async ({ input, ctx }) => {
      return updateOrder(input, {
        clinicId: ctx.clinicId!,
        userId:   ctx.user!.sub,
        ipOrigin: ctx.req.ip ?? null,
      });
    }),

  /* ── Transições de status ───────────────────────────────────────────────── */

  submit: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(submitOrderSchema)
    .mutation(async ({ input, ctx }) => {
      return submitOrder(input, {
        clinicId: ctx.clinicId!,
        userId:   ctx.user!.sub,
        ipOrigin: ctx.req.ip ?? null,
      });
    }),

  approve: protectedProcedure
    .use(requirePermission('supply', 'approve'))
    .input(approveOrderSchema)
    .mutation(async ({ input, ctx }) => {
      return approveOrder(input, {
        clinicId: ctx.clinicId!,
        userId:   ctx.user!.sub,
        ipOrigin: ctx.req.ip ?? null,
      });
    }),

  reject: protectedProcedure
    .use(requirePermission('supply', 'approve'))
    .input(rejectOrderSchema)
    .mutation(async ({ input, ctx }) => {
      return rejectOrder(input, {
        clinicId: ctx.clinicId!,
        userId:   ctx.user!.sub,
        ipOrigin: ctx.req.ip ?? null,
      });
    }),

  return: protectedProcedure
    .use(requirePermission('supply', 'approve'))
    .input(returnOrderSchema)
    .mutation(async ({ input, ctx }) => {
      return returnOrder(input, {
        clinicId: ctx.clinicId!,
        userId:   ctx.user!.sub,
        ipOrigin: ctx.req.ip ?? null,
      });
    }),

  send: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(sendOrderSchema)
    .mutation(async ({ input, ctx }) => {
      return sendOrder(input, {
        clinicId: ctx.clinicId!,
        userId:   ctx.user!.sub,
        ipOrigin: ctx.req.ip ?? null,
      });
    }),

  receive: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(receiveOrderSchema)
    .mutation(async ({ input, ctx }) => {
      return receiveOrder(input, {
        clinicId: ctx.clinicId!,
        userId:   ctx.user!.sub,
        ipOrigin: ctx.req.ip ?? null,
      });
    }),

  /* ── Parse de NF-e (sem efeitos colaterais) ─────────────────────────────── */

  parseNfe: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(parseNfeSchema)
    .mutation(async ({ input }) => {
      try {
        return parseNfeXml(input.xml);
      } catch (e) {
        throw new TRPCError({
          code:    'UNPROCESSABLE_CONTENT',
          message: e instanceof Error ? e.message : 'Erro ao processar XML da NF-e.',
        });
      }
    }),

  /* ── Configurações ──────────────────────────────────────────────────────── */

  settings: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(getPurchaseSettingsSchema)
    .query(async ({ ctx }) => {
      return getPurchaseSettings(ctx.clinicId!);
    }),
});

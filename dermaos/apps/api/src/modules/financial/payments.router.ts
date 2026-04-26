import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  registerPaymentSchema,
  refundPaymentSchema,
  installmentsSchema,
} from '@dermaos/shared';
import {
  getInvoicePayments,
  registerPayment,
  refundPayment,
  createInstallments,
} from './payments.service.js';

export const paymentsRouter = router({
  forInvoice: protectedProcedure
    .use(requirePermission('financial', 'read'))
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ input, ctx }) =>
      getInvoicePayments(input.invoiceId, ctx.clinicId!),
    ),

  register: protectedProcedure
    .use(requirePermission('financial', 'write'))
    .input(registerPaymentSchema)
    .mutation(async ({ input, ctx }) =>
      registerPayment(input, ctx.clinicId!, ctx.user!.sub, ctx.req.ip),
    ),

  refund: protectedProcedure
    .use(requirePermission('financial', 'write'))
    .input(refundPaymentSchema)
    .mutation(async ({ input, ctx }) =>
      refundPayment(input, ctx.clinicId!, ctx.user!.sub, ctx.req.ip),
    ),

  installments: protectedProcedure
    .use(requirePermission('financial', 'write'))
    .input(installmentsSchema)
    .mutation(async ({ input, ctx }) =>
      createInstallments(input, ctx.clinicId!, ctx.user!.sub, ctx.req.ip),
    ),
});

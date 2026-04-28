import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission, requireRoles } from '../../trpc/middleware/rbac.middleware.js';
import {
  createInvoiceSchema,
  updateInvoiceDraftSchema,
  listInvoicesSchema,
  cancelInvoiceSchema,
  applyDiscountSchema,
} from '@dermaos/shared';
import {
  listInvoices,
  getInvoiceById,
  getInvoiceItems,
  createInvoice,
  updateInvoiceDraft,
  emitInvoice,
  cancelInvoice,
} from './invoices.service.js';
import { withClinicContext, db } from '../../db/client.js';

export const invoicesRouter = router({
  list: protectedProcedure
    .use(requirePermission('financial', 'read'))
    .input(listInvoicesSchema)
    .query(async ({ input, ctx }) =>
      listInvoices(input, ctx.clinicId!),
    ),

  getById: protectedProcedure
    .use(requirePermission('financial', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) =>
      getInvoiceById(input.id, ctx.clinicId!),
    ),

  items: protectedProcedure
    .use(requirePermission('financial', 'read'))
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ input, ctx }) =>
      getInvoiceItems(input.invoiceId, ctx.clinicId!),
    ),

  create: protectedProcedure
    .use(requirePermission('financial', 'write'))
    .input(createInvoiceSchema)
    .mutation(async ({ input, ctx }) =>
      createInvoice(input, ctx.clinicId!, ctx.user!.sub, ctx.req.ip),
    ),

  updateDraft: protectedProcedure
    .use(requirePermission('financial', 'write'))
    .input(updateInvoiceDraftSchema)
    .mutation(async ({ input, ctx }) =>
      updateInvoiceDraft(input, ctx.clinicId!, ctx.user!.sub, ctx.req.ip),
    ),

  emit: protectedProcedure
    .use(requirePermission('financial', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) =>
      emitInvoice(input.id, ctx.clinicId!, ctx.user!.sub, ctx.req.ip),
    ),

  cancel: protectedProcedure
    .use(requirePermission('financial', 'write'))
    .input(cancelInvoiceSchema)
    .mutation(async ({ input, ctx }) =>
      cancelInvoice(input, ctx.clinicId!, ctx.user!.sub, ctx.req.ip),
    ),

  approveDiscount: protectedProcedure
    .use(requireRoles('owner', 'admin'))
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const invoice = await getInvoiceById(input.invoiceId, ctx.clinicId!);
      if (invoice.status !== 'rascunho') {
        throw new TRPCError({
          code:    'UNPROCESSABLE_CONTENT',
          message: 'Aprovação de desconto só é possível em faturas rascunho.',
        });
      }
      await withClinicContext(ctx.clinicId!, async (client) => {
        await client.query(
          `UPDATE financial.invoices
              SET discount_approved_by = $3, updated_by = $3
            WHERE id = $1 AND clinic_id = $2`,
          [input.invoiceId, ctx.clinicId!, ctx.user!.sub],
        );
      });
      await db.query(
        `INSERT INTO audit.domain_events
           (clinic_id, aggregate_type, aggregate_id, event_type, metadata)
         VALUES ($1,'financial_invoice',$2,'financial_invoice.discount_approved',$3)`,
        [ctx.clinicId!, input.invoiceId, JSON.stringify({ user_id: ctx.user!.sub })],
      );
      return getInvoiceById(input.invoiceId, ctx.clinicId!);
    }),

  // Resumo financeiro do paciente (total devido, pago, saldo)
  patientSummary: protectedProcedure
    .use(requirePermission('financial', 'read'))
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return withClinicContext(ctx.clinicId!, async (client) => {
        const r = await client.query<{
          total_invoiced: string;
          total_paid:     string;
          pending_count:  string;
        }>(
          `SELECT
             COALESCE(SUM(total_amount), 0) AS total_invoiced,
             COALESCE(SUM(amount_paid),  0) AS total_paid,
             COUNT(*) FILTER (WHERE status IN ('enviada','parcialmente_paga','vencida')) AS pending_count
           FROM financial.invoices
          WHERE patient_id = $1 AND clinic_id = $2
            AND status NOT IN ('rascunho','cancelada','estornada')`,
          [input.patientId, ctx.clinicId!],
        );
        const row = r.rows[0]!;
        return {
          totalInvoiced: parseInt(row.total_invoiced, 10),
          totalPaid:     parseInt(row.total_paid,     10),
          balance:       parseInt(row.total_invoiced, 10) - parseInt(row.total_paid, 10),
          pendingCount:  parseInt(row.pending_count,  10),
        };
      });
    }),
});

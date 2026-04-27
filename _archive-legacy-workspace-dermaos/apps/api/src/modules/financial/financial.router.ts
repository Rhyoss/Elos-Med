import { router } from '../../trpc/trpc.js';
import { catalogRouter }  from './catalog.router.js';
import { invoicesRouter } from './invoices.router.js';
import { paymentsRouter } from './payments.router.js';
import { caixaRouter }    from './caixa.router.js';

export const financialRouter = router({
  catalog:  catalogRouter,
  invoices: invoicesRouter,
  payments: paymentsRouter,
  caixa:    caixaRouter,
});

import { router } from './trpc.js';
import { authRouter } from '../modules/auth/auth.router.js';

/**
 * Root tRPC router — módulos adicionados aqui conforme implementados.
 */
export const appRouter = router({
  auth: authRouter,
  // clinical: clinicalRouter,
  // omni: omniRouter,
  // supply: supplyRouter,
  // financial: financialRouter,
  // analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;

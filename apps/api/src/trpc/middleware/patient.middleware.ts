import { TRPCError } from '@trpc/server';
import { t } from '../trpc.js';
import { withClinicScope } from './clinic-scope.middleware.js';
import type { PatientJwt } from '../../modules/auth/auth.types.js';

/**
 * SEC-21 — Middleware que exige um token do Patient Portal.
 *
 * Tokens emitidos para staff (aud=`dermaos-staff`) NÃO são aceitos aqui:
 * o `@fastify/jwt` namespace `patient` valida `aud=dermaos-patient` e
 * usa o cookie `patient_access_token` (não `access_token`). Isto impede
 * que um paciente ganhe acesso a procedures de staff (e vice-versa)
 * mesmo com adulteração de payload.
 */
export const isPatientAuthenticated = t.middleware(async ({ ctx, next }) => {
  // O `createContext` decodifica o JWT de staff. Para o portal, o token
  // está em outro cookie e usa outro namespace.
  let patient: PatientJwt | null = null;
  try {
    const verifier = (ctx.req.server as unknown as {
      patient: { verify: <T>(t: string) => T };
    }).patient;
    const cookieToken = ctx.req.cookies['patient_access_token'];
    if (cookieToken) {
      patient = verifier.verify<PatientJwt>(cookieToken);
    }
  } catch {
    // patient permanece null
  }

  if (!patient || !patient.clinicId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Autenticação do Patient Portal necessária',
    });
  }

  return next({
    ctx: {
      ...ctx,
      patient,
      clinicId: patient.clinicId,
      // Não copia `user` — pacientes NÃO têm role de staff e não devem
      // satisfazer `isAuthenticated`.
    },
  });
});

/**
 * Procedure dedicada ao Patient Portal — autentica via cookie/aud
 * `patient` E aplica o scope multi-tenant pela clínica do paciente.
 */
export const patientProcedure = t.procedure
  .use(isPatientAuthenticated)
  .use(withClinicScope);

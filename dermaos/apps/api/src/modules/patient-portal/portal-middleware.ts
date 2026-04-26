import type { FastifyRequest, FastifyReply } from 'fastify';
import type { PortalJwtPayload } from './portal-auth.service.js';
import { isAccessTokenBlacklisted } from './portal-auth.service.js';
import { redis } from '../../db/redis.js';

const PORTAL_AUDIENCE = 'patient-portal';

// Aumenta FastifyRequest para expor o contexto do paciente autenticado.
declare module 'fastify' {
  interface FastifyRequest {
    portalPatient: {
      id:       string;
      clinicId: string;
    };
  }
}

export async function verifyPortalToken(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const payload = await req.jwtVerify<PortalJwtPayload>();

    // Validar audience — token do portal não é aceito na API principal e vice-versa
    if (payload.aud !== PORTAL_AUDIENCE) {
      return reply.status(401).send({ error: 'Token inválido para este recurso.' });
    }

    // Verificar blacklist (tokens invalidados ao trocar senha / logout)
    if (await isAccessTokenBlacklisted(redis, payload.jti)) {
      return reply.status(401).send({ error: 'Sessão encerrada. Faça login novamente.' });
    }

    req.portalPatient = {
      id:       payload.sub,
      clinicId: payload.clinicId,
    };
  } catch {
    return reply.status(401).send({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}

// Garante que o recurso pertence ao paciente autenticado.
// Erro 403 (não 404) para não revelar existência de dados de outros pacientes.
export function assertOwnership(
  reply: FastifyReply,
  resourcePatientId: string,
  authenticatedPatientId: string,
): boolean {
  if (resourcePatientId !== authenticatedPatientId) {
    reply.status(403).send({ error: 'Acesso não autorizado.' });
    return false;
  }
  return true;
}

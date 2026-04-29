import type { FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/jwt';
import type { PoolClient } from 'pg';
import { db } from '../db/client.js';
import { redis } from '../db/redis.js';
import type { JwtUser, PatientJwt } from '../modules/auth/auth.types.js';

export interface TrpcContext {
  req: FastifyRequest;
  res: FastifyReply;
  db: typeof db;
  redis: typeof redis;
  user: JwtUser | null;
  /** SEC-21: token do Patient Portal — nunca preenchido junto com `user`. */
  patient: PatientJwt | null;
  clinicId: string | null;
}

export async function createContext({
  req,
  res,
}: {
  req: FastifyRequest;
  res: FastifyReply;
}): Promise<TrpcContext> {
  let user: JwtUser | null = null;
  let patient: PatientJwt | null = null;
  let clinicId: string | null = null;

  // SEC-06/14: tenta o JWT de staff (audience=dermaos-staff). Se falhar,
  // tenta o do Patient Portal (audience=dermaos-patient). Os dois cookies
  // são distintos e os dois plugins JWT têm chaves/audiences distintas —
  // não há possibilidade de cross-use mesmo com payload adulterado.
  try {
    const payload = await (req as FastifyRequest & {
      accessJwtVerify: <T>() => Promise<T>;
    }).accessJwtVerify<JwtUser>();
    user = payload;
    clinicId = payload.clinicId ?? null;
  } catch {
    try {
      const payload = await (req as FastifyRequest & {
        patientJwtVerify: <T>() => Promise<T>;
      }).patientJwtVerify<PatientJwt>();
      patient = payload;
      clinicId = payload.clinicId ?? null;
    } catch {
      // Nenhum token válido — rota pública ou middleware de auth vai rejeitar
    }
  }

  return {
    req,
    res,
    db,
    redis,
    user,
    patient,
    clinicId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

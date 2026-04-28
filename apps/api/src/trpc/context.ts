import type { FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/jwt';
import type { PoolClient } from 'pg';
import { db } from '../db/client.js';
import { redis } from '../db/redis.js';
import type { JwtUser } from '../modules/auth/auth.types.js';

export interface TrpcContext {
  req: FastifyRequest;
  res: FastifyReply;
  db: typeof db;
  redis: typeof redis;
  user: JwtUser | null;
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
  let clinicId: string | null = null;

  try {
    // JWT está em httpOnly cookie — Fastify JWT plugin decodifica automaticamente
    const payload = await req.jwtVerify<JwtUser>();
    user = payload;
    clinicId = payload.clinicId ?? null;
  } catch {
    // Token ausente ou inválido — rota pública ou middleware de auth vai rejeitar
  }

  return {
    req,
    res,
    db,
    redis,
    user,
    clinicId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

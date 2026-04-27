import type { FastifyRequest, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { db } from '../db/client.js';
import { redis } from '../db/redis.js';
import { correlationStore } from '../lib/logger.js';
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
    const payload = await req.jwtVerify<JwtUser>();
    user     = payload;
    clinicId = payload.clinicId ?? null;

    // Update correlation store with authenticated identity so that all
    // subsequent log calls in this request include userId + tenantId.
    const current = correlationStore.getStore();
    if (current) {
      correlationStore.enterWith({
        ...current,
        userId:   payload.sub,
        tenantId: clinicId ?? undefined,
      });
    }
  } catch {
    // Token absent or invalid — public route or auth middleware will reject
  }

  return { req, res, db, redis, user, clinicId };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

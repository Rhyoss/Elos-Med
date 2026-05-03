import '@fastify/cookie';
import '@fastify/jwt';
import type { FastifyJwtVerifyOptions, VerifyPayloadType } from '@fastify/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    accessJwtVerify<Decoded extends VerifyPayloadType>(options?: FastifyJwtVerifyOptions): Promise<Decoded>;
    accessJwtSign(payload: Record<string, unknown>, options?: object): Promise<string>;
    refreshJwtVerify<Decoded extends VerifyPayloadType>(options?: FastifyJwtVerifyOptions): Promise<Decoded>;
    refreshJwtSign(payload: Record<string, unknown>, options?: object): Promise<string>;
    patientJwtVerify<Decoded extends VerifyPayloadType>(options?: FastifyJwtVerifyOptions): Promise<Decoded>;
    patientJwtSign(payload: Record<string, unknown>, options?: object): Promise<string>;
  }
}


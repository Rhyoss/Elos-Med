import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { correlationStore } from './logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** UUID v4 for this request — propagated via X-Correlation-ID header */
    correlationId: string;
    /** hrtime.bigint() recorded at onRequest for precise duration calculation */
    startTimeNs: bigint;
  }
}

const correlationPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req, reply) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ?? randomUUID();

    req.correlationId = correlationId;
    req.startTimeNs   = process.hrtime.bigint();

    reply.header('x-correlation-id', correlationId);

    // enterWith() sets the store for this async execution context and all its
    // descendants (subsequent hooks, handler, any awaited calls within them).
    // Because Fastify processes hooks in the same async chain as the handler,
    // getStore() will return this value everywhere in the request lifecycle.
    correlationStore.enterWith({ correlationId });
  });
};

export default fp(correlationPlugin, { name: 'correlation-id', fastify: '5.x' });

import type { FastifyInstance } from 'fastify';
import '@fastify/jwt';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Gateway de Real-time por clínica (multi-tenant).
 * Cada conexão autentica via cookie httpOnly (mesmo JWT do tRPC) e
 * entra na sala "clinic:<clinicId>" para receber eventos isolados.
 */

let io: SocketIOServer | null = null;

interface AuthedSocketData {
  userId:   string;
  clinicId: string;
  role:     string;
}

function parseCookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const parts = header.split(';').map((p) => p.trim());
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return undefined;
}

export function initSocketGateway(app: FastifyInstance): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(app.server, {
    path: '/api/realtime',
    cors: {
      origin: env.NODE_ENV === 'development'
        ? ['http://localhost:3000']
        : [/\.dermaos\.com\.br$/],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const cookie = socket.request.headers.cookie;
      const token  = parseCookieValue(cookie, 'access_token');
      if (!token) {
        return next(new Error('UNAUTHORIZED: missing token'));
      }

      // SEC-06/21: usa o namespace `access` — tokens com aud=patient
      // (Patient Portal) NÃO conseguem entrar nas salas de staff.
      // @fastify/jwt expõe o namespace em `fastify.jwt[namespace]`.
      const payload = (app as unknown as {
        jwt: { access: { verify: <T>(t: string) => T } };
      }).jwt.access.verify<{ sub: string; clinicId: string; role: string }>(token);
      const data: AuthedSocketData = {
        userId:   payload.sub,
        clinicId: payload.clinicId,
        role:     payload.role,
      };
      (socket.data as AuthedSocketData) = data;
      next();
    } catch (err) {
      logger.warn({ err }, 'Socket auth failed');
      next(new Error('UNAUTHORIZED: invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as AuthedSocketData;
    const room = `clinic:${data.clinicId}`;
    void socket.join(room);

    logger.debug({ userId: data.userId, clinicId: data.clinicId }, 'Socket connected');

    socket.on('disconnect', (reason) => {
      logger.debug({ userId: data.userId, reason }, 'Socket disconnected');
    });

    // Ping manual para medir latência do lado do cliente
    socket.on('ping', (cb?: (ts: number) => void) => {
      if (typeof cb === 'function') cb(Date.now());
    });
  });

  logger.info('Socket.io gateway initialized at /api/realtime');
  return io;
}

/**
 * Emite um evento para todos os sockets conectados de uma clínica.
 * Safe-noop se o gateway não foi inicializado (testes/CLI).
 */
export function emitToClinic(
  clinicId: string,
  event:    string,
  payload:  Record<string, unknown>,
): void {
  if (!io) return;
  io.to(`clinic:${clinicId}`).emit(event, {
    ...payload,
    emittedAt: new Date().toISOString(),
  });
}

export function getIO(): SocketIOServer | null {
  return io;
}

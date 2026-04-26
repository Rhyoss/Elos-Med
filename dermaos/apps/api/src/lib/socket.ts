import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { redis } from '../db/redis.js';
import { incrementConnections, decrementConnections } from '../realtime/metrics.js';

/**
 * DermaOS Real-time Gateway (Socket.io v4).
 *
 * Tenant isolation: every emit is scoped to a room derived from clinicId.
 * Rooms per connection:
 *   {clinicId}:general  — all authenticated clinic staff (alerts, broadcasts)
 *   {clinicId}:inbox    — staff with inbox access (omni messages)
 *   {clinicId}:queue    — staff with queue access (appointment queue)
 *   user:{userId}       — personal notifications
 *
 * Auth: JWT from handshake.auth.token > Authorization header > httpOnly cookie.
 * Active user check: Redis `dermaos:deactivated:{userId}` key (TTL-cached 60s).
 */

let io: SocketIOServer | null = null;

// Internal EventEmitter for in-process ack signaling
import { EventEmitter } from 'node:events';
export const socketInternalEvents = new EventEmitter();
socketInternalEvents.setMaxListeners(200);

export interface AuthedSocketData {
  userId: string;
  tenantId: string;
  role: string;
}

const QUEUE_ROLES = new Set(['admin', 'director', 'doctor', 'receptionist', 'nurse']);
const INBOX_ROLES = new Set(['admin', 'director', 'doctor', 'receptionist']);

// Server-side client-event throttle (key → last emit timestamp ms)
const clientThrottle = new Map<string, number>();

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseCookieToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq !== -1 && trimmed.slice(0, eq) === 'access_token') {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return undefined;
}

async function verifyJwt(
  app: FastifyInstance,
  token: string,
): Promise<{ sub: string; clinicId: string; role: string } | null> {
  try {
    return app.jwt.verify<{ sub: string; clinicId: string; role: string }>(token);
  } catch {
    return null;
  }
}

async function checkUserActive(userId: string): Promise<boolean> {
  const cacheKey = `dermaos:socket:active:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) return cached === '1';
  const deactivated = await redis.exists(`dermaos:deactivated:${userId}`);
  const active = deactivated === 0;
  await redis.set(cacheKey, active ? '1' : '0', 'EX', 60);
  return active;
}

// ─── gateway init ─────────────────────────────────────────────────────────────

export function initSocketGateway(app: FastifyInstance): SocketIOServer {
  if (io) return io;

  // Dedicated ioredis clients for Socket.io Redis adapter (pub/sub cannot mix with regular commands)
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();

  const allowedOrigins: (string | RegExp)[] =
    env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:3002']
      : [/\.dermaos\.com\.br$/];

  io = new SocketIOServer(app.server, {
    path: '/api/realtime',
    cors: { origin: allowedOrigins, credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
    perMessageDeflate: { threshold: 1_024 },
  });

  io.adapter(createAdapter(pubClient, subClient));

  // ─── Auth middleware ────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      // 1. handshake.auth.token (preferred — mobile / non-browser)
      let token: string | undefined =
        typeof socket.handshake.auth?.token === 'string'
          ? socket.handshake.auth.token
          : undefined;

      // 2. Authorization: Bearer <token>
      if (!token) {
        const authHeader = socket.handshake.headers.authorization;
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
          token = authHeader.slice(7);
        }
      }

      // 3. httpOnly cookie (web browser — withCredentials: true)
      if (!token) {
        token = parseCookieToken(socket.handshake.headers.cookie);
      }

      if (!token) {
        socket.emit('auth_error', { code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
        return next(new Error('UNAUTHORIZED: missing token'));
      }

      const payload = await verifyJwt(app, token);
      if (!payload) {
        socket.emit('auth_error', { code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
        return next(new Error('UNAUTHORIZED: invalid token'));
      }

      const active = await checkUserActive(payload.sub);
      if (!active) {
        socket.emit('auth_error', { code: 'UNAUTHORIZED', message: 'Usuário inativo.' });
        return next(new Error('UNAUTHORIZED: inactive user'));
      }

      socket.data = {
        userId: payload.sub,
        tenantId: payload.clinicId,
        role: payload.role,
      } satisfies AuthedSocketData;

      next();
    } catch (err) {
      logger.warn({ err }, 'Socket.io auth middleware error');
      socket.emit('auth_error', { code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
      next(new Error('UNAUTHORIZED'));
    }
  });

  // ─── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const { userId, tenantId, role } = socket.data as AuthedSocketData;

    // Join rooms — always general + personal
    void socket.join(`${tenantId}:general`);
    void socket.join(`user:${userId}`);
    if (QUEUE_ROLES.has(role)) void socket.join(`${tenantId}:queue`);
    if (INBOX_ROLES.has(role)) void socket.join(`${tenantId}:inbox`);

    incrementConnections(tenantId);
    logger.info(
      { userId, tenantId, role, socketId: socket.id, timestamp: new Date().toISOString() },
      'Socket connected',
    );

    // ── token_refresh ─────────────────────────────────────────────────────────
    socket.on('token_refresh', async (newToken: unknown) => {
      if (typeof newToken !== 'string') {
        socket.emit('auth_error', { code: 'INVALID_TOKEN', message: 'Token inválido.' });
        socket.disconnect(true);
        return;
      }
      const payload = await verifyJwt(app, newToken);
      if (!payload || payload.sub !== userId) {
        socket.emit('auth_error', { code: 'UNAUTHORIZED', message: 'Token inválido.' });
        socket.disconnect(true);
        return;
      }
      // Reset active-user cache so next check re-queries
      await redis.set(`dermaos:socket:active:${userId}`, '1', 'EX', 60);
    });

    // ── notification:ack ──────────────────────────────────────────────────────
    socket.on('notification:ack', (data: unknown) => {
      if (typeof data !== 'object' || !data) return;
      const notificationId = (data as Record<string, unknown>).notification_id;
      if (typeof notificationId !== 'string') return;
      socketInternalEvents.emit('notification:acked', { notificationId, userId, tenantId });
    });

    // ── alert:ack ─────────────────────────────────────────────────────────────
    socket.on('alert:ack', (data: unknown) => {
      if (typeof data !== 'object' || !data) return;
      const alertId = (data as Record<string, unknown>).alert_id;
      if (typeof alertId !== 'string') return;
      logger.info(
        { userId, tenantId, alertId, timestamp: new Date().toISOString() },
        'alert:critical acknowledged',
      );
      socketInternalEvents.emit('alert:acked', { alertId, userId, tenantId });
    });

    // ── inbox:typing_start (client → server → other clients in same clinic) ───
    // Rate-limited: max 1 emit per conversation per second.
    socket.on('inbox:typing_start', (data: unknown) => {
      if (typeof data !== 'object' || !data) return;
      const conversationId = (data as Record<string, unknown>).conversation_id;
      if (typeof conversationId !== 'string') return;

      const key = `typing:${tenantId}:${conversationId}`;
      const now = Date.now();
      if (now - (clientThrottle.get(key) ?? 0) < 1_000) return;
      clientThrottle.set(key, now);

      // Emit only within tenant inbox room — never cross-tenant
      io!.to(`${tenantId}:inbox`).emit('inbox:typing', {
        conversation_id: conversationId,
        is_typing: true,
        emittedAt: new Date().toISOString(),
      });
    });

    // ── ping (latency probe) ─────────────────────────────────────────────────
    socket.on('ping', (cb?: (ts: number) => void) => {
      if (typeof cb === 'function') cb(Date.now());
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      decrementConnections(tenantId);
      logger.info(
        { userId, tenantId, socketId: socket.id, reason, timestamp: new Date().toISOString() },
        'Socket disconnected',
      );
    });
  });

  // Periodic cleanup of stale throttle entries (older than 30s)
  setInterval(() => {
    const cutoff = Date.now() - 30_000;
    for (const [key, ts] of clientThrottle) {
      if (ts < cutoff) clientThrottle.delete(key);
    }
  }, 30_000).unref();

  logger.info('Socket.io gateway initialized at /api/realtime (Redis adapter active)');
  return io;
}

// ─── Emit helpers (always tenant-scoped, never global broadcast) ──────────────

export function emitToClinic(
  clinicId: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  io?.to(`${clinicId}:general`).emit(event, { ...payload, emittedAt: new Date().toISOString() });
}

export function emitToInbox(
  clinicId: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  io?.to(`${clinicId}:inbox`).emit(event, { ...payload, emittedAt: new Date().toISOString() });
}

export function emitToQueue(
  clinicId: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  io?.to(`${clinicId}:queue`).emit(event, { ...payload, emittedAt: new Date().toISOString() });
}

export function emitToUser(
  userId: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  io?.to(`user:${userId}`).emit(event, { ...payload, emittedAt: new Date().toISOString() });
}

export function getIO(): SocketIOServer | null {
  return io;
}

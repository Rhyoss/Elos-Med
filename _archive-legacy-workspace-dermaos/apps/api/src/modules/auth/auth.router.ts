import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requireRoles } from '../../trpc/middleware/rbac.middleware.js';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@dermaos/shared';
import {
  registerUser,
  verifyPassword,
  storeRefreshToken,
  validateAndRevokeRefreshToken,
  revokeRefreshToken,
  changePassword,
  forgotPassword,
  resetPassword,
} from './auth.service.js';
import { getPermissionsForRole } from '@dermaos/shared';
import type { UserRole } from '@dermaos/shared';
import { eventBus } from '../../events/event-bus.js';
import {
  recordLoginIp,
  recordSecurityEvent,
  blacklistJti,
  bumpPasswordVersion,
  touchActivity,
  clearActivity,
  newJti,
  geoLookup,
} from '../security/session.service.js';
import { checkPasswordResetLimit } from '../../lib/rate-limit.js';

const COOKIE_OPTS_BASE = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax' as const,
};

function setAuthCookies(
  res: import('fastify').FastifyReply,
  accessToken: string,
  refreshToken: string,
) {
  res.setCookie('access_token', accessToken, {
    ...COOKIE_OPTS_BASE,
    path: '/',
    maxAge: 900, // 15 min
  });
  res.setCookie('refresh_token', refreshToken, {
    ...COOKIE_OPTS_BASE,
    path: '/',
    maxAge: 604_800, // 7 dias
  });
}

function clearAuthCookies(res: import('fastify').FastifyReply) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
}

export const authRouter = router({
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;

      const result = await ctx.db.query<{
        id: string; clinic_id: string; name: string; email: string;
        password_hash: string; role: string; is_active: boolean;
        failed_login_attempts: number; locked_until: string | null;
        clinic_slug: string; clinic_active: boolean; clinic_name: string;
        password_version: number;
      }>(
        `SELECT u.id, u.clinic_id, u.name, u.email, u.password_hash, u.role,
                u.is_active, u.failed_login_attempts, u.locked_until,
                u.password_version,
                c.slug AS clinic_slug, c.name AS clinic_name, c.is_active AS clinic_active
         FROM shared.users u
         JOIN shared.clinics c ON c.id = u.clinic_id
         WHERE u.email = $1
         LIMIT 1`,
        [email],
      );

      const user = result.rows[0];
      const invalidCredentials = new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Email ou senha inválidos',
      });

      if (!user) throw invalidCredentials;

      if (!user.is_active || !user.clinic_active) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Conta desativada' });
      }

      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const remaining = Math.ceil(
          (new Date(user.locked_until).getTime() - Date.now()) / 60_000,
        );
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Conta bloqueada. Tente novamente em ${remaining} minuto(s).`,
        });
      }

      const passwordValid = await verifyPassword(user.password_hash, password);

      if (!passwordValid) {
        await ctx.db.query(
          `UPDATE shared.users
           SET failed_login_attempts = failed_login_attempts + 1,
               locked_until = CASE
                 WHEN failed_login_attempts + 1 >= 5
                 THEN NOW() + INTERVAL '30 minutes'
                 ELSE locked_until
               END
           WHERE id = $1`,
          [user.id],
        );

        if (user.failed_login_attempts + 1 >= 5) {
          await eventBus.publish('user.locked', user.clinic_id, user.id, {}, {
            ip: ctx.req.ip,
          });
        }

        throw invalidCredentials;
      }

      await ctx.db.query(
        `UPDATE shared.users
         SET failed_login_attempts = 0, locked_until = NULL,
             last_login_at = NOW(), last_login_ip = $2
         WHERE id = $1`,
        [user.id, ctx.req.ip],
      );

      const jti = newJti();
      const payload = {
        sub: user.id,
        clinicId: user.clinic_id,
        email: user.email,
        role: user.role,
        name: user.name,
        pv: user.password_version,
        jti,
      };

      const accessToken = ctx.req.server.jwt.sign(payload, { expiresIn: '15m' });
      const refreshToken = ctx.req.server.jwt.sign(
        { sub: user.id, type: 'refresh', pv: user.password_version },
        { expiresIn: '7d' },
      );

      await storeRefreshToken(ctx.redis, user.id, refreshToken);
      setAuthCookies(ctx.res, accessToken, refreshToken);

      // Inicia janela de inatividade
      await touchActivity(ctx.redis, user.id);

      // Detecta IP novo — não bloqueia, apenas alerta
      const ipDetect = await recordLoginIp(ctx.db, user.id, ctx.req.ip ?? '0.0.0.0');
      if (ipDetect.isNewIp) {
        const geo = geoLookup(ctx.req.ip ?? '0.0.0.0');
        await recordSecurityEvent(ctx.db, {
          clinicId:  user.clinic_id,
          userId:    user.id,
          eventType: 'login.new_ip',
          severity:  'warning',
          ip:        ctx.req.ip ?? null,
          userAgent: (ctx.req.headers['user-agent'] as string | undefined) ?? null,
          metadata:  { geo },
        });
        // Email de alerta — best-effort, não falha login
        try {
          const { sendNewIpAlertEmail } = await import('../../lib/mailer.js');
          await sendNewIpAlertEmail(user.email, user.name, ctx.req.ip ?? 'desconhecido', geo);
        } catch (err) {
          // logger silenciado para evitar PII em logs — apenas evento
        }
      }

      await eventBus.publish('user.login', user.clinic_id, user.id, {}, {
        userId: user.id,
        ip: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
        newIp: ipDetect.isNewIp,
      });

      return {
        user: {
          id: user.id,
          clinicId: user.clinic_id,
          clinicSlug: user.clinic_slug,
          clinicName: user.clinic_name,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
          permissions: getPermissionsForRole(user.role as UserRole),
        },
      };
    }),

  register: protectedProcedure
    .use(requireRoles('owner', 'admin'))
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      // Só pode criar usuários na própria clínica
      if (input.clinicId !== ctx.clinicId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é possível criar usuários em outra clínica' });
      }

      const newUser = await registerUser(ctx.db, {
        clinicId: input.clinicId,
        name: input.name,
        email: input.email,
        password: input.password,
        role: input.role,
      });

      return { user: newUser };
    }),

  refresh: publicProcedure.mutation(async ({ ctx }) => {
    const refreshToken = ctx.req.cookies['refresh_token'];

    if (!refreshToken) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token ausente' });
    }

    let decoded: { sub: string; type?: string };
    try {
      decoded = ctx.req.server.jwt.verify<{ sub: string; type: string }>(refreshToken);
    } catch {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token inválido' });
    }

    if (decoded.type !== 'refresh') {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token inválido' });
    }

    const valid = await validateAndRevokeRefreshToken(ctx.redis, decoded.sub, refreshToken);
    if (!valid) {
      clearAuthCookies(ctx.res);
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token expirado ou já utilizado' });
    }

    const userResult = await ctx.db.query<{
      id: string; clinic_id: string; name: string; email: string;
      role: string; is_active: boolean;
    }>(
      'SELECT id, clinic_id, name, email, role, is_active FROM shared.users WHERE id = $1',
      [decoded.sub],
    );

    const user = userResult.rows[0];
    if (!user || !user.is_active) {
      clearAuthCookies(ctx.res);
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Usuário não encontrado ou inativo' });
    }

    const payload = {
      sub: user.id,
      clinicId: user.clinic_id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const newAccessToken = ctx.req.server.jwt.sign(payload, { expiresIn: '15m' });
    const newRefreshToken = ctx.req.server.jwt.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    await storeRefreshToken(ctx.redis, user.id, newRefreshToken);
    setAuthCookies(ctx.res, newAccessToken, newRefreshToken);

    return { ok: true };
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await revokeRefreshToken(ctx.redis, ctx.user.sub);
    clearAuthCookies(ctx.res);
    await clearActivity(ctx.redis, ctx.user.sub);

    // Blacklist do JTI — token ainda válido por TTL não pode ser reutilizado
    const jti = (ctx.user as { jti?: string }).jti;
    const exp = (ctx.user as { exp?: number }).exp;
    if (jti) {
      const remaining = exp ? Math.max(60, exp - Math.floor(Date.now() / 1_000)) : 900;
      await blacklistJti(ctx.redis, jti, remaining);
    }

    await eventBus.publish('user.logout', ctx.clinicId!, ctx.user.sub, {}, {
      userId: ctx.user.sub,
      ip: ctx.req.ip,
    });

    return { success: true };
  }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ input, ctx }) => {
      await changePassword(
        ctx.db,
        ctx.redis,
        ctx.user.sub,
        ctx.clinicId!,
        input.currentPassword,
        input.newPassword,
      );

      // Invalida todas as sessões anteriores: incrementa password_version
      // (middleware sessionHardening rejeita JWTs com pv divergente)
      await bumpPasswordVersion(ctx.redis, ctx.db, ctx.user.sub);
      clearAuthCookies(ctx.res);
      await clearActivity(ctx.redis, ctx.user.sub);

      await recordSecurityEvent(ctx.db, {
        clinicId:  ctx.clinicId!,
        userId:    ctx.user.sub,
        eventType: 'auth.password_changed',
        severity:  'info',
        ip:        ctx.req.ip ?? null,
        userAgent: (ctx.req.headers['user-agent'] as string | undefined) ?? null,
      });

      await eventBus.publish('user.password_changed', ctx.clinicId!, ctx.user.sub, {}, {
        userId: ctx.user.sub,
        ip: ctx.req.ip,
      });

      return { success: true };
    }),

  forgotPassword: publicProcedure
    .input(forgotPasswordSchema)
    .mutation(async ({ input, ctx }) => {
      // Rate limit: 3 req/hora por email — sem vazar resultado
      const limit = await checkPasswordResetLimit(input.email);
      if (!limit.allowed) {
        // Mensagem genérica — não distingue rate limit de email inexistente
        return { success: true };
      }
      await forgotPassword(ctx.db, ctx.redis, input.email);
      // Resposta sempre ok para não vazar existência de emails
      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ input, ctx }) => {
      await resetPassword(ctx.db, ctx.redis, input.token, input.newPassword);
      clearAuthCookies(ctx.res);
      return { success: true };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.query<{
      id: string; clinic_id: string; name: string; email: string; role: string;
      avatar_url: string | null; crm: string | null; specialty: string | null;
      clinic_name: string; clinic_slug: string; logo_url: string | null;
    }>(
      `SELECT u.id, u.clinic_id, u.name, u.email, u.role, u.avatar_url,
              u.crm, u.specialty,
              c.name AS clinic_name, c.slug AS clinic_slug, c.logo_url
       FROM shared.users u
       JOIN shared.clinics c ON c.id = u.clinic_id
       WHERE u.id = $1 AND u.clinic_id = $2 AND u.is_active = TRUE`,
      [ctx.user.sub, ctx.clinicId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
    }

    return {
      user: {
        id: row.id,
        clinicId: row.clinic_id,
        clinicSlug: row.clinic_slug,
        name: row.name,
        email: row.email,
        role: row.role as UserRole,
        avatarUrl: row.avatar_url,
        crm: row.crm,
        specialty: row.specialty,
      },
      clinic: {
        id: row.clinic_id,
        name: row.clinic_name,
        slug: row.clinic_slug,
        logoUrl: row.logo_url,
      },
      permissions: getPermissionsForRole(row.role as UserRole),
    };
  }),
});

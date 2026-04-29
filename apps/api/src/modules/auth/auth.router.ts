import crypto from 'node:crypto';
import { z } from 'zod';
import '@fastify/cookie';
import '@fastify/jwt';
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

const COOKIE_OPTS_BASE = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax' as const,
};

/**
 * Helper para acessar os 3 namespaces JWT registrados no bootstrap
 * (SEC-06/21): `access`, `refresh`, `patient`. Cada um tem seu próprio
 * segredo + audience.
 */
type JwtNamespace = 'access' | 'refresh' | 'patient';
type JwtNamespaceAPI = {
  sign:   (payload: Record<string, unknown>, opts?: Record<string, unknown>) => string;
  verify: <T>(token: string) => T;
};

function serverJwt(ctx: { req: { server: unknown } }, ns: JwtNamespace): JwtNamespaceAPI {
  const server = ctx.req.server as Record<JwtNamespace, JwtNamespaceAPI>;
  return server[ns];
}

// SEC-11: verifica um hash dummy de mesmo custo argon2 para uniformizar
// timing entre o caso "user existe" e "user não existe / invite pendente".
// O hash é gerado uma vez e reusado.
const DUMMY_PASSWORD = 'never-matched-' + crypto.randomBytes(16).toString('hex');
let DUMMY_HASH_PROMISE: Promise<string> | null = null;
async function dummyHash(): Promise<string> {
  if (!DUMMY_HASH_PROMISE) {
    DUMMY_HASH_PROMISE = (await import('./auth.service.js')).hashPassword(DUMMY_PASSWORD);
  }
  return DUMMY_HASH_PROMISE;
}
async function dummyPasswordCheck(): Promise<void> {
  const { verifyPassword: vp } = await import('./auth.service.js');
  await vp(await dummyHash(), 'never-matches').catch(() => undefined);
}

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

      // SEC-02: rota pré-tenant — usa função SECURITY DEFINER que pertence a
      // `dermaos_authn` (BYPASSRLS). Único caminho permitido para ler
      // shared.users sem clinic_id no contexto.
      const result = await ctx.db.query<{
        id: string; clinic_id: string; name: string; email: string;
        password_hash: string | null; password_version: number;
        is_invite_pending: boolean;
        role: string; is_active: boolean;
        failed_login_attempts: number; locked_until: string | null;
        clinic_slug: string; clinic_active: boolean; clinic_name: string;
      }>(
        `SELECT * FROM shared.find_user_for_login($1)`,
        [email],
      );

      const user = result.rows[0];
      const invalidCredentials = new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Email ou senha inválidos',
      });

      // SEC-11: trata user-not-found, invite-pending e password-hash-null
      // como o MESMO erro (anti-enumeração + anti-oracle).
      // Para uniformizar tempo de resposta com o caminho válido, executamos
      // uma verificação argon2 dummy no caso falho.
      if (!user || user.is_invite_pending || !user.password_hash) {
        await dummyPasswordCheck();
        throw invalidCredentials;
      }

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
          `SELECT * FROM shared.register_login_failure($1, $2)`,
          [user.id, ctx.req.ip],
        );

        if (user.failed_login_attempts + 1 >= 5) {
          await eventBus.publish('user.locked', user.clinic_id, user.id, {}, {
            ip: ctx.req.ip,
          });
        }

        throw invalidCredentials;
      }

      await ctx.db.query(
        `SELECT shared.register_login_success($1, $2)`,
        [user.id, ctx.req.ip],
      );

      const payload = {
        sub: user.id,
        clinicId: user.clinic_id,
        email: user.email,
        role: user.role,
        name: user.name,
      };

      // SEC-06: cada token é assinado pelo seu próprio plugin (chaves
      // distintas + audience distinta). SEC-14: jti único por sessão.
      const jti = crypto.randomUUID();
      const accessToken  = serverJwt(ctx, 'access').sign({ ...payload, jti });
      const refreshToken = serverJwt(ctx, 'refresh').sign({ sub: user.id, jti });

      await storeRefreshToken(ctx.redis, user.id, jti, refreshToken);
      setAuthCookies(ctx.res, accessToken, refreshToken);

      await eventBus.publish('user.login', user.clinic_id, user.id, {}, {
        userId: user.id,
        ip: ctx.req.ip,
        ...(ctx.req.headers['user-agent'] ? { userAgent: ctx.req.headers['user-agent'] } : {}),
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

    // SEC-06: refresh token usa segredo PRÓPRIO + audience distinta
    // (`dermaos-refresh`). Acesso tokens NÃO podem ser reapresentados aqui.
    let decoded: { sub: string; jti?: string };
    try {
      decoded = serverJwt(ctx, 'refresh').verify<{ sub: string; jti: string }>(refreshToken);
    } catch {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token inválido' });
    }

    if (!decoded.jti) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token sem jti' });
    }

    const valid = await validateAndRevokeRefreshToken(ctx.redis, decoded.sub, decoded.jti, refreshToken);
    if (!valid) {
      clearAuthCookies(ctx.res);
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token expirado ou já utilizado' });
    }

    // SEC-02: pré-tenant — usa função SECURITY DEFINER.
    const userResult = await ctx.db.query<{
      id: string; clinic_id: string; name: string; email: string;
      role: string; is_active: boolean;
    }>(
      `SELECT * FROM shared.find_user_for_refresh($1)`,
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

    // SEC-14: rotação de jti em cada refresh — refresh token reutilizado é
    // rejeitado (validateAndRevokeRefreshToken já invalidou o antigo).
    const newJti = crypto.randomUUID();
    const newAccessToken  = serverJwt(ctx, 'access').sign({ ...payload, jti: newJti });
    const newRefreshToken = serverJwt(ctx, 'refresh').sign({ sub: user.id, jti: newJti });

    await storeRefreshToken(ctx.redis, user.id, newJti, newRefreshToken);
    setAuthCookies(ctx.res, newAccessToken, newRefreshToken);

    return { ok: true };
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // SEC-14: logout do dispositivo atual (jti vem do access token).
    // Outras sessões ativas do usuário continuam válidas.
    const jti = (ctx.user as { jti?: string }).jti;
    await revokeRefreshToken(ctx.redis, ctx.user.sub, jti);
    clearAuthCookies(ctx.res);

    await eventBus.publish('user.logout', ctx.clinicId!, ctx.user.sub, {}, {
      userId: ctx.user.sub,
      ip: ctx.req.ip,
    });

    return { success: true };
  }),

  // SEC-14: logout em TODOS os dispositivos do usuário.
  logoutAllDevices: protectedProcedure.mutation(async ({ ctx }) => {
    await revokeRefreshToken(ctx.redis, ctx.user.sub); // sem jti = revoga tudo
    clearAuthCookies(ctx.res);
    await eventBus.publish('user.logout', ctx.clinicId!, ctx.user.sub, { allDevices: true }, {
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

      await eventBus.publish('user.password_changed', ctx.clinicId!, ctx.user.sub, {}, {
        userId: ctx.user.sub,
        ip: ctx.req.ip,
      });

      return { success: true };
    }),

  forgotPassword: publicProcedure
    .input(forgotPasswordSchema)
    .mutation(async ({ input, ctx }) => {
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

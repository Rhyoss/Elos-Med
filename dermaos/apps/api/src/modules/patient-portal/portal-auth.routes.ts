import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { db } from '../../db/client.js';
import { redis } from '../../db/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import {
  portalLoginSchema,
  portalSetPasswordSchema,
  portalChangePasswordSchema,
  portalForgotPasswordSchema,
} from './portal.schemas.js';
import {
  findPortalPatient,
  hashPortalPassword,
  verifyPortalPassword,
  recordLoginAttempt,
  updateFailedAttempts,
  resetFailedAttempts,
  createMagicLink,
  consumeMagicLink,
  createRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
  blacklistAccessToken,
  isCaptchaRequiredForIp,
  incrementIpAttempts,
  resetIpAttempts,
  type PortalJwtPayload,
} from './portal-auth.service.js';
import { verifyPortalToken } from './portal-middleware.js';
import {
  sendMagicLinkEmail,
  sendAccountLockedEmail,
} from './portal-email.service.js';

const PORTAL_AUDIENCE  = 'patient-portal';
const COOKIE_OPTS = {
  httpOnly:  true,
  secure:    env.NODE_ENV === 'production',
  sameSite:  'strict' as const,
  path:      '/',
};

function getLockDurationLabel(attempts: number): string {
  if (attempts >= 15) return '24 horas';
  if (attempts >= 10) return '1 hora';
  return '15 minutos';
}

export async function registerPortalAuthRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /portal/auth/login ──────────────────────────────────────────────────
  app.post('/auth/login', async (req, reply) => {
    const parsed = portalLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos.' });
    }

    const { email, password, clinicSlug, captchaToken } = parsed.data;
    const ip = req.ip;

    // CAPTCHA obrigatório após 3 tentativas de IP (verificado no cliente)
    const captchaRequired = await isCaptchaRequiredForIp(redis, ip);
    if (captchaRequired && !captchaToken) {
      return reply.status(400).send({
        error: 'Verificação CAPTCHA necessária.',
        captchaRequired: true,
      });
    }

    // Validar CAPTCHA token se presente
    if (captchaToken && env.PORTAL_CAPTCHA_SECRET) {
      const ok = await verifyCaptcha(captchaToken, env.PORTAL_CAPTCHA_SECRET, ip);
      if (!ok) {
        return reply.status(400).send({ error: 'Verificação CAPTCHA inválida.' });
      }
    }

    // Buscar paciente — sempre responde com tempo similar (anti-timing)
    const patient = await findPortalPatient(db, email, clinicSlug);

    // Dummy hash para comparação de tempo constante quando paciente não existe
    const dummyHash = '$2b$12$KIXgV4yQ.pJFfh6oHQ.dIuW5AQ3BXDiA1C8PbCJQe3g0K1iCN2ZE6';

    if (!patient) {
      await verifyPortalPassword(dummyHash, password); // consume same time
      await recordLoginAttempt(db, email, 'email', false, ip);
      await incrementIpAttempts(redis, ip);
      return reply.status(401).send({ error: 'E-mail ou senha incorretos.' });
    }

    // Verificar portal habilitado e paciente ativo
    if (!patient.portal_enabled || patient.status !== 'active') {
      await verifyPortalPassword(dummyHash, password);
      return reply.status(403).send({ error: 'Acesso ao portal não disponível.' });
    }

    // Verificar lockout
    if (patient.portal_locked_until && new Date() < patient.portal_locked_until) {
      await verifyPortalPassword(dummyHash, password);
      return reply.status(429).send({
        error: 'Conta temporariamente bloqueada. Verifique seu e-mail para desbloquear.',
        lockedUntil: patient.portal_locked_until.toISOString(),
      });
    }

    // Senha ainda não definida (primeiro acesso pendente)
    if (!patient.portal_password_hash) {
      await verifyPortalPassword(dummyHash, password);
      return reply.status(401).send({
        error: 'Acesso não configurado. Verifique o e-mail de primeiro acesso.',
      });
    }

    const valid = await verifyPortalPassword(patient.portal_password_hash, password);

    if (!valid) {
      const newAttempts = patient.portal_failed_attempts + 1;
      await updateFailedAttempts(db, patient.id, newAttempts);
      await recordLoginAttempt(db, email, 'email', false, ip);
      await incrementIpAttempts(redis, ip);

      // Notificar por e-mail se lockout ocorreu agora
      if (newAttempts === 5 || newAttempts === 10 || newAttempts === 15) {
        try {
          const unlockToken = await createMagicLink(db, patient.id, 'account_unlock', {}, ip);
          const unlockUrl = `${env.PORTAL_URL}/desbloquear/${unlockToken}`;
          await sendAccountLockedEmail(
            email,
            email, // nome não disponível sem descriptografar; usa e-mail
            unlockUrl,
            getLockDurationLabel(newAttempts),
          );
        } catch (err) {
          logger.warn({ err }, 'Failed to send lockout email');
        }
      }

      return reply.status(401).send({ error: 'E-mail ou senha incorretos.' });
    }

    // Login bem-sucedido
    await resetFailedAttempts(db, patient.id, ip);
    await recordLoginAttempt(db, email, 'email', true, ip);
    await resetIpAttempts(redis, ip);

    const jti = crypto.randomUUID();
    const accessToken = app.jwt.sign(
      {
        sub:      patient.id,
        clinicId: patient.clinic_id,
        aud:      PORTAL_AUDIENCE,
        jti,
      } satisfies Omit<PortalJwtPayload, 'iat' | 'exp'>,
      { expiresIn: '15m' },
    );

    const refreshToken = await createRefreshToken(
      db, patient.id, null, ip, req.headers['user-agent'] ?? null,
    );

    return reply
      .setCookie('portal_access_token', accessToken, {
        ...COOKIE_OPTS,
        maxAge: 15 * 60,
      })
      .setCookie('portal_refresh_token', refreshToken, {
        ...COOKIE_OPTS,
        maxAge: 7 * 24 * 3600,
      })
      .send({
        ok: true,
        emailVerified: patient.portal_email_verified,
      });
  });

  // ── POST /portal/auth/refresh ────────────────────────────────────────────────
  app.post('/auth/refresh', async (req, reply) => {
    const oldToken = req.cookies['portal_refresh_token'];
    if (!oldToken) {
      return reply.status(401).send({ error: 'Sessão expirada. Faça login novamente.' });
    }

    const result = await rotateRefreshToken(
      db,
      oldToken,
      req.ip,
      req.headers['user-agent'] ?? null,
    );

    if (!result) {
      reply.clearCookie('portal_access_token').clearCookie('portal_refresh_token');
      return reply.status(401).send({ error: 'Sessão inválida. Faça login novamente.' });
    }

    // Buscar clinicId atual do paciente
    const pr = await db.query<{ clinic_id: string }>(
      'SELECT clinic_id FROM shared.patients WHERE id = $1 AND deleted_at IS NULL',
      [result.patientId],
    );
    if (!pr.rows[0]) {
      return reply.status(401).send({ error: 'Sessão inválida.' });
    }

    const jti = crypto.randomUUID();
    const accessToken = app.jwt.sign(
      {
        sub:      result.patientId,
        clinicId: pr.rows[0].clinic_id,
        aud:      PORTAL_AUDIENCE,
        jti,
      } satisfies Omit<PortalJwtPayload, 'iat' | 'exp'>,
      { expiresIn: '15m' },
    );

    return reply
      .setCookie('portal_access_token', accessToken, {
        ...COOKIE_OPTS,
        maxAge: 15 * 60,
      })
      .setCookie('portal_refresh_token', result.newToken, {
        ...COOKIE_OPTS,
        maxAge: 7 * 24 * 3600,
      })
      .send({ ok: true });
  });

  // ── POST /portal/auth/logout ─────────────────────────────────────────────────
  app.post('/auth/logout', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id: patientId } = req.portalPatient;

    // Revogar todos os refresh tokens
    await revokeAllRefreshTokens(db, patientId);

    // Blacklistar o access token atual
    const payload = req.user as PortalJwtPayload;
    if (payload?.jti) {
      await blacklistAccessToken(redis, payload.jti);
    }

    return reply
      .clearCookie('portal_access_token', { path: '/' })
      .clearCookie('portal_refresh_token', { path: '/' })
      .send({ ok: true });
  });

  // ── POST /portal/auth/magic-link ─────────────────────────────────────────────
  // Solicitar primeiro acesso ou redefinição de senha
  app.post('/auth/magic-link', async (req, reply) => {
    const parsed = portalForgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos.' });
    }

    const { email, clinicSlug } = parsed.data;

    // Resposta silenciosa — não revela se e-mail existe
    const patient = await findPortalPatient(db, email, clinicSlug);

    if (patient && patient.portal_enabled && patient.status === 'active') {
      try {
        const purpose = patient.portal_password_hash ? 'password_reset' : 'first_access';
        const token = await createMagicLink(db, patient.id, purpose, {}, req.ip);
        const url = `${env.PORTAL_URL}/${purpose === 'first_access' ? 'primeiro-acesso' : 'redefinir-senha'}/${token}`;
        await sendMagicLinkEmail(email, email, url, purpose);
      } catch (err) {
        logger.warn({ err }, 'Failed to send magic link email');
      }
    }

    return reply.send({
      ok: true,
      message: 'Se o e-mail estiver cadastrado, você receberá um link em instantes.',
    });
  });

  // ── GET /portal/auth/magic-link/:token/validate ───────────────────────────
  app.get('/auth/magic-link/:token/validate', async (req, reply) => {
    const { token } = req.params as { token: string };
    const tokenHash = require('node:crypto').createHash('sha256').update(token).digest('hex');

    const r = await db.query(
      `SELECT purpose, expires_at FROM portal.magic_links
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash],
    );

    if (!r.rows[0]) {
      return reply.status(400).send({ valid: false, error: 'Link inválido ou expirado.' });
    }

    return reply.send({ valid: true, purpose: r.rows[0].purpose });
  });

  // ── POST /portal/auth/primeiro-acesso ────────────────────────────────────────
  app.post('/auth/primeiro-acesso', async (req, reply) => {
    const parsed = portalSetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      });
    }

    const { token, password } = parsed.data;
    const result = await consumeMagicLink(db, token, 'first_access');

    if (!result) {
      return reply.status(400).send({ error: 'Link inválido ou expirado.' });
    }

    const hash = await hashPortalPassword(password);

    await db.query(
      `UPDATE shared.patients
       SET portal_password_hash  = $1,
           portal_email_verified = TRUE,
           updated_at            = NOW()
       WHERE id = $2`,
      [hash, result.patientId],
    );

    return reply.send({ ok: true });
  });

  // ── POST /portal/auth/redefinir-senha ────────────────────────────────────────
  app.post('/auth/redefinir-senha', async (req, reply) => {
    const parsed = portalSetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      });
    }

    const { token, password } = parsed.data;
    const result = await consumeMagicLink(db, token, 'password_reset');

    if (!result) {
      return reply.status(400).send({ error: 'Link inválido ou expirado.' });
    }

    const hash = await hashPortalPassword(password);

    await db.query(
      `UPDATE shared.patients
       SET portal_password_hash = $1,
           updated_at           = NOW()
       WHERE id = $2`,
      [hash, result.patientId],
    );

    // Invalidar todas as sessões ao trocar senha
    await revokeAllRefreshTokens(db, result.patientId);

    return reply.send({ ok: true });
  });

  // ── GET /portal/auth/desbloquear/:token ──────────────────────────────────────
  app.get('/auth/desbloquear/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const result = await consumeMagicLink(db, token, 'account_unlock');

    if (!result) {
      return reply.status(400).send({ error: 'Link inválido ou expirado.' });
    }

    await db.query(
      `UPDATE shared.patients
       SET portal_failed_attempts  = 0,
           portal_locked_until     = NULL,
           portal_captcha_required = FALSE,
           updated_at              = NOW()
       WHERE id = $1`,
      [result.patientId],
    );

    return reply.send({ ok: true, message: 'Conta desbloqueada com sucesso.' });
  });

  // ── POST /portal/auth/alterar-senha ──────────────────────────────────────────
  app.post('/auth/alterar-senha', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const parsed = portalChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      });
    }

    const { currentPassword, newPassword } = parsed.data;
    const { id: patientId } = req.portalPatient;

    const r = await db.query<{ portal_password_hash: string }>(
      'SELECT portal_password_hash FROM shared.patients WHERE id = $1 AND deleted_at IS NULL',
      [patientId],
    );

    if (!r.rows[0]?.portal_password_hash) {
      return reply.status(400).send({ error: 'Operação não permitida.' });
    }

    const valid = await verifyPortalPassword(r.rows[0].portal_password_hash, currentPassword);
    if (!valid) {
      return reply.status(401).send({ error: 'Senha atual incorreta.' });
    }

    const hash = await hashPortalPassword(newPassword);

    await db.query(
      'UPDATE shared.patients SET portal_password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, patientId],
    );

    // Invalidar todas as sessões
    await revokeAllRefreshTokens(db, patientId);

    const payload = req.user as PortalJwtPayload;
    if (payload?.jti) await blacklistAccessToken(redis, payload.jti);

    return reply
      .clearCookie('portal_access_token', { path: '/' })
      .clearCookie('portal_refresh_token', { path: '/' })
      .send({ ok: true, message: 'Senha alterada. Faça login novamente.' });
  });

  // ── GET /portal/auth/me ───────────────────────────────────────────────────────
  app.get('/auth/me', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id: patientId } = req.portalPatient;

    const r = await db.query<{
      portal_email: string;
      portal_email_verified: boolean;
      portal_captcha_required: boolean;
    }>(
      `SELECT portal_email, portal_email_verified, portal_captcha_required
       FROM shared.patients WHERE id = $1 AND deleted_at IS NULL`,
      [patientId],
    );

    if (!r.rows[0]) {
      return reply.status(404).send({ error: 'Paciente não encontrado.' });
    }

    return reply.send({
      patientId,
      email:         r.rows[0].portal_email,
      emailVerified: r.rows[0].portal_email_verified,
    });
  });
}

async function verifyCaptcha(
  token: string,
  secret: string,
  ip: string,
): Promise<boolean> {
  try {
    const res = await fetch('https://hcaptcha.com/siteverify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

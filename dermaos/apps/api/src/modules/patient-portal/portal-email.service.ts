import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

function getTransport() {
  if (!env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    secure: env.SMTP_PORT === 465,
  });
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    logger.warn({ to, subject }, 'SMTP not configured — skipping email');
    if (env.NODE_ENV !== 'production') {
      logger.info({ to, subject, html: html.substring(0, 200) }, '[DEV] Portal email would be sent');
    }
    return;
  }

  try {
    await transport.sendMail({
      from: env.SMTP_FROM ?? 'DermaOS <noreply@dermaos.com.br>',
      to,
      subject,
      html,
    });
  } catch (err) {
    logger.error({ err, to, subject }, 'Failed to send portal email');
    throw err;
  }
}

export async function sendMagicLinkEmail(
  to: string,
  patientName: string,
  magicUrl: string,
  purpose: 'first_access' | 'password_reset' | 'account_unlock',
): Promise<void> {
  const subjects = {
    first_access:    'Bem-vindo ao Portal DermaOS — Configure seu acesso',
    password_reset:  'Portal DermaOS — Redefinição de senha',
    account_unlock:  'Portal DermaOS — Desbloqueio de conta',
  };

  const actions = {
    first_access:   'configurar seu acesso',
    password_reset: 'redefinir sua senha',
    account_unlock: 'desbloquear sua conta',
  };

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h1 style="color: #b8860b; font-size: 24px; margin-bottom: 8px;">Portal do Paciente</h1>
      <p>Olá, ${patientName}.</p>
      <p>Clique no botão abaixo para ${actions[purpose]}:</p>
      <a href="${magicUrl}" style="
        display: inline-block; padding: 14px 28px; background-color: #b8860b;
        color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;
        margin: 16px 0;">
        Continuar
      </a>
      <p style="font-size: 14px; color: #666;">
        Este link é válido por 24 horas e só pode ser usado uma vez.<br>
        Se você não solicitou este acesso, ignore este e-mail.
      </p>
      <p style="font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 16px; margin-top: 24px;">
        DermaOS — Plataforma de Gestão para Clínicas Dermatológicas
      </p>
    </body>
    </html>`;

  await send(to, subjects[purpose], html);
}

export async function sendAccountLockedEmail(
  to: string,
  patientName: string,
  unlockUrl: string,
  lockDurationLabel: string,
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h1 style="color: #b8860b; font-size: 24px; margin-bottom: 8px;">Acesso temporariamente bloqueado</h1>
      <p>Olá, ${patientName}.</p>
      <p>
        Detectamos várias tentativas de login sem sucesso na sua conta.
        Por segurança, o acesso foi bloqueado por ${lockDurationLabel}.
      </p>
      <p>Para desbloquear imediatamente, clique no link abaixo:</p>
      <a href="${unlockUrl}" style="
        display: inline-block; padding: 14px 28px; background-color: #b8860b;
        color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;
        margin: 16px 0;">
        Desbloquear conta
      </a>
      <p style="font-size: 14px; color: #666;">
        Se não foi você, entre em contato com a clínica.
      </p>
    </body>
    </html>`;

  await send(to, 'Portal DermaOS — Conta temporariamente bloqueada', html);
}

export async function sendEmailVerificationEmail(
  to: string,
  patientName: string,
  verifyUrl: string,
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h1 style="color: #b8860b; font-size: 24px; margin-bottom: 8px;">Confirme seu e-mail</h1>
      <p>Olá, ${patientName}.</p>
      <p>Clique no botão abaixo para confirmar o endereço de e-mail <strong>${to}</strong>:</p>
      <a href="${verifyUrl}" style="
        display: inline-block; padding: 14px 28px; background-color: #b8860b;
        color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;
        margin: 16px 0;">
        Confirmar e-mail
      </a>
      <p style="font-size: 14px; color: #666;">Este link expira em 24 horas.</p>
    </body>
    </html>`;

  await send(to, 'Portal DermaOS — Confirmação de e-mail', html);
}

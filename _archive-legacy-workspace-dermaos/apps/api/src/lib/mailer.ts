import { env } from '../config/env.js';
import { logger } from './logger.js';

interface MailOptions {
  to:      string;
  subject: string;
  html:    string;
  text?:   string;
}

export async function sendMail(opts: MailOptions): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    logger.warn({ to: opts.to, subject: opts.subject }, '[Mailer] SMTP não configurado — email suprimido');
    return;
  }

  // Lazy import para não adicionar peso de startup quando SMTP não configurado
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host:   env.SMTP_HOST,
    port:   env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:   env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from:    env.SMTP_FROM,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
  });
}

export async function sendInvitationEmail(
  to: string,
  clinicName: string,
  inviteUrl: string,
): Promise<void> {
  await sendMail({
    to,
    subject: `Convite para acessar o DermaOS — ${clinicName}`,
    html: `
      <p>Você foi convidado(a) para acessar o DermaOS na clínica <strong>${clinicName}</strong>.</p>
      <p>Clique no link abaixo para definir sua senha e acessar a plataforma:</p>
      <p><a href="${inviteUrl}" style="padding:10px 20px;background:#0066cc;color:#fff;border-radius:4px;text-decoration:none">Aceitar convite</a></p>
      <p>Este link expira em 72 horas e pode ser usado apenas uma vez.</p>
      <p>Se você não esperava este convite, ignore este e-mail.</p>
    `,
    text: `Convite DermaOS — ${clinicName}\n\nLink de acesso: ${inviteUrl}\n\nExpira em 72 horas.`,
  }).catch((err) => logger.error({ err, to }, 'Falha ao enviar e-mail de convite'));
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  await sendMail({
    to,
    subject: 'Redefinição de senha — DermaOS',
    html: `
      <p>Uma solicitação de redefinição de senha foi realizada para sua conta no DermaOS.</p>
      <p>Clique no link abaixo para definir uma nova senha:</p>
      <p><a href="${resetUrl}" style="padding:10px 20px;background:#0066cc;color:#fff;border-radius:4px;text-decoration:none">Redefinir senha</a></p>
      <p>Este link expira em 1 hora e pode ser usado apenas uma vez.</p>
      <p>Se você não solicitou a redefinição, ignore este e-mail.</p>
    `,
    text: `Redefinição de senha DermaOS\n\nLink: ${resetUrl}\n\nExpira em 1 hora.`,
  }).catch((err) => logger.error({ err, to }, 'Falha ao enviar e-mail de reset'));
}

export async function sendNewIpAlertEmail(
  to: string,
  details: { ip: string; userAgent?: string | null; whenIso: string },
): Promise<void> {
  const ua = details.userAgent ? `<p>Dispositivo/navegador: <code>${details.userAgent}</code></p>` : '';
  await sendMail({
    to,
    subject: 'Novo acesso detectado em sua conta DermaOS',
    html: `
      <p>Detectamos um login de um endereço IP que ainda não havíamos visto na sua conta.</p>
      <p>IP: <strong>${details.ip}</strong></p>
      ${ua}
      <p>Quando: ${details.whenIso}</p>
      <p>Se foi você, pode ignorar esta mensagem. Caso contrário, redefina sua senha imediatamente e contate o administrador da sua clínica.</p>
    `,
    text:
      `Novo acesso detectado em sua conta DermaOS.\n` +
      `IP: ${details.ip}\nQuando: ${details.whenIso}\n` +
      (details.userAgent ? `User-Agent: ${details.userAgent}\n` : '') +
      `Se não foi você, redefina sua senha imediatamente.`,
  }).catch((err) => logger.error({ err, to }, 'Falha ao enviar alerta de novo IP'));
}

export async function sendDeactivationEmail(
  to: string,
  userName: string,
  clinicName: string,
): Promise<void> {
  await sendMail({
    to,
    subject: `Sua conta no DermaOS foi desativada — ${clinicName}`,
    html: `
      <p>Olá, ${userName}.</p>
      <p>Sua conta na clínica <strong>${clinicName}</strong> foi desativada por um administrador.</p>
      <p>Se você acredita que isso foi um erro, entre em contato com o responsável da clínica.</p>
    `,
    text: `Olá, ${userName}.\n\nSua conta em ${clinicName} foi desativada. Entre em contato com o administrador se necessário.`,
  }).catch((err) => logger.error({ err, to }, 'Falha ao enviar e-mail de desativação'));
}

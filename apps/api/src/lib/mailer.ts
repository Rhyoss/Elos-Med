import { logger } from './logger.js';

async function logEmail(kind: string, to: string, metadata: Record<string, unknown>) {
  logger.info({ kind, to, ...metadata }, 'Email delivery adapter is not configured in local mode');
}

export async function sendInvitationEmail(to: string, clinicName: string, inviteUrl: string): Promise<void> {
  await logEmail('invitation', to, { clinicName, inviteUrl });
}

export async function sendPasswordResetEmail(to: string, clinicNameOrResetUrl: string, resetUrl?: string): Promise<void> {
  await logEmail('password_reset', to, { clinicNameOrResetUrl, resetUrl });
}

export async function sendDeactivationEmail(to: string, nameOrClinicName: string, clinicName?: string): Promise<void> {
  await logEmail('deactivation', to, { nameOrClinicName, clinicName });
}

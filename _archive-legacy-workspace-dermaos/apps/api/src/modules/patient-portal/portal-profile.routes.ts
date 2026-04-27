import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { redis } from '../../db/redis.js';
import { decryptOptional, encrypt } from '../../lib/crypto.js';
import { verifyPortalToken } from './portal-middleware.js';
import {
  portalUpdateProfileSchema,
  portalRequestEmailChangeSchema,
} from './portal.schemas.js';
import { createMagicLink, consumeMagicLink } from './portal-auth.service.js';
import { sendEmailVerificationEmail } from './portal-email.service.js';
import { env } from '../../config/env.js';

export async function registerPortalProfileRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /portal/profile ───────────────────────────────────────────────────────
  // Retorna apenas campos públicos/editáveis pelo paciente.
  // Dados somente-leitura: nome, CPF, data de nascimento.
  // Dados sensíveis clínicos (SOAP, diagnósticos): jamais expostos.
  app.get('/profile', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id: patientId } = req.portalPatient;

    const r = await db.query<{
      name_search: string;     // nome para exibição (não-PHI)
      birth_date: string | null;
      phone_encrypted: string | null;
      address: unknown;
      portal_email: string | null;
      portal_email_verified: boolean;
      blood_type: string | null;
    }>(
      `SELECT name_search, birth_date, phone_encrypted, address,
              portal_email, portal_email_verified, blood_type
       FROM shared.patients
       WHERE id = $1 AND deleted_at IS NULL`,
      [patientId],
    );

    if (!r.rows[0]) {
      return reply.status(404).send({ error: 'Paciente não encontrado.' });
    }

    const p = r.rows[0];

    return reply.send({
      displayName:   p.name_search,
      birthDate:     p.birth_date,
      phone:         decryptOptional(p.phone_encrypted),
      address:       p.address,
      email:         p.portal_email,
      emailVerified: p.portal_email_verified,
      bloodType:     p.blood_type,
    });
  });

  // ── PATCH /portal/profile ─────────────────────────────────────────────────────
  // Apenas campos editáveis: telefone e endereço.
  // Nome, CPF e data de nascimento são somente leitura (alterações presenciais).
  app.patch('/profile', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const parsed = portalUpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      });
    }

    const { phone, address } = parsed.data;
    const { id: patientId } = req.portalPatient;

    const current = await db.query<{
      phone_encrypted: string | null; address: unknown;
    }>(
      'SELECT phone_encrypted, address FROM shared.patients WHERE id = $1 AND deleted_at IS NULL',
      [patientId],
    );

    if (!current.rows[0]) {
      return reply.status(404).send({ error: 'Paciente não encontrado.' });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    const auditEntries: Array<{ field: string; old: string | null; newVal: string | null }> = [];

    if (phone !== undefined) {
      const oldPhone = decryptOptional(current.rows[0].phone_encrypted);
      const encPhone = encrypt(phone);
      updates.push(`phone_encrypted = $${values.length + 1}`);
      values.push(encPhone);
      auditEntries.push({ field: 'phone', old: oldPhone ? '***MASKED***' : null, newVal: '***MASKED***' });
    }

    if (address !== undefined) {
      updates.push(`address = $${values.length + 1}`);
      values.push(JSON.stringify(address));
      auditEntries.push({
        field:  'address',
        old:    JSON.stringify(current.rows[0].address),
        newVal: JSON.stringify(address),
      });
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Nenhum campo para atualizar.' });
    }

    values.push(patientId);
    await db.query(
      `UPDATE shared.patients SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
      values,
    );

    // Audit trail
    for (const entry of auditEntries) {
      await db.query(
        `INSERT INTO portal.profile_audit (patient_id, field_name, old_value, new_value, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [patientId, entry.field, entry.old, entry.newVal, req.ip],
      );
    }

    return reply.send({ ok: true });
  });

  // ── POST /portal/profile/request-email-change ─────────────────────────────────
  // Solicitar troca de e-mail — envia link de confirmação para o NOVO e-mail.
  app.post('/profile/request-email-change', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const parsed = portalRequestEmailChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'E-mail inválido.' });
    }

    const { newEmail } = parsed.data;
    const { id: patientId } = req.portalPatient;

    // Verificar se novo e-mail já está em uso na mesma clínica
    const existing = await db.query(
      `SELECT 1 FROM shared.patients WHERE portal_email = $1 AND id != $2`,
      [newEmail.toLowerCase().trim(), patientId],
    );
    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: 'Este e-mail já está sendo utilizado.' });
    }

    const token = await createMagicLink(
      db,
      patientId,
      'email_change',
      { new_email: newEmail.toLowerCase().trim() },
      req.ip,
    );

    const verifyUrl = `${env.PORTAL_URL}/confirmar-email/${token}`;
    await sendEmailVerificationEmail(newEmail, newEmail, verifyUrl);

    return reply.send({
      ok: true,
      message: 'Enviamos um link de confirmação para o novo e-mail.',
    });
  });

  // ── GET /portal/profile/confirm-email/:token ──────────────────────────────────
  app.get('/profile/confirm-email/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const result = await consumeMagicLink(db, token, 'email_change');

    if (!result) {
      return reply.status(400).send({ error: 'Link inválido ou expirado.' });
    }

    const newEmail = result.metadata['new_email'] as string | undefined;
    if (!newEmail) {
      return reply.status(400).send({ error: 'Link inválido.' });
    }

    const oldEmailResult = await db.query<{ portal_email: string }>(
      'SELECT portal_email FROM shared.patients WHERE id = $1',
      [result.patientId],
    );

    await db.query(
      `UPDATE shared.patients
       SET portal_email = $1, portal_email_verified = TRUE, updated_at = NOW()
       WHERE id = $2`,
      [newEmail, result.patientId],
    );

    // Auditoria
    await db.query(
      `INSERT INTO portal.profile_audit (patient_id, field_name, old_value, new_value)
       VALUES ($1, 'portal_email', $2, $3)`,
      [result.patientId, oldEmailResult.rows[0]?.portal_email ?? null, newEmail],
    );

    return reply.send({ ok: true, message: 'E-mail atualizado com sucesso.' });
  });
}

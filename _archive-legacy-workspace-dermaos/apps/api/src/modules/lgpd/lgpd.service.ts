import crypto from 'node:crypto';
import argon2 from 'argon2';
import { TRPCError } from '@trpc/server';
import type { Pool } from 'pg';
import { withClinicContext } from '../../db/client.js';
import { decryptOptional } from '../../lib/encryption.js';
import { recordSecurityEvent } from '../security/session.service.js';
import { logger } from '../../lib/logger.js';
import { enqueueLgpdExport } from '../../jobs/queues.js';

/**
 * LGPD service:
 *  - requestExport: enfileira job. Apenas paciente próprio, admin ou DPO.
 *  - anonymizePatient: anonimiza PII preservando dados clínicos. Two-man rule opcional.
 *  - registerConsent / revokeConsent: append-only.
 *  - getCurrentPrivacyNotice: HTML versionado (cacheável).
 */

interface RequestExportInput {
  db:          Pool;
  clinicId:    string;
  patientId:   string;
  requestedBy: string;
  requestedRole: 'patient' | 'admin' | 'dpo';
  ip:          string | null;
  justification?: string;
}

export async function requestExport(input: RequestExportInput): Promise<{ jobId: string }> {
  return withClinicContext(input.clinicId, async (client) => {
    // Carrega email criptografado para envio do link
    const patient = await client.query<{ email_encrypted: string | null }>(
      'SELECT email_encrypted FROM shared.patients WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL',
      [input.patientId, input.clinicId],
    );
    if (!patient.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado' });
    }
    const email = decryptOptional(patient.rows[0].email_encrypted, { clinicId: input.clinicId });
    if (!email) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Paciente sem email cadastrado — exportação requer email para envio do link.',
      });
    }

    const insert = await client.query<{ id: string }>(
      `INSERT INTO shared.lgpd_export_jobs
         (clinic_id, patient_id, requested_by, requested_role, status, ip_address, justification)
       VALUES ($1, $2, $3, $4, 'pending', $5::inet, $6)
       RETURNING id`,
      [input.clinicId, input.patientId, input.requestedBy, input.requestedRole, input.ip, input.justification ?? null],
    );
    const jobId = insert.rows[0]!.id;

    return { jobId, email };
  }).then(async ({ jobId, email }) => {
    await enqueueLgpdExport({
      jobId,
      clinicId: input.clinicId,
      patientId: input.patientId,
      requestedBy: input.requestedBy,
      email,
      ip: input.ip,
    });
    await recordSecurityEvent(input.db, {
      clinicId: input.clinicId,
      userId:   input.requestedBy,
      eventType: 'lgpd.export_requested',
      severity:  'info',
      ip: input.ip,
      metadata: { patientId: input.patientId, requestedRole: input.requestedRole },
    });
    return { jobId };
  });
}

// ─── Anonimização ────────────────────────────────────────────────────────────

const ANONYMIZED_NAME    = 'Paciente Anonimizado';
const ANONYMIZED_CPF     = '00000000000';
const ANONYMIZED_FIELDS  = [
  'name', 'name_search', 'cpf_hash', 'cpf_encrypted',
  'email_encrypted', 'phone_encrypted', 'phone_secondary_encrypted',
  'address', 'photo_url', 'portal_email',
];

interface AnonymizeInput {
  db:           Pool;
  redis:        import('ioredis').default;
  clinicId:     string;
  patientId:    string;
  performedBy:  string;
  performedRole: 'owner' | 'dpo';
  approvedBy?:  string;
  reason:       string;
  confirmation: string;             // exigida: "ANONIMIZAR <patient_id>"
  ip:           string | null;
}

export async function anonymizePatient(input: AnonymizeInput): Promise<void> {
  const expected = `ANONIMIZAR ${input.patientId}`;
  if (input.confirmation.trim() !== expected) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Confirmação inválida. Digite literalmente: ${expected}`,
    });
  }
  if (!['owner', 'dpo'].includes(input.performedRole)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas owner ou DPO pode anonimizar' });
  }

  await withClinicContext(input.clinicId, async (client) => {
    const exists = await client.query(
      'SELECT id FROM shared.patients WHERE id = $1 AND clinic_id = $2',
      [input.patientId, input.clinicId],
    );
    if (!exists.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado' });
    }

    // Anonimização — preserva dados clínicos (encounters, prescriptions, lots, etc.)
    await client.query(
      `UPDATE shared.patients
          SET name                       = $3,
              name_search                = $3,
              cpf_hash                   = NULL,
              cpf_encrypted              = NULL,
              email_encrypted            = NULL,
              phone_encrypted            = NULL,
              phone_secondary_encrypted  = NULL,
              address                    = NULL,
              photo_url                  = NULL,
              portal_email               = NULL,
              portal_enabled             = false,
              portal_password_hash       = NULL,
              status                     = 'inactive',
              deletion_reason            = $4,
              deleted_at                 = NOW(),
              updated_at                 = NOW()
        WHERE id = $1 AND clinic_id = $2`,
      [input.patientId, input.clinicId, ANONYMIZED_NAME, input.reason],
    );

    await client.query(
      `INSERT INTO shared.lgpd_anonymization_log
         (clinic_id, patient_id, performed_by, approved_by, reason, fields_anonymized,
          clinical_data_preserved, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7::inet)`,
      [
        input.clinicId,
        input.patientId,
        input.performedBy,
        input.approvedBy ?? null,
        input.reason,
        ANONYMIZED_FIELDS,
        input.ip,
      ],
    );
  });

  // Invalida caches do paciente em Redis (RBAC, dashboards).
  try {
    const keys = await input.redis.keys(`dermaos:patient:${input.patientId}:*`);
    if (keys.length > 0) await input.redis.del(...keys);
  } catch (err) {
    logger.warn({ err, patientId: input.patientId }, '[lgpd] redis cache invalidation failed');
  }

  await recordSecurityEvent(input.db, {
    clinicId: input.clinicId,
    userId:   input.performedBy,
    eventType: 'lgpd.patient_anonymized',
    severity:  'critical',
    ip: input.ip,
    metadata: {
      patientId: input.patientId,
      approvedBy: input.approvedBy,
      reason: input.reason,
    },
  });
}

// ─── Consentimento ───────────────────────────────────────────────────────────

interface ConsentInput {
  db:           Pool;
  clinicId:     string;
  patientId:    string;
  consentType:  'dados_pessoais' | 'marketing' | 'pesquisa' | 'imagens';
  version:      string;
  channel:      'web' | 'whatsapp' | 'in_person' | 'portal' | 'paper';
  ip:           string | null;
  collectedBy:  string | null;
  evidence?:    Record<string, unknown>;
}

export async function registerConsent(input: ConsentInput): Promise<{ id: string }> {
  return withClinicContext(input.clinicId, async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO shared.consent_log
         (clinic_id, patient_id, consent_type, version, ip_address, channel, collected_by, evidence)
       VALUES ($1, $2, $3, $4, $5::inet, $6, $7, $8::jsonb)
       RETURNING id`,
      [
        input.clinicId, input.patientId, input.consentType, input.version,
        input.ip, input.channel, input.collectedBy,
        JSON.stringify(input.evidence ?? {}),
      ],
    );
    return { id: result.rows[0]!.id };
  });
}

export async function revokeConsent(
  db: Pool,
  input: Omit<ConsentInput, 'evidence'> & { evidence?: Record<string, unknown> },
): Promise<{ id: string }> {
  return withClinicContext(input.clinicId, async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO shared.consent_log
         (clinic_id, patient_id, consent_type, version, ip_address, channel, collected_by,
          evidence, revoked_at, is_revocation)
       VALUES ($1, $2, $3, $4, $5::inet, $6, $7, $8::jsonb, NOW(), true)
       RETURNING id`,
      [
        input.clinicId, input.patientId, input.consentType, input.version,
        input.ip, input.channel, input.collectedBy,
        JSON.stringify(input.evidence ?? {}),
      ],
    );
    return { id: result.rows[0]!.id };
  });
}

/** Retorna consentimento ativo (último não-revogado) para um tipo. */
export async function getActiveConsent(
  db: Pool,
  clinicId: string,
  patientId: string,
  consentType: string,
): Promise<boolean> {
  return withClinicContext(clinicId, async (client) => {
    const result = await client.query<{ is_revocation: boolean }>(
      `SELECT is_revocation
         FROM shared.consent_log
        WHERE clinic_id = $1 AND patient_id = $2 AND consent_type = $3
        ORDER BY granted_at DESC
        LIMIT 1`,
      [clinicId, patientId, consentType],
    );
    const row = result.rows[0];
    return row ? !row.is_revocation : false;
  });
}

// ─── Privacy notice ──────────────────────────────────────────────────────────

export async function getCurrentPrivacyNotice(
  db: Pool,
  clinicId: string | null,
): Promise<{ version: string; html: string }> {
  const result = await db.query<{ version: string; html: string }>(
    `SELECT version, html
       FROM shared.privacy_notices
      WHERE is_current = true
        AND (clinic_id = $1::uuid OR clinic_id IS NULL)
      ORDER BY clinic_id NULLS LAST
      LIMIT 1`,
    [clinicId],
  );
  if (!result.rows[0]) {
    return {
      version: 'global-fallback',
      html: '<h1>Política de Privacidade</h1><p>Política em elaboração.</p>',
    };
  }
  return result.rows[0];
}

// ─── ZIP password helper ─────────────────────────────────────────────────────

/** Gera senha forte para o ZIP do export — caller envia em email separado. */
export function generateZipPassword(): string {
  const bytes = crypto.randomBytes(18);
  return bytes.toString('base64').replace(/[+/=]/g, '').slice(0, 24);
}

export async function hashZipPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 4,
  });
}

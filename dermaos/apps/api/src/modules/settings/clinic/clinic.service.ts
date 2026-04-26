import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import sharp from 'sharp';
import { withClinicContext, db } from '../../../db/client.js';
import { detectMimeFromBytes } from '../../../lib/image-validation.js';
import { putObjectBuffer, CLINIC_ASSETS_BUCKET } from '../../../lib/minio.js';
import { logger } from '../../../lib/logger.js';
import type { UpdateClinicInput, UpdateBusinessHoursInput, UpdateTimezoneInput } from '@dermaos/shared';

const ALLOWED_LOGO_MIMES = new Set(['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']);
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

async function writeAuditEvent(
  clinicId: string,
  eventType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $2::uuid, $3, $4, $5)`,
      [clinicId, aggregateId, eventType, JSON.stringify(payload), JSON.stringify(metadata)],
    );
  } catch (err) {
    logger.error({ err, eventType }, 'Settings audit write failed');
  }
}

export async function getClinic(clinicId: string, isOwnerOrAdmin: boolean) {
  return withClinicContext(clinicId, async (client) => {
    const cols = isOwnerOrAdmin
      ? `id, name, slug, cnpj, cnes, logo_url, address, phone, email,
         timezone, dpo_name, dpo_email, cnpj_locked, cnes_locked,
         ai_config, is_active, created_at, updated_at`
      : `id, name, logo_url`;

    const { rows } = await client.query(
      `SELECT ${cols} FROM shared.clinics WHERE id = $1`,
      [clinicId],
    );
    return rows[0] ?? null;
  });
}

export async function updateClinic(
  clinicId: string,
  userId: string,
  input: UpdateClinicInput,
) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT cnpj, cnes, cnpj_locked, cnes_locked, name, email, phone, address, dpo_name, dpo_email
         FROM shared.clinics WHERE id = $1`,
      [clinicId],
    );
    const current = rows[0];
    if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Clínica não encontrada.' });

    if (input.cnpj !== undefined && current.cnpj_locked) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'CNPJ não pode ser alterado após a configuração inicial. Entre em contato com o suporte.',
      });
    }
    if (input.cnes !== undefined && current.cnes_locked) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'CNES não pode ser alterado após a configuração inicial. Entre em contato com o suporte.',
      });
    }

    if (input.cnpj) {
      const { rows: dup } = await client.query(
        `SELECT id FROM shared.clinics WHERE cnpj = $1 AND id != $2`,
        [input.cnpj, clinicId],
      );
      if (dup.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'CNPJ já cadastrado em outra clínica.' });
      }
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];
    const auditChanges: Record<string, { old: unknown; new: unknown }> = {};
    let idx = 1;

    const fieldMap: Array<[keyof UpdateClinicInput, string, boolean]> = [
      ['name',      'name',      false],
      ['cnpj',      'cnpj',      false],
      ['cnes',      'cnes',      false],
      ['email',     'email',     false],
      ['phone',     'phone',     false],
      ['address',   'address',   true],
      ['dpo_name',  'dpo_name',  false],
      ['dpo_email', 'dpo_email', false],
    ];

    for (const [key, col, isJson] of fieldMap) {
      const val = input[key];
      if (val === undefined) continue;
      const serialized = isJson ? JSON.stringify(val) : val;
      const oldSerialized = isJson ? JSON.stringify(current[col]) : current[col];
      if (serialized !== oldSerialized) {
        auditChanges[col] = { old: current[col], new: val };
      }
      setClauses.push(`${col} = $${idx}`);
      params.push(serialized);
      idx++;
    }

    if (setClauses.length === 0) return current;

    // Lock on first set
    if (input.cnpj && !current.cnpj) setClauses.push('cnpj_locked = true');
    if (input.cnes && !current.cnes) setClauses.push('cnes_locked = true');

    params.push(clinicId);
    const { rows: updated } = await client.query(
      `UPDATE shared.clinics SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );

    if (Object.keys(auditChanges).length > 0) {
      await client.query(
        `INSERT INTO audit.domain_events
           (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
         VALUES ($1, 'settings', $1::uuid, 'settings.clinic_updated', $2, $3)`,
        [clinicId, JSON.stringify({ changes: auditChanges }), JSON.stringify({ user_id: userId })],
      );
    }

    return updated[0];
  });
}

export async function uploadLogo(
  clinicId: string,
  userId: string,
  buffer: Buffer,
  _declaredMime: string,
): Promise<{ logoUrl: string }> {
  if (buffer.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Arquivo vazio.' });
  }
  if (buffer.length > MAX_LOGO_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Logo excede 2MB.' });
  }

  // SVG detection: text-based, check for XML tag
  const prefix = buffer.subarray(0, 64).toString('utf8').trimStart();
  const isSvg = prefix.startsWith('<?xml') || prefix.startsWith('<svg');

  let detectedMime: string | null = null;
  if (isSvg) {
    detectedMime = 'image/svg+xml';
  } else {
    detectedMime = detectMimeFromBytes(buffer);
  }

  if (!detectedMime || !ALLOWED_LOGO_MIMES.has(detectedMime)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Formato inválido. Apenas JPEG, PNG, SVG e WebP são aceitos.',
    });
  }

  const extMap: Record<string, string> = {
    'image/jpeg':   'jpg',
    'image/png':    'png',
    'image/svg+xml':'svg',
    'image/webp':   'webp',
  };
  const ext = extMap[detectedMime] ?? 'bin';
  const objectKey = `clinics/${clinicId}/logo-${crypto.randomBytes(4).toString('hex')}.${ext}`;

  // Resize raster formats to max 400×400 (SVG is vector — skip resize)
  let uploadBuffer = buffer;
  if (detectedMime !== 'image/svg+xml') {
    uploadBuffer = await sharp(buffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
  }

  await putObjectBuffer(objectKey, uploadBuffer, detectedMime, CLINIC_ASSETS_BUCKET);

  // Store the MinIO object key; presigned URL generated on read
  await db.query(`UPDATE shared.clinics SET logo_url = $1 WHERE id = $2`, [objectKey, clinicId]);

  setImmediate(() =>
    writeAuditEvent(clinicId, 'settings.clinic_logo_updated', clinicId, {}, { user_id: userId })
      .catch((err) => logger.error({ err }, 'Logo audit failed')),
  );

  return { logoUrl: objectKey };
}

export async function getBusinessHours(clinicId: string) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT day_of_week, is_open, shifts
         FROM shared.clinic_business_hours
         WHERE clinic_id = $1
         ORDER BY day_of_week`,
      [clinicId],
    );
    return rows;
  });
}

export async function updateBusinessHours(
  clinicId: string,
  userId: string,
  input: UpdateBusinessHoursInput,
) {
  return withClinicContext(clinicId, async (client) => {
    for (const day of input.hours) {
      if (day.isOpen) {
        for (const shift of day.shifts) {
          if (shift.start >= shift.end) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Dia ${day.dayOfWeek}: horário de fim deve ser posterior ao início.`,
            });
          }
        }
      }

      await client.query(
        `INSERT INTO shared.clinic_business_hours (clinic_id, day_of_week, is_open, shifts)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (clinic_id, day_of_week)
           DO UPDATE SET is_open = EXCLUDED.is_open, shifts = EXCLUDED.shifts`,
        [clinicId, day.dayOfWeek, day.isOpen, JSON.stringify(day.shifts)],
      );
    }

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $1::uuid, 'settings.hours_updated', $2, $3)`,
      [clinicId, JSON.stringify({ days: input.hours.length }), JSON.stringify({ user_id: userId })],
    );

    return { ok: true };
  });
}

export async function updateTimezone(
  clinicId: string,
  userId: string,
  input: UpdateTimezoneInput,
) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT timezone FROM shared.clinics WHERE id = $1`,
      [clinicId],
    );
    const oldTimezone = rows[0]?.timezone ?? null;

    await client.query(
      `UPDATE shared.clinics SET timezone = $1 WHERE id = $2`,
      [input.timezone, clinicId],
    );

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $1::uuid, 'settings.timezone_updated', $2, $3)`,
      [
        clinicId,
        JSON.stringify({ old: oldTimezone, new: input.timezone }),
        JSON.stringify({ user_id: userId }),
      ],
    );

    return { timezone: input.timezone };
  });
}

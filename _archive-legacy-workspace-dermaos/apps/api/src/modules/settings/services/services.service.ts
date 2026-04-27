import { TRPCError } from '@trpc/server';
import { withClinicContext } from '../../../db/client.js';
import type {
  CreateSettingsServiceInput,
  UpdateSettingsServiceInput,
} from '@dermaos/shared';

export async function listServices(clinicId: string, includeInactive = false) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT id, name, description, category, tuss_code, price_cents, duration_min,
              is_active, allow_online, deleted_at, created_at, updated_at
         FROM shared.services
         WHERE clinic_id = $1
           AND deleted_at IS NULL
           ${includeInactive ? '' : 'AND is_active = true'}
         ORDER BY name ASC`,
      [clinicId],
    );
    return rows;
  });
}

export async function createService(
  clinicId: string,
  userId: string,
  input: CreateSettingsServiceInput,
) {
  return withClinicContext(clinicId, async (client) => {
    const { rows: dup } = await client.query(
      `SELECT id FROM shared.services WHERE clinic_id = $1 AND name = $2 AND deleted_at IS NULL`,
      [clinicId, input.name],
    );
    if (dup.length > 0) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Já existe um serviço com este nome.' });
    }

    const { rows } = await client.query(
      `INSERT INTO shared.services
         (clinic_id, name, description, category, tuss_code, price_cents, duration_min)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, category, price_cents, duration_min, is_active`,
      [
        clinicId,
        input.name,
        input.description ?? null,
        input.category,
        input.tussCode ?? null,
        input.priceCents,
        input.durationMin,
      ],
    );

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $2::uuid, 'settings.service_created', $3, $4)`,
      [
        clinicId,
        rows[0].id,
        JSON.stringify({ name: input.name, price_cents: input.priceCents }),
        JSON.stringify({ user_id: userId }),
      ],
    );

    return rows[0];
  });
}

export async function updateService(
  clinicId: string,
  userId: string,
  input: UpdateSettingsServiceInput,
) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT id, name, category, tuss_code, price_cents, duration_min, description, deleted_at
         FROM shared.services WHERE id = $1 AND clinic_id = $2`,
      [input.id, clinicId],
    );
    const current = rows[0];
    if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado.' });
    if (current.deleted_at) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Serviço desativado não pode ser editado.' });

    if (input.name && input.name !== current.name) {
      const { rows: dup } = await client.query(
        `SELECT id FROM shared.services WHERE clinic_id = $1 AND name = $2 AND id != $3 AND deleted_at IS NULL`,
        [clinicId, input.name, input.id],
      );
      if (dup.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Já existe um serviço com este nome.' });
      }
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: Array<[keyof Omit<UpdateSettingsServiceInput, 'id'>, string]> = [
      ['name', 'name'],
      ['description', 'description'],
      ['category', 'category'],
      ['tussCode', 'tuss_code'],
      ['priceCents', 'price_cents'],
      ['durationMin', 'duration_min'],
    ];

    for (const [key, col] of fields) {
      const val = input[key];
      if (val === undefined) continue;
      setClauses.push(`${col} = $${idx}`);
      params.push(val ?? null);
      idx++;
    }

    if (setClauses.length === 0) return current;

    params.push(input.id, clinicId);
    const { rows: updated } = await client.query(
      `UPDATE shared.services SET ${setClauses.join(', ')}
         WHERE id = $${idx} AND clinic_id = $${idx + 1}
         RETURNING *`,
      params,
    );

    // Record price history when price changed
    if (input.priceCents !== undefined && input.priceCents !== current.price_cents) {
      await client.query(
        `INSERT INTO shared.service_price_history
           (service_id, clinic_id, old_price_cents, new_price_cents, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [input.id, clinicId, current.price_cents, input.priceCents, userId],
      );
    }

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $2::uuid, 'settings.service_updated', $3, $4)`,
      [
        clinicId,
        input.id,
        JSON.stringify({ fields: Object.keys(Object.fromEntries(fields.filter(([k]) => input[k] !== undefined))) }),
        JSON.stringify({ user_id: userId }),
      ],
    );

    return updated[0];
  });
}

export async function softDeleteService(clinicId: string, userId: string, serviceId: string) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT id, deleted_at FROM shared.services WHERE id = $1 AND clinic_id = $2`,
      [serviceId, clinicId],
    );
    if (!rows[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado.' });
    if (rows[0].deleted_at) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Serviço já desativado.' });

    await client.query(
      `UPDATE shared.services SET deleted_at = NOW(), is_active = false WHERE id = $1 AND clinic_id = $2`,
      [serviceId, clinicId],
    );

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $2::uuid, 'settings.service_deleted', '{}', $3)`,
      [clinicId, serviceId, JSON.stringify({ user_id: userId })],
    );

    return { ok: true };
  });
}

export async function getServicePriceHistory(clinicId: string, serviceId: string) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT h.id, h.old_price_cents, h.new_price_cents, h.changed_at, u.name AS changed_by_name
         FROM shared.service_price_history h
         LEFT JOIN shared.users u ON u.id = h.changed_by
         WHERE h.service_id = $1 AND h.clinic_id = $2
         ORDER BY h.changed_at DESC
         LIMIT 50`,
      [serviceId, clinicId],
    );
    return rows;
  });
}

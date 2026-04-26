import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../db/client.js';
import type {
  CreateServiceInput,
  UpdateServiceInput,
  ListServicesInput,
} from '@dermaos/shared';

export interface ServiceRow {
  id:           string;
  clinic_id:    string;
  name:         string;
  description:  string | null;
  category:     string;
  tuss_code:    string | null;
  cbhpm_code:   string | null;
  price:        number;  // centavos
  duration_min: number;
  is_active:    boolean;
  deleted_at:   string | null;
  created_at:   string;
  updated_at:   string;
  created_by:   string | null;
  updated_by:   string | null;
}

export interface ServicePriceHistoryRow {
  id:             string;
  service_id:     string;
  price:          number;
  effective_from: string;
  changed_by:     string | null;
  notes:          string | null;
}

// ─── Leitura ───────────────────────────────────────────────────────────────

export async function listServices(
  input:    ListServicesInput,
  clinicId: string,
): Promise<{ data: ServiceRow[]; total: number }> {
  return withClinicContext(clinicId, async (client) => {
    const conditions: string[] = ['s.clinic_id = $1', 's.deleted_at IS NULL'];
    const params: unknown[] = [clinicId];
    let p = 2;

    if (input.isActive !== undefined) {
      conditions.push(`s.is_active = $${p++}`);
      params.push(input.isActive);
    }
    if (input.category) {
      conditions.push(`s.category = $${p++}`);
      params.push(input.category);
    }
    if (input.search) {
      conditions.push(`(s.name ILIKE $${p} OR s.tuss_code ILIKE $${p})`);
      params.push(`%${input.search}%`);
      p++;
    }

    const where  = conditions.join(' AND ');
    const offset = (input.page - 1) * input.limit;

    const [rows, count] = await Promise.all([
      client.query<ServiceRow>(
        `SELECT * FROM financial.service_catalog s
          WHERE ${where}
          ORDER BY s.name ASC
          LIMIT $${p} OFFSET $${p + 1}`,
        [...params, input.limit, offset],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM financial.service_catalog s WHERE ${where}`,
        params,
      ),
    ]);

    return {
      data:  rows.rows,
      total: parseInt(count.rows[0]?.count ?? '0', 10),
    };
  });
}

export async function getServiceById(id: string, clinicId: string): Promise<ServiceRow> {
  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<ServiceRow>(
      `SELECT * FROM financial.service_catalog
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [id, clinicId],
    );
    if (!r.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado.' });
    }
    return r.rows[0];
  });
}

export async function getServicePriceHistory(
  serviceId: string,
  clinicId:  string,
): Promise<ServicePriceHistoryRow[]> {
  await getServiceById(serviceId, clinicId);
  const r = await db.query<ServicePriceHistoryRow>(
    `SELECT * FROM financial.service_price_history
      WHERE service_id = $1 AND clinic_id = $2
      ORDER BY effective_from DESC`,
    [serviceId, clinicId],
  );
  return r.rows;
}

// ─── Criação ───────────────────────────────────────────────────────────────

export async function createService(
  input:    CreateServiceInput,
  clinicId: string,
  userId:   string,
): Promise<ServiceRow> {
  await assertNameUnique(input.name, clinicId, null);

  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO financial.service_catalog
         (clinic_id, name, description, category, tuss_code, cbhpm_code,
          price, duration_min, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       RETURNING id`,
      [
        clinicId,
        input.name,
        input.description ?? null,
        input.category,
        input.tussCode    ?? null,
        input.cbhpmCode   ?? null,
        input.price,
        input.durationMin,
        userId,
      ],
    );

    const serviceId = r.rows[0]!.id;

    // Registra preço inicial no histórico
    await client.query(
      `INSERT INTO financial.service_price_history
         (clinic_id, service_id, price, changed_by, notes)
       VALUES ($1,$2,$3,$4,'Preço inicial')`,
      [clinicId, serviceId, input.price, userId],
    );

    await db.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1,'financial_service',$2,'financial_service.created',$3,$4)`,
      [clinicId, serviceId,
        JSON.stringify({ name: input.name, price: input.price }),
        JSON.stringify({ user_id: userId })],
    );

    return getServiceById(serviceId, clinicId);
  });
}

// ─── Atualização ───────────────────────────────────────────────────────────

export async function updateService(
  input:    UpdateServiceInput,
  clinicId: string,
  userId:   string,
): Promise<ServiceRow> {
  const current = await getServiceById(input.id, clinicId);

  if (input.name && input.name !== current.name) {
    await assertNameUnique(input.name, clinicId, input.id);
  }

  return withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE financial.service_catalog
          SET name         = COALESCE($3, name),
              description  = COALESCE($4, description),
              category     = COALESCE($5, category),
              tuss_code    = COALESCE($6, tuss_code),
              cbhpm_code   = COALESCE($7, cbhpm_code),
              price        = COALESCE($8, price),
              duration_min = COALESCE($9, duration_min),
              is_active    = COALESCE($10, is_active),
              updated_by   = $11
        WHERE id = $1 AND clinic_id = $2`,
      [
        input.id, clinicId,
        input.name        ?? null,
        input.description ?? null,
        input.category    ?? null,
        input.tussCode    ?? null,
        input.cbhpmCode   ?? null,
        input.price       ?? null,
        input.durationMin ?? null,
        input.isActive    ?? null,
        userId,
      ],
    );

    // Registra histórico se preço mudou
    if (input.price !== undefined && input.price !== current.price) {
      await client.query(
        `INSERT INTO financial.service_price_history
           (clinic_id, service_id, price, changed_by)
         VALUES ($1,$2,$3,$4)`,
        [clinicId, input.id, input.price, userId],
      );
    }

    await db.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1,'financial_service',$2,'financial_service.updated',$3,$4)`,
      [clinicId, input.id,
        JSON.stringify({ fields: Object.keys(input) }),
        JSON.stringify({ user_id: userId })],
    );

    return getServiceById(input.id, clinicId);
  });
}

// ─── Soft-delete ───────────────────────────────────────────────────────────

export async function deactivateService(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<void> {
  await getServiceById(id, clinicId);
  await withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE financial.service_catalog
          SET is_active = FALSE, deleted_at = NOW(), updated_by = $3
        WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId, userId],
    );
    await db.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, metadata)
       VALUES ($1,'financial_service',$2,'financial_service.deactivated',$3)`,
      [clinicId, id, JSON.stringify({ user_id: userId })],
    );
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function assertNameUnique(
  name:      string,
  clinicId:  string,
  excludeId: string | null,
): Promise<void> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM financial.service_catalog
      WHERE clinic_id = $1 AND name = $2 AND deleted_at IS NULL
        AND ($3::uuid IS NULL OR id != $3)
      LIMIT 1`,
    [clinicId, name, excludeId],
  );
  if (r.rows.length > 0) {
    throw new TRPCError({
      code:    'CONFLICT',
      message: `Já existe um serviço com o nome "${name}" nesta clínica.`,
    });
  }
}

import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../db/client.js';
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  ListSuppliersInput,
} from '@dermaos/shared';

export interface SupplierRow {
  id:             string;
  clinic_id:      string;
  name:           string;
  cnpj:           string | null;
  contact_name:   string | null;
  phone:          string | null;
  email:          string | null;
  address:        Record<string, string>;
  payment_terms:  string | null;
  lead_time_days: number | null;
  is_active:      boolean;
  deleted_at:     string | null;
  created_at:     string;
  updated_at:     string;
  created_by:     string | null;
  updated_by:     string | null;
}

/* ── Listagem ─────────────────────────────────────────────────────────────── */

export async function listSuppliers(
  input:    ListSuppliersInput,
  clinicId: string,
): Promise<{ data: SupplierRow[]; total: number }> {
  return withClinicContext(clinicId, async (client) => {
    const conditions: string[] = ['clinic_id = $1', 'deleted_at IS NULL'];
    const params: unknown[]    = [clinicId];
    let p = 2;

    if (input.search) {
      conditions.push(`(name ILIKE $${p} OR cnpj ILIKE $${p})`);
      params.push(`%${input.search}%`);
      p++;
    }

    const where  = conditions.join(' AND ');
    const offset = (input.page - 1) * input.limit;

    const [rows, countResult] = await Promise.all([
      client.query<SupplierRow>(
        `SELECT * FROM supply.suppliers WHERE ${where}
          ORDER BY name ASC LIMIT $${p} OFFSET $${p + 1}`,
        [...params, input.limit, offset],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM supply.suppliers WHERE ${where}`,
        params,
      ),
    ]);

    return {
      data:  rows.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  });
}

export async function getSupplierById(id: string, clinicId: string): Promise<SupplierRow> {
  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<SupplierRow>(
      `SELECT * FROM supply.suppliers
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [id, clinicId],
    );
    if (!r.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Fornecedor não encontrado.' });
    }
    return r.rows[0];
  });
}

/* ── Validações ───────────────────────────────────────────────────────────── */

async function assertCnpjUnique(
  cnpj:      string,
  clinicId:  string,
  excludeId: string | null,
): Promise<void> {
  const normalized = cnpj.replace(/\D/g, '');
  const r = await db.query<{ id: string }>(
    `SELECT id FROM supply.suppliers
      WHERE clinic_id = $1
        AND REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = $2
        AND deleted_at IS NULL
        AND ($3::uuid IS NULL OR id != $3)
      LIMIT 1`,
    [clinicId, normalized, excludeId],
  );
  if (r.rows.length > 0) {
    throw new TRPCError({
      code:    'CONFLICT',
      message: 'Já existe um fornecedor cadastrado com este CNPJ.',
    });
  }
}

/* ── Criação ──────────────────────────────────────────────────────────────── */

export async function createSupplier(
  input:    CreateSupplierInput,
  clinicId: string,
  userId:   string,
): Promise<SupplierRow> {
  await assertCnpjUnique(input.cnpj, clinicId, null);

  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO supply.suppliers
         (clinic_id, name, cnpj, contact_name, phone, email,
          address, payment_terms, lead_time_days, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id`,
      [
        clinicId,
        input.name,
        input.cnpj.replace(/\D/g, ''),
        input.contactName  ?? null,
        input.phone.replace(/\D/g, ''),
        input.email,
        JSON.stringify(input.address),
        input.paymentTerms ?? null,
        input.leadTimeDays ?? null,
        userId,
      ],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'supply_supplier', $2, 'supply_supplier.created', $3, $4)`,
      [clinicId, r.rows[0]!.id, JSON.stringify({ name: input.name }), JSON.stringify({ user_id: userId })],
    );

    return getSupplierById(r.rows[0]!.id, clinicId);
  });
}

/* ── Atualização ──────────────────────────────────────────────────────────── */

export async function updateSupplier(
  input:    UpdateSupplierInput,
  clinicId: string,
  userId:   string,
): Promise<SupplierRow> {
  await getSupplierById(input.id, clinicId);

  if (input.cnpj) {
    await assertCnpjUnique(input.cnpj, clinicId, input.id);
  }

  return withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE supply.suppliers
          SET name           = COALESCE($3, name),
              cnpj           = COALESCE($4, cnpj),
              contact_name   = COALESCE($5, contact_name),
              phone          = COALESCE($6, phone),
              email          = COALESCE($7, email),
              address        = COALESCE($8, address),
              payment_terms  = COALESCE($9, payment_terms),
              lead_time_days = COALESCE($10, lead_time_days),
              updated_by     = $11
        WHERE id = $1 AND clinic_id = $2`,
      [
        input.id, clinicId,
        input.name          ?? null,
        input.cnpj          ? input.cnpj.replace(/\D/g, '') : null,
        input.contactName   ?? null,
        input.phone         ? input.phone.replace(/\D/g, '') : null,
        input.email         ?? null,
        input.address       ? JSON.stringify(input.address) : null,
        input.paymentTerms  ?? null,
        input.leadTimeDays  !== undefined ? input.leadTimeDays : null,
        userId,
      ],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'supply_supplier', $2, 'supply_supplier.updated', $3, $4)`,
      [clinicId, input.id, JSON.stringify({ fields: Object.keys(input) }), JSON.stringify({ user_id: userId })],
    );

    return getSupplierById(input.id, clinicId);
  });
}

/* ── Soft-delete ──────────────────────────────────────────────────────────── */

export async function deleteSupplier(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<void> {
  await getSupplierById(id, clinicId);

  await withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE supply.suppliers
          SET deleted_at = NOW(), is_active = FALSE, updated_by = $3
        WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId, userId],
    );
    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, metadata)
       VALUES ($1, 'supply_supplier', $2, 'supply_supplier.deleted', $3)`,
      [clinicId, id, JSON.stringify({ user_id: userId })],
    );
  });
}

/* ── Verificação de CNPJ disponível (para feedback em tempo real) ──────── */

export async function checkCnpjAvailability(
  cnpj:      string,
  clinicId:  string,
  excludeId: string | undefined,
): Promise<{ available: boolean }> {
  const normalized = cnpj.replace(/\D/g, '');
  const r = await db.query<{ id: string }>(
    `SELECT id FROM supply.suppliers
      WHERE clinic_id = $1
        AND REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = $2
        AND deleted_at IS NULL
        AND ($3::uuid IS NULL OR id != $3)
      LIMIT 1`,
    [clinicId, normalized, excludeId ?? null],
  );
  return { available: r.rows.length === 0 };
}

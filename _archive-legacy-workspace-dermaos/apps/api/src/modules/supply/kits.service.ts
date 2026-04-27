import { TRPCError } from '@trpc/server';
import type { PoolClient } from 'pg';
import { withClinicContext, db } from '../../db/client.js';
import { emitToClinic } from '../../lib/socket.js';
import type {
  CreateKitInput,
  UpdateKitInput,
  ListKitsInput,
  KitAvailabilityInput,
  KitAvailabilityResult,
  KitAvailabilityItemResult,
  KitAvailabilityStatus,
  KitItemStatus,
  KitItemInput,
  KitStatus,
} from '@dermaos/shared';

/* ══════════════════════════════════════════════════════════════════════════
 * Kits de procedimento: CRUD, versionamento, disponibilidade
 * ══════════════════════════════════════════════════════════════════════════ */

export interface KitRow {
  id:                 string;
  name:               string;
  description:        string | null;
  procedure_type_id:  string | null;
  procedure_type_name: string | null;
  version:            number;
  parent_kit_id:      string | null;
  status:             KitStatus;
  items_count:        number;
  created_at:         string;
  updated_at:         string;
  created_by:         string | null;
  updated_by:         string | null;
}

export interface KitItemRow {
  id:             string;
  kit_template_id: string;
  product_id:     string;
  product_name:   string;
  product_unit:   string;
  quantity:       number;
  is_optional:    boolean;
  display_order:  number;
  notes:          string | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

async function assertProcedureType(
  client: PoolClient, procedureTypeId: string, clinicId: string,
): Promise<{ id: string; name: string }> {
  const r = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM shared.services
      WHERE id = $1 AND clinic_id = $2 AND is_active = TRUE
      LIMIT 1`,
    [procedureTypeId, clinicId],
  );
  if (!r.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tipo de procedimento não encontrado ou inativo.' });
  }
  return r.rows[0];
}

async function assertProductsExist(
  client: PoolClient, productIds: string[], clinicId: string,
): Promise<Map<string, { id: string; name: string }>> {
  const map = new Map<string, { id: string; name: string }>();
  if (productIds.length === 0) return map;
  const r = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM supply.products
      WHERE clinic_id = $1 AND id = ANY($2::uuid[])
        AND is_active = TRUE AND deleted_at IS NULL`,
    [clinicId, productIds],
  );
  for (const row of r.rows) map.set(row.id, row);
  const missing = productIds.filter((id) => !map.has(id));
  if (missing.length > 0) {
    throw new TRPCError({
      code:    'BAD_REQUEST',
      message: `Produtos inválidos, inativos ou de outro tenant: ${missing.join(', ')}`,
    });
  }
  return map;
}

async function hasConsumptions(client: PoolClient, kitId: string): Promise<boolean> {
  const r = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM supply.procedure_consumption_log
        WHERE kit_template_id = $1
     ) AS exists`,
    [kitId],
  );
  return !!r.rows[0]?.exists;
}

async function enforceUniqueActivePerProcedure(
  client:          PoolClient,
  clinicId:        string,
  procedureTypeId: string,
  excludeKitId:    string | null,
): Promise<void> {
  const r = await client.query<{ id: string }>(
    `SELECT id FROM supply.kit_templates
      WHERE clinic_id = $1 AND procedure_type_id = $2
        AND status = 'active' AND deleted_at IS NULL
        ${excludeKitId ? 'AND id <> $3' : ''}
      LIMIT 1`,
    excludeKitId ? [clinicId, procedureTypeId, excludeKitId] : [clinicId, procedureTypeId],
  );
  if (r.rows[0]) {
    throw new TRPCError({
      code:    'CONFLICT',
      message: 'Já existe um kit ativo para este tipo de procedimento. Arquive o existente antes de criar outro.',
    });
  }
}

async function insertKitItems(
  client:          PoolClient,
  clinicId:        string,
  kitId:           string,
  items:           KitItemInput[],
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    await client.query(
      `INSERT INTO supply.kit_items
         (clinic_id, kit_template_id, product_id, quantity, is_optional, display_order, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [clinicId, kitId, it.productId, it.quantity, it.isOptional, it.displayOrder ?? i, it.notes ?? null],
    );
  }
}

/* ── Create ──────────────────────────────────────────────────────────────── */

export async function createKit(
  input:   CreateKitInput,
  clinicId: string,
  userId:  string,
): Promise<{ id: string }> {
  return withClinicContext(clinicId, async (client) => {
    await assertProcedureType(client, input.procedureTypeId, clinicId);
    await assertProductsExist(client, input.items.map((i) => i.productId), clinicId);
    await enforceUniqueActivePerProcedure(client, clinicId, input.procedureTypeId, null);

    const r = await client.query<{ id: string }>(
      `INSERT INTO supply.kit_templates
         (clinic_id, name, description, procedure_type_id, service_id,
          version, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4, 1, 'active', $5, $5)
       RETURNING id`,
      [clinicId, input.name, input.description ?? null, input.procedureTypeId, userId],
    );
    const kitId = r.rows[0]!.id;

    await insertKitItems(client, clinicId, kitId, input.items);

    await writeAudit(clinicId, kitId, 'kit.created', userId, {
      kitName: input.name, procedureTypeId: input.procedureTypeId, itemCount: input.items.length,
    });

    emitToClinic(clinicId, 'supply.kit_changed', { kitId, action: 'created' });

    return { id: kitId };
  });
}

/* ── Update com versionamento ────────────────────────────────────────────── */

export async function updateKit(
  input:    UpdateKitInput,
  clinicId: string,
  userId:   string,
): Promise<{ id: string; versioned: boolean }> {
  return withClinicContext(clinicId, async (client) => {
    const existing = await client.query<{
      id: string; name: string; description: string | null;
      procedure_type_id: string | null; version: number;
    }>(
      `SELECT id, name, description, procedure_type_id, version
         FROM supply.kit_templates
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
          FOR UPDATE`,
      [input.id, clinicId],
    );
    if (!existing.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Kit não encontrado.' });
    }
    const current = existing.rows[0];

    const procedureTypeId = input.procedureTypeId ?? current.procedure_type_id;
    if (!procedureTypeId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Kit precisa de tipo de procedimento.' });
    }
    if (input.procedureTypeId) {
      await assertProcedureType(client, input.procedureTypeId, clinicId);
    }

    const structuralChange = input.items !== undefined;
    const needsVersioning  = structuralChange && (await hasConsumptions(client, current.id));

    if (input.items) {
      await assertProductsExist(client, input.items.map((i) => i.productId), clinicId);
    }

    if (needsVersioning) {
      if (!input.acknowledgeVersioning) {
        throw new TRPCError({
          code:    'PRECONDITION_FAILED',
          message: 'Este kit tem consumos históricos. Confirme a criação de nova versão (acknowledgeVersioning=true).',
        });
      }
      // Marca versão atual como superseded e cria nova versão.
      await client.query(
        `UPDATE supply.kit_templates
            SET status = 'superseded', updated_by = $2, updated_at = NOW()
          WHERE id = $1`,
        [current.id, userId],
      );

      const newR = await client.query<{ id: string }>(
        `INSERT INTO supply.kit_templates
           (clinic_id, name, description, procedure_type_id, service_id,
            version, parent_kit_id, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4, $5, $6, 'active', $7, $7)
         RETURNING id`,
        [
          clinicId,
          input.name ?? current.name,
          input.description ?? current.description,
          procedureTypeId,
          current.version + 1,
          current.id,
          userId,
        ],
      );
      const newKitId = newR.rows[0]!.id;
      await insertKitItems(client, clinicId, newKitId, input.items!);

      await writeAudit(clinicId, newKitId, 'kit.versioned', userId, {
        previousKitId: current.id, newVersion: current.version + 1,
      });

      emitToClinic(clinicId, 'supply.kit_changed', { kitId: newKitId, action: 'versioned', previousKitId: current.id });

      return { id: newKitId, versioned: true };
    }

    // Edição in-place (sem consumos históricos ou edição de metadados apenas)
    if (input.procedureTypeId && input.procedureTypeId !== current.procedure_type_id) {
      await enforceUniqueActivePerProcedure(client, clinicId, input.procedureTypeId, current.id);
    }

    await client.query(
      `UPDATE supply.kit_templates
          SET name              = COALESCE($2, name),
              description       = $3,
              procedure_type_id = COALESCE($4, procedure_type_id),
              service_id        = COALESCE($4, service_id),
              updated_by        = $5,
              updated_at        = NOW()
        WHERE id = $1`,
      [current.id, input.name ?? null, input.description ?? current.description, input.procedureTypeId ?? null, userId],
    );

    if (input.items) {
      await client.query(
        `DELETE FROM supply.kit_items WHERE kit_template_id = $1 AND clinic_id = $2`,
        [current.id, clinicId],
      );
      await insertKitItems(client, clinicId, current.id, input.items);
    }

    await writeAudit(clinicId, current.id, 'kit.updated', userId, {
      itemsReplaced: !!input.items,
    });

    emitToClinic(clinicId, 'supply.kit_changed', { kitId: current.id, action: 'updated' });

    return { id: current.id, versioned: false };
  });
}

/* ── Archive (soft delete) ───────────────────────────────────────────────── */

export async function archiveKit(
  kitId:    string,
  clinicId: string,
  userId:   string,
): Promise<{ id: string }> {
  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<{ id: string; status: KitStatus }>(
      `SELECT id, status FROM supply.kit_templates
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
          FOR UPDATE`,
      [kitId, clinicId],
    );
    if (!r.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Kit não encontrado.' });
    }

    await client.query(
      `UPDATE supply.kit_templates
          SET status = 'archived', updated_by = $2, updated_at = NOW(),
              is_active = FALSE
        WHERE id = $1`,
      [kitId, userId],
    );

    await writeAudit(clinicId, kitId, 'kit.archived', userId, {});
    emitToClinic(clinicId, 'supply.kit_changed', { kitId, action: 'archived' });

    return { id: kitId };
  });
}

/* ── List ────────────────────────────────────────────────────────────────── */

export async function listKits(
  input:    ListKitsInput,
  clinicId: string,
): Promise<{ data: KitRow[]; total: number }> {
  return withClinicContext(clinicId, async (client) => {
    const conds: string[] = ['kt.clinic_id = $1', 'kt.deleted_at IS NULL'];
    const params: unknown[] = [clinicId];
    let p = 2;

    if (!input.includeArchived) {
      conds.push(`kt.status = 'active'`);
    }
    if (input.procedureTypeId) {
      conds.push(`kt.procedure_type_id = $${p++}`);
      params.push(input.procedureTypeId);
    }
    if (input.search && input.search.trim().length >= 2) {
      conds.push(`kt.name ILIKE $${p}`);
      params.push(`%${input.search.trim()}%`);
      p += 1;
    }

    const where   = conds.join(' AND ');
    const offset  = (input.page - 1) * input.limit;

    const [rows, count] = await Promise.all([
      client.query<KitRow>(
        `SELECT kt.id, kt.name, kt.description, kt.procedure_type_id,
                s.name AS procedure_type_name,
                kt.version, kt.parent_kit_id, kt.status,
                (SELECT COUNT(*)::int FROM supply.kit_items ki
                  WHERE ki.kit_template_id = kt.id) AS items_count,
                kt.created_at, kt.updated_at, kt.created_by, kt.updated_by
           FROM supply.kit_templates kt
      LEFT JOIN shared.services s ON s.id = kt.procedure_type_id
          WHERE ${where}
          ORDER BY kt.updated_at DESC
          LIMIT $${p} OFFSET $${p + 1}`,
        [...params, input.limit, offset],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM supply.kit_templates kt WHERE ${where}`,
        params,
      ),
    ]);

    return {
      data:  rows.rows,
      total: parseInt(count.rows[0]?.count ?? '0', 10),
    };
  });
}

export async function getKitById(
  kitId:    string,
  clinicId: string,
): Promise<{ kit: KitRow; items: KitItemRow[] }> {
  return withClinicContext(clinicId, async (client) => {
    const kitR = await client.query<KitRow>(
      `SELECT kt.id, kt.name, kt.description, kt.procedure_type_id,
              s.name AS procedure_type_name,
              kt.version, kt.parent_kit_id, kt.status,
              0 AS items_count,
              kt.created_at, kt.updated_at, kt.created_by, kt.updated_by
         FROM supply.kit_templates kt
    LEFT JOIN shared.services s ON s.id = kt.procedure_type_id
        WHERE kt.id = $1 AND kt.clinic_id = $2 AND kt.deleted_at IS NULL`,
      [kitId, clinicId],
    );
    if (!kitR.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Kit não encontrado.' });
    }
    const itemsR = await client.query<KitItemRow>(
      `SELECT ki.id, ki.kit_template_id, ki.product_id,
              p.name AS product_name, p.unit AS product_unit,
              ki.quantity, ki.is_optional, ki.display_order, ki.notes
         FROM supply.kit_items ki
         JOIN supply.products p ON p.id = ki.product_id
        WHERE ki.kit_template_id = $1 AND ki.clinic_id = $2
        ORDER BY ki.display_order ASC, p.name ASC`,
      [kitId, clinicId],
    );
    return { kit: kitR.rows[0], items: itemsR.rows };
  });
}

/* ── Availability (disponibilidade por item + FEFO) ──────────────────────── */

export async function checkKitAvailability(
  input:    KitAvailabilityInput,
  clinicId: string,
): Promise<KitAvailabilityResult> {
  return withClinicContext(clinicId, async (client) => {
    const kitR = await client.query<{ id: string; name: string; version: number }>(
      `SELECT id, name, version FROM supply.kit_templates
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
      [input.kitId, clinicId],
    );
    if (!kitR.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Kit não encontrado.' });
    }

    const items = await client.query<{
      product_id: string; product_name: string; product_unit: string;
      quantity:   number; is_optional: boolean;
    }>(
      `SELECT ki.product_id, p.name AS product_name, p.unit AS product_unit,
              ki.quantity, ki.is_optional
         FROM supply.kit_items ki
         JOIN supply.products p ON p.id = ki.product_id
        WHERE ki.kit_template_id = $1 AND ki.clinic_id = $2
        ORDER BY ki.display_order ASC, p.name ASC`,
      [input.kitId, clinicId],
    );

    const results: KitAvailabilityItemResult[] = [];
    let kitStatus: KitAvailabilityStatus = 'completo';

    for (const it of items.rows) {
      const required = Number(it.quantity);
      const fefo = await client.query<{
        lot_id: string | null; lot_number: string | null; expiry_date: string | null;
        quantity_available: string; quantity_from_lot: string; is_insufficient: boolean;
      }>(
        `SELECT * FROM supply.select_lot_fefo($1, $2, $3)`,
        [clinicId, it.product_id, required],
      );

      const suggestedLots = fefo.rows
        .filter((r) => !r.is_insufficient && r.lot_id !== null)
        .map((r) => ({
          lotId:             r.lot_id!,
          lotNumber:         r.lot_number!,
          expiryDate:        r.expiry_date,
          quantityFromLot:   Number(r.quantity_from_lot),
          quantityAvailable: Number(r.quantity_available),
        }));

      const shortageRow = fefo.rows.find((r) => r.is_insufficient);
      const shortage    = shortageRow ? Number(shortageRow.quantity_available) : 0;
      const available   = required - shortage;

      let itemStatus: KitItemStatus;
      if (available >= required)      itemStatus = 'disponivel';
      else if (available > 0)         itemStatus = 'insuficiente';
      else                            itemStatus = 'indisponivel';

      if (!it.is_optional) {
        if (itemStatus === 'indisponivel')  kitStatus = 'indisponivel';
        else if (itemStatus === 'insuficiente' && kitStatus !== 'indisponivel') kitStatus = 'parcial';
      }

      results.push({
        productId:         it.product_id,
        productName:       it.product_name,
        productUnit:       it.product_unit,
        isOptional:        it.is_optional,
        quantityRequired:  required,
        quantityAvailable: available,
        status:            itemStatus,
        suggestedLots,
      });
    }

    return {
      kitId:      kitR.rows[0].id,
      kitName:    kitR.rows[0].name,
      kitVersion: kitR.rows[0].version,
      status:     kitStatus,
      items:      results,
      checkedAt:  new Date().toISOString(),
    };
  });
}

/* ── Audit helper ────────────────────────────────────────────────────────── */

async function writeAudit(
  clinicId: string, kitId: string, eventType: string, userId: string, payload: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
     VALUES ($1, 'supply_kit', $2, $3, $4, $5)`,
    [
      clinicId, kitId, eventType,
      JSON.stringify(payload),
      JSON.stringify({ user_id: userId }),
    ],
  );
}

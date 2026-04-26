import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../db/client.js';
import { REFRIGERATED_STORAGE_TYPES, type StorageType } from '@dermaos/shared';
import type {
  CreateStorageLocationInput,
  UpdateStorageLocationInput,
  ListStorageLocationsInput,
} from '@dermaos/shared';

export interface StorageLocationRow {
  id:          string;
  clinic_id:   string;
  name:        string;
  type:        StorageType;
  description: string | null;
  min_temp_c:  number | null;
  max_temp_c:  number | null;
  is_active:   boolean;
  deleted_at:  string | null;
  created_at:  string;
  updated_at:  string;
  created_by:  string | null;
  updated_by:  string | null;
  // Computed
  supports_refrigeration: boolean;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function computeSupportsRefrigeration(type: StorageType): boolean {
  return (REFRIGERATED_STORAGE_TYPES as ReadonlyArray<string>).includes(type);
}

/* ── Listagem ─────────────────────────────────────────────────────────────── */

export async function listStorageLocations(
  input:    ListStorageLocationsInput,
  clinicId: string,
): Promise<StorageLocationRow[]> {
  return withClinicContext(clinicId, async (client) => {
    const conditions: string[] = ['clinic_id = $1', 'deleted_at IS NULL', 'is_active = TRUE'];
    const params: unknown[]    = [clinicId];

    if (input.refrigerationOnly) {
      conditions.push(`type = ANY($${params.length + 1}::supply.storage_type[])`);
      params.push(REFRIGERATED_STORAGE_TYPES);
    }

    const rows = await client.query<Omit<StorageLocationRow, 'supports_refrigeration'>>(
      `SELECT * FROM supply.storage_locations
        WHERE ${conditions.join(' AND ')}
        ORDER BY name ASC`,
      params,
    );

    return rows.rows.map(r => ({
      ...r,
      supports_refrigeration: computeSupportsRefrigeration(r.type),
    }));
  });
}

export async function getStorageLocationById(
  id:       string,
  clinicId: string,
): Promise<StorageLocationRow> {
  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<Omit<StorageLocationRow, 'supports_refrigeration'>>(
      `SELECT * FROM supply.storage_locations
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [id, clinicId],
    );
    if (!r.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Local de armazenamento não encontrado.' });
    }
    return {
      ...r.rows[0],
      supports_refrigeration: computeSupportsRefrigeration(r.rows[0].type),
    };
  });
}

/* ── Validações ───────────────────────────────────────────────────────────── */

async function assertNameUnique(
  name:      string,
  clinicId:  string,
  excludeId: string | null,
): Promise<void> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM supply.storage_locations
      WHERE clinic_id = $1 AND name = $2 AND deleted_at IS NULL
        AND ($3::uuid IS NULL OR id != $3)
      LIMIT 1`,
    [clinicId, name, excludeId],
  );
  if (r.rows.length > 0) {
    throw new TRPCError({
      code:    'CONFLICT',
      message: `Já existe um local de armazenamento com o nome "${name}".`,
    });
  }
}

/* ── Criação ──────────────────────────────────────────────────────────────── */

export async function createStorageLocation(
  input:    CreateStorageLocationInput,
  clinicId: string,
  userId:   string,
): Promise<StorageLocationRow> {
  await assertNameUnique(input.name, clinicId, null);

  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO supply.storage_locations
         (clinic_id, name, type, description, min_temp_c, max_temp_c, created_by, updated_by)
       VALUES ($1, $2, $3::supply.storage_type, $4, $5, $6, $7, $7)
       RETURNING id`,
      [
        clinicId, input.name, input.type,
        input.description ?? null,
        input.minTempC    ?? null,
        input.maxTempC    ?? null,
        userId,
      ],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'supply_storage_location', $2, 'supply_storage_location.created', $3, $4)`,
      [clinicId, r.rows[0]!.id, JSON.stringify({ name: input.name, type: input.type }), JSON.stringify({ user_id: userId })],
    );

    return getStorageLocationById(r.rows[0]!.id, clinicId);
  });
}

/* ── Atualização ──────────────────────────────────────────────────────────── */

export async function updateStorageLocation(
  input:    UpdateStorageLocationInput,
  clinicId: string,
  userId:   string,
): Promise<StorageLocationRow> {
  await getStorageLocationById(input.id, clinicId);

  if (input.name) {
    await assertNameUnique(input.name, clinicId, input.id);
  }

  return withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE supply.storage_locations
          SET name        = COALESCE($3, name),
              type        = COALESCE($4::supply.storage_type, type),
              description = COALESCE($5, description),
              min_temp_c  = COALESCE($6, min_temp_c),
              max_temp_c  = COALESCE($7, max_temp_c),
              updated_by  = $8
        WHERE id = $1 AND clinic_id = $2`,
      [
        input.id, clinicId,
        input.name        ?? null,
        input.type        ?? null,
        input.description ?? null,
        input.minTempC    ?? null,
        input.maxTempC    ?? null,
        userId,
      ],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'supply_storage_location', $2, 'supply_storage_location.updated', $3, $4)`,
      [clinicId, input.id, JSON.stringify({ fields: Object.keys(input) }), JSON.stringify({ user_id: userId })],
    );

    return getStorageLocationById(input.id, clinicId);
  });
}

/* ── Soft-delete ──────────────────────────────────────────────────────────── */

export async function deleteStorageLocation(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<void> {
  await getStorageLocationById(id, clinicId);

  // Bloqueia se houver lotes com estoque neste local
  const lotsCheck = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM supply.inventory_lots
      WHERE storage_location_id = $1 AND clinic_id = $2 AND quantity_current > 0`,
    [id, clinicId],
  );
  if (parseInt(lotsCheck.rows[0]?.count ?? '0', 10) > 0) {
    throw new TRPCError({
      code:    'PRECONDITION_FAILED',
      message: 'Não é possível excluir um local com lotes de estoque ativos. Transfira os lotes primeiro.',
    });
  }

  await withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE supply.storage_locations
          SET deleted_at = NOW(), is_active = FALSE, updated_by = $3
        WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId, userId],
    );
    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, metadata)
       VALUES ($1, 'supply_storage_location', $2, 'supply_storage_location.deleted', $3)`,
      [clinicId, id, JSON.stringify({ user_id: userId })],
    );
  });
}

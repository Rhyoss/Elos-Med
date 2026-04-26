import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import {
  upsertProductDocument,
  deleteProductDocument,
  searchProductsInTypesense,
} from '../../lib/typesense.js';
import { REFRIGERATED_STORAGE_TYPES } from '@dermaos/shared';
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsInput,
  CheckSkuInput,
} from '@dermaos/shared';

export interface ProductRow {
  id:                       string;
  clinic_id:                string;
  category_id:              string | null;
  preferred_supplier_id:    string | null;
  name:                     string;
  description:              string | null;
  sku:                      string | null;
  barcode:                  string | null;
  brand:                    string | null;
  unit:                     string;
  unit_cost:                number | null;
  sale_price:               number | null;
  markup_pct:               number | null;
  requires_prescription:    boolean;
  is_controlled:            boolean;
  control_class:            string | null;
  is_consumable:            boolean;
  is_cold_chain:            boolean;
  default_storage_location_id: string | null;
  min_stock:                number;
  max_stock:                number | null;
  reorder_point:            number | null;
  anvisa_registration:      string | null;
  photo_object_key:         string | null;
  is_active:                boolean;
  deleted_at:               string | null;
  created_at:               string;
  updated_at:               string;
  created_by:               string | null;
  updated_by:               string | null;
  // JOINed
  category_name:            string | null;
  supplier_name:            string | null;
  substitute_ids:           string[];
}

/* ── Listagem ─────────────────────────────────────────────────────────────── */

export async function listProducts(
  input:    ListProductsInput,
  clinicId: string,
): Promise<{ data: ProductRow[]; total: number }> {
  return withClinicContext(clinicId, async (client) => {
    const conditions: string[] = ['p.clinic_id = $1', 'p.deleted_at IS NULL'];
    const params: unknown[]    = [clinicId];
    let p = 2;

    if (input.isActive !== undefined) {
      conditions.push(`p.is_active = $${p++}`);
      params.push(input.isActive);
    }
    if (input.categoryId) {
      conditions.push(`p.category_id = $${p++}`);
      params.push(input.categoryId);
    }
    if (input.search) {
      conditions.push(`(p.name ILIKE $${p} OR p.sku ILIKE $${p} OR p.barcode ILIKE $${p})`);
      params.push(`%${input.search}%`);
      p++;
    }

    const where  = conditions.join(' AND ');
    const offset = (input.page - 1) * input.limit;

    const [rows, countResult] = await Promise.all([
      client.query<ProductRow>(
        `SELECT p.*,
                c.name AS category_name,
                s.name AS supplier_name,
                COALESCE(
                  ARRAY(SELECT substitute_id FROM supply.product_substitutes
                         WHERE product_id = p.id AND clinic_id = p.clinic_id),
                  '{}'::uuid[]
                ) AS substitute_ids
           FROM supply.products p
      LEFT JOIN supply.categories c ON c.id = p.category_id AND c.deleted_at IS NULL
      LEFT JOIN supply.suppliers  s ON s.id = p.preferred_supplier_id AND s.deleted_at IS NULL
          WHERE ${where}
          ORDER BY p.name ASC
          LIMIT $${p} OFFSET $${p + 1}`,
        [...params, input.limit, offset],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM supply.products p WHERE ${where}`,
        params,
      ),
    ]);

    return {
      data:  rows.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  });
}

export async function getProductById(id: string, clinicId: string): Promise<ProductRow> {
  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<ProductRow>(
      `SELECT p.*,
              c.name AS category_name,
              s.name AS supplier_name,
              COALESCE(
                ARRAY(SELECT substitute_id FROM supply.product_substitutes
                       WHERE product_id = p.id AND clinic_id = p.clinic_id),
                '{}'::uuid[]
              ) AS substitute_ids
         FROM supply.products p
    LEFT JOIN supply.categories c ON c.id = p.category_id AND c.deleted_at IS NULL
    LEFT JOIN supply.suppliers  s ON s.id = p.preferred_supplier_id AND s.deleted_at IS NULL
        WHERE p.id = $1 AND p.clinic_id = $2 AND p.deleted_at IS NULL
        LIMIT 1`,
      [id, clinicId],
    );
    if (!r.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Produto não encontrado.' });
    }
    return r.rows[0];
  });
}

/* ── Verificações ─────────────────────────────────────────────────────────── */

export async function checkSkuAvailability(
  input:    CheckSkuInput,
  clinicId: string,
): Promise<{ available: boolean }> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM supply.products
      WHERE clinic_id = $1 AND sku = $2 AND deleted_at IS NULL
        AND ($3::uuid IS NULL OR id != $3)
      LIMIT 1`,
    [clinicId, input.sku, input.excludeId ?? null],
  );
  return { available: r.rows.length === 0 };
}

async function assertSkuUnique(
  sku:       string,
  clinicId:  string,
  excludeId: string | null,
): Promise<void> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM supply.products
      WHERE clinic_id = $1 AND sku = $2 AND deleted_at IS NULL
        AND ($3::uuid IS NULL OR id != $3)
      LIMIT 1`,
    [clinicId, sku, excludeId],
  );
  if (r.rows.length > 0) {
    throw new TRPCError({
      code:    'CONFLICT',
      message: `O SKU "${sku}" já está em uso por outro produto deste tenant.`,
    });
  }
}

async function assertColdChainLocation(
  storageLocationId: string | null | undefined,
  clinicId:          string,
): Promise<void> {
  if (!storageLocationId) return;

  const r = await db.query<{ type: string }>(
    `SELECT type::text FROM supply.storage_locations
      WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [storageLocationId, clinicId],
  );
  if (!r.rows[0]) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Local de armazenamento não encontrado.' });
  }
  if (!(REFRIGERATED_STORAGE_TYPES as ReadonlyArray<string>).includes(r.rows[0].type)) {
    throw new TRPCError({
      code:    'BAD_REQUEST',
      message: `Produto com cadeia fria exige local que suporte refrigeração (geladeira ou freezer). O local "${storageLocationId}" é do tipo "${r.rows[0].type}".`,
    });
  }
}

/* ── Criação ──────────────────────────────────────────────────────────────── */

export async function createProduct(
  input:    CreateProductInput,
  clinicId: string,
  userId:   string,
): Promise<ProductRow> {
  await assertSkuUnique(input.sku, clinicId, null);

  if (input.isColdChain) {
    await assertColdChainLocation(input.defaultStorageLocationId, clinicId);
  }

  // Valida que substitutos existem e são do mesmo tenant (sem auto-referência)
  if (input.substituteIds.length > 0) {
    const found = await db.query<{ id: string }>(
      `SELECT id FROM supply.products
        WHERE id = ANY($1::uuid[]) AND clinic_id = $2 AND deleted_at IS NULL`,
      [input.substituteIds, clinicId],
    );
    if (found.rows.length !== input.substituteIds.length) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Um ou mais produtos substitutos não encontrados.' });
    }
  }

  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO supply.products
         (clinic_id, category_id, preferred_supplier_id, name, sku, barcode, brand, unit,
          unit_cost, sale_price, min_stock, max_stock, reorder_point,
          anvisa_registration, is_controlled, control_class, is_cold_chain,
          default_storage_location_id, requires_prescription, is_consumable,
          photo_object_key, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22)
       RETURNING id`,
      [
        clinicId,
        input.categoryId               ?? null,
        input.preferredSupplierId      ?? null,
        input.name,
        input.sku,
        input.barcode                  ?? null,
        input.brand                    ?? null,
        input.unit,
        input.unitCost                 ?? null,
        input.salePrice                ?? null,
        input.minStock,
        input.maxStock                 ?? null,
        input.reorderPoint             ?? null,
        input.anvisaRegistration       ?? null,
        input.isControlled,
        input.controlClass             ?? null,
        input.isColdChain,
        input.defaultStorageLocationId ?? null,
        input.requiresPrescription,
        input.isConsumable,
        input.photoObjectKey           ?? null,
        userId,
      ],
    );

    const productId = r.rows[0]!.id;

    // Insere substitutos
    if (input.substituteIds.length > 0) {
      const values = input.substituteIds
        .map((_, i) => `($1, $${i + 2}, $${input.substituteIds.length + 2})`)
        .join(',');
      await client.query(
        `INSERT INTO supply.product_substitutes (product_id, substitute_id, clinic_id)
         VALUES ${values} ON CONFLICT DO NOTHING`,
        [productId, ...input.substituteIds, clinicId],
      );
    }

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'supply_product', $2, 'supply_product.created', $3, $4)`,
      [clinicId, productId, JSON.stringify({ name: input.name, sku: input.sku }), JSON.stringify({ user_id: userId })],
    );

    const product = await getProductById(productId, clinicId);

    // Indexa no Typesense (falha silenciosa)
    void indexProductInTypesense(product);

    return product;
  });
}

/* ── Atualização ──────────────────────────────────────────────────────────── */

export async function updateProduct(
  input:    UpdateProductInput,
  clinicId: string,
  userId:   string,
): Promise<ProductRow> {
  const current = await getProductById(input.id, clinicId);

  if (input.sku && input.sku !== current.sku) {
    await assertSkuUnique(input.sku, clinicId, input.id);
  }

  const willBeColdChain = input.isColdChain ?? current.is_cold_chain;
  const newLocationId   = input.defaultStorageLocationId !== undefined
    ? input.defaultStorageLocationId
    : current.default_storage_location_id;

  if (willBeColdChain && newLocationId) {
    await assertColdChainLocation(newLocationId, clinicId);
  }

  return withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE supply.products
          SET name                      = COALESCE($3, name),
              sku                       = COALESCE($4, sku),
              barcode                   = COALESCE($5, barcode),
              category_id               = COALESCE($6, category_id),
              preferred_supplier_id     = COALESCE($7, preferred_supplier_id),
              brand                     = COALESCE($8, brand),
              unit                      = COALESCE($9, unit),
              unit_cost                 = COALESCE($10, unit_cost),
              sale_price                = COALESCE($11, sale_price),
              min_stock                 = COALESCE($12, min_stock),
              max_stock                 = COALESCE($13, max_stock),
              reorder_point             = COALESCE($14, reorder_point),
              anvisa_registration       = COALESCE($15, anvisa_registration),
              is_controlled             = COALESCE($16, is_controlled),
              control_class             = COALESCE($17, control_class),
              is_cold_chain             = COALESCE($18, is_cold_chain),
              default_storage_location_id = COALESCE($19, default_storage_location_id),
              requires_prescription     = COALESCE($20, requires_prescription),
              is_consumable             = COALESCE($21, is_consumable),
              photo_object_key          = COALESCE($22, photo_object_key),
              is_active                 = COALESCE($23, is_active),
              updated_by                = $24
        WHERE id = $1 AND clinic_id = $2`,
      [
        input.id, clinicId,
        input.name                    ?? null,
        input.sku                     ?? null,
        input.barcode                 ?? null,
        input.categoryId              ?? null,
        input.preferredSupplierId     ?? null,
        input.brand                   ?? null,
        input.unit                    ?? null,
        input.unitCost                ?? null,
        input.salePrice               ?? null,
        input.minStock                ?? null,
        input.maxStock                ?? null,
        input.reorderPoint            ?? null,
        input.anvisaRegistration      ?? null,
        input.isControlled            ?? null,
        input.controlClass            ?? null,
        input.isColdChain             ?? null,
        input.defaultStorageLocationId ?? null,
        input.requiresPrescription    ?? null,
        input.isConsumable            ?? null,
        input.photoObjectKey          ?? null,
        input.isActive                ?? null,
        userId,
      ],
    );

    // Atualiza substitutos se fornecidos
    if (input.substituteIds !== undefined) {
      if (input.substituteIds.includes(input.id)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Um produto não pode ser substituto de si mesmo.' });
      }
      await client.query(
        'DELETE FROM supply.product_substitutes WHERE product_id = $1 AND clinic_id = $2',
        [input.id, clinicId],
      );
      if (input.substituteIds.length > 0) {
        const values = input.substituteIds
          .map((_, i) => `($1, $${i + 2}, $${input.substituteIds!.length + 2})`)
          .join(',');
        await client.query(
          `INSERT INTO supply.product_substitutes (product_id, substitute_id, clinic_id)
           VALUES ${values} ON CONFLICT DO NOTHING`,
          [input.id, ...input.substituteIds, clinicId],
        );
      }
    }

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'supply_product', $2, 'supply_product.updated', $3, $4)`,
      [clinicId, input.id, JSON.stringify({ fields: Object.keys(input) }), JSON.stringify({ user_id: userId })],
    );

    const updated = await getProductById(input.id, clinicId);
    void indexProductInTypesense(updated);
    return updated;
  });
}

/* ── Soft-delete ──────────────────────────────────────────────────────────── */

export async function deleteProduct(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<void> {
  await getProductById(id, clinicId);

  await withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE supply.products
          SET deleted_at = NOW(), is_active = FALSE, updated_by = $3
        WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId, userId],
    );
    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, metadata)
       VALUES ($1, 'supply_product', $2, 'supply_product.deleted', $3)`,
      [clinicId, id, JSON.stringify({ user_id: userId })],
    );
  });

  await deleteProductDocument(id);
}

/* ── Busca (Typesense + fallback SQL) ─────────────────────────────────────── */

export async function searchProducts(
  query:    string,
  clinicId: string,
  page:     number,
  perPage:  number,
): Promise<{ ids: string[]; found: number }> {
  try {
    const result = await searchProductsInTypesense(query, clinicId, page, perPage);
    return {
      ids:   result.hits.map(h => h.document.id),
      found: result.found,
    };
  } catch (err) {
    // Degradação graciosa: fallback para busca SQL
    logger.warn({ err, query, clinicId }, 'Typesense unavailable, falling back to SQL search');
    return searchProductsSQL(query, clinicId, page, perPage);
  }
}

async function searchProductsSQL(
  query:    string,
  clinicId: string,
  page:     number,
  perPage:  number,
): Promise<{ ids: string[]; found: number }> {
  const offset = (page - 1) * perPage;
  const term   = `%${query}%`;
  const r = await db.query<{ id: string; count: string }>(
    `SELECT id, COUNT(*) OVER() AS count
       FROM supply.products
      WHERE clinic_id = $1 AND deleted_at IS NULL AND is_active = TRUE
        AND (name ILIKE $2 OR sku ILIKE $2 OR barcode ILIKE $2 OR brand ILIKE $2)
      ORDER BY name ASC
      LIMIT $3 OFFSET $4`,
    [clinicId, term, perPage, offset],
  );
  return {
    ids:   r.rows.map(row => row.id),
    found: r.rows.length > 0 ? parseInt(r.rows[0]!.count, 10) : 0,
  };
}

/* ── Indexação Typesense ──────────────────────────────────────────────────── */

async function indexProductInTypesense(product: ProductRow): Promise<void> {
  try {
    await upsertProductDocument({
      id:            product.id,
      clinic_id:     product.clinic_id,
      name:          product.name,
      sku:           product.sku ?? '',
      barcode:       product.barcode ?? '',
      brand:         product.brand ?? '',
      category_name: product.category_name ?? '',
      is_active:     product.is_active,
      created_at:    Math.floor(new Date(product.created_at).getTime() / 1000),
    });
  } catch (err) {
    logger.warn({ err, productId: product.id }, 'Failed to index product in Typesense');
  }
}

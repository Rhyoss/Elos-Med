import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../db/client.js';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  ListCategoriesInput,
} from '@dermaos/shared';

export interface CategoryRow {
  id:          string;
  clinic_id:   string;
  parent_id:   string | null;
  name:        string;
  description: string | null;
  is_active:   boolean;
  deleted_at:  string | null;
  created_at:  string;
  updated_at:  string;
  created_by:  string | null;
  updated_by:  string | null;
  // JOIN
  parent_name: string | null;
  depth:       number;
}

/* ── Listagem ─────────────────────────────────────────────────────────────── */

export async function listCategories(
  input:    ListCategoriesInput,
  clinicId: string,
): Promise<CategoryRow[]> {
  return withClinicContext(clinicId, async (client) => {
    const rows = await client.query<CategoryRow>(
      `WITH RECURSIVE tree AS (
          SELECT c.*, 0 AS depth, NULL::text AS parent_name
            FROM supply.categories c
           WHERE c.clinic_id = $1 AND c.parent_id IS NULL AND c.deleted_at IS NULL
         UNION ALL
          SELECT c.*, t.depth + 1, t.name AS parent_name
            FROM supply.categories c
            JOIN tree t ON t.id = c.parent_id
           WHERE c.deleted_at IS NULL
       )
       SELECT * FROM tree
        ORDER BY depth ASC, name ASC`,
      [clinicId],
    );
    return rows.rows;
  });
}

export async function getCategoryById(id: string, clinicId: string): Promise<CategoryRow> {
  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<CategoryRow>(
      `SELECT c.*, p.name AS parent_name, 0 AS depth
         FROM supply.categories c
    LEFT JOIN supply.categories p ON p.id = c.parent_id AND p.deleted_at IS NULL
        WHERE c.id = $1 AND c.clinic_id = $2 AND c.deleted_at IS NULL
        LIMIT 1`,
      [id, clinicId],
    );
    if (!r.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Categoria não encontrada.' });
    }
    return r.rows[0];
  });
}

/* ── Validações ───────────────────────────────────────────────────────────── */

async function assertMaxDepth(
  parentId:  string | null | undefined,
  clinicId:  string,
  excludeId: string | null,
): Promise<void> {
  if (!parentId) return; // nível 1 — sem pai

  const r = await db.query<{ depth: number }>(
    `WITH RECURSIVE tree AS (
        SELECT id, parent_id, 0 AS depth
          FROM supply.categories
         WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
       UNION ALL
        SELECT c.id, c.parent_id, t.depth + 1
          FROM supply.categories c
          JOIN tree t ON t.parent_id = c.id
         WHERE c.deleted_at IS NULL
     )
     SELECT MAX(depth) AS depth FROM tree`,
    [parentId, clinicId],
  );
  const parentDepth = r.rows[0]?.depth ?? 0;
  // Máximo 3 níveis: pai no nível 0, filho no 1, neto no 2 (índice base 0)
  if (parentDepth >= 2) {
    throw new TRPCError({
      code:    'BAD_REQUEST',
      message: 'Hierarquia de categorias permite no máximo 3 níveis. O pai selecionado já está no nível máximo.',
    });
  }
  void excludeId;
}

async function assertNameUnique(
  name:      string,
  parentId:  string | null | undefined,
  clinicId:  string,
  excludeId: string | null,
): Promise<void> {
  const parentKey = parentId ?? '';
  const r = await db.query<{ id: string }>(
    `SELECT id FROM supply.categories
      WHERE clinic_id = $1
        AND COALESCE(parent_id::text, '') = $2
        AND name = $3
        AND deleted_at IS NULL
        AND ($4::uuid IS NULL OR id != $4)
      LIMIT 1`,
    [clinicId, parentKey, name, excludeId],
  );
  if (r.rows.length > 0) {
    throw new TRPCError({
      code:    'CONFLICT',
      message: `Já existe uma categoria com o nome "${name}" neste nível. Use um nome diferente.`,
    });
  }
}

/* ── Criação ──────────────────────────────────────────────────────────────── */

export async function createCategory(
  input:    CreateCategoryInput,
  clinicId: string,
  userId:   string,
): Promise<CategoryRow> {
  await assertMaxDepth(input.parentId, clinicId, null);
  await assertNameUnique(input.name, input.parentId, clinicId, null);

  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO supply.categories (clinic_id, parent_id, name, description, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id`,
      [clinicId, input.parentId ?? null, input.name, input.description ?? null, userId],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'supply_category', $2, 'supply_category.created', $3, $4)`,
      [clinicId, r.rows[0]!.id, JSON.stringify({ name: input.name }), JSON.stringify({ user_id: userId })],
    );

    return getCategoryById(r.rows[0]!.id, clinicId);
  });
}

/* ── Atualização ──────────────────────────────────────────────────────────── */

export async function updateCategory(
  input:    UpdateCategoryInput,
  clinicId: string,
  userId:   string,
): Promise<CategoryRow> {
  const current = await getCategoryById(input.id, clinicId);

  const newName     = input.name     ?? current.name;
  const newParentId = input.parentId !== undefined ? input.parentId : current.parent_id;

  if (input.name || input.parentId !== undefined) {
    await assertMaxDepth(newParentId, clinicId, input.id);
    await assertNameUnique(newName, newParentId, clinicId, input.id);
  }

  // Impede criar ciclo: novo parent não pode ser descendente do próprio item
  if (input.parentId) {
    const cycleCheck = await db.query<{ id: string }>(
      `WITH RECURSIVE descendants AS (
          SELECT id FROM supply.categories WHERE id = $1 AND deleted_at IS NULL
        UNION ALL
          SELECT c.id FROM supply.categories c JOIN descendants d ON d.id = c.parent_id
          WHERE c.deleted_at IS NULL
       )
       SELECT id FROM descendants WHERE id = $2 LIMIT 1`,
      [input.id, input.parentId],
    );
    if (cycleCheck.rows.length > 0) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: 'Operação criaria um ciclo na hierarquia de categorias.',
      });
    }
  }

  return withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE supply.categories
          SET name        = COALESCE($3, name),
              parent_id   = CASE WHEN $4::boolean THEN $5::uuid ELSE parent_id END,
              description = COALESCE($6, description),
              updated_by  = $7
        WHERE id = $1 AND clinic_id = $2`,
      [
        input.id, clinicId,
        input.name      ?? null,
        input.parentId !== undefined,
        input.parentId  ?? null,
        input.description ?? null,
        userId,
      ],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'supply_category', $2, 'supply_category.updated', $3, $4)`,
      [clinicId, input.id, JSON.stringify({ fields: Object.keys(input) }), JSON.stringify({ user_id: userId })],
    );

    return getCategoryById(input.id, clinicId);
  });
}

/* ── Soft-delete ──────────────────────────────────────────────────────────── */

export async function deleteCategory(
  id:       string,
  clinicId: string,
  userId:   string,
): Promise<void> {
  await getCategoryById(id, clinicId);

  // Impede deleção de categoria com produtos vinculados
  const prodCheck = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM supply.products
      WHERE category_id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
    [id, clinicId],
  );
  if (parseInt(prodCheck.rows[0]?.count ?? '0', 10) > 0) {
    throw new TRPCError({
      code:    'PRECONDITION_FAILED',
      message: 'Não é possível excluir uma categoria com produtos vinculados. Remova ou remova os produtos primeiro.',
    });
  }

  // Impede deleção de categoria com subcategorias ativas
  const childCheck = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM supply.categories
      WHERE parent_id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
    [id, clinicId],
  );
  if (parseInt(childCheck.rows[0]?.count ?? '0', 10) > 0) {
    throw new TRPCError({
      code:    'PRECONDITION_FAILED',
      message: 'Não é possível excluir uma categoria que possui subcategorias. Remova as subcategorias primeiro.',
    });
  }

  await withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE supply.categories
          SET deleted_at = NOW(), is_active = FALSE, updated_by = $3
        WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId, userId],
    );
    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, metadata)
       VALUES ($1, 'supply_category', $2, 'supply_category.deleted', $3)`,
      [clinicId, id, JSON.stringify({ user_id: userId })],
    );
  });
}

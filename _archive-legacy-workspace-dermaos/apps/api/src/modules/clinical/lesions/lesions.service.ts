import { TRPCError } from '@trpc/server';
import { db, withClinicContext } from '../../../db/client.js';
import { emitToClinic } from '../../../lib/socket.js';
import type {
  CreateLesionInput,
  UpdateLesionInput,
  LesionStatus,
  ListLesionsByPatientQuery,
} from '@dermaos/shared';

interface LesionRow {
  id:                  string;
  clinic_id:           string;
  patient_id:          string;
  location_body_map:   string;
  location_notes:      string | null;
  morphology:          string[];
  color:               string[];
  size_mm:             string | null;
  description:         string | null;
  first_noted_at:      string | null;
  is_active:           boolean;
  status:              LesionStatus;
  status_reason:       string | null;
  status_changed_at:   string | null;
  status_changed_by:   string | null;
  created_at:          string;
  updated_at:          string;
  created_by:          string | null;
  updated_by:          string | null;
  deleted_at:          string | null;
  deleted_by:          string | null;
  deletion_reason:     string | null;
}

export interface LesionPublic {
  id:             string;
  clinicId:       string;
  patientId:      string;
  bodyRegion:     string;
  locationNotes:  string | null;
  morphology:     string[];
  color:          string[];
  sizeMm:         number | null;
  description:    string | null;
  firstNotedAt:   Date | null;
  status:         LesionStatus;
  statusReason:   string | null;
  statusChangedAt: Date | null;
  statusChangedBy: string | null;
  imageCount:     number;
  createdAt:      Date;
  updatedAt:      Date;
  createdBy:      string | null;
  updatedBy:      string | null;
  deletedAt:      Date | null;
}

function mapRow(row: LesionRow, imageCount = 0): LesionPublic {
  return {
    id:              row.id,
    clinicId:        row.clinic_id,
    patientId:       row.patient_id,
    bodyRegion:      row.location_body_map,
    locationNotes:   row.location_notes,
    morphology:      row.morphology ?? [],
    color:           row.color ?? [],
    sizeMm:          row.size_mm != null ? parseFloat(row.size_mm) : null,
    description:     row.description,
    firstNotedAt:    row.first_noted_at ? new Date(row.first_noted_at) : null,
    status:          row.status,
    statusReason:    row.status_reason,
    statusChangedAt: row.status_changed_at ? new Date(row.status_changed_at) : null,
    statusChangedBy: row.status_changed_by,
    imageCount,
    createdAt:       new Date(row.created_at),
    updatedAt:       new Date(row.updated_at),
    createdBy:       row.created_by,
    updatedBy:       row.updated_by,
    deletedAt:       row.deleted_at ? new Date(row.deleted_at) : null,
  };
}

async function assertPatientInClinic(
  clinicId: string,
  patientId: string,
): Promise<void> {
  const res = await db.query(
    `SELECT 1 FROM shared.patients WHERE id = $1 AND clinic_id = $2`,
    [patientId, clinicId],
  );
  if (res.rowCount === 0) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado' });
  }
}

export async function createLesion(
  input:    CreateLesionInput,
  clinicId: string,
  userId:   string,
): Promise<LesionPublic> {
  await assertPatientInClinic(clinicId, input.patientId);

  return withClinicContext(clinicId, async (client) => {
    const result = await client.query<LesionRow>(
      `INSERT INTO clinical.lesions
         (clinic_id, patient_id, location_body_map, location_notes,
          morphology, color, size_mm, description, first_noted_at,
          status, created_by, updated_by, is_active)
       VALUES ($1, $2, $3, $4, $5::text[], $6::text[], $7, $8, $9,
               'active', $10, $10, TRUE)
       RETURNING *`,
      [
        clinicId,
        input.patientId,
        input.bodyRegion,
        input.locationNotes ?? null,
        input.morphology,
        input.color,
        input.sizeMm ?? null,
        input.description,
        input.firstNotedAt ?? null,
        userId, // reportedBy registrado como created_by/updated_by
      ],
    );
    const lesion = mapRow(result.rows[0]!);

    setImmediate(() => {
      emitToClinic(clinicId, 'lesion.created', {
        lesionId:  lesion.id,
        patientId: lesion.patientId,
      });
    });
    return lesion;
  });
}

export async function updateLesion(
  input:    UpdateLesionInput,
  clinicId: string,
  userId:   string,
): Promise<LesionPublic> {
  return withClinicContext(clinicId, async (client) => {
    const setClauses: string[] = [];
    const values:     unknown[] = [input.id, clinicId];
    let idx = 3;

    const d = input.data;
    if (d.bodyRegion    !== undefined) { setClauses.push(`location_body_map = $${idx++}`); values.push(d.bodyRegion); }
    if (d.description   !== undefined) { setClauses.push(`description = $${idx++}`);        values.push(d.description); }
    if (d.locationNotes !== undefined) { setClauses.push(`location_notes = $${idx++}`);     values.push(d.locationNotes); }
    if (d.morphology    !== undefined) { setClauses.push(`morphology = $${idx++}::text[]`); values.push(d.morphology); }
    if (d.color         !== undefined) { setClauses.push(`color = $${idx++}::text[]`);      values.push(d.color); }
    if (d.sizeMm        !== undefined) { setClauses.push(`size_mm = $${idx++}`);            values.push(d.sizeMm); }
    if (d.firstNotedAt  !== undefined) { setClauses.push(`first_noted_at = $${idx++}`);     values.push(d.firstNotedAt); }

    if (setClauses.length === 0) {
      const res = await client.query<LesionRow>(
        `SELECT * FROM clinical.lesions WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
        [input.id, clinicId],
      );
      if (!res.rows[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesão não encontrada' });
      return mapRow(res.rows[0]);
    }

    setClauses.push(`updated_at = NOW()`);
    setClauses.push(`updated_by = $${idx++}`);
    values.push(userId);

    const result = await client.query<LesionRow>(
      `UPDATE clinical.lesions SET ${setClauses.join(', ')}
       WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      values,
    );
    if (!result.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesão não encontrada' });
    }
    const lesion = mapRow(result.rows[0]);
    setImmediate(() => {
      emitToClinic(clinicId, 'lesion.updated', {
        lesionId: lesion.id, patientId: lesion.patientId,
      });
    });
    return lesion;
  });
}

async function changeStatus(
  id:       string,
  status:   LesionStatus,
  reason:   string,
  clinicId: string,
  userId:   string,
): Promise<LesionPublic> {
  return withClinicContext(clinicId, async (client) => {
    const result = await client.query<LesionRow>(
      `UPDATE clinical.lesions
         SET status = $3::clinical.lesion_status,
             status_reason = $4,
             status_changed_at = NOW(),
             status_changed_by = $5,
             is_active = ($3 <> 'resolved'),
             updated_at = NOW(),
             updated_by = $5
       WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [id, clinicId, status, reason, userId],
    );
    if (!result.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesão não encontrada' });
    }
    const lesion = mapRow(result.rows[0]);
    setImmediate(() => {
      emitToClinic(clinicId, 'lesion.status_changed', {
        lesionId:  lesion.id,
        patientId: lesion.patientId,
        status,
      });
    });
    return lesion;
  });
}

export function resolveLesion(id: string, reason: string, clinicId: string, userId: string) {
  return changeStatus(id, 'resolved', reason, clinicId, userId);
}
export function reactivateLesion(id: string, reason: string, clinicId: string, userId: string) {
  return changeStatus(id, 'active', reason, clinicId, userId);
}
export function setMonitoring(id: string, reason: string, clinicId: string, userId: string) {
  return changeStatus(id, 'monitoring', reason, clinicId, userId);
}

export async function softDeleteLesion(
  id:       string,
  reason:   string,
  clinicId: string,
  userId:   string,
): Promise<{ id: string }> {
  return withClinicContext(clinicId, async (client) => {
    const result = await client.query<LesionRow>(
      `UPDATE clinical.lesions
         SET deleted_at = NOW(),
             deleted_by = $3,
             deletion_reason = $4,
             updated_at = NOW(),
             updated_by = $3
       WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, clinicId, userId, reason],
    );
    if (!result.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesão não encontrada' });
    }
    setImmediate(() => {
      emitToClinic(clinicId, 'lesion.deleted', { lesionId: id });
    });
    return { id };
  });
}

export async function getLesionById(id: string, clinicId: string): Promise<LesionPublic> {
  const res = await db.query<LesionRow & { image_count: string }>(
    `SELECT l.*, COALESCE(i.c, 0) AS image_count
       FROM clinical.lesions l
       LEFT JOIN (
         SELECT lesion_id, COUNT(*)::int AS c
           FROM clinical.lesion_images
          WHERE clinic_id = $2
          GROUP BY lesion_id
       ) i ON i.lesion_id = l.id
      WHERE l.id = $1 AND l.clinic_id = $2`,
    [id, clinicId],
  );
  if (!res.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesão não encontrada' });
  }
  const row = res.rows[0];
  return mapRow(row, parseInt(row.image_count as unknown as string, 10));
}

export async function listLesionsByPatient(
  params:   ListLesionsByPatientQuery,
  clinicId: string,
): Promise<LesionPublic[]> {
  const where: string[] = ['l.clinic_id = $1', 'l.patient_id = $2'];
  const values: unknown[] = [clinicId, params.patientId];
  let idx = 3;

  if (!params.includeDeleted) {
    where.push('l.deleted_at IS NULL');
  }
  if (params.status) {
    where.push(`l.status = $${idx++}::clinical.lesion_status`);
    values.push(params.status);
  }

  const res = await db.query<LesionRow & { image_count: string }>(
    `SELECT l.*, COALESCE(i.c, 0) AS image_count
       FROM clinical.lesions l
       LEFT JOIN (
         SELECT lesion_id, COUNT(*)::int AS c
           FROM clinical.lesion_images
          WHERE clinic_id = $1
          GROUP BY lesion_id
       ) i ON i.lesion_id = l.id
      WHERE ${where.join(' AND ')}
      ORDER BY l.created_at DESC`,
    values,
  );
  return res.rows.map((r) => mapRow(r, parseInt(r.image_count as unknown as string, 10)));
}

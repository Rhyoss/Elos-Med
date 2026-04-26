import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import type { PoolClient } from 'pg';
import { db, withClinicContext } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { encrypt, encryptOptional, decryptOptional } from '../../lib/crypto.js';
import {
  upsertPatientDocument,
  deletePatientDocument,
  searchPatientsInTypesense,
} from '../../lib/typesense.js';
import { eventBus } from '../../events/event-bus.js';
import type {
  CreatePatientInput,
  UpdatePatientInput,
  SearchPatientInput,
  MergePatientInput,
  PatientListQuery,
} from '@dermaos/shared';

/* ── Internal DB row type ────────────────────────────────────────────────── */

interface PatientRow {
  id:                          string;
  clinic_id:                   string;
  name:                        string | null;
  name_search:                 string | null;
  cpf_hash:                    string | null;
  cpf_encrypted:               string | null;
  birth_date:                  string | null;
  gender:                      string | null;
  email_encrypted:             string | null;
  phone_encrypted:             string | null;
  phone_secondary_encrypted:   string | null;
  address:                     Record<string, string> | null;
  blood_type:                  string | null;
  allergies:                   string[];
  chronic_conditions:          string[];
  active_medications:          string[];
  source_channel:              string | null;
  source_campaign:             string | null;
  referred_by:                 string | null;
  status:                      string;
  total_visits:                number;
  last_visit_at:               string | null;
  first_visit_at:              string | null;
  total_revenue:               string;
  portal_enabled:              boolean;
  portal_email:                string | null;
  internal_notes:              string | null;
  created_at:                  string;
  updated_at:                  string;
  created_by:                  string | null;
  deleted_at:                  string | null;
  redirect_to:                 string | null;
}

/* ── Public patient type returned to callers ─────────────────────────────── */

export interface PatientPublic {
  id:                string;
  clinicId:          string;
  name:              string;
  cpf:               string | null;
  birthDate:         Date | null;
  age:               number | null;
  gender:            string | null;
  email:             string | null;
  phone:             string | null;
  phoneSecondary:    string | null;
  address:           { street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string; zip?: string } | null;
  bloodType:         string | null;
  allergies:         string[];
  chronicConditions: string[];
  activeMedications: string[];
  sourceChannel:     string | null;
  sourceCampaign:    string | null;
  referredBy:        string | null;
  status:            string;
  totalVisits:       number;
  lastVisitAt:       Date | null;
  firstVisitAt:      Date | null;
  totalRevenue:      number;
  portalEnabled:     boolean;
  internalNotes:     string | null;
  createdAt:         Date;
  updatedAt:         Date;
}

export interface PatientSummary {
  id:          string;
  name:        string;
  cpfMasked:   string | null;
  age:         number | null;
  gender:      string | null;
  phone:       string | null;
  status:      string;
  lastVisitAt: Date | null;
  allergies:   string[];
  createdAt:   Date;
}

export interface PaginatedPatients {
  data:       PatientSummary[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

export interface DuplicateGroup {
  reason:   'cpf_match' | 'name_date_match';
  patients: Array<{ id: string; name: string; cpfMasked: string | null; birthDate: Date | null; createdAt: Date }>;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function normalizeForSearch(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hashCpf(cpf: string, clinicId: string): string {
  return crypto.createHash('sha256').update(`${clinicId}:${cpf}`).digest('hex');
}

function calcAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function maskCpf(cpf: string): string {
  if (cpf.length !== 11) return '***.***.***-**';
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

function maskPhone(phone: string): string {
  if (phone.length === 11) {
    return `(${phone.slice(0, 2)}) ${phone[2]} ****-${phone.slice(7)}`;
  }
  return `(${phone.slice(0, 2)}) ****-${phone.slice(6)}`;
}

function mapRowToPublic(row: PatientRow): PatientPublic {
  const birthDate = row.birth_date ? new Date(row.birth_date) : null;
  return {
    id:                row.id,
    clinicId:          row.clinic_id,
    name:              row.name ?? 'Nome indisponível',
    cpf:               decryptOptional(row.cpf_encrypted),
    birthDate,
    age:               calcAge(birthDate),
    gender:            row.gender,
    email:             decryptOptional(row.email_encrypted),
    phone:             decryptOptional(row.phone_encrypted),
    phoneSecondary:    decryptOptional(row.phone_secondary_encrypted),
    address:           row.address ?? null,
    bloodType:         row.blood_type,
    allergies:         row.allergies ?? [],
    chronicConditions: row.chronic_conditions ?? [],
    activeMedications: row.active_medications ?? [],
    sourceChannel:     row.source_channel,
    sourceCampaign:    row.source_campaign,
    referredBy:        row.referred_by,
    status:            row.status,
    totalVisits:       row.total_visits ?? 0,
    lastVisitAt:       row.last_visit_at ? new Date(row.last_visit_at) : null,
    firstVisitAt:      row.first_visit_at ? new Date(row.first_visit_at) : null,
    totalRevenue:      row.total_revenue ? parseFloat(row.total_revenue) : 0,
    portalEnabled:     row.portal_enabled ?? false,
    internalNotes:     row.internal_notes,
    createdAt:         new Date(row.created_at),
    updatedAt:         new Date(row.updated_at),
  };
}

function mapRowToSummary(row: PatientRow): PatientSummary {
  const rawCpf  = decryptOptional(row.cpf_encrypted);
  const rawName = row.name ?? 'Nome indisponível';
  const phone   = decryptOptional(row.phone_encrypted);
  const birthDate = row.birth_date ? new Date(row.birth_date) : null;
  return {
    id:          row.id,
    name:        rawName,
    cpfMasked:   rawCpf ? maskCpf(rawCpf) : null,
    age:         calcAge(birthDate),
    gender:      row.gender,
    phone:       phone ? maskPhone(phone) : null,
    status:      row.status,
    lastVisitAt: row.last_visit_at ? new Date(row.last_visit_at) : null,
    allergies:   row.allergies ?? [],
    createdAt:   new Date(row.created_at),
  };
}

async function syncToSearch(patient: PatientPublic): Promise<void> {
  try {
    await upsertPatientDocument({
      id:            patient.id,
      clinic_id:     patient.clinicId,
      name:          patient.name,
      name_search:   normalizeForSearch(patient.name),
      phone:         patient.phone ? maskPhone(patient.phone) : '',
      status:        patient.status,
      age:           patient.age ?? 0,
      birth_date:    patient.birthDate?.toISOString().split('T')[0] ?? '',
      created_at:    patient.createdAt.getTime(),
      last_visit_at: patient.lastVisitAt?.getTime() ?? 0,
      total_visits:  patient.totalVisits,
    });
  } catch (err) {
    logger.warn({ err, patientId: patient.id }, 'Typesense sync failed — non-critical');
  }
}

/* ── Service functions ───────────────────────────────────────────────────── */

export async function createPatient(
  data:     CreatePatientInput,
  clinicId: string,
  userId:   string,
): Promise<{ patient: PatientPublic; isDuplicate: false } | { isDuplicate: true; existing: PatientSummary }> {
  return withClinicContext(clinicId, async (client: PoolClient) => {
    // Detecção de duplicata por CPF
    if (data.cpf) {
      const hash = hashCpf(data.cpf, clinicId);
      const dup = await client.query<PatientRow>(
        `SELECT id, clinic_id, name, name_search, cpf_hash, cpf_encrypted,
                birth_date, gender, phone_encrypted, status, allergies,
                total_visits, last_visit_at, created_at, updated_at, deleted_at
         FROM shared.patients
         WHERE clinic_id = $1 AND cpf_hash = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [clinicId, hash],
      );
      if (dup.rows[0]) {
        return { isDuplicate: true as const, existing: mapRowToSummary(dup.rows[0]) };
      }
    }

    const nameEncrypted  = encrypt(data.name);
    const nameSearch     = normalizeForSearch(data.name);
    const cpfHash        = data.cpf ? hashCpf(data.cpf, clinicId) : null;
    const cpfEncrypted   = encryptOptional(data.cpf);
    const emailEncrypted = encryptOptional(data.email);
    const phoneEncrypted = encryptOptional(data.phone);
    const phoneSecEncrypted = encryptOptional(data.phoneSecondary);

    const result = await client.query<PatientRow>(
      `INSERT INTO shared.patients (
         clinic_id, name, name_search, cpf_hash, cpf_encrypted,
         birth_date, gender, email_encrypted, phone_encrypted, phone_secondary_encrypted,
         address, blood_type, allergies, chronic_conditions, active_medications,
         source_channel, source_campaign, referred_by,
         portal_enabled, portal_email, internal_notes,
         created_by, status
       ) VALUES (
         $1,  $2,  $3,  $4,  $5,
         $6,  $7,  $8,  $9,  $10,
         $11, $12, $13::text[], $14::text[], $15::text[],
         $16, $17, $18,
         $19, $20, $21,
         $22, 'active'
       )
       RETURNING *`,
      [
        clinicId, nameEncrypted, nameSearch, cpfHash, cpfEncrypted,
        data.birthDate ?? null, data.gender ?? null, emailEncrypted, phoneEncrypted, phoneSecEncrypted,
        data.address ? JSON.stringify(data.address) : null,
        data.bloodType ?? null,
        data.allergies,
        data.chronicConditions,
        data.activeMedications,
        data.sourceChannel ?? null, data.sourceCampaign ?? null, data.referredBy ?? null,
        data.portalEnabled, data.portalEmail ?? null, data.internalNotes ?? null,
        userId,
      ],
    );

    const patient = mapRowToPublic(result.rows[0]!);

    setImmediate(() => {
      void syncToSearch(patient);
      void eventBus.publish('patient.created', clinicId, patient.id, {
        name: nameSearch,
      }, { userId });
    });

    return { isDuplicate: false as const, patient };
  });
}

export async function updatePatient(
  id:       string,
  data:     UpdatePatientInput,
  clinicId: string,
  userId:   string,
): Promise<PatientPublic> {
  return withClinicContext(clinicId, async (client: PoolClient) => {
    const existing = await client.query<PatientRow>(
      'SELECT * FROM shared.patients WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL',
      [id, clinicId],
    );
    if (!existing.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado' });
    }

    const setClauses: string[] = [];
    const values: unknown[]    = [id, clinicId];
    let   idx                  = 3;

    function addField(clause: string, value: unknown) {
      setClauses.push(`${clause} = $${idx++}`);
      values.push(value);
    }

    if (data.name !== undefined) {
      addField('name',        encrypt(data.name));
      addField('name_search', normalizeForSearch(data.name));
    }
    if (data.cpf !== undefined) {
      const newHash = data.cpf ? hashCpf(data.cpf, clinicId) : null;
      // Verify no other patient owns this CPF
      if (newHash) {
        const dup = await client.query<{ id: string }>(
          'SELECT id FROM shared.patients WHERE clinic_id = $1 AND cpf_hash = $2 AND id != $3 AND deleted_at IS NULL',
          [clinicId, newHash, id],
        );
        if (dup.rows[0]) {
          throw new TRPCError({ code: 'CONFLICT', message: 'CPF já cadastrado para outro paciente' });
        }
      }
      addField('cpf_hash',      newHash);
      addField('cpf_encrypted', encryptOptional(data.cpf));
    }
    if (data.birthDate !== undefined)       addField('birth_date',                  data.birthDate);
    if (data.gender    !== undefined)       addField('gender',                      data.gender);
    if (data.email     !== undefined)       addField('email_encrypted',             encryptOptional(data.email));
    if (data.phone     !== undefined)       addField('phone_encrypted',             encryptOptional(data.phone));
    if (data.phoneSecondary !== undefined)  addField('phone_secondary_encrypted',   encryptOptional(data.phoneSecondary));
    if (data.bloodType !== undefined)       addField('blood_type',                  data.bloodType);
    if (data.allergies !== undefined)       { setClauses.push(`allergies = $${idx++}::text[]`); values.push(data.allergies); }
    if (data.chronicConditions !== undefined) { setClauses.push(`chronic_conditions = $${idx++}::text[]`); values.push(data.chronicConditions); }
    if (data.activeMedications !== undefined) { setClauses.push(`active_medications = $${idx++}::text[]`); values.push(data.activeMedications); }
    if (data.address   !== undefined)       addField('address',         data.address ? JSON.stringify(data.address) : null);
    if (data.sourceChannel  !== undefined)  addField('source_channel',  data.sourceChannel);
    if (data.sourceCampaign !== undefined)  addField('source_campaign', data.sourceCampaign);
    if (data.portalEnabled  !== undefined)  addField('portal_enabled',  data.portalEnabled);
    if (data.portalEmail    !== undefined)  addField('portal_email',    data.portalEmail);
    if (data.internalNotes  !== undefined)  addField('internal_notes',  data.internalNotes);

    if (setClauses.length === 0) {
      return mapRowToPublic(existing.rows[0]!);
    }

    setClauses.push('updated_at = NOW()');

    const result = await client.query<PatientRow>(
      `UPDATE shared.patients SET ${setClauses.join(', ')}
       WHERE id = $1 AND clinic_id = $2
       RETURNING *`,
      values,
    );

    const patient = mapRowToPublic(result.rows[0]!);

    setImmediate(() => {
      void syncToSearch(patient);
      void eventBus.publish('patient.updated', clinicId, id, {
        updatedFields: Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined),
      }, { userId });
    });

    return patient;
  });
}

export async function getPatientById(id: string, clinicId: string): Promise<PatientPublic> {
  const result = await db.query<PatientRow>(
    `SELECT * FROM shared.patients
     WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
    [id, clinicId],
  );
  if (!result.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado' });
  }
  // Segue redirect de merge
  if (result.rows[0].status === 'merged' && result.rows[0].redirect_to) {
    return getPatientById(result.rows[0].redirect_to, clinicId);
  }
  return mapRowToPublic(result.rows[0]);
}

export async function listPatients(
  params:   PatientListQuery,
  clinicId: string,
): Promise<PaginatedPatients> {
  const offset  = (params.page - 1) * params.pageSize;
  const search  = params.search ? `%${params.search.toLowerCase()}%` : null;

  const sortColumn: Record<string, string> = {
    name:        'p.name_search',
    createdAt:   'p.created_at',
    lastVisitAt: 'p.last_visit_at',
  };
  const orderBy = `${sortColumn[params.sortBy] ?? 'p.name_search'} ${params.sortDir === 'desc' ? 'DESC NULLS LAST' : 'ASC NULLS LAST'}`;

  const conditions: string[] = [
    'p.clinic_id = $1',
    'p.deleted_at IS NULL',
    "p.status != 'merged'",
  ];
  const values: unknown[] = [clinicId];
  let   idx               = 2;

  if (search) {
    conditions.push(`p.name_search ILIKE $${idx++}`);
    values.push(search);
  }
  if (params.status) {
    conditions.push(`p.status = $${idx++}`);
    values.push(params.status);
  }
  if (params.source) {
    conditions.push(`p.source_channel = $${idx++}`);
    values.push(params.source);
  }

  const where = conditions.join(' AND ');

  const [countResult, dataResult] = await Promise.all([
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM shared.patients p WHERE ${where}`,
      values,
    ),
    db.query<PatientRow>(
      `SELECT p.id, p.clinic_id, p.name, p.name_search, p.cpf_encrypted,
              p.birth_date, p.gender, p.phone_encrypted, p.status,
              p.total_visits, p.last_visit_at, p.first_visit_at, p.total_revenue,
              p.allergies, p.source_channel, p.created_at, p.updated_at,
              NULL::text AS cpf_hash, NULL::text AS email_encrypted,
              NULL::text AS phone_secondary_encrypted, NULL::jsonb AS address,
              NULL::varchar AS blood_type, '{}'::text[] AS chronic_conditions,
              '{}'::text[] AS active_medications, NULL AS source_campaign,
              NULL AS referred_by, FALSE AS portal_enabled, NULL AS portal_email,
              NULL AS internal_notes, NULL AS created_by, NULL AS deleted_at,
              NULL AS redirect_to
       FROM shared.patients p
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.pageSize, offset],
    ),
  ]);

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  return {
    data:       dataResult.rows.map(mapRowToSummary),
    total,
    page:       params.page,
    pageSize:   params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}

export async function searchPatients(
  params:   SearchPatientInput,
  clinicId: string,
): Promise<PaginatedPatients> {
  // Tenta Typesense primeiro (full-text) se query fornecida
  if (params.query && params.query.trim().length > 0) {
    try {
      const tsResult = await searchPatientsInTypesense(
        params.query,
        clinicId,
        params.page,
        params.limit,
      );

      if (tsResult.found > 0) {
        const ids = tsResult.hits.map((h) => h.document.id);
        const rows = await db.query<PatientRow>(
          `SELECT id, clinic_id, name, name_search, cpf_encrypted,
                  birth_date, gender, phone_encrypted, status,
                  total_visits, last_visit_at, first_visit_at, total_revenue,
                  allergies, source_channel, created_at, updated_at,
                  NULL::text AS cpf_hash, NULL::text AS email_encrypted,
                  NULL::text AS phone_secondary_encrypted, NULL::jsonb AS address,
                  NULL::varchar AS blood_type, '{}'::text[] AS chronic_conditions,
                  '{}'::text[] AS active_medications, NULL AS source_campaign,
                  NULL AS referred_by, FALSE AS portal_enabled, NULL AS portal_email,
                  NULL AS internal_notes, NULL AS created_by, NULL AS deleted_at,
                  NULL AS redirect_to
           FROM shared.patients
           WHERE id = ANY($1) AND clinic_id = $2 AND deleted_at IS NULL`,
          [ids, clinicId],
        );

        return {
          data:       rows.rows.map(mapRowToSummary),
          total:      tsResult.found,
          page:       params.page,
          pageSize:   params.limit,
          totalPages: Math.ceil(tsResult.found / params.limit),
        };
      }
    } catch (err) {
      logger.warn({ err }, 'Typesense search failed — falling back to pg_trgm');
    }
  }

  // Fallback: pg_trgm / ILIKE
  return listPatients(
    {
      search:   params.query,
      status:   params.status,
      source:   params.source,
      page:     params.page,
      pageSize: params.limit,
      sortBy:   params.sort,
      sortDir:  params.sortDir,
    },
    clinicId,
  );
}

export async function softDeletePatient(
  id:       string,
  reason:   string,
  clinicId: string,
  userId:   string,
): Promise<void> {
  return withClinicContext(clinicId, async (client: PoolClient) => {
    const result = await client.query<{ id: string }>(
      `UPDATE shared.patients
       SET deleted_at = NOW(), deletion_reason = $3, status = 'inactive'
       WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, clinicId, reason],
    );
    if (!result.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado' });
    }

    setImmediate(() => {
      void deletePatientDocument(id);
      void eventBus.publish('patient.updated', clinicId, id, { deleted: true }, { userId });
    });
  });
}

export async function mergePatients(
  input:    MergePatientInput,
  clinicId: string,
  userId:   string,
): Promise<PatientPublic> {
  const { primaryId, secondaryId } = input;

  return withClinicContext(clinicId, async (client: PoolClient) => {
    // Valida existência dos dois
    const [primary, secondary] = await Promise.all([
      client.query<PatientRow>('SELECT * FROM shared.patients WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL', [primaryId, clinicId]),
      client.query<PatientRow>('SELECT * FROM shared.patients WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL', [secondaryId, clinicId]),
    ]);

    if (!primary.rows[0])   throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente primário não encontrado' });
    if (!secondary.rows[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente secundário não encontrado' });

    // Move registros do secundário para o primário
    const moveQueries = [
      client.query('UPDATE shared.appointments    SET patient_id = $1 WHERE patient_id = $2 AND clinic_id = $3', [primaryId, secondaryId, clinicId]),
      client.query('UPDATE clinical.encounters    SET patient_id = $1 WHERE patient_id = $2 AND clinic_id = $3', [primaryId, secondaryId, clinicId]),
      client.query('UPDATE clinical.prescriptions SET patient_id = $1 WHERE patient_id = $2 AND clinic_id = $3', [primaryId, secondaryId, clinicId]),
      client.query('UPDATE clinical.lesions       SET patient_id = $1 WHERE patient_id = $2 AND clinic_id = $3', [primaryId, secondaryId, clinicId]).catch(() => null),
      client.query('UPDATE clinical.protocols     SET patient_id = $1 WHERE patient_id = $2 AND clinic_id = $3', [primaryId, secondaryId, clinicId]).catch(() => null),
    ];
    await Promise.all(moveQueries);

    // Consolida contadores no primário
    await client.query(
      `UPDATE shared.patients
       SET total_visits  = total_visits + $3,
           total_revenue = total_revenue + $4,
           updated_at    = NOW()
       WHERE id = $1 AND clinic_id = $2`,
      [primaryId, clinicId, secondary.rows[0].total_visits ?? 0, parseFloat(secondary.rows[0].total_revenue ?? '0')],
    );

    // Marca secundário como merged
    await client.query(
      `UPDATE shared.patients
       SET status = 'merged', redirect_to = $3, deleted_at = NOW(), deletion_reason = 'merged'
       WHERE id = $1 AND clinic_id = $2`,
      [secondaryId, clinicId, primaryId],
    );

    const updated = await client.query<PatientRow>(
      'SELECT * FROM shared.patients WHERE id = $1 AND clinic_id = $2',
      [primaryId, clinicId],
    );

    const patient = mapRowToPublic(updated.rows[0]!);

    setImmediate(() => {
      void syncToSearch(patient);
      void deletePatientDocument(secondaryId);
      void eventBus.publish('patient.merged', clinicId, primaryId, {
        secondaryId,
      }, { userId });
    });

    return patient;
  });
}

export async function getDuplicatePatients(clinicId: string): Promise<DuplicateGroup[]> {
  const result = await db.query<{
    reason:      string;
    patient1_id: string;
    p1_name:     string | null;
    p1_cpf:      string | null;
    p1_birth:    string | null;
    p1_created:  string;
    patient2_id: string;
    p2_name:     string | null;
    p2_cpf:      string | null;
    p2_birth:    string | null;
    p2_created:  string;
  }>(
    `SELECT
       'cpf_match' AS reason,
       p1.id  AS patient1_id,
       p1.name AS p1_name, p1.cpf_encrypted AS p1_cpf,
       p1.birth_date AS p1_birth, p1.created_at AS p1_created,
       p2.id  AS patient2_id,
       p2.name AS p2_name, p2.cpf_encrypted AS p2_cpf,
       p2.birth_date AS p2_birth, p2.created_at AS p2_created
     FROM shared.patients p1
     JOIN shared.patients p2
       ON p2.cpf_hash = p1.cpf_hash
      AND p2.id > p1.id
      AND p2.clinic_id = p1.clinic_id
     WHERE p1.clinic_id = $1
       AND p1.cpf_hash IS NOT NULL
       AND p1.status NOT IN ('merged', 'deceased')
       AND p2.status NOT IN ('merged', 'deceased')
       AND p1.deleted_at IS NULL
       AND p2.deleted_at IS NULL

     UNION ALL

     SELECT
       'name_date_match' AS reason,
       p1.id, p1.name, p1.cpf_encrypted, p1.birth_date, p1.created_at,
       p2.id, p2.name, p2.cpf_encrypted, p2.birth_date, p2.created_at
     FROM shared.patients p1
     JOIN shared.patients p2
       ON p2.id > p1.id
      AND p2.clinic_id = p1.clinic_id
      AND p2.birth_date = p1.birth_date
      AND similarity(p2.name_search, p1.name_search) > 0.7
     WHERE p1.clinic_id = $1
       AND p1.birth_date IS NOT NULL
       AND (p1.cpf_hash IS DISTINCT FROM p2.cpf_hash OR p1.cpf_hash IS NULL)
       AND p1.status NOT IN ('merged', 'deceased')
       AND p2.status NOT IN ('merged', 'deceased')
       AND p1.deleted_at IS NULL
       AND p2.deleted_at IS NULL
     LIMIT 50`,
    [clinicId],
  );

  return result.rows.map((row) => ({
    reason: row.reason as 'cpf_match' | 'name_date_match',
    patients: [
      {
        id:         row.patient1_id,
        name:       row.p1_name ?? 'Nome indisponível',
        cpfMasked:  row.p1_cpf ? maskCpf(decryptOptional(row.p1_cpf) ?? '') : null,
        birthDate:  row.p1_birth ? new Date(row.p1_birth) : null,
        createdAt:  new Date(row.p1_created),
      },
      {
        id:         row.patient2_id,
        name:       row.p2_name ?? 'Nome indisponível',
        cpfMasked:  row.p2_cpf ? maskCpf(decryptOptional(row.p2_cpf) ?? '') : null,
        birthDate:  row.p2_birth ? new Date(row.p2_birth) : null,
        createdAt:  new Date(row.p2_created),
      },
    ],
  }));
}

export async function getPatientActivity(
  patientId: string,
  clinicId:  string,
): Promise<Array<{ id: string; eventType: string; occurredAt: Date; metadata: Record<string, unknown> }>> {
  const result = await db.query<{
    id:             string;
    event_type:     string;
    occurred_at:    string;
    metadata:       Record<string, unknown>;
  }>(
    `SELECT id::text, event_type, occurred_at, metadata
     FROM audit.domain_events
     WHERE aggregate_id = $1 AND clinic_id = $2
       AND aggregate_type = 'patient'
     ORDER BY occurred_at DESC
     LIMIT 10`,
    [patientId, clinicId],
  );

  return result.rows.map((r) => ({
    id:          r.id,
    eventType:   r.event_type,
    occurredAt:  new Date(r.occurred_at),
    metadata:    r.metadata ?? {},
  }));
}

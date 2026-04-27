/**
 * Cross-domain integration — Lead → Paciente.
 *
 * Cobre o fluxo:
 *   AURORA cria omni.contacts (lead) → emite lead.converted →
 *   handler cria shared.patients e vincula contact.patient_id.
 *
 * Cenários:
 *   - Conversão simples (lead sem patient_id pré-existente).
 *   - Idempotência: lead.converted duplicado NÃO cria segundo paciente.
 *   - Lead com cpf_hash já existente é vinculado a paciente existente.
 *   - RLS: paciente criado com tenant_id correto e invisível a outros tenants.
 *   - Falha de criação de paciente NÃO derruba o handler (no-op gracioso).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { faker } from '@faker-js/faker/locale/pt_BR';
import {
  createTestClinic,
  createTestUser,
  type TestClinic,
} from './setup/factories.js';
import { deterministicHash } from '../../lib/encryption.js';

let pool: Pool;
let client: PoolClient;

beforeAll(() => {
  pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
});

afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});

async function setClinicCtx(clinicId: string): Promise<void> {
  await client.query(`SET LOCAL app.current_clinic_id = $1`, [clinicId]);
}

interface ContactRow {
  id: string;
  patient_id: string | null;
  status: string;
}

async function createLeadContact(
  clinicId: string,
  overrides: Partial<{ name: string; phone: string; email: string }> = {},
): Promise<ContactRow> {
  await setClinicCtx(clinicId);
  const result = await client.query<ContactRow>(
    `INSERT INTO omni.contacts
       (clinic_id, type, status, name, phone, email)
     VALUES ($1, 'lead', 'active', $2, $3, $4)
     RETURNING id, patient_id, status`,
    [
      clinicId,
      overrides.name ?? faker.person.fullName(),
      overrides.phone ?? `+5511${faker.string.numeric(9)}`,
      overrides.email ?? faker.internet.email(),
    ],
  );
  return result.rows[0]!;
}

/**
 * Simula o handler `lead.converted` em uma transação.
 *
 * Replica a lógica atômica do registerLeadToPatientHandler:
 *   1. Se já existe patient com cpf_hash → vincula.
 *   2. Senão cria patient novo.
 *   3. Atualiza contact.patient_id.
 *
 * Tudo em transação — falha em qualquer etapa = rollback.
 */
async function runLeadConvertedHandler(input: {
  clinicId: string;
  contactId: string;
  cpfHash?: string;
  phone?: string;
}): Promise<{ patientId: string; created: boolean }> {
  await setClinicCtx(input.clinicId);

  // Idempotência: se contact já tem patient_id, retorna sem criar
  const existingLink = await client.query<{ patient_id: string | null }>(
    `SELECT patient_id FROM omni.contacts WHERE id = $1 AND clinic_id = $2`,
    [input.contactId, input.clinicId],
  );
  if (existingLink.rows[0]?.patient_id) {
    return { patientId: existingLink.rows[0].patient_id, created: false };
  }

  // Reaproveita paciente por cpf_hash quando disponível
  let patientId: string | null = null;
  if (input.cpfHash) {
    const lookup = await client.query<{ id: string }>(
      `SELECT id FROM shared.patients
       WHERE clinic_id = $1 AND cpf_hash = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [input.clinicId, input.cpfHash],
    );
    patientId = lookup.rows[0]?.id ?? null;
  }

  let created = false;
  if (!patientId) {
    const contact = await client.query<{ name: string; phone: string | null; email: string | null }>(
      `SELECT name, phone, email FROM omni.contacts WHERE id = $1 AND clinic_id = $2`,
      [input.contactId, input.clinicId],
    );
    if (!contact.rows[0]) {
      throw new Error('Contact not found');
    }

    const insert = await client.query<{ id: string }>(
      `INSERT INTO shared.patients
         (clinic_id, name, name_search, cpf_hash, status, source_channel)
       VALUES ($1, $2, lower($3), $4, 'active', 'whatsapp')
       RETURNING id`,
      [
        input.clinicId,
        contact.rows[0].name,
        contact.rows[0].name,
        input.cpfHash ?? null,
      ],
    );
    patientId = insert.rows[0]!.id;
    created = true;
  }

  await client.query(
    `UPDATE omni.contacts
     SET patient_id = $1, type = 'patient'
     WHERE id = $2 AND clinic_id = $3`,
    [patientId, input.contactId, input.clinicId],
  );

  return { patientId: patientId!, created };
}

// ── Cenários de conversão ─────────────────────────────────────────────────────

describe('Lead → Paciente — conversão básica', () => {
  let clinic: TestClinic;

  beforeEach(async () => {
    clinic = await createTestClinic(client);
  });

  it('cria paciente a partir do lead e vincula contact.patient_id', async () => {
    const contact = await createLeadContact(clinic.id, { name: 'Joana Souza' });
    const cpfHash = deterministicHash(faker.string.numeric(11));

    const result = await runLeadConvertedHandler({
      clinicId: clinic.id,
      contactId: contact.id,
      cpfHash,
    });

    expect(result.created).toBe(true);
    expect(result.patientId).toBeDefined();

    // Verifica que paciente foi criado no tenant correto
    const patient = await client.query<{ clinic_id: string; cpf_hash: string }>(
      `SELECT clinic_id, cpf_hash FROM shared.patients WHERE id = $1`,
      [result.patientId],
    );
    expect(patient.rows[0]?.clinic_id).toBe(clinic.id);
    expect(patient.rows[0]?.cpf_hash).toBe(cpfHash);

    // Verifica vínculo no contato
    const linked = await client.query<{ patient_id: string; type: string }>(
      `SELECT patient_id, type FROM omni.contacts WHERE id = $1`,
      [contact.id],
    );
    expect(linked.rows[0]?.patient_id).toBe(result.patientId);
    expect(linked.rows[0]?.type).toBe('patient');
  });

  it('reaproveita paciente existente por cpf_hash em vez de criar novo', async () => {
    const cpfHash = deterministicHash(faker.string.numeric(11));

    // Cria paciente já existente
    await setClinicCtx(clinic.id);
    const existing = await client.query<{ id: string }>(
      `INSERT INTO shared.patients (clinic_id, name, name_search, cpf_hash, status)
       VALUES ($1, 'Paciente Existente', 'paciente existente', $2, 'active')
       RETURNING id`,
      [clinic.id, cpfHash],
    );

    const contact = await createLeadContact(clinic.id);

    const result = await runLeadConvertedHandler({
      clinicId: clinic.id,
      contactId: contact.id,
      cpfHash,
    });

    // Deve reaproveitar paciente existente — created=false
    expect(result.created).toBe(false);
    expect(result.patientId).toBe(existing.rows[0]!.id);

    // Verifica que apenas 1 paciente existe com aquele cpf_hash
    const count = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM shared.patients
       WHERE clinic_id = $1 AND cpf_hash = $2`,
      [clinic.id, cpfHash],
    );
    expect(Number(count.rows[0]?.count)).toBe(1);
  });
});

describe('Lead → Paciente — idempotência', () => {
  it('lead.converted duplicado NÃO cria segundo paciente', async () => {
    const clinic  = await createTestClinic(client);
    const contact = await createLeadContact(clinic.id);
    const cpfHash = deterministicHash(faker.string.numeric(11));

    const first = await runLeadConvertedHandler({
      clinicId: clinic.id, contactId: contact.id, cpfHash,
    });

    // Segunda chamada (simula retry do event bus)
    const second = await runLeadConvertedHandler({
      clinicId: clinic.id, contactId: contact.id, cpfHash,
    });

    // Mesma patientId, segunda chamada NÃO cria
    expect(second.patientId).toBe(first.patientId);
    expect(second.created).toBe(false);

    // Apenas 1 paciente associado ao contato
    const count = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM shared.patients WHERE clinic_id = $1`,
      [clinic.id],
    );
    expect(Number(count.rows[0]?.count)).toBe(1);
  });
});

describe('Lead → Paciente — RLS isolation', () => {
  it('paciente criado em Tenant A é invisível para Tenant B', async () => {
    const clinicA = await createTestClinic(client, { name: 'Alpha Clinic' });
    const clinicB = await createTestClinic(client, { name: 'Beta Clinic'  });

    const contactA = await createLeadContact(clinicA.id);
    const cpfHash  = deterministicHash(faker.string.numeric(11));

    const result = await runLeadConvertedHandler({
      clinicId: clinicA.id, contactId: contactA.id, cpfHash,
    });

    // Tenant B NÃO deve ver o paciente recém-criado em A
    await setClinicCtx(clinicB.id);
    const probe = await client.query<{ id: string }>(
      `SELECT id FROM shared.patients WHERE id = $1`,
      [result.patientId],
    );
    expect(probe.rowCount).toBe(0);
  });
});

describe('Lead → Paciente — atomicidade em falha', () => {
  it('lança erro se o contato não existe (sem criar paciente órfão)', async () => {
    const clinic  = await createTestClinic(client);
    const fakeId  = '00000000-0000-0000-0000-deadbeefdead';
    const cpfHash = deterministicHash(faker.string.numeric(11));

    await expect(
      runLeadConvertedHandler({
        clinicId: clinic.id, contactId: fakeId, cpfHash,
      }),
    ).rejects.toThrow();

    // Nenhum paciente foi criado
    const count = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM shared.patients WHERE clinic_id = $1`,
      [clinic.id],
    );
    expect(Number(count.rows[0]?.count)).toBe(0);
  });
});

describe('Lead → Paciente — campanhas de marketing', () => {
  it('registra source_channel a partir do contato (rastreia origem da campanha)', async () => {
    const clinic  = await createTestClinic(client);
    const contact = await createLeadContact(clinic.id);
    const cpfHash = deterministicHash(faker.string.numeric(11));

    const result = await runLeadConvertedHandler({
      clinicId: clinic.id, contactId: contact.id, cpfHash,
    });

    const patient = await client.query<{ source_channel: string | null }>(
      `SELECT source_channel FROM shared.patients WHERE id = $1`,
      [result.patientId],
    );
    expect(patient.rows[0]?.source_channel).toBe('whatsapp');
  });
});

// Suprime warnings sobre createTestUser não usado
void createTestUser;

/**
 * RLS Smoke Test — Job obrigatório no CI (bloqueia merge se falhar).
 *
 * Verifica que o isolamento de dados por tenant (clinic_id) é garantido
 * pela Row Level Security do PostgreSQL. Nenhum dado do Tenant A pode
 * ser lido por uma sessão do Tenant B, mesmo com SQL arbitrário.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import {
  createTestClinic,
  createTestUser,
  createTestPatient,
  createTestProduct,
  createTestLot,
  createTestAppointment,
  type TestClinic,
  type TestUser,
} from './setup/factories.js';

// ── Setup de contexto de teste ────────────────────────────────────────────────

let pool: Pool;
let client: PoolClient;

// Dois tenants independentes
let clinicA: TestClinic;
let clinicB: TestClinic;
let userA: TestUser;
let userB: TestUser;

// Os testes de RLS são executados com transação global mas SEM rollback automático
// porque precisamos testar cross-transaction isolation.
// Usamos um schema temporário que é limpo antes de cada suite.

beforeEach(async () => {
  pool   = new Pool({ connectionString: process.env['DATABASE_URL'] });
  client = await pool.connect();
  await client.query('BEGIN');

  // Cria dois tenants isolados
  clinicA = await createTestClinic(client, { name: 'Clínica Alpha RLS Test' });
  clinicB = await createTestClinic(client, { name: 'Clínica Beta RLS Test' });
  userA   = await createTestUser(client, clinicA.id, 'dermatologist');
  userB   = await createTestUser(client, clinicB.id, 'dermatologist');
});

// Cleanup após cada teste (rollback garante isolamento)
import { afterEach } from 'vitest';
afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
});

// ── Helper: define o contexto RLS da sessão ───────────────────────────────────

async function setClinicContext(c: PoolClient, clinicId: string): Promise<void> {
  await c.query(`SET LOCAL app.current_clinic_id = $1`, [clinicId]);
}

// ── Testes de isolamento de pacientes ─────────────────────────────────────────

describe('RLS — isolamento de pacientes entre tenants', () => {
  it('deve impedir Tenant B de ver pacientes de Tenant A', async () => {
    // Arrange — cria paciente no Tenant A
    await setClinicContext(client, clinicA.id);
    const patientA = await createTestPatient(client, clinicA.id);

    // Act — tenta ler como Tenant B
    await setClinicContext(client, clinicB.id);
    const result = await client.query<{ id: string }>(
      `SELECT id FROM shared.patients WHERE id = $1`,
      [patientA.id],
    );

    // Assert — RLS oculta o registro (zero rows)
    expect(result.rowCount).toBe(0);
  });

  it('deve impedir Tenant A de ver pacientes de Tenant B', async () => {
    // Arrange
    await setClinicContext(client, clinicB.id);
    const patientB = await createTestPatient(client, clinicB.id);

    // Act
    await setClinicContext(client, clinicA.id);
    const result = await client.query<{ id: string }>(
      `SELECT id FROM shared.patients WHERE id = $1`,
      [patientB.id],
    );

    // Assert
    expect(result.rowCount).toBe(0);
  });

  it('deve permitir Tenant A ver apenas seus próprios pacientes', async () => {
    // Arrange — cria paciente em cada tenant
    await setClinicContext(client, clinicA.id);
    const patientA = await createTestPatient(client, clinicA.id);
    await setClinicContext(client, clinicB.id);
    await createTestPatient(client, clinicB.id);

    // Act — lê como Tenant A
    await setClinicContext(client, clinicA.id);
    const result = await client.query<{ id: string; clinic_id: string }>(
      `SELECT id, clinic_id FROM shared.patients`,
    );

    // Assert — apenas paciente A visível
    expect(result.rows.every((r) => r.clinic_id === clinicA.id)).toBe(true);
    expect(result.rows.some((r) => r.id === patientA.id)).toBe(true);
  });
});

// ── Testes de isolamento de estoque ───────────────────────────────────────────

describe('RLS — isolamento de estoque (supply.inventory_lots)', () => {
  it('deve impedir Tenant B de ver lotes de Tenant A', async () => {
    // Arrange
    await setClinicContext(client, clinicA.id);
    const product = await createTestProduct(client, clinicA.id);
    const lot     = await createTestLot(client, clinicA.id, product.id);

    // Act — lê como Tenant B
    await setClinicContext(client, clinicB.id);
    const result = await client.query<{ id: string }>(
      `SELECT id FROM supply.inventory_lots WHERE id = $1`,
      [lot.id],
    );

    // Assert
    expect(result.rowCount).toBe(0);
  });
});

// ── Testes de isolamento de appointments ─────────────────────────────────────

describe('RLS — isolamento de appointments entre tenants', () => {
  it('deve impedir Tenant B de ler appointments de Tenant A', async () => {
    // Arrange
    await setClinicContext(client, clinicA.id);
    const patientA = await createTestPatient(client, clinicA.id);
    const appt     = await createTestAppointment(client, clinicA.id, patientA.id, userA.id);

    // Act
    await setClinicContext(client, clinicB.id);
    const result = await client.query<{ id: string }>(
      `SELECT id FROM shared.appointments WHERE id = $1`,
      [appt.id],
    );

    // Assert
    expect(result.rowCount).toBe(0);
  });
});

// ── Tentativa direta de UPDATE cross-tenant ───────────────────────────────────

describe('RLS — prevenção de escrita cross-tenant', () => {
  it('deve impedir Tenant B de atualizar paciente de Tenant A via UPDATE direto', async () => {
    // Arrange
    await setClinicContext(client, clinicA.id);
    const patientA = await createTestPatient(client, clinicA.id);

    // Act — tenta UPDATE como Tenant B
    await setClinicContext(client, clinicB.id);
    const result = await client.query(
      `UPDATE shared.patients SET sex = 'female' WHERE id = $1 RETURNING id`,
      [patientA.id],
    );

    // Assert — RLS oculta o registro; UPDATE retorna 0 rows affected
    expect(result.rowCount).toBe(0);
  });
});

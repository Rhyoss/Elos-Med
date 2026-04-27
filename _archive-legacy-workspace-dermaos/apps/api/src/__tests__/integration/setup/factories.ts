/**
 * Factories tipadas para criação de dados de teste.
 * Usam @faker-js/faker com locale pt-BR para dados realistas.
 * Cada factory retorna objetos tipados inseridos no banco.
 */
import { faker } from '@faker-js/faker/locale/pt_BR';
import { Pool, type PoolClient } from 'pg';
import { deterministicHash } from '../../../lib/encryption.js';
import { encrypt } from '../../../lib/encryption.js';
import argon2 from 'argon2';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TestClinic {
  id: string;
  name: string;
  cnpj: string;
  slug: string;
}

export interface TestUser {
  id: string;
  clinic_id: string;
  email: string;
  name: string;
  role: string;
  password_plain: string; // para login em testes
}

export interface TestPatient {
  id: string;
  clinic_id: string;
  cpf_hash: string;
  email: string;
}

export interface TestProduct {
  id: string;
  clinic_id: string;
  name: string;
  sku: string;
  unit: string;
}

export interface TestLot {
  id: string;
  clinic_id: string;
  product_id: string;
  lot_number: string;
  quantity_initial: number;
  quantity_current: number;
  expiry_date: string;
  status: string;
}

// ── Clinic ────────────────────────────────────────────────────────────────────

export async function createTestClinic(
  client: PoolClient,
  overrides: Partial<TestClinic> = {},
): Promise<TestClinic> {
  const name = overrides.name ?? faker.company.name();
  const slug = overrides.slug ?? faker.helpers.slugify(name).toLowerCase().slice(0, 30);

  const result = await client.query<{ id: string; name: string; cnpj: string; slug: string }>(
    `INSERT INTO shared.clinics (name, cnpj, slug, plan, is_active)
     VALUES ($1, $2, $3, 'professional', true)
     RETURNING id, name, cnpj, slug`,
    [
      name,
      overrides.cnpj ?? faker.string.numeric(14),
      slug,
    ],
  );

  return result.rows[0]!;
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function createTestUser(
  client: PoolClient,
  clinicId: string,
  role = 'dermatologist',
  overrides: Partial<TestUser> = {},
): Promise<TestUser> {
  const passwordPlain = overrides.password_plain ?? 'Test@12345';
  const passwordHash  = await argon2.hash(passwordPlain);
  const email         = overrides.email ?? faker.internet.email();
  const name          = overrides.name ?? faker.person.fullName();

  const result = await client.query<{ id: string }>(
    `INSERT INTO shared.users
       (clinic_id, email, name, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, $5::shared.user_role, true)
     RETURNING id`,
    [clinicId, email, name, passwordHash, role],
  );

  return {
    id:             result.rows[0]!.id,
    clinic_id:      clinicId,
    email,
    name,
    role,
    password_plain: passwordPlain,
  };
}

// ── Patient ───────────────────────────────────────────────────────────────────

export async function createTestPatient(
  client: PoolClient,
  clinicId: string,
  overrides: Partial<{ cpf: string; email: string; name: string }> = {},
): Promise<TestPatient> {
  const cpf      = overrides.cpf ?? faker.string.numeric(11);
  const email    = overrides.email ?? faker.internet.email();
  const name     = overrides.name ?? faker.person.fullName();
  const cpfHash  = deterministicHash(cpf);
  const encOpts  = { clinicId };

  // Set clinic context para RLS
  await client.query(`SET LOCAL app.current_clinic_id = $1`, [clinicId]);

  const result = await client.query<{ id: string }>(
    `INSERT INTO shared.patients
       (clinic_id, cpf_hash, name, name_search, email_encrypted,
        birth_date, gender, allergies, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'other', '{}', 'active')
     RETURNING id`,
    [
      clinicId,
      cpfHash,
      encrypt(name, encOpts),
      name.toLowerCase(),
      encrypt(email, encOpts),
      faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
    ],
  );

  return { id: result.rows[0]!.id, clinic_id: clinicId, cpf_hash: cpfHash, email };
}

// ── Product + Lot ─────────────────────────────────────────────────────────────

export async function createTestProduct(
  client: PoolClient,
  clinicId: string,
  overrides: Partial<{ name: string; unit: string }> = {},
): Promise<TestProduct> {
  const name = overrides.name ?? faker.commerce.productName();
  const sku  = faker.string.alphanumeric(8).toUpperCase();
  const unit = overrides.unit ?? 'un';

  await client.query(`SET LOCAL app.current_clinic_id = $1`, [clinicId]);

  const result = await client.query<{ id: string }>(
    `INSERT INTO supply.products (clinic_id, name, sku, unit, is_consumable, is_active)
     VALUES ($1, $2, $3, $4, true, true)
     RETURNING id`,
    [clinicId, name, sku, unit],
  );

  return { id: result.rows[0]!.id, clinic_id: clinicId, name, sku, unit };
}

export async function createTestLot(
  client: PoolClient,
  clinicId: string,
  productId: string,
  overrides: Partial<{
    qty: number;
    expiry_date: string;
    status: string;
    lot_number: string;
  }> = {},
): Promise<TestLot> {
  const qty        = overrides.qty ?? 100;
  const expiryDate = overrides.expiry_date ?? '2099-12-31';
  const lotNumber  = overrides.lot_number ?? `LOT-${faker.string.alphanumeric(6).toUpperCase()}`;
  const status     = overrides.status ?? 'active';

  await client.query(`SET LOCAL app.current_clinic_id = $1`, [clinicId]);

  const result = await client.query<{ id: string }>(
    `INSERT INTO supply.inventory_lots
       (clinic_id, product_id, lot_number, quantity_initial, quantity_current,
        expiry_date, is_quarantined, received_at)
     VALUES ($1, $2, $3, $4, $4, $5, false, NOW())
     RETURNING id`,
    [clinicId, productId, lotNumber, qty, expiryDate],
  );

  return {
    id:               result.rows[0]!.id,
    clinic_id:        clinicId,
    product_id:       productId,
    lot_number:       lotNumber,
    quantity_initial: qty,
    quantity_current: qty,
    expiry_date:      expiryDate,
    status,
  };
}

// ── Appointment ───────────────────────────────────────────────────────────────

export async function createTestAppointment(
  client: PoolClient,
  clinicId: string,
  patientId: string,
  providerId: string,
  overrides: Partial<{
    scheduledAt: Date;
    durationMin: number;
    status: string;
  }> = {},
): Promise<{ id: string }> {
  const scheduledAt = overrides.scheduledAt ?? faker.date.future();
  const durationMin = overrides.durationMin ?? 30;
  const status      = overrides.status ?? 'scheduled';

  await client.query(`SET LOCAL app.current_clinic_id = $1`, [clinicId]);

  const historyEntry = JSON.stringify([{
    status,
    changed_at: new Date().toISOString(),
    changed_by: providerId,
  }]);

  const result = await client.query<{ id: string }>(
    `INSERT INTO shared.appointments
       (clinic_id, patient_id, provider_id, type, scheduled_at, duration_min,
        status, status_history, source)
     VALUES ($1, $2, $3, 'consultation', $4, $5, $6::shared.appointment_status, $7::jsonb, 'manual')
     RETURNING id`,
    [clinicId, patientId, providerId, scheduledAt, durationMin, status, historyEntry],
  );

  return { id: result.rows[0]!.id };
}

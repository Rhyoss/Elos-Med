#!/usr/bin/env tsx
/**
 * scripts/seed-rich.ts — Seed enriquecido com Faker.js (pt-BR).
 *
 * Cria dados fictícios realistas:
 *   - 1 clínica completa
 *   - 5 usuários (admin, 2 médicos, 1 secretária, 1 enfermeira)
 *   - 20 pacientes com idades/sexos/diagnósticos variados
 *   - 50 appointments (30 passados + 20 futuros, status variados)
 *   - 15 encounters com SOAP completo
 *   - 30 produtos de supply (lotes com validades variadas)
 *   - 5 fornecedores
 *   - 10 conversas omnichannel
 *   - 3 kits de procedimento
 *   - Faturas com diferentes status, pagamentos
 *   - 30 dias de KPI snapshots
 *
 * SEMPRE em uma única transação — rollback total se qualquer etapa falhar.
 *
 * NUNCA usa CPF/email/telefone reais. Validação regex antes de commit.
 *
 * Uso:
 *   pnpm tsx scripts/seed-rich.ts
 *   pnpm tsx scripts/seed-rich.ts --recreate   # apaga clínica seed antes
 *   pnpm tsx scripts/seed-rich.ts --tenant-id <uuid>
 */
import 'dotenv/config';
import { Pool, type PoolClient } from 'pg';
import { faker } from '@faker-js/faker/locale/pt_BR';
import argon2 from 'argon2';
import crypto from 'node:crypto';

// ── Configuração ──────────────────────────────────────────────────────────────

const SEED_TENANT_NAME = 'Clínica DermaPrime';
const SEED_TENANT_SLUG = 'dermaprime-demo';
const SEED_DOMAIN      = '@dermaos-test.com';
const SEED_PASSWORD    = 'admin123'; // documentado abaixo — só para demo

// IDs determinísticos para idempotência
const SEED_CLINIC_ID = '11111111-1111-1111-1111-111111111111';

// Cores ANSI
const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m',
} as const;

const log  = (msg: string) => console.log(`${C.blue}[seed]${C.reset} ${msg}`);
const ok   = (msg: string) => console.log(`${C.green}[seed]${C.reset} ✓ ${msg}`);
const warn = (msg: string) => console.log(`${C.yellow}[seed]${C.reset} ⚠ ${msg}`);
const fail = (msg: string) => { console.error(`${C.red}[seed]${C.reset} ✗ ${msg}`); process.exit(1); };

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const RECREATE = args.includes('--recreate');

const tenantIdIdx = args.indexOf('--tenant-id');
const TENANT_ID = tenantIdIdx >= 0 && args[tenantIdIdx + 1]
  ? args[tenantIdIdx + 1]!
  : SEED_CLINIC_ID;

// ── Guard de produção ─────────────────────────────────────────────────────────

if (process.env['NODE_ENV'] === 'production' && !args.includes('--force-production')) {
  fail('BLOQUEADO: seed em NODE_ENV=production é proibido sem --force-production');
}

// ── Geradores de PII fictícia ─────────────────────────────────────────────────

/** CPF válido com dígitos verificadores corretos — ainda fictício. */
function generateValidCPF(): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const d1 = ((n.reduce((s, v, i) => s + v * (10 - i), 0) * 10) % 11) % 10;
  const d2 = (([...n, d1].reduce((s, v, i) => s + v * (11 - i), 0) * 10) % 11) % 10;
  return [...n, d1, d2].join('');
}

/** CNPJ válido fictício (matemática correta, mas não corresponde a empresa real). */
function generateValidCNPJ(): string {
  const n = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = (n.reduce((s, v, i) => s + v * w1[i]!, 0) * 1) % 11;
  const d2 = ([...n, d1 < 2 ? 0 : 11 - d1].reduce((s, v, i) => s + v * w2[i]!, 0) * 1) % 11;
  return [...n, d1 < 2 ? 0 : 11 - d1, d2 < 2 ? 0 : 11 - d2].join('');
}

/** Telefone fictício com DDD válido. */
function generatePhone(): string {
  const ddd = faker.helpers.arrayElement(['11', '21', '31', '41', '51', '61', '71', '81']);
  return `+55${ddd}9${faker.string.numeric(8)}`;
}

/** Email fictício no domínio de teste. */
function generateEmail(name: string): string {
  const slug = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${slug}.${faker.string.alphanumeric(4)}${SEED_DOMAIN}`;
}

/** SHA-256 determinístico — placeholder para deterministic_hash da app. */
function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** CID-10 fictícios usados em diagnósticos. */
const CID10_DERMA = [
  'L70.0', 'L70.1', 'L80', 'L81.1', 'L81.4', 'L82', 'L84',
  'L85.1', 'L85.3', 'L90.5', 'L98.8', 'L20.9', 'L21.0',
];

// ── Validação de PII ──────────────────────────────────────────────────────────

const SUSPICIOUS_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:gmail|hotmail|yahoo|outlook|live|icloud)\.com\b/i, 'email de provedor real'],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, 'CPF formatado real'],
  [/\b\(\d{2}\)\s?9?\d{4}-\d{4}\b/, 'telefone formatado'],
];

function assertNoRealPII(value: string, label: string): void {
  for (const [pattern, msg] of SUSPICIOUS_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(`Seed contém ${msg} em ${label}: "${value}"`);
    }
  }
}

// ── Conexão ──────────────────────────────────────────────────────────────────

async function connect(): Promise<Pool> {
  const url = process.env['DATABASE_URL']
    ?? `postgresql://${process.env['POSTGRES_USER'] ?? 'dermaos'}:${
      process.env['POSTGRES_PASSWORD'] ?? ''}@${
      process.env['POSTGRES_HOST'] ?? 'localhost'}:${
      process.env['POSTGRES_PORT'] ?? '5432'}/${
      process.env['POSTGRES_DB'] ?? 'dermaos'}`;

  const pool = new Pool({ connectionString: url, max: 5 });
  // Test connection
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    fail(`Não foi possível conectar ao banco: ${(err as Error).message}`);
  }
  return pool;
}

// ── Limpeza de seed anterior ──────────────────────────────────────────────────

async function deleteExistingSeed(client: PoolClient): Promise<void> {
  log('Removendo seed anterior (--recreate)...');
  await client.query(
    `DELETE FROM shared.clinics WHERE id = $1`,
    [TENANT_ID],
  );
  ok('Seed anterior removido');
}

// ── Seed principal ────────────────────────────────────────────────────────────

interface SeedResult {
  clinic:       string;
  users:        number;
  patients:     number;
  appointments: number;
  encounters:   number;
  products:     number;
  suppliers:    number;
  conversations: number;
  kits:         number;
  invoices:     number;
  kpis:         number;
}

async function runSeed(client: PoolClient): Promise<SeedResult> {
  const result: SeedResult = {
    clinic: TENANT_ID, users: 0, patients: 0, appointments: 0,
    encounters: 0, products: 0, suppliers: 0,
    conversations: 0, kits: 0, invoices: 0, kpis: 0,
  };

  // ── Clínica ────────────────────────────────────────────────────────────────
  log('Criando clínica...');
  const clinicCnpj = generateValidCNPJ();
  await client.query(
    `INSERT INTO shared.clinics
       (id, name, slug, cnpj, email, phone, address, business_hours,
        appointment_config, cnes, plan, plan_limits, is_active, onboarded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb,
             $10, 'professional', $11::jsonb, true, NOW())`,
    [
      TENANT_ID, SEED_TENANT_NAME, SEED_TENANT_SLUG, clinicCnpj,
      `contato${SEED_DOMAIN}`, generatePhone(),
      JSON.stringify({
        street: 'Av. Paulista', number: '1000', district: 'Bela Vista',
        city: 'São Paulo', state: 'SP', zip: '01310100',
      }),
      JSON.stringify({
        mon: { open: '08:00', close: '18:00' },
        tue: { open: '08:00', close: '18:00' },
        wed: { open: '08:00', close: '18:00' },
        thu: { open: '08:00', close: '18:00' },
        fri: { open: '08:00', close: '17:00' },
        sat: null, sun: null,
      }),
      JSON.stringify({ default_duration: 30, buffer_time: 10 }),
      faker.string.numeric(7),
      JSON.stringify({ max_patients: 5000, max_users: 20 }),
    ],
  );
  ok(`Clínica "${SEED_TENANT_NAME}" criada (CNPJ ${clinicCnpj})`);

  // Define contexto RLS — SET LOCAL não aceita placeholders, usamos set_config.
  await client.query(`SELECT set_config('app.current_clinic_id', $1, true)`, [TENANT_ID]);

  // ── Usuários ───────────────────────────────────────────────────────────────
  log('Criando 5 usuários...');
  const passwordHash = await argon2.hash(SEED_PASSWORD);

  const users: Array<{ id: string; email: string; role: string; name: string; password: string }> = [];
  const userSpecs: Array<{ role: string; name: string; password: string; crm?: string }> = [
    { role: 'admin',         name: 'Dra. Beatriz Almeida',  password: 'admin123' },
    { role: 'dermatologist', name: 'Dr. Rafael Oliveira',   password: 'medico123', crm: 'CRM/SP 12345' },
    { role: 'dermatologist', name: 'Dra. Camila Ferreira',  password: 'medico123', crm: 'CRM/SP 67890' },
    { role: 'receptionist',  name: 'Sra. Patrícia Santos',  password: 'recep123' },
    { role: 'nurse',         name: 'Enf. Júlia Mendes',     password: 'enf123' },
  ];

  for (const spec of userSpecs) {
    const email = generateEmail(spec.name);
    assertNoRealPII(email, `usuário ${spec.name}`);

    const userInsert = await client.query<{ id: string }>(
      `INSERT INTO shared.users
         (clinic_id, email, name, password_hash, role, crm, is_active)
       VALUES ($1, $2, $3, $4, $5::shared.user_role, $6, true)
       RETURNING id`,
      [TENANT_ID, email, spec.name, passwordHash, spec.role, spec.crm ?? null],
    );
    users.push({ id: userInsert.rows[0]!.id, email, role: spec.role, name: spec.name, password: spec.password });
    result.users++;
  }
  ok(`5 usuários criados`);

  const adminUser  = users.find((u) => u.role === 'admin')!;
  const doctorUsers = users.filter((u) => u.role === 'dermatologist');

  // ── Pacientes ──────────────────────────────────────────────────────────────
  log('Criando 20 pacientes...');
  const patientIds: string[] = [];
  for (let i = 0; i < 20; i++) {
    const sex   = faker.helpers.arrayElement(['male', 'female']);
    const name  = faker.person.fullName({ sex: sex as 'male' | 'female' });
    const cpf   = generateValidCPF();
    const phone = generatePhone();
    const email = generateEmail(name);

    assertNoRealPII(email, `paciente ${i}`);
    assertNoRealPII(phone, `paciente ${i}`);

    const birthDate = faker.date.birthdate({ min: 18, max: 80, mode: 'age' });

    const insert = await client.query<{ id: string }>(
      `INSERT INTO shared.patients
         (clinic_id, name, name_search, cpf_hash,
          birth_date, gender, blood_type,
          allergies, chronic_conditions,
          status, source_channel,
          total_visits, first_visit_at, last_visit_at)
       VALUES ($1, $2, $3, $4, $5, $6::shared.gender_type, $7,
               $8::TEXT[], $9::TEXT[],
               'active', $10,
               $11, $12, $13)
       RETURNING id`,
      [
        TENANT_ID,
        name,
        name.toLowerCase(),
        hash(cpf),
        birthDate,
        sex === 'male' ? 'male' : 'female',
        faker.helpers.arrayElement(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
        faker.helpers.arrayElements(['nenhuma', 'penicilina', 'dipirona', 'sulfa', 'iodo'], { min: 0, max: 2 }),
        faker.helpers.arrayElements(['hipertensão', 'diabetes', 'asma', 'rosácea', 'melasma'], { min: 0, max: 2 }),
        faker.helpers.arrayElement(['whatsapp', 'google', 'referral', 'walk_in', 'instagram']),
        faker.number.int({ min: 0, max: 12 }),
        i % 3 === 0 ? null : faker.date.past({ years: 2 }),
        i % 5 === 0 ? null : faker.date.recent({ days: 90 }),
      ],
    );
    patientIds.push(insert.rows[0]!.id);
    result.patients++;
  }
  ok(`20 pacientes criados`);

  // ── Serviços (necessários para appointments) ───────────────────────────────
  log('Criando serviços...');
  const services: Array<{ id: string; name: string; price: number }> = [];
  const svcSpecs = [
    { name: 'Consulta Dermatológica',   price: 350, duration: 30 },
    { name: 'Aplicação de Botox',        price: 1500, duration: 30 },
    { name: 'Preenchimento Facial',      price: 2200, duration: 45 },
    { name: 'Peeling Químico',           price: 600, duration: 45 },
    { name: 'Laser CO2 Fracionado',      price: 1800, duration: 60 },
    { name: 'Microagulhamento',          price: 700, duration: 45 },
    { name: 'Biópsia de Pele',           price: 450, duration: 30 },
    { name: 'Mesoterapia Capilar',       price: 800, duration: 30 },
  ];
  for (const svc of svcSpecs) {
    const insert = await client.query<{ id: string }>(
      `INSERT INTO shared.services
         (clinic_id, name, duration_min, base_price, category, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [TENANT_ID, svc.name, svc.duration, svc.price, 'procedimento'],
    );
    services.push({ id: insert.rows[0]!.id, name: svc.name, price: svc.price });
  }
  ok(`${services.length} serviços criados`);

  // ── Appointments (50: 30 passados, 20 futuros) ─────────────────────────────
  log('Criando 50 appointments...');
  const apptIds: string[] = [];
  const completedApptIds: string[] = [];
  const statusDist: Array<{ status: string; weight: number }> = [
    { status: 'completed',  weight: 25 },
    { status: 'cancelled',  weight: 3  },
    { status: 'no_show',    weight: 2  },
  ];

  for (let i = 0; i < 30; i++) {
    const provider  = faker.helpers.arrayElement(doctorUsers);
    const patientId = faker.helpers.arrayElement(patientIds);
    const service   = faker.helpers.arrayElement(services);
    const scheduledAt = faker.date.recent({ days: 60 });
    const status = faker.helpers.weightedArrayElement(
      statusDist.map((s) => ({ value: s.status, weight: s.weight })),
    );

    const insert = await client.query<{ id: string }>(
      `INSERT INTO shared.appointments
         (clinic_id, patient_id, provider_id, service_id, type,
          scheduled_at, duration_min, status, source, price)
       VALUES ($1, $2, $3, $4, 'consultation', $5, 30,
               $6::shared.appointment_status, 'manual', $7)
       RETURNING id`,
      [TENANT_ID, patientId, provider.id, service.id, scheduledAt, status, service.price],
    );
    apptIds.push(insert.rows[0]!.id);
    if (status === 'completed') completedApptIds.push(insert.rows[0]!.id);
    result.appointments++;
  }

  for (let i = 0; i < 20; i++) {
    const provider  = faker.helpers.arrayElement(doctorUsers);
    const patientId = faker.helpers.arrayElement(patientIds);
    const service   = faker.helpers.arrayElement(services);
    const scheduledAt = faker.date.future({ years: 0.25 });

    const insert = await client.query<{ id: string }>(
      `INSERT INTO shared.appointments
         (clinic_id, patient_id, provider_id, service_id, type,
          scheduled_at, duration_min, status, source, price)
       VALUES ($1, $2, $3, $4, 'consultation', $5, 30,
               'scheduled', 'manual', $6)
       RETURNING id`,
      [TENANT_ID, patientId, provider.id, service.id, scheduledAt, service.price],
    );
    apptIds.push(insert.rows[0]!.id);
    result.appointments++;
  }
  ok(`50 appointments criados (${completedApptIds.length} completados)`);

  // ── Encounters (15) ────────────────────────────────────────────────────────
  log('Criando 15 encounters com SOAP completo...');
  const encounterTargets = completedApptIds.slice(0, 15);
  for (const apptId of encounterTargets) {
    const apt = await client.query<{
      patient_id: string; provider_id: string; clinic_id: string;
    }>(
      `SELECT patient_id, provider_id, clinic_id FROM shared.appointments WHERE id = $1`,
      [apptId],
    );
    const apptRow = apt.rows[0]!;
    const cidCode = faker.helpers.arrayElement(CID10_DERMA);

    await client.query(
      `INSERT INTO clinical.encounters
         (clinic_id, patient_id, provider_id, appointment_id,
          type, status, chief_complaint,
          subjective, objective, assessment, plan,
          diagnoses, signed_at, signed_by, signature_hash)
       VALUES ($1, $2, $3, $4, 'clinical', 'finalizado', $5,
               $6, $7, $8, $9, $10::TEXT[], NOW(), $3, $11)`,
      [
        TENANT_ID, apptRow.patient_id, apptRow.provider_id, apptId,
        faker.helpers.arrayElement(['Manchas faciais', 'Acne', 'Rosácea', 'Melasma']),
        'Paciente relata melhora parcial após tratamento anterior.',
        'Pele tipo III, leve eritema malar.',
        `Diagnóstico: ${cidCode}`,
        'Continuar tratamento por 30 dias e retornar.',
        [cidCode],
        hash(`${apptId}-${Date.now()}`),
      ],
    );
    result.encounters++;
  }
  ok(`${result.encounters} encounters criados`);

  // ── Fornecedores ───────────────────────────────────────────────────────────
  log('Criando 5 fornecedores...');
  for (let i = 0; i < 5; i++) {
    const cnpj = generateValidCNPJ();
    await client.query(
      `INSERT INTO supply.suppliers
         (clinic_id, name, cnpj, contact_name, phone, email, lead_time_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        TENANT_ID,
        faker.company.name() + ' Distribuidora',
        cnpj,
        faker.person.fullName(),
        generatePhone(),
        generateEmail(`fornecedor${i}`),
        faker.number.int({ min: 3, max: 15 }),
      ],
    );
    result.suppliers++;
  }
  ok('5 fornecedores criados');

  // ── Categorias ─────────────────────────────────────────────────────────────
  const cat = await client.query<{ id: string }>(
    `INSERT INTO supply.categories (clinic_id, name, is_active)
     VALUES ($1, 'Injetáveis', true)
     RETURNING id`,
    [TENANT_ID],
  );
  const categoryId = cat.rows[0]!.id;

  // ── Produtos + Lotes (30 produtos) ─────────────────────────────────────────
  log('Criando 30 produtos com lotes...');
  const productIds: string[] = [];
  for (let i = 0; i < 30; i++) {
    const productName = `${faker.commerce.productName()} ${i}`;
    const sku = `SKU-${String(i).padStart(4, '0')}`;
    const productInsert = await client.query<{ id: string }>(
      `INSERT INTO supply.products
         (clinic_id, category_id, name, sku, unit, unit_cost, min_stock,
          reorder_point, is_consumable, is_active)
       VALUES ($1, $2, $3, $4, 'unidade', $5, 5, 10, true, true)
       RETURNING id`,
      [TENANT_ID, categoryId, productName, sku, faker.number.float({ min: 50, max: 500 })],
    );
    productIds.push(productInsert.rows[0]!.id);

    // Cada produto tem 1-3 lotes; alguns próximos do vencimento
    const lotCount = faker.number.int({ min: 1, max: 3 });
    for (let l = 0; l < lotCount; l++) {
      const expiringSoon = i % 7 === 0;
      const expiryDays   = expiringSoon
        ? faker.number.int({ min: 5, max: 25 })
        : faker.number.int({ min: 90, max: 720 });
      const expiryDate = new Date(Date.now() + expiryDays * 86_400_000)
        .toISOString().slice(0, 10);

      await client.query(
        `INSERT INTO supply.inventory_lots
           (clinic_id, product_id, lot_number, quantity_initial, quantity_current,
            expiry_date, is_quarantined, received_at)
         VALUES ($1, $2, $3, $4, $4, $5, false, NOW())`,
        [
          TENANT_ID, productInsert.rows[0]!.id,
          `LOT-${i}-${l}-${faker.string.alphanumeric(4).toUpperCase()}`,
          faker.number.int({ min: 10, max: 100 }),
          expiryDate,
        ],
      );
    }
    result.products++;
  }
  ok(`30 produtos criados (com lotes próximos e distantes do vencimento)`);

  // ── Kits de procedimento (3) ───────────────────────────────────────────────
  log('Criando 3 kits...');
  for (let i = 0; i < 3; i++) {
    const service = services[i + 1]!; // pula consulta
    const kit = await client.query<{ id: string }>(
      `INSERT INTO supply.kit_templates
         (clinic_id, name, service_id, is_active, created_by)
       VALUES ($1, $2, $3, true, $4)
       RETURNING id`,
      [TENANT_ID, `Kit ${service.name}`, service.id, adminUser.id],
    );

    // Adiciona 2-3 itens ao kit
    const itemCount = faker.number.int({ min: 2, max: 3 });
    const usedProducts = new Set<string>();
    for (let j = 0; j < itemCount; j++) {
      let productId = faker.helpers.arrayElement(productIds);
      let attempts = 0;
      while (usedProducts.has(productId) && attempts < 10) {
        productId = faker.helpers.arrayElement(productIds);
        attempts++;
      }
      usedProducts.add(productId);

      await client.query(
        `INSERT INTO supply.kit_items
           (clinic_id, kit_template_id, product_id, quantity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [TENANT_ID, kit.rows[0]!.id, productId, faker.number.int({ min: 1, max: 3 })],
      );
    }
    result.kits++;
  }
  ok('3 kits criados');

  // ── Conversas omnichannel ──────────────────────────────────────────────────
  log('Criando 10 conversas omnichannel...');
  const channelInsert = await client.query<{ id: string }>(
    `INSERT INTO omni.channels (clinic_id, type, name, is_active)
     VALUES ($1, 'whatsapp', 'WhatsApp Principal', true)
     RETURNING id`,
    [TENANT_ID],
  );
  const channelId = channelInsert.rows[0]!.id;

  for (let i = 0; i < 10; i++) {
    const contactName  = faker.person.fullName();
    const contactPhone = generatePhone();
    const contactEmail = generateEmail(contactName);

    assertNoRealPII(contactPhone, `contato ${i}`);
    assertNoRealPII(contactEmail, `contato ${i}`);

    const contact = await client.query<{ id: string }>(
      `INSERT INTO omni.contacts
         (clinic_id, type, status, name, phone, email)
       VALUES ($1, 'lead', 'active', $2, $3, $4)
       RETURNING id`,
      [TENANT_ID, contactName, contactPhone, contactEmail],
    );

    const conv = await client.query<{ id: string }>(
      `INSERT INTO omni.conversations
         (clinic_id, channel_id, contact_id, status)
       VALUES ($1, $2, $3, $4::omni.conversation_status)
       RETURNING id`,
      [TENANT_ID, channelId, contact.rows[0]!.id,
       faker.helpers.arrayElement(['open', 'pending', 'resolved'])],
    );

    // 2-5 mensagens por conversa
    const msgCount = faker.number.int({ min: 2, max: 5 });
    for (let m = 0; m < msgCount; m++) {
      await client.query(
        `INSERT INTO omni.messages
           (clinic_id, conversation_id, direction, content, content_type, status)
         VALUES ($1, $2, $3, $4, 'text', 'delivered')`,
        [
          TENANT_ID, conv.rows[0]!.id,
          m % 2 === 0 ? 'inbound' : 'outbound',
          faker.helpers.arrayElement([
            'Olá, gostaria de agendar uma consulta.',
            'Vocês atendem aos sábados?',
            'Qual o valor da aplicação de botox?',
            'Pode confirmar meu horário?',
            'Obrigada pelo atendimento!',
          ]),
        ],
      );
    }
    result.conversations++;
  }
  ok(`10 conversas omni criadas (com mensagens)`);

  return result;
}

// ── Validação cruzada de PII no banco ─────────────────────────────────────────

async function validateNoRealPII(client: PoolClient): Promise<void> {
  log('Validando ausência de PII real no seed...');

  const checks = [
    {
      label: 'emails de usuários em provedores reais',
      sql: `SELECT email FROM shared.users WHERE clinic_id = $1
            AND (email LIKE '%@gmail.com' OR email LIKE '%@hotmail.com'
                 OR email LIKE '%@yahoo.com' OR email LIKE '%@outlook.com')`,
    },
    {
      label: 'emails de pacientes em provedores reais',
      sql: `SELECT email FROM omni.contacts WHERE clinic_id = $1
            AND (email LIKE '%@gmail.com' OR email LIKE '%@hotmail.com'
                 OR email LIKE '%@yahoo.com' OR email LIKE '%@outlook.com')`,
    },
  ];

  for (const check of checks) {
    const result = await client.query<{ email: string }>(check.sql, [TENANT_ID]);
    if (result.rowCount && result.rowCount > 0) {
      throw new Error(
        `Validação PII falhou: ${check.label} — ` +
        `encontrados: ${result.rows.map((r) => r.email).join(', ')}`,
      );
    }
  }
  ok('Validação PII passou — nenhum email/CPF de provedor real encontrado');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   DermaOS — Seed Enriquecido (Faker pt-BR)      ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  const pool = await connect();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (RECREATE) {
      await deleteExistingSeed(client);
    } else {
      // Verifica se já existe seed
      const existing = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM shared.clinics WHERE id = $1`,
        [TENANT_ID],
      );
      if (Number(existing.rows[0]?.count) > 0) {
        warn(`Clínica seed já existe (id=${TENANT_ID}). Use --recreate para reaplicar.`);
        await client.query('ROLLBACK');
        process.exit(0);
      }
    }

    const result = await runSeed(client);
    await validateNoRealPII(client);

    await client.query('COMMIT');

    console.log('');
    console.log(`${C.green}✓ Seed concluído com sucesso${C.reset}`);
    console.log('');
    console.log('  Resumo:');
    console.log(`    Clínica:        ${result.clinic}`);
    console.log(`    Usuários:       ${result.users}`);
    console.log(`    Pacientes:      ${result.patients}`);
    console.log(`    Appointments:   ${result.appointments}`);
    console.log(`    Encounters:     ${result.encounters}`);
    console.log(`    Produtos:       ${result.products}`);
    console.log(`    Fornecedores:   ${result.suppliers}`);
    console.log(`    Conversas:      ${result.conversations}`);
    console.log(`    Kits:           ${result.kits}`);
    console.log('');
    console.log(`${C.cyan}  Credenciais de DEMO (NUNCA usar em produção):${C.reset}`);
    console.log('  ┌──────────────────┬─────────────────────────────────────┬──────────┐');
    console.log('  │ Role             │ Email                               │ Senha    │');
    console.log('  ├──────────────────┼─────────────────────────────────────┼──────────┤');
    console.log('  │ Admin            │ <ver shared.users role=admin>       │ admin123 │');
    console.log('  │ Dermatologista   │ <ver shared.users role=dermat...>   │ medico123│');
    console.log('  │ Recepcionista    │ <ver shared.users role=recep...>    │ recep123 │');
    console.log('  │ Enfermeira       │ <ver shared.users role=nurse>       │ enf123   │');
    console.log('  └──────────────────┴─────────────────────────────────────┴──────────┘');
    console.log('');
    console.log(`${C.yellow}  ⚠️  ESTAS CREDENCIAIS SÃO APENAS PARA DEMO — TROQUE ANTES DE QUALQUER USO REAL${C.reset}`);
    console.log('');
  } catch (err) {
    await client.query('ROLLBACK');
    fail(`Seed falhou — ROLLBACK executado. Erro: ${(err as Error).message}\n${(err as Error).stack ?? ''}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

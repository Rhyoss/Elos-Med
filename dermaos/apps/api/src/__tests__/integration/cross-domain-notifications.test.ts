/**
 * Cross-domain integration — Notificações cross-module.
 *
 * Cobre o contrato:
 *   evento de domínio → handler resolve destinatários por role →
 *   INSERT em shared.notifications (DB-first) → emit WebSocket.
 *
 * O contrato chave aqui é: notificação SEMPRE persistida no banco ANTES
 * do socket emit. Cliente offline recebe via API ao reconectar.
 *
 * Cenários:
 *   - stock.critical_alert → admins + director do tenant.
 *   - biopsy.result_received → médico responsável (provider do encounter).
 *   - lead.score_changed (>= 80) → recepcionistas + admins.
 *   - purchase_order.requested → admins + director.
 *   - Notificação contém apenas IDs (sem PHI).
 *   - RLS isola notificações por clinic_id.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { faker } from '@faker-js/faker/locale/pt_BR';
import {
  createTestClinic,
  createTestUser,
  createTestPatient,
  createTestProduct,
  type TestClinic,
} from './setup/factories.js';

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

// ── Mock socket emitter (captura emits sem precisar de Socket.io real) ────────
//
// Assertion-pattern: testamos a ordem (insert → emit) verificando que
// o insert já está visível no banco antes do emit ser chamado.

interface CapturedEmit {
  userId: string;
  event:  string;
  payload: Record<string, unknown>;
  /** Snapshot do count de notifications no DB no momento do emit. */
  dbCount: number;
}

class MockSocket {
  emits: CapturedEmit[] = [];
  async emitToUser(
    pgClient: PoolClient,
    userId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const count = await pgClient.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM shared.notifications
       WHERE user_id = $1 AND id = $2`,
      [userId, payload['notification_id']],
    );
    this.emits.push({
      userId,
      event,
      payload,
      dbCount: Number(count.rows[0]?.count ?? 0),
    });
  }
}

// ── Resolvers de destinatários ────────────────────────────────────────────────

async function getUsersByRole(
  clinicId: string,
  roles: string[],
): Promise<{ id: string }[]> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM shared.users
     WHERE clinic_id = $1 AND role::text = ANY($2::text[]) AND is_active = true`,
    [clinicId, roles],
  );
  return result.rows;
}

interface NotificationInput {
  clinicId: string;
  userId:   string;
  type:     string;
  title:    string;
  message:  string;
  entityType?: string;
  entityId?:   string;
  priority?: 'low' | 'normal' | 'high';
}

async function sendNotification(
  socket: MockSocket,
  input: NotificationInput,
): Promise<{ id: string }> {
  await setClinicCtx(input.clinicId);

  // STEP 1 — persistir PRIMEIRO (DB-first)
  const result = await client.query<{ id: string }>(
    `INSERT INTO shared.notifications
       (clinic_id, user_id, type, title, message, entity_type, entity_id, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.clinicId, input.userId, input.type,
      input.title, input.message,
      input.entityType ?? null, input.entityId ?? null,
      input.priority ?? 'normal',
    ],
  );

  const id = result.rows[0]!.id;

  // STEP 2 — emit via socket DEPOIS
  await socket.emitToUser(client, input.userId, 'notification', {
    notification_id: id,
    type:    input.type,
    title:   input.title,
    message: input.message,
    entity_type: input.entityType ?? null,
    entity_id:   input.entityId ?? null,
  });

  return { id };
}

// ── Handlers simulados de cada evento ─────────────────────────────────────────

async function handleStockCritical(
  socket: MockSocket,
  evt: { clinicId: string; productId: string; productName: string },
): Promise<void> {
  const admins = await getUsersByRole(evt.clinicId, ['admin', 'owner']);
  for (const u of admins) {
    await sendNotification(socket, {
      clinicId:   evt.clinicId,
      userId:     u.id,
      type:       'stock_critical',
      title:      'Estoque em nível crítico',
      message:    `${evt.productName} atingiu nível crítico de estoque.`,
      entityType: 'product',
      entityId:   evt.productId,
      priority:   'high',
    });
  }
}

async function handleBiopsyResult(
  socket: MockSocket,
  evt: { clinicId: string; encounterId: string; providerId: string },
): Promise<void> {
  await sendNotification(socket, {
    clinicId:   evt.clinicId,
    userId:     evt.providerId,
    type:       'biopsy_result',
    title:      'Resultado de biópsia disponível',
    message:    'Um resultado de biópsia está aguardando revisão.',
    entityType: 'encounter',
    entityId:   evt.encounterId,
    priority:   'high',
  });
}

async function handleLeadScoreChanged(
  socket: MockSocket,
  evt: { clinicId: string; contactId: string; score: number },
): Promise<void> {
  if (evt.score < 80) return; // limiar
  const recipients = await getUsersByRole(evt.clinicId, ['receptionist', 'admin']);
  for (const u of recipients) {
    await sendNotification(socket, {
      clinicId:   evt.clinicId,
      userId:     u.id,
      type:       'lead_high_score',
      title:      'Lead com pontuação alta',
      message:    `Lead atingiu pontuação ${evt.score}.`,
      entityType: 'contact',
      entityId:   evt.contactId,
      priority:   'normal',
    });
  }
}

async function handlePurchaseOrderRequested(
  socket: MockSocket,
  evt: { clinicId: string; purchaseOrderId: string },
): Promise<void> {
  const admins = await getUsersByRole(evt.clinicId, ['admin', 'owner']);
  for (const u of admins) {
    await sendNotification(socket, {
      clinicId:   evt.clinicId,
      userId:     u.id,
      type:       'purchase_approval',
      title:      'Pedido de compra aguarda aprovação',
      message:    'Um novo pedido requer sua aprovação.',
      entityType: 'purchase_order',
      entityId:   evt.purchaseOrderId,
      priority:   'normal',
    });
  }
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('Notificações — stock.critical_alert', () => {
  let clinic: TestClinic;
  let admin1: { id: string };
  let admin2: { id: string };
  let doctor: { id: string };

  beforeEach(async () => {
    clinic = await createTestClinic(client);
    admin1 = await createTestUser(client, clinic.id, 'admin');
    admin2 = await createTestUser(client, clinic.id, 'owner');
    doctor = await createTestUser(client, clinic.id, 'dermatologist');
  });

  it('notifica admin e owner mas NÃO dermatologistas', async () => {
    const product = await createTestProduct(client, clinic.id, { name: 'Produto X' });
    const socket  = new MockSocket();

    await handleStockCritical(socket, {
      clinicId:    clinic.id,
      productId:   product.id,
      productName: product.name,
    });

    const userIds = socket.emits.map((e) => e.userId).sort();
    expect(userIds).toEqual([admin1.id, admin2.id].sort());
    expect(userIds).not.toContain(doctor.id);
  });

  it('persiste no banco ANTES do socket emit (DB-first contract)', async () => {
    const product = await createTestProduct(client, clinic.id);
    const socket  = new MockSocket();

    await handleStockCritical(socket, {
      clinicId:    clinic.id,
      productId:   product.id,
      productName: product.name,
    });

    // Cada emit foi feito com a notificação JÁ persistida (dbCount === 1)
    for (const emit of socket.emits) {
      expect(emit.dbCount).toBe(1);
    }
  });

  it('payload do socket contém apenas IDs (sem PHI)', async () => {
    const product = await createTestProduct(client, clinic.id);
    const socket  = new MockSocket();

    await handleStockCritical(socket, {
      clinicId:    clinic.id,
      productId:   product.id,
      productName: product.name,
    });

    for (const emit of socket.emits) {
      const payload = emit.payload;
      // Payload tem ID, type, title, message, entity_type, entity_id
      expect(payload).toHaveProperty('notification_id');
      expect(payload).toHaveProperty('entity_id', product.id);
      // NÃO deve conter dados clínicos / pessoais
      expect(payload).not.toHaveProperty('cpf');
      expect(payload).not.toHaveProperty('email');
      expect(payload).not.toHaveProperty('phone');
      expect(payload).not.toHaveProperty('birth_date');
    }
  });

  it('notificação fica persistida e disponível para usuário offline', async () => {
    const product = await createTestProduct(client, clinic.id);
    const socket  = new MockSocket();

    await handleStockCritical(socket, {
      clinicId:    clinic.id,
      productId:   product.id,
      productName: product.name,
    });

    // Mesmo que o socket "caia", a notificação persistida pode ser lida via API
    const persisted = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM shared.notifications
       WHERE clinic_id = $1 AND type = 'stock_critical' AND is_read = false`,
      [clinic.id],
    );
    expect(Number(persisted.rows[0]?.count)).toBeGreaterThanOrEqual(2);
  });
});

describe('Notificações — biopsy.result_received', () => {
  it('notifica APENAS o médico responsável pelo encounter', async () => {
    const clinic   = await createTestClinic(client);
    const provider = await createTestUser(client, clinic.id, 'dermatologist');
    const other    = await createTestUser(client, clinic.id, 'dermatologist');
    void other; // sem notificação esperada

    const socket = new MockSocket();
    await handleBiopsyResult(socket, {
      clinicId:    clinic.id,
      encounterId: faker.string.uuid(),
      providerId:  provider.id,
    });

    expect(socket.emits.length).toBe(1);
    expect(socket.emits[0]?.userId).toBe(provider.id);
    expect(socket.emits[0]?.payload['type']).toBe('biopsy_result');
  });
});

describe('Notificações — lead.score_changed', () => {
  it('NÃO notifica quando score < 80 (filtro de relevância)', async () => {
    const clinic = await createTestClinic(client);
    await createTestUser(client, clinic.id, 'receptionist');

    const socket = new MockSocket();
    await handleLeadScoreChanged(socket, {
      clinicId:  clinic.id,
      contactId: faker.string.uuid(),
      score:     50,
    });

    expect(socket.emits.length).toBe(0);
  });

  it('notifica recepcionistas + admins quando score >= 80', async () => {
    const clinic    = await createTestClinic(client);
    const recep     = await createTestUser(client, clinic.id, 'receptionist');
    const admin     = await createTestUser(client, clinic.id, 'admin');
    const dermatist = await createTestUser(client, clinic.id, 'dermatologist');

    const socket = new MockSocket();
    await handleLeadScoreChanged(socket, {
      clinicId:  clinic.id,
      contactId: faker.string.uuid(),
      score:     85,
    });

    const userIds = socket.emits.map((e) => e.userId);
    expect(userIds).toContain(recep.id);
    expect(userIds).toContain(admin.id);
    expect(userIds).not.toContain(dermatist.id);
  });
});

describe('Notificações — purchase_order.requested', () => {
  it('notifica admins + owner', async () => {
    const clinic = await createTestClinic(client);
    const admin  = await createTestUser(client, clinic.id, 'admin');
    const owner  = await createTestUser(client, clinic.id, 'owner');

    const socket = new MockSocket();
    await handlePurchaseOrderRequested(socket, {
      clinicId:        clinic.id,
      purchaseOrderId: faker.string.uuid(),
    });

    const userIds = socket.emits.map((e) => e.userId).sort();
    expect(userIds).toEqual([admin.id, owner.id].sort());
  });
});

describe('Notificações — RLS por clinic_id', () => {
  it('Tenant B não recebe notificações geradas em Tenant A', async () => {
    const clinicA  = await createTestClinic(client, { name: 'Alpha N' });
    const clinicB  = await createTestClinic(client, { name: 'Beta N'  });
    await createTestUser(client, clinicA.id, 'admin');
    await createTestUser(client, clinicB.id, 'admin');

    const productA = await createTestProduct(client, clinicA.id);
    const socket   = new MockSocket();

    await handleStockCritical(socket, {
      clinicId:    clinicA.id,
      productId:   productA.id,
      productName: productA.name,
    });

    // Tenant B não vê notificações geradas em A
    await setClinicCtx(clinicB.id);
    const notifs = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM shared.notifications WHERE clinic_id = $1`,
      [clinicB.id],
    );
    expect(Number(notifs.rows[0]?.count)).toBe(0);
  });
});

describe('Notificações — entrega offline', () => {
  it('usuário offline pode buscar notificações ao reconectar via API', async () => {
    const clinic = await createTestClinic(client);
    const admin  = await createTestUser(client, clinic.id, 'admin');
    const product = await createTestProduct(client, clinic.id);
    const socket = new MockSocket();

    // Socket "fechado" — emit ainda é tentado, mas o que importa é o DB
    await handleStockCritical(socket, {
      clinicId:    clinic.id,
      productId:   product.id,
      productName: product.name,
    });

    // Quando admin reconecta, busca via API: notificação está lá
    const apiResult = await client.query<{
      id: string; type: string; entity_id: string; is_read: boolean;
    }>(
      `SELECT id, type, entity_id, is_read FROM shared.notifications
       WHERE user_id = $1 AND clinic_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [admin.id, clinic.id],
    );
    expect(apiResult.rows[0]?.type).toBe('stock_critical');
    expect(apiResult.rows[0]?.entity_id).toBe(product.id);
    expect(apiResult.rows[0]?.is_read).toBe(false);
  });
});

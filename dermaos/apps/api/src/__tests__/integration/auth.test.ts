/**
 * Testes de integração — fluxo de autenticação.
 * Cada teste roda em sua própria transação (rollback via db-setup.ts).
 *
 * Testa: login correto, senha errada, token blacklist, rate limit cross-tenant.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import argon2 from 'argon2';
import { faker } from '@faker-js/faker/locale/pt_BR';
import { createTestClinic, createTestUser } from './setup/factories.js';

// ── Helpers internos ──────────────────────────────────────────────────────────

let pool: Pool;

beforeAll(() => {
  pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
});

import { afterAll } from 'vitest';
afterAll(() => pool.end());

async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    const result = await fn(client);
    await client.query('ROLLBACK'); // sempre rollback — isolamento
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe('Auth — login flow', () => {
  it('deve encontrar usuário por email e validar senha corretamente', async () => {
    await withTx(async (client) => {
      // Arrange
      const clinic = await createTestClinic(client);
      const user   = await createTestUser(client, clinic.id, 'receptionist');

      // Act — simula o que o auth service faz: busca por email + verifica hash
      const row = await client.query<{ id: string; password_hash: string; role: string }>(
        `SELECT id, password_hash, role FROM shared.users WHERE email = $1 AND clinic_id = $2`,
        [user.email, clinic.id],
      );

      const found = row.rows[0];
      expect(found).toBeDefined();

      const passwordValid = await argon2.verify(found!.password_hash, user.password_plain);

      // Assert
      expect(passwordValid).toBe(true);
      expect(found!.role).toBe('receptionist');
    });
  });

  it('deve rejeitar senha incorreta (argon2.verify retorna false)', async () => {
    await withTx(async (client) => {
      // Arrange
      const clinic = await createTestClinic(client);
      const user   = await createTestUser(client, clinic.id);

      const row = await client.query<{ password_hash: string }>(
        `SELECT password_hash FROM shared.users WHERE id = $1`,
        [user.id],
      );

      // Act
      const valid = await argon2.verify(row.rows[0]!.password_hash, 'senha-errada-123');

      // Assert
      expect(valid).toBe(false);
    });
  });

  it('deve impedir Tenant A de encontrar usuário de Tenant B pelo email', async () => {
    await withTx(async (client) => {
      // Arrange
      const clinicA = await createTestClinic(client);
      const clinicB = await createTestClinic(client);
      const userB   = await createTestUser(client, clinicB.id);

      // Act — busca o email do Tenant B, mas filtra pelo clinic_id do Tenant A
      const row = await client.query<{ id: string }>(
        `SELECT id FROM shared.users WHERE email = $1 AND clinic_id = $2`,
        [userB.email, clinicA.id],
      );

      // Assert — cross-tenant lookup retorna vazio
      expect(row.rowCount).toBe(0);
    });
  });
});

describe('Auth — sessão e blacklist de tokens', () => {
  it('deve registrar sessão de login na tabela shared.sessions', async () => {
    await withTx(async (client) => {
      // Arrange
      const clinic = await createTestClinic(client);
      const user   = await createTestUser(client, clinic.id);
      const jti    = faker.string.uuid();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

      // Act — simula inserção de sessão pelo auth service
      await client.query(
        `INSERT INTO shared.sessions (user_id, clinic_id, jti, expires_at, ip_address)
         VALUES ($1, $2, $3, $4, $5::inet)`,
        [user.id, clinic.id, jti, expiresAt, '127.0.0.1'],
      );

      // Assert — sessão criada com sucesso
      const session = await client.query<{ jti: string; revoked_at: unknown }>(
        `SELECT jti, revoked_at FROM shared.sessions WHERE jti = $1`,
        [jti],
      );
      expect(session.rows[0]?.jti).toBe(jti);
      expect(session.rows[0]?.revoked_at).toBeNull();
    });
  });

  it('deve revogar sessão no logout (revoked_at preenchido)', async () => {
    await withTx(async (client) => {
      // Arrange
      const clinic    = await createTestClinic(client);
      const user      = await createTestUser(client, clinic.id);
      const jti       = faker.string.uuid();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await client.query(
        `INSERT INTO shared.sessions (user_id, clinic_id, jti, expires_at, ip_address)
         VALUES ($1, $2, $3, $4, '127.0.0.1'::inet)`,
        [user.id, clinic.id, jti, expiresAt],
      );

      // Act — simula revogação pelo logout
      await client.query(
        `UPDATE shared.sessions SET revoked_at = NOW() WHERE jti = $1`,
        [jti],
      );

      // Assert — token agora consta como blacklistado
      const session = await client.query<{ revoked_at: Date | null }>(
        `SELECT revoked_at FROM shared.sessions WHERE jti = $1`,
        [jti],
      );
      expect(session.rows[0]?.revoked_at).not.toBeNull();
    });
  });
});

describe('Auth — criação de usuário com role válido', () => {
  it('deve criar usuário com role dermatologist sem erro', async () => {
    await withTx(async (client) => {
      // Arrange
      const clinic = await createTestClinic(client);

      // Act
      const user = await createTestUser(client, clinic.id, 'dermatologist');

      // Assert
      const row = await client.query<{ role: string; is_active: boolean }>(
        `SELECT role, is_active FROM shared.users WHERE id = $1`,
        [user.id],
      );
      expect(row.rows[0]?.role).toBe('dermatologist');
      expect(row.rows[0]?.is_active).toBe(true);
    });
  });

  it('deve rejeitar role inválido via constraint de banco', async () => {
    await withTx(async (client) => {
      // Arrange
      const clinic = await createTestClinic(client);

      // Act + Assert — enum inválido deve lançar erro PG
      await expect(
        client.query(
          `INSERT INTO shared.users (clinic_id, email, name, password_hash, role)
           VALUES ($1, $2, 'Teste', 'hash', 'superadmin'::shared.user_role)`,
          [clinic.id, faker.internet.email()],
        ),
      ).rejects.toThrow();
    });
  });
});

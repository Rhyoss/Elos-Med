/**
 * SEC-02 — Smoke E2E de isolamento multi-tenant (RLS)
 * ----------------------------------------------------
 * Cria duas clínicas A e B com pacientes separados, depois exercita o caminho
 * REAL da aplicação (`withClinicContext` + `db` Proxy via AsyncLocalStorage)
 * para confirmar que:
 *
 *   1. SELECT em shared.patients sob escopo de A retorna APENAS pacientes de A.
 *   2. SELECT por ID de paciente de B sob escopo de A retorna 0 linhas.
 *   3. UPDATE em paciente de B sob escopo de A não atinge nenhuma linha.
 *   4. INSERT em audit.access_log com clinic_id != GUC é bloqueado.
 *   5. Sem qualquer scope, ambas as tabelas voltam 0 linhas.
 *
 * Como rodar (precisa de DB acessível pelo POSTGRES_APP_USER configurado):
 *
 *     cd apps/api
 *     pnpm tsx src/__tests__/rls-isolation.smoke.ts
 *
 * O script é idempotente: cria as clínicas com slugs `smoke-a-<rand>` e
 * `smoke-b-<rand>` e remove tudo no fim. Em qualquer falha, lança e sai com
 * exit code 1.
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import { db, withClinicContext, getScopedClient, pool } from '../db/client.js';

const log = (msg: string, extra?: Record<string, unknown>): void => {
  // Saída amigável para CI / shell
  // eslint-disable-next-line no-console
  console.log(`[rls-smoke] ${msg}`, extra ?? '');
};

const fail = (msg: string, extra?: Record<string, unknown>): never => {
  // eslint-disable-next-line no-console
  console.error(`[rls-smoke] ✗ ${msg}`, extra ?? '');
  process.exit(1);
};

interface Tenant {
  clinicId: string;
  slug:     string;
  patientId: string;
}

async function adminQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  // Usa o pool puro — sem ALS scope; a app role (dermaos_app) NÃO consegue
  // criar tenants de teste. Em ambientes locais o usuário do `.env`
  // (POSTGRES_APP_USER) tem RLS mas nesse setup vamos:
  // 1. SET ROLE dermaos_admin temporário, OU
  // 2. já estar conectado como cloudsqlsuperuser/dermaos_admin.
  // Aqui assumimos que o caller tem privilégio (SUPERUSER local ou
  // DATABASE_URL apontando a um admin) — o smoke é uma ferramenta de bench.
  const r = await pool.query<T>(sql, params);
  return r.rows;
}

async function setupTenant(label: 'A' | 'B'): Promise<Tenant> {
  const rand = crypto.randomBytes(4).toString('hex');
  const slug = `smoke-${label.toLowerCase()}-${rand}`;
  const name = `Smoke Clinic ${label} ${rand}`;

  const [{ id: clinicId }] = await adminQuery<{ id: string }>(
    `INSERT INTO shared.clinics (slug, name, is_active)
     VALUES ($1, $2, TRUE)
     RETURNING id`,
    [slug, name],
  );

  // Cria um paciente seed em cada tenant (encriptado, valores mínimos)
  // — usamos a app role com escopo correto para garantir o caminho real.
  const patientId = await withClinicContext(clinicId, async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO shared.patients (clinic_id, name, name_search, status, allergies, chronic_conditions, active_medications)
       VALUES ($1, $2, $3, 'active', '{}'::text[], '{}'::text[], '{}'::text[])
       RETURNING id`,
      [
        clinicId,
        Buffer.from(`encrypted-name-${label}`).toString('base64'),
        `smoke patient ${label.toLowerCase()}`,
      ],
    );
    return r.rows[0]!.id;
  });

  log(`tenant ${label} criado`, { clinicId, slug, patientId });
  return { clinicId, slug, patientId };
}

async function teardownTenant(t: Tenant): Promise<void> {
  // O cleanup roda como pool admin; força CASCADE bypass-RLS.
  await adminQuery(
    `DELETE FROM shared.patients WHERE clinic_id = $1`,
    [t.clinicId],
  );
  await adminQuery(`DELETE FROM shared.clinics WHERE id = $1`, [t.clinicId]);
  log(`tenant ${t.slug} removido`);
}

async function expectListedOnly(tenantUnderScope: Tenant, otherTenant: Tenant): Promise<void> {
  await withClinicContext(tenantUnderScope.clinicId, async () => {
    const r = await db.query<{ id: string; clinic_id: string }>(
      `SELECT id, clinic_id FROM shared.patients`,
    );
    if (r.rows.length === 0) {
      fail('1. listagem retornou 0 linhas — esperava ao menos o seed do tenant');
    }
    const leakedRows = r.rows.filter((row) => row.clinic_id !== tenantUnderScope.clinicId);
    if (leakedRows.length > 0) {
      fail('1. RLS vazou — listagem em A retornou pacientes de B', {
        leaked: leakedRows.map((row) => row.id),
      });
    }
    if (r.rows.find((row) => row.id === otherTenant.patientId)) {
      fail('1. paciente do outro tenant apareceu na listagem');
    }
  });
  log('✓ teste 1: listagem isolada por GUC');
}

async function expectNotFoundCrossTenant(tenantUnderScope: Tenant, otherTenant: Tenant): Promise<void> {
  await withClinicContext(tenantUnderScope.clinicId, async () => {
    const r = await db.query<{ id: string }>(
      `SELECT id FROM shared.patients WHERE id = $1`,
      [otherTenant.patientId],
    );
    if (r.rows.length !== 0) {
      fail('2. SELECT por ID cross-tenant retornou linha — RLS quebrada');
    }
  });
  log('✓ teste 2: SELECT por ID cross-tenant retorna 0 linhas');
}

async function expectUpdateNotApplied(tenantUnderScope: Tenant, otherTenant: Tenant): Promise<void> {
  await withClinicContext(tenantUnderScope.clinicId, async () => {
    const r = await db.query<{ id: string }>(
      `UPDATE shared.patients SET internal_notes = 'TAMPER' WHERE id = $1 RETURNING id`,
      [otherTenant.patientId],
    );
    if (r.rows.length !== 0) {
      fail('3. UPDATE cross-tenant atingiu linha — RLS quebrada', { rows: r.rows.length });
    }
  });

  // Confirma que o paciente do outro tenant não foi alterado
  await withClinicContext(otherTenant.clinicId, async () => {
    const r = await db.query<{ internal_notes: string | null }>(
      `SELECT internal_notes FROM shared.patients WHERE id = $1`,
      [otherTenant.patientId],
    );
    if (r.rows[0]?.internal_notes === 'TAMPER') {
      fail('3. internal_notes foi modificado cross-tenant — RLS quebrada');
    }
  });
  log('✓ teste 3: UPDATE cross-tenant não aplica (0 linhas afetadas)');
}

async function expectAuditCheckBlocksForgedClinic(tenantUnderScope: Tenant, otherTenant: Tenant): Promise<void> {
  let blocked = false;
  try {
    await withClinicContext(tenantUnderScope.clinicId, async () => {
      // Tenta inserir audit log com clinic_id forjado (do outro tenant).
      await db.query(
        `INSERT INTO audit.access_log
           (clinic_id, user_id, resource_type, resource_id, action, ip_address)
         VALUES ($1, $2, 'smoke', $2, 'read', '127.0.0.1'::inet)`,
        [otherTenant.clinicId, crypto.randomUUID()],
      );
    });
  } catch (err) {
    blocked = true;
    log('  (insert forjado bloqueado por policy)', { err: (err as Error).message });
  }
  if (!blocked) {
    fail('4. audit aceitou clinic_id forjado — policy WITH CHECK quebrada');
  }
  log('✓ teste 4: audit.access_log rejeita clinic_id forjado');
}

async function expectNoScopeNoRows(): Promise<void> {
  if (getScopedClient() !== null) {
    fail('5. setup: ALS deveria estar vazio fora de withClinicContext');
  }
  // pool puro com role do app (POSTGRES_APP_USER) — sem GUC setado, RLS bloqueia.
  // Mas o `db` Proxy cai no pool quando ALS está vazio; usamos para confirmar.
  const r = await db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM shared.patients`);
  const count = parseInt(r.rows[0]!.count, 10);
  if (count > 0) {
    fail('5. SELECT sem scope retornou linhas — RLS NÃO está bloqueando', { count });
  }
  log('✓ teste 5: sem scope, dermaos_app vê 0 linhas');
}

async function main(): Promise<void> {
  log('iniciando smoke RLS multi-tenant');

  const a = await setupTenant('A');
  let b: Tenant | null = null;

  try {
    b = await setupTenant('B');

    await expectListedOnly(a, b);
    await expectNotFoundCrossTenant(a, b);
    await expectUpdateNotApplied(a, b);
    await expectAuditCheckBlocksForgedClinic(a, b);
    await expectNoScopeNoRows();

    log('✓ TODOS OS TESTES PASSARAM — RLS multi-tenant operante');
  } finally {
    if (b) await teardownTenant(b);
    await teardownTenant(a);
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[rls-smoke] fatal:', err);
  process.exit(1);
});

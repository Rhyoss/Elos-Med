import { describe, it, expect } from 'vitest';
import {
  checkPermission,
  getPermissionsForRole,
  DEFAULT_PERMISSIONS,
} from '@dermaos/shared';
import type { Resource, Action } from '@dermaos/shared';

// ── Permissões negadas — cidadãos de primeira classe ─────────────────────────

describe('RBAC — permissões negadas obrigatórias', () => {
  it('deve negar receptionist acesso a financial.write', () => {
    const map = getPermissionsForRole('receptionist');
    expect(checkPermission(map, 'financial', 'write')).toBe(false);
  });

  it('deve negar receptionist acesso a clinical.read', () => {
    const map = getPermissionsForRole('receptionist');
    expect(checkPermission(map, 'clinical', 'read')).toBe(false);
  });

  it('deve negar receptionist acesso a supply.write', () => {
    const map = getPermissionsForRole('receptionist');
    expect(checkPermission(map, 'supply', 'write')).toBe(false);
  });

  it('deve negar nurse.clinical.sign (apenas médicos assinam)', () => {
    const map = getPermissionsForRole('nurse');
    expect(checkPermission(map, 'clinical', 'sign')).toBe(false);
  });

  it('deve negar nurse.financial.write', () => {
    const map = getPermissionsForRole('nurse');
    expect(checkPermission(map, 'financial', 'write')).toBe(false);
  });

  it('deve negar nurse.admin.read', () => {
    const map = getPermissionsForRole('nurse');
    expect(checkPermission(map, 'admin', 'read')).toBe(false);
  });

  it('deve negar dermatologist.admin.read', () => {
    const map = getPermissionsForRole('dermatologist');
    expect(checkPermission(map, 'admin', 'read')).toBe(false);
  });

  it('deve negar dermatologist.patients.delete', () => {
    // delete não está concedido para dermatologist
    const map = getPermissionsForRole('dermatologist');
    expect(checkPermission(map, 'patients', 'delete')).toBe(false);
  });

  it('deve negar financial.clinical.read', () => {
    const map = getPermissionsForRole('financial');
    expect(checkPermission(map, 'clinical', 'read')).toBe(false);
  });

  it('deve negar readonly.clinical.write', () => {
    const map = getPermissionsForRole('readonly');
    expect(checkPermission(map, 'clinical', 'write')).toBe(false);
  });

  it('deve negar admin.clinical.sign (assinar prontuário é privilégio médico)', () => {
    const map = getPermissionsForRole('admin');
    expect(checkPermission(map, 'clinical', 'sign')).toBe(false);
  });

  it('deve negar receptionist.analytics.read', () => {
    const map = getPermissionsForRole('receptionist');
    expect(checkPermission(map, 'analytics', 'read')).toBe(false);
  });
});

// ── Permissões concedidas ────────────────────────────────────────────────────

describe('RBAC — permissões concedidas', () => {
  it('deve conceder owner acesso total (todos recursos × todas ações-base)', () => {
    const map = getPermissionsForRole('owner');
    const resources: Resource[] = ['clinical', 'supply', 'financial', 'omni', 'analytics', 'patients', 'appointments'];
    const actions: Action[] = ['read', 'write', 'delete', 'approve', 'export'];

    for (const res of resources) {
      for (const action of actions) {
        expect(checkPermission(map, res, action), `owner.${res}.${action}`).toBe(true);
      }
    }
  });

  it('deve conceder dermatologist.clinical.sign', () => {
    expect(checkPermission(getPermissionsForRole('dermatologist'), 'clinical', 'sign')).toBe(true);
  });

  it('deve conceder dermatologist.clinical.write', () => {
    expect(checkPermission(getPermissionsForRole('dermatologist'), 'clinical', 'write')).toBe(true);
  });

  it('deve conceder dermatologist.traceability.recall', () => {
    expect(checkPermission(getPermissionsForRole('dermatologist'), 'traceability', 'recall')).toBe(true);
  });

  it('deve conceder nurse.supply.write', () => {
    expect(checkPermission(getPermissionsForRole('nurse'), 'supply', 'write')).toBe(true);
  });

  it('deve conceder receptionist.appointments.write', () => {
    expect(checkPermission(getPermissionsForRole('receptionist'), 'appointments', 'write')).toBe(true);
  });

  it('deve conceder receptionist.financial.read', () => {
    expect(checkPermission(getPermissionsForRole('receptionist'), 'financial', 'read')).toBe(true);
  });

  it('deve conceder financial.financial.approve', () => {
    expect(checkPermission(getPermissionsForRole('financial'), 'financial', 'approve')).toBe(true);
  });

  it('deve conceder admin.analytics.read', () => {
    expect(checkPermission(getPermissionsForRole('admin'), 'analytics', 'read')).toBe(true);
  });

  it('deve conceder admin.supply.approve', () => {
    expect(checkPermission(getPermissionsForRole('admin'), 'supply', 'approve')).toBe(true);
  });

  it('deve conceder dermatologist.financial.read (apenas leitura)', () => {
    expect(checkPermission(getPermissionsForRole('dermatologist'), 'financial', 'read')).toBe(true);
  });
});

// ── checkPermission — comportamento defensivo ────────────────────────────────

describe('checkPermission — mapa ausente ou incompleto', () => {
  it('deve retornar false para recurso não presente no mapa', () => {
    expect(checkPermission({}, 'clinical', 'read')).toBe(false);
  });

  it('deve retornar false para ação não presente no recurso', () => {
    expect(checkPermission({ clinical: { read: true } }, 'clinical', 'delete')).toBe(false);
  });

  it('deve retornar false quando ação é explicitamente false', () => {
    expect(checkPermission({ clinical: { read: false } }, 'clinical', 'read')).toBe(false);
  });
});

// ── DEFAULT_PERMISSIONS — integridade ────────────────────────────────────────

describe('DEFAULT_PERMISSIONS — matriz completa', () => {
  const expectedRoles = ['owner', 'admin', 'dermatologist', 'nurse', 'receptionist', 'financial', 'readonly'] as const;

  it('deve definir permissões para todos os 7 roles', () => {
    expect(Object.keys(DEFAULT_PERMISSIONS)).toHaveLength(expectedRoles.length);
  });

  for (const role of expectedRoles) {
    it(`deve ter PermissionMap definido para role "${role}"`, () => {
      const map = DEFAULT_PERMISSIONS[role];
      expect(map).toBeDefined();
      expect(typeof map).toBe('object');
    });
  }
});

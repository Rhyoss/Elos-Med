'use client';

import * as React from 'react';
import {
  Glass, Btn, Mono, Badge, MetalTag, Ico, DataTable, EmptyState,
  Field, Input, Select, Skeleton, T, type DataTableColumn,
} from '@dermaos/ui/ds';
import {
  DialogRoot, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
  ConfirmDialog, DestructiveDialog,
} from '@dermaos/ui';
import { Button } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { useAuth } from '@/lib/auth';
import {
  ROLE_LABELS, USER_ROLES, type UserRole,
  PERMISSION_MODULES, PERMISSION_ACTIONS,
  type PermissionModule, type PermissionAction,
  type PermissionEntry,
} from '@dermaos/shared';

const MODULE_LABELS: Record<PermissionModule, string> = {
  patients: 'Pacientes',
  appointments: 'Agenda',
  clinical: 'Clínico',
  financial: 'Financeiro',
  supply: 'Suprimentos',
  omni: 'Comunicação',
  analytics: 'Analytics',
  settings: 'Configurações',
};

const ACTION_LABELS: Record<PermissionAction, string> = {
  read: 'Visualizar',
  write: 'Criar/Editar',
  delete: 'Excluir',
  export: 'Exportar',
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_invite_pending?: boolean;
  permissions?: PermissionEntry[];
  last_login_at?: string | null;
  created_at?: string;
}

export function SectionUsuarios() {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'owner' || user?.role === 'admin';

  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<string>('');
  const [roleFilter, setRoleFilter] = React.useState<string>('');

  const usersQuery = trpc.settings.users.list.useQuery(
    {
      page,
      limit: 25,
      ...(statusFilter ? { status: statusFilter as 'active' | 'inactive' | 'locked' } : {}),
      ...(roleFilter ? { role: roleFilter as UserRole } : {}),
    },
    { staleTime: 15_000 },
  );

  const createUser = trpc.settings.users.create.useMutation({
    onSuccess: () => { void usersQuery.refetch(); setShowInvite(false); resetInviteForm(); },
  });
  const setPermissions = trpc.settings.users.setPermissions.useMutation({
    onSuccess: () => { void usersQuery.refetch(); setEditingUser(null); },
  });
  const deactivateUser = trpc.settings.users.deactivate.useMutation({
    onSuccess: () => { void usersQuery.refetch(); setDeactivatingUser(null); },
  });
  const reactivateUser = trpc.settings.users.reactivate.useMutation({
    onSuccess: () => usersQuery.refetch(),
  });
  const resetPassword = trpc.settings.users.initiatePasswordReset.useMutation();

  const [showInvite, setShowInvite] = React.useState(false);
  const [inviteName, setInviteName] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<UserRole>('receptionist');
  const [inviteError, setInviteError] = React.useState('');

  const [editingUser, setEditingUser] = React.useState<UserRow | null>(null);
  const [editPerms, setEditPerms] = React.useState<PermissionEntry[]>([]);

  const [deactivatingUser, setDeactivatingUser] = React.useState<UserRow | null>(null);
  const [deactivateReason, setDeactivateReason] = React.useState('');

  const [resetConfirmUser, setResetConfirmUser] = React.useState<UserRow | null>(null);

  function resetInviteForm() {
    setInviteName(''); setInviteEmail(''); setInviteRole('receptionist'); setInviteError('');
  }

  function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError('Nome e e-mail são obrigatórios.');
      return;
    }
    setInviteError('');
    createUser.mutate({ name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole });
  }

  function openPermissions(u: UserRow) {
    setEditingUser(u);
    const existing = u.permissions ?? [];
    const map: Record<string, boolean> = {};
    for (const p of existing) map[`${p.module}.${p.action}`] = p.granted;

    const perms: PermissionEntry[] = [];
    for (const mod of PERMISSION_MODULES) {
      for (const act of PERMISSION_ACTIONS) {
        perms.push({ module: mod, action: act, granted: map[`${mod}.${act}`] ?? false });
      }
    }
    setEditPerms(perms);
  }

  function togglePerm(mod: PermissionModule, act: PermissionAction) {
    setEditPerms((prev) => prev.map((p) =>
      p.module === mod && p.action === act ? { ...p, granted: !p.granted } : p,
    ));
  }

  function handleSavePerms() {
    if (!editingUser) return;
    setPermissions.mutate({ userId: editingUser.id, permissions: editPerms });
  }

  const columns: DataTableColumn<UserRow>[] = [
    {
      header: 'Usuário',
      cell: (row) => (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{row.name}</p>
          <Mono size={11}>{row.email}</Mono>
        </div>
      ),
    },
    {
      header: 'Perfil',
      cell: (row) => (
        <MetalTag>{ROLE_LABELS[row.role as UserRole] ?? row.role}</MetalTag>
      ),
      width: 140,
    },
    {
      header: 'Status',
      cell: (row) => {
        if (row.is_invite_pending) return <Badge variant="warning">Convite pendente</Badge>;
        return row.is_active
          ? <Badge variant="success">Ativo</Badge>
          : <Badge variant="danger">Inativo</Badge>;
      },
      width: 140,
    },
    {
      header: 'Último acesso',
      cell: (row) => (
        <Mono size={11}>
          {row.last_login_at
            ? new Date(row.last_login_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
            : '—'}
        </Mono>
      ),
      width: 150,
    },
    ...(isPrivileged ? [{
      header: 'Ações',
      width: 200,
      cell: (row: UserRow) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Btn small variant="ghost" icon="settings" iconOnly onClick={() => openPermissions(row)} />
          {row.is_active && row.id !== user?.id && (
            <>
              <Btn small variant="ghost" icon="lock" iconOnly onClick={() => setResetConfirmUser(row)} />
              <Btn small variant="ghost" icon="x" iconOnly onClick={() => { setDeactivatingUser(row); setDeactivateReason(''); }} />
            </>
          )}
          {!row.is_active && (
            <Btn small variant="glass" icon="plus" iconOnly loading={reactivateUser.isPending} onClick={() => reactivateUser.mutate({ userId: row.id })} />
          )}
        </div>
      ),
    } as DataTableColumn<UserRow>] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filters & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            style={{ width: 180 }}
          >
            <option value="">Todos os perfis</option>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ width: 160 }}
          >
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="locked">Bloqueados</option>
          </Select>
        </div>
        {isPrivileged && (
          <Btn small icon="plus" onClick={() => setShowInvite(true)}>
            Convidar usuário
          </Btn>
        )}
      </div>

      {/* Table */}
      <Glass style={{ padding: 0, overflow: 'hidden' }}>
        {usersQuery.isLoading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={52} delay={i * 80} />)}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={(usersQuery.data?.users as UserRow[]) ?? []}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                icon="users"
                title="Nenhum usuário encontrado"
                description="Convide membros da equipe para começar."
                action={isPrivileged ? <Btn small icon="plus" onClick={() => setShowInvite(true)}>Convidar</Btn> : undefined}
              />
            }
          />
        )}
      </Glass>

      {/* Pagination */}
      {usersQuery.data && usersQuery.data.total > 25 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <Btn small variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Btn>
          <Mono size={12} style={{ padding: '8px 12px' }}>
            Página {page} de {Math.ceil(usersQuery.data.total / 25)}
          </Mono>
          <Btn small variant="ghost" disabled={page * 25 >= usersQuery.data.total} onClick={() => setPage((p) => p + 1)}>Próxima</Btn>
        </div>
      )}

      {/* Invite Dialog */}
      <DialogRoot open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent a11yTitle="Convidar usuário">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
            <DialogDescription>Envie um convite por e-mail para um novo membro da equipe.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {inviteError && (
              <div style={{ padding: '8px 12px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, fontSize: 13, color: T.danger }}>
                {inviteError}
              </div>
            )}
            {createUser.error && (
              <div style={{ padding: '8px 12px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, fontSize: 13, color: T.danger }}>
                {createUser.error.message}
              </div>
            )}
            <Field label="Nome completo" required>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Dr. João Silva" />
            </Field>
            <Field label="E-mail" required>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="joao@clinica.com" type="email" />
            </Field>
            <Field label="Perfil">
              <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)}>
                {USER_ROLES.filter((r) => r !== 'owner').map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleInvite} isLoading={createUser.isPending}>Enviar convite</Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* Permissions Dialog (RBAC Matrix) */}
      <DialogRoot open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent a11yTitle="Permissões" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Permissões — {editingUser?.name}</DialogTitle>
            <DialogDescription>
              Perfil base: {ROLE_LABELS[(editingUser?.role ?? 'readonly') as UserRole]}.
              Ajuste permissões granulares abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {setPermissions.error && (
              <div style={{ padding: '8px 12px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, fontSize: 13, color: T.danger, marginBottom: 12 }}>
                {setPermissions.error.message}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: `1px solid ${T.divider}` }}>
                    Módulo
                  </th>
                  {PERMISSION_ACTIONS.map((a) => (
                    <th key={a} style={{ textAlign: 'center', padding: '6px 8px', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: `1px solid ${T.divider}` }}>
                      {ACTION_LABELS[a]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MODULES.map((mod) => (
                  <tr key={mod}>
                    <td style={{ padding: '10px 8px', fontSize: 14, fontWeight: 500, color: T.textPrimary, borderBottom: `1px solid ${T.divider}` }}>
                      {MODULE_LABELS[mod]}
                    </td>
                    {PERMISSION_ACTIONS.map((act) => {
                      const perm = editPerms.find((p) => p.module === mod && p.action === act);
                      const isGranted = perm?.granted ?? false;
                      const isSelf = editingUser?.id === user?.id;
                      return (
                        <td key={act} style={{ textAlign: 'center', padding: '10px 8px', borderBottom: `1px solid ${T.divider}` }}>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => togglePerm(mod, act)}
                            aria-label={`${MODULE_LABELS[mod]} — ${ACTION_LABELS[act]}: ${isGranted ? 'concedida' : 'negada'}`}
                            style={{
                              width: 28, height: 28, borderRadius: T.r.sm,
                              border: `1px solid ${isGranted ? T.primaryBorder : T.divider}`,
                              background: isGranted ? T.primaryBg : 'transparent',
                              cursor: isSelf ? 'not-allowed' : 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              opacity: isSelf ? 0.4 : 1,
                              transition: 'all 0.15s',
                            }}
                          >
                            {isGranted && <Ico name="check" size={14} color={T.primary} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSavePerms} isLoading={setPermissions.isPending}>
              Salvar permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* Deactivate Dialog */}
      <DialogRoot open={!!deactivatingUser} onOpenChange={(open) => !open && setDeactivatingUser(null)}>
        <DialogContent a11yTitle="Desativar usuário">
          <DialogHeader>
            <DialogTitle className="text-danger-500">Desativar {deactivatingUser?.name}?</DialogTitle>
            <DialogDescription>
              O usuário será bloqueado por 30 dias. Convites e sessões serão invalidados.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4">
            {deactivateUser.error && (
              <div style={{ padding: '8px 12px', borderRadius: T.r.md, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, fontSize: 13, color: T.danger, marginBottom: 12 }}>
                {deactivateUser.error.message}
              </div>
            )}
            <Field label="Motivo da desativação" required>
              <Input
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Ex: Desligamento, férias prolongadas..."
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deactivateReason.length < 5}
              isLoading={deactivateUser.isPending}
              onClick={() => deactivatingUser && deactivateUser.mutate({ userId: deactivatingUser.id, reason: deactivateReason })}
            >
              Desativar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* Password Reset Confirm */}
      <ConfirmDialog
        open={!!resetConfirmUser}
        onOpenChange={(open) => !open && setResetConfirmUser(null)}
        title={`Redefinir senha de ${resetConfirmUser?.name ?? ''}?`}
        description="Um e-mail com link de redefinição será enviado. O link expira em 1 hora."
        confirmLabel="Enviar link"
        onConfirm={() => {
          if (resetConfirmUser) {
            resetPassword.mutate({ userId: resetConfirmUser.id });
            setResetConfirmUser(null);
          }
        }}
        isLoading={resetPassword.isPending}
      />
    </div>
  );
}

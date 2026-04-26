'use client';

import * as React from 'react';
import { Plus, RefreshCw, PowerOff, Power, Key, ChevronDown } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { PageHeader } from '@dermaos/ui';
import { ROLE_LABELS } from '@dermaos/shared';
import type { PermissionEntry, PermissionModule, PermissionAction } from '@dermaos/shared';
import { PERMISSION_MODULES, PERMISSION_ACTIONS } from '@dermaos/shared';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: 'Ativo',    color: 'text-green-600 bg-green-50' },
  inactive: { label: 'Inativo',  color: 'text-gray-500 bg-gray-50' },
  locked:   { label: 'Bloqueado', color: 'text-yellow-600 bg-yellow-50' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS['inactive'];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return 'Nunca';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function PermissionsModal({
  userId,
  userName,
  currentPerms,
  onClose,
}: {
  userId: string;
  userName: string;
  currentPerms: PermissionEntry[];
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [perms, setPerms] = React.useState<PermissionEntry[]>(currentPerms);
  const setPermsMut = trpc.settings.users.setPermissions.useMutation({
    onSuccess: () => { utils.settings.users.list.invalidate(); onClose(); },
  });

  function toggle(module: PermissionModule, action: PermissionAction) {
    setPerms((prev) => {
      const existing = prev.find((p) => p.module === module && p.action === action);
      if (existing) {
        return prev.map((p) =>
          p.module === module && p.action === action ? { ...p, granted: !p.granted } : p,
        );
      }
      return [...prev, { module, action, granted: true }];
    });
  }

  function isGranted(module: PermissionModule, action: PermissionAction) {
    return perms.find((p) => p.module === module && p.action === action)?.granted ?? false;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-xl border bg-background p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Permissões — {userName}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-2 text-left font-medium text-muted-foreground">Módulo</th>
                {PERMISSION_ACTIONS.map((a) => (
                  <th key={a} className="px-3 py-2 text-center font-medium text-muted-foreground capitalize">
                    {a === 'read' ? 'Ler' : a === 'write' ? 'Criar/Editar' : a === 'delete' ? 'Excluir' : 'Exportar'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MODULES.map((mod) => (
                <tr key={mod} className="border-t">
                  <td className="py-2 capitalize">{mod}</td>
                  {PERMISSION_ACTIONS.map((action) => (
                    <td key={action} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isGranted(mod, action)}
                        onChange={() => toggle(mod, action)}
                        className="h-4 w-4 rounded border"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={() => setPermsMut.mutate({ userId, permissions: perms })}
            disabled={setPermsMut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {setPermsMut.isPending ? 'Salvando...' : 'Salvar Permissões'}
          </button>
        </div>
        {setPermsMut.isError && (
          <p className="mt-2 text-sm text-destructive">{setPermsMut.error.message}</p>
        )}
      </div>
    </div>
  );
}

function DeactivateModal({
  userId,
  userName,
  onClose,
}: { userId: string; userName: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [reason, setReason] = React.useState('');
  const deactivateMut = trpc.settings.users.deactivate.useMutation({
    onSuccess: () => { utils.settings.users.list.invalidate(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold">Desativar usuário</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Desativar <strong>{userName}</strong> encerrará todas as sessões ativas imediatamente.
        </p>
        <label className="block text-sm font-medium mb-1">
          Motivo <span className="text-destructive">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Mínimo 5 caracteres..."
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={() => deactivateMut.mutate({ userId, reason })}
            disabled={deactivateMut.isPending || reason.length < 5}
            className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-50"
          >
            {deactivateMut.isPending ? 'Desativando...' : 'Desativar'}
          </button>
        </div>
        {deactivateMut.isError && (
          <p className="mt-2 text-sm text-destructive">{deactivateMut.error.message}</p>
        )}
      </div>
    </div>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = React.useState({ name: '', email: '', role: 'readonly' as const });
  const createMut = trpc.settings.users.create.useMutation({
    onSuccess: () => { utils.settings.users.list.invalidate(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Convidar Usuário</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome completo *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">E-mail *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Perfil *</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as typeof form.role }))}
              className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Um link de convite será enviado por e-mail. Válido por 72 horas.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={() => createMut.mutate(form)}
            disabled={createMut.isPending || !form.name || !form.email}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {createMut.isPending ? 'Enviando convite...' : 'Enviar convite'}
          </button>
        </div>
        {createMut.isError && (
          <p className="mt-2 text-sm text-destructive">{createMut.error.message}</p>
        )}
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const utils = trpc.useUtils();
  const [page, setPage] = React.useState(1);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [permsUser, setPermsUser] = React.useState<{ id: string; name: string; permissions: PermissionEntry[] } | null>(null);
  const [deactivateUser, setDeactivateUser] = React.useState<{ id: string; name: string } | null>(null);

  const usersQuery = trpc.settings.users.list.useQuery({ page, limit: 20 });
  const reactivateMut = trpc.settings.users.reactivate.useMutation({
    onSuccess: () => utils.settings.users.list.invalidate(),
  });
  const resetMut = trpc.settings.users.initiatePasswordReset.useMutation();

  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Usuários & Permissões"
        description="Gerencie o acesso da equipe à plataforma"
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Convidar usuário
          </button>
        }
      />

      <div className="p-6">
        {usersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Nome</th>
                  <th className="px-4 py-3 text-left font-medium">Perfil</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Último acesso</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: {
                  id: string; name: string; email: string; role: string; status: string;
                  last_login_at: string | null; permissions: PermissionEntry[];
                }) => (
                  <tr key={u.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(u.last_login_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setPermsUser({ id: u.id, name: u.name, permissions: u.permissions ?? [] })}
                          className="rounded-md p-1.5 hover:bg-accent"
                          title="Editar permissões"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm('Enviar link de reset de senha?')) resetMut.mutate({ userId: u.id }); }}
                          className="rounded-md p-1.5 hover:bg-accent"
                          title="Reset de senha"
                        >
                          <Key className="h-4 w-4" />
                        </button>
                        {u.status === 'active' ? (
                          <button
                            onClick={() => setDeactivateUser({ id: u.id, name: u.name })}
                            className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                            title="Desativar"
                          >
                            <PowerOff className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivateMut.mutate({ userId: u.id })}
                            disabled={reactivateMut.isPending}
                            className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                            title="Reativar"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {total > 20 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="text-sm text-muted-foreground">{total} usuários</span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={page * 20 >= total}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} />}
      {permsUser && (
        <PermissionsModal
          userId={permsUser.id}
          userName={permsUser.name}
          currentPerms={permsUser.permissions}
          onClose={() => setPermsUser(null)}
        />
      )}
      {deactivateUser && (
        <DeactivateModal
          userId={deactivateUser.id}
          userName={deactivateUser.name}
          onClose={() => setDeactivateUser(null)}
        />
      )}
    </div>
  );
}

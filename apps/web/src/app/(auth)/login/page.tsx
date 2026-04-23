'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { loginSchema } from '@dermaos/shared';
import type { z } from 'zod';
import { trpc } from '@/lib/trpc-provider';
import { useAuthStore } from '@/stores/auth-store';
import { getPermissionsForRole } from '@dermaos/shared';
import type { UserRole } from '@dermaos/shared';

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setSession(
        {
          id: data.user.id,
          clinicId: data.user.clinicId,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          avatarUrl: null,
          crm: null,
          specialty: null,
        },
        {
          id: data.user.clinicId,
          name: data.user.clinicName,
          slug: data.user.clinicSlug,
          logoUrl: null,
        },
        getPermissionsForRole(data.user.role as UserRole),
      );
      router.push('/');
      router.refresh();
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const isLocked = loginMutation.error?.data?.code === 'TOO_MANY_REQUESTS';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4"
            aria-hidden="true"
          >
            <span className="text-primary-foreground font-bold text-xl">D</span>
          </div>
          <h1 className="text-2xl font-semibold">DermaOS</h1>
          <p className="text-muted-foreground text-sm mt-1">Faça login na sua clínica</p>
        </div>

        {/* Formulário */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            aria-label="Formulário de login"
          >
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  aria-required="true"
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  aria-invalid={!!errors.email}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
                             disabled:opacity-50"
                  disabled={isLocked || loginMutation.isPending}
                  {...register('email')}
                />
                {errors.email && (
                  <p id="email-error" className="mt-1 text-xs text-destructive" role="alert" aria-live="polite">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-required="true"
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  aria-invalid={!!errors.password}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
                             disabled:opacity-50"
                  disabled={isLocked || loginMutation.isPending}
                  {...register('password')}
                />
                {errors.password && (
                  <p id="password-error" className="mt-1 text-xs text-destructive" role="alert" aria-live="polite">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Erro de autenticação */}
              {loginMutation.error && (
                <div
                  className={`rounded-md border px-3 py-2.5 ${
                    isLocked
                      ? 'bg-warning/10 border-warning/20'
                      : 'bg-destructive/10 border-destructive/20'
                  }`}
                  role="alert"
                  aria-live="assertive"
                >
                  <p className={`text-sm ${isLocked ? 'text-warning' : 'text-destructive'}`}>
                    {loginMutation.error.message}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || loginMutation.isPending || isLocked}
                aria-busy={isSubmitting || loginMutation.isPending}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium
                           hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loginMutation.isPending ? 'Entrando...' : isLocked ? 'Conta bloqueada' : 'Entrar'}
              </button>
            </div>
          </form>

          <div className="mt-4 text-center">
            <a
              href="/esqueci-senha"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Esqueceu a senha?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

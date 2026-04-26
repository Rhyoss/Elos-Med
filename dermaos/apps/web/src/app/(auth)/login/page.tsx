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
import { ShieldCheck, Sparkles, Stethoscope, Lock, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

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
          clinicSlug: data.user.clinicSlug,
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
  const [showPassword, setShowPassword] = useState(false);
  const isPending = isSubmitting || loginMutation.isPending;

  return (
    <div className="min-h-screen lg:flex bg-background">
      {/* ── Brand storytelling (esquerda) ────────────────────────────────── */}
      <aside
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 text-white lg:w-[52%] xl:w-[55%]"
        style={{ background: 'var(--gradient-brand)' }}
        aria-hidden="true"
      >
        <div
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'hsl(var(--gold-500))' }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: 'hsl(var(--primary-300))' }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-white/30 backdrop-blur-sm"
              style={{ background: 'hsl(0 0% 100% / 0.18)' }}
            >
              <span className="font-semibold text-xl tracking-tight">D</span>
            </div>
            <div className="leading-tight">
              <p className="text-lg font-semibold tracking-tight">DermaOS</p>
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">Clinical OS</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="text-3xl xl:text-4xl font-semibold leading-tight tracking-tight">
            A plataforma que dermatologistas confiam para gerenciar a clínica inteira.
          </h2>
          <p className="mt-4 text-white/85 leading-relaxed">
            Prontuário, agenda, prescrições, suprimentos, financeiro e analytics —
            tudo conectado, com IA que entende o contexto clínico e protege os
            dados dos pacientes.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Stethoscope className="h-5 w-5 shrink-0 text-white/95" aria-hidden="true" />
              <span className="text-white/90">
                Atendimento, prontuário e prescrições em um só lugar.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-white/95" aria-hidden="true" />
              <span className="text-white/90">
                IA clínica para resumos, automações e insights operacionais.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-white/95" aria-hidden="true" />
              <span className="text-white/90">
                LGPD, CFM e ANVISA por padrão — auditoria imutável e RLS multi-tenant.
              </span>
            </li>
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-white/70">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Conexão segura • Criptografia AES-256 • Sessão com tempo limite</span>
        </div>
      </aside>

      {/* ── Form (direita) ──────────────────────────────────────────────── */}
      <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:py-12">
        <div className="w-full max-w-sm">
          {/* Brand mobile */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div
              className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground shadow-md"
              style={{ background: 'var(--gradient-brand)' }}
              aria-hidden="true"
            >
              <span className="font-bold text-xl">D</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">DermaOS</h1>
            <p className="mt-1 text-sm uppercase tracking-[0.18em] text-muted-foreground">
              Clinical OS
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo(a) de volta</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Faça login para acessar o painel da sua clínica.
            </p>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            aria-label="Formulário de login"
            className="space-y-5"
          >
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                Email profissional
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="seu.nome@suaclinica.com.br"
                aria-required="true"
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={!!errors.email}
                className="w-full h-11 rounded-lg border border-input bg-background px-3.5 text-sm
                           transition-colors placeholder:text-muted-foreground/60
                           hover:border-input/80
                           focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30
                           disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLocked || isPending}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-xs text-destructive" role="alert" aria-live="polite">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Senha */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium">
                  Senha
                </label>
                <a
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Esqueceu?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-required="true"
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  aria-invalid={!!errors.password}
                  className="w-full h-11 rounded-lg border border-input bg-background px-3.5 pr-11 text-sm
                             transition-colors placeholder:text-muted-foreground/60
                             hover:border-input/80
                             focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLocked || isPending}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-xs text-destructive" role="alert" aria-live="polite">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Erro de autenticação */}
            {loginMutation.error && (
              <div
                className={`rounded-lg border px-3.5 py-2.5 ${
                  isLocked
                    ? 'border-warning/30 bg-warning-100 text-warning-700'
                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}
                role="alert"
                aria-live="assertive"
              >
                <p className="text-sm">{loginMutation.error.message}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending || isLocked}
              aria-busy={isPending}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium
                         shadow-sm transition-all
                         hover:bg-primary/90 hover:shadow-md
                         active:translate-y-px
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? 'Entrando...' : isLocked ? 'Conta temporariamente bloqueada' : 'Entrar na clínica'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} DermaOS · Plataforma para clínicas dermatológicas
          </p>
        </div>
      </main>
    </div>
  );
}

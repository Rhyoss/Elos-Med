'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { loginSchema } from '@dermaos/shared';
import type { z } from 'zod';
import { Btn, Input, Field, Mono, T } from '@dermaos/ui/ds';
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
          clinicSlug: data.user.clinicSlug,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          avatarUrl: null,
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
  const isPending = isSubmitting || loginMutation.isPending;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <Mono size={9} spacing="1.3px" color={T.primary}>FAÇA LOGIN NA SUA CLÍNICA</Mono>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: T.textPrimary,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            marginTop: 4,
          }}
        >
          Bem-vindo de volta
        </h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-label="Formulário de login"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field
            label="Email"
            icon="mail"
            error={errors.email?.message}
          >
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="seu@clinica.com.br"
              aria-required
              error={!!errors.email}
              disabled={isLocked || isPending}
              {...register('email')}
            />
          </Field>

          <Field
            label="Senha"
            icon="lock"
            error={errors.password?.message}
          >
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-required
              error={!!errors.password}
              disabled={isLocked || isPending}
              {...register('password')}
            />
          </Field>

          {/* Erro de autenticação */}
          {loginMutation.error && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                padding: '10px 12px',
                borderRadius: T.r.md,
                background: isLocked ? T.warningBg : T.dangerBg,
                border: `1px solid ${isLocked ? T.warningBorder : T.dangerBorder}`,
                color: isLocked ? T.warning : T.danger,
                fontSize: 12,
                lineHeight: 1.5,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              {loginMutation.error.message}
            </div>
          )}

          <Btn
            type="submit"
            disabled={isLocked}
            loading={isPending}
            style={{ width: '100%', marginTop: 4 }}
          >
            {isLocked ? 'Conta bloqueada' : 'Entrar'}
          </Btn>
        </div>
      </form>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <a
          href="/forgot-password"
          style={{
            fontSize: 12,
            color: T.textMuted,
            textDecoration: 'none',
            fontFamily: "'IBM Plex Sans', sans-serif",
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = T.primary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = T.textMuted; }}
        >
          Esqueceu a senha?
        </a>
      </div>
    </>
  );
}

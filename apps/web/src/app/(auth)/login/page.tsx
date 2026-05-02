'use client';

import { useEffect, useRef, useState } from 'react';
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
  const emailRef = useRef<HTMLInputElement | null>(null);
  const [rememberChecked, setRememberChecked] = useState(false);

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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const { ref: rhfEmailRef, ...emailRest } = register('email');

  // Restore saved email and remember state on mount
  useEffect(() => {
    const saved = localStorage.getItem('elosmed_saved_email');
    if (saved) {
      setValue('email', saved);
      setRememberChecked(true);
    }
  }, [setValue]);

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const handleRememberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRememberChecked(e.target.checked);
    if (!e.target.checked) {
      localStorage.removeItem('elosmed_saved_email');
    } else if (emailRef.current?.value) {
      localStorage.setItem('elosmed_saved_email', emailRef.current.value);
    }
  };

  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const remember = document.getElementById('remember') as HTMLInputElement | null;
    if (remember?.checked && e.target.value) {
      localStorage.setItem('elosmed_saved_email', e.target.value);
    }
  };

  const isLocked = loginMutation.error?.data?.code === 'TOO_MANY_REQUESTS';
  const isPending = isSubmitting || loginMutation.isPending;

  return (
    <div
      style={{
        background: 'rgba(250,249,247,0.78)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '0.5px solid rgba(255,255,255,0.6)',
        borderRadius: 24,
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.5) inset, 0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(23,77,56,0.04)',
        padding: '48px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top highlight line */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            color: T.primary,
            letterSpacing: '-0.02em',
            marginBottom: 6,
            lineHeight: 1,
          }}
        >
          ElosMed
        </h1>
        <Mono size={9} spacing="1.2px" color={T.textMuted}>
          PLATAFORMA MÉDICA INTEGRADA
        </Mono>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Formulário de login">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Field label="E-mail" icon="mail" error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="seu@email.com.br"
              aria-required
              error={!!errors.email}
              disabled={isLocked || isPending}
              {...emailRest}
              ref={(el) => {
                rhfEmailRef(el);
                emailRef.current = el;
              }}
              onBlur={handleEmailBlur}
            />
          </Field>

          <Field label="Senha" icon="lock" error={errors.password?.message}>
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

          {/* Options row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              marginTop: -4,
            }}
          >
            <label
              htmlFor="remember"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                userSelect: 'none',
                color: T.textSecondary,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <input
                type="checkbox"
                id="remember"
                onChange={handleRememberChange}
                checked={rememberChecked}
                style={{
                  width: 16,
                  height: 16,
                  cursor: 'pointer',
                  accentColor: T.primary,
                }}
              />
              Lembrar de mim
            </label>
            <a
              href="/forgot-password"
              style={{
                color: T.primary,
                textDecoration: 'none',
                fontWeight: 500,
                fontFamily: "'IBM Plex Sans', sans-serif",
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = T.primaryLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = T.primary; }}
            >
              Esqueci a senha
            </a>
          </div>

          {/* Auth error */}
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

      {/* Divider */}
      <div
        style={{
          margin: '28px 0',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 1,
            background: 'rgba(203,203,203,0.4)',
          }}
        />
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            padding: '0 16px',
            background: 'rgba(250,249,247,0.78)',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: '0.8px',
            color: T.textMuted,
          }}
        >
          OU
        </span>
      </div>

      {/* Google SSO */}
      <button
        type="button"
        style={{
          width: '100%',
          padding: '14px',
          background: 'rgba(23,77,56,0.06)',
          color: T.primary,
          border: '1px solid rgba(23,77,56,0.18)',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "'IBM Plex Sans', sans-serif",
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(23,77,56,0.10)';
          e.currentTarget.style.borderColor = 'rgba(23,77,56,0.28)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(23,77,56,0.06)';
          e.currentTarget.style.borderColor = 'rgba(23,77,56,0.18)';
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
          <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332A8.997 8.997 0 009.003 18z" fill="#34A853" />
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
          <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0A8.997 8.997 0 00.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335" />
        </svg>
        Continuar com Google
      </button>

      {/* Metal separator */}
      <div
        aria-hidden
        style={{
          height: 1,
          margin: '32px 0 24px',
          background:
            'repeating-linear-gradient(90deg, transparent 0px, rgba(0,0,0,0.04) 1px, transparent 2px, transparent 8px)',
        }}
      />

      {/* Footer */}
      <p
        style={{
          textAlign: 'center',
          fontSize: 12,
          color: T.textMuted,
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        Não tem uma conta?{' '}
        <a
          href="#"
          style={{
            color: T.primary,
            textDecoration: 'none',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
        >
          Criar conta
        </a>
      </p>
    </div>
  );
}

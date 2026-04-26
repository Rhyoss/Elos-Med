'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Btn, Input, Field, Mono, Ico, T } from '@dermaos/ui/ds';

const schema = z.object({
  password: z.string().min(8, 'Mínimo de 8 caracteres'),
  confirm:  z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'As senhas não coincidem',
  path:    ['confirm'],
});
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = React.use(params);
  const router    = useRouter();
  const [done, setDone] = React.useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(_data: FormData) {
    /* TODO Phase 5b: trpc.auth.resetPassword.mutate({ token, password }) */
    await new Promise((r) => setTimeout(r, 800));
    setDone(true);
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: T.r.lg,
            background: T.successBg,
            border: `1px solid ${T.successBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <Ico name="check" size={28} color={T.success} sw={2.4} />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, lineHeight: 1.2 }}>
            Senha redefinida!
          </h1>
          <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 6, lineHeight: 1.55 }}>
            Sua senha foi alterada com sucesso. Faça login com a nova senha.
          </p>
        </div>
        <Btn icon="arrowRight" onClick={() => router.push('/login')} style={{ width: '100%' }}>
          Ir para o Login
        </Btn>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <Mono size={9} spacing="1.3px" color={T.primary}>NOVA SENHA</Mono>
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
          Defina sua nova senha
        </h1>
        <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 6, lineHeight: 1.55 }}>
          Escolha uma senha segura para sua conta.
        </p>
        <Mono size={8} color={T.textMuted}>
          TOKEN: {token.slice(0, 16)}…
        </Mono>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Nova senha" icon="lock" error={errors.password?.message}>
            <Input
              type="password"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              autoFocus
              error={!!errors.password}
              {...register('password')}
            />
          </Field>

          <Field label="Confirmar senha" icon="lock" error={errors.confirm?.message}>
            <Input
              type="password"
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              error={!!errors.confirm}
              {...register('confirm')}
            />
          </Field>

          <Btn type="submit" loading={isSubmitting} style={{ width: '100%' }}>
            Redefinir senha
          </Btn>
        </div>
      </form>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Link
          href="/login"
          style={{
            fontSize: 12,
            color: T.textMuted,
            textDecoration: 'none',
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          ← Voltar ao Login
        </Link>
      </div>
    </>
  );
}

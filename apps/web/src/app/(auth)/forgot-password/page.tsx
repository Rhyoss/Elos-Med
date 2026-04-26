'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Btn, Input, Field, Mono, Ico, T } from '@dermaos/ui/ds';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(_data: FormData) {
    /* TODO Phase 5b: trpc.auth.forgotPassword.mutate(data) */
    await new Promise((r) => setTimeout(r, 800));
    setSent(true);
  }

  if (sent) {
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
          <Ico name="mail" size={28} color={T.success} />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, lineHeight: 1.2 }}>
            E-mail enviado!
          </h1>
          <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 6, lineHeight: 1.55 }}>
            Se existir uma conta com esse e-mail, você receberá as instruções para redefinir sua senha.
          </p>
        </div>
        <Link href="/login" style={{ textDecoration: 'none' }}>
          <Btn variant="glass" icon="arrowLeft" style={{ width: '100%' }}>Voltar ao Login</Btn>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <Mono size={9} spacing="1.3px" color={T.primary}>RECUPERAÇÃO DE ACESSO</Mono>
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
          Esqueceu a senha?
        </h1>
        <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 6, lineHeight: 1.55 }}>
          Digite seu e-mail e enviaremos um link para redefinir.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="E-mail" icon="mail" error={errors.email?.message}>
            <Input
              type="email"
              placeholder="voce@clinica.com"
              autoComplete="email"
              autoFocus
              error={!!errors.email}
              {...register('email')}
            />
          </Field>

          <Btn type="submit" loading={isSubmitting} style={{ width: '100%' }}>
            Enviar link de redefinição
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

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@dermaos/ui';

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
    /* TODO: chamar trpc.auth.forgotPassword.mutate(data) */
    await new Promise((r) => setTimeout(r, 800));
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="text-4xl">📧</div>
        <h1 className="text-lg font-semibold text-foreground">E-mail enviado!</h1>
        <p className="text-sm text-muted-foreground">
          Se existir uma conta com esse e-mail, você receberá as instruções para redefinir sua senha.
        </p>
        <Link href="/login">
          <Button variant="outline" className="w-full mt-2">Voltar ao Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-semibold text-foreground">Esqueceu a senha?</h1>
        <p className="text-sm text-muted-foreground">
          Digite seu e-mail e enviaremos um link para redefinir sua senha.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            placeholder="voce@clinica.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-danger-500" role="alert">{errors.email.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Enviar link de redefinição
        </Button>
      </form>

      <Link
        href="/login"
        className="text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Voltar ao Login
      </Link>
    </div>
  );
}

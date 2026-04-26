'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@dermaos/ui';

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
  const [error, setError] = React.useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(_data: FormData) {
    /* TODO: chamar trpc.auth.resetPassword.mutate({ token, password: data.password }) */
    await new Promise((r) => setTimeout(r, 800));
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="text-lg font-semibold text-foreground">Senha redefinida!</h1>
        <p className="text-sm text-muted-foreground">
          Sua senha foi alterada com sucesso. Faça login com a nova senha.
        </p>
        <Button className="w-full mt-2" onClick={() => router.push('/login')}>
          Ir para o Login
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-semibold text-foreground">Nova senha</h1>
        <p className="text-sm text-muted-foreground">
          Escolha uma senha segura para sua conta.
        </p>
        <p className="text-xs text-muted-foreground font-mono truncate" aria-label="Token de redefinição">
          Token: {token.slice(0, 16)}…
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Nova senha
          </label>
          <Input
            id="password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-danger-500" role="alert">{errors.password.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-sm font-medium text-foreground">
            Confirmar senha
          </label>
          <Input
            id="confirm"
            type="password"
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
            {...register('confirm')}
          />
          {errors.confirm && (
            <p className="text-xs text-danger-500" role="alert">{errors.confirm.message}</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-danger-500 text-center" role="alert">{error}</p>
        )}

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Redefinir senha
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

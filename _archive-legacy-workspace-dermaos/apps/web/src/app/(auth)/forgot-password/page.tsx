'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, MailCheck } from 'lucide-react';

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

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm">
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao login
        </Link>

        {/* Brand mark */}
        <div className="mb-6 flex items-center gap-2.5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-sm"
            style={{ background: 'var(--gradient-brand)' }}
            aria-hidden="true"
          >
            <span className="font-bold">D</span>
          </div>
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight">DermaOS</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Clinical OS</p>
          </div>
        </div>

        {sent ? (
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'hsl(var(--success-100))', color: 'hsl(var(--success-700))' }}
              aria-hidden="true"
            >
              <MailCheck className="h-6 w-6" />
            </div>
            <h1 className="text-center text-lg font-semibold tracking-tight">
              Verifique seu e-mail
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Se existir uma conta com esse e-mail, enviamos as instruções para
              redefinir sua senha. O link expira em 30 minutos.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-background text-sm font-medium transition-colors hover:bg-muted"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">Esqueceu a senha?</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sem problemas. Digite seu e-mail e enviamos um link de redefinição.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="seu.nome@suaclinica.com.br"
                  autoComplete="email"
                  autoFocus
                  aria-invalid={!!errors.email}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm transition-colors
                             placeholder:text-muted-foreground/60
                             hover:border-input/80
                             focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30
                             disabled:opacity-50"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-destructive" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-all
                           hover:bg-primary/90 hover:shadow-md
                           active:translate-y-px
                           disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar link de redefinição'}
              </button>
            </form>
          </>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} DermaOS · Plataforma para clínicas dermatológicas
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { portalAuth } from '@/lib/api-client';

type Status = 'loading' | 'success' | 'error';

export default function DesbloquearPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const params = useParams<{ token: string }>();

  useEffect(() => {
    const token = params.token;
    if (!token) {
      setStatus('error');
      setMessage('Link inválido.');
      return;
    }

    portalAuth
      .unlockAccount(token)
      .then(() => {
        setStatus('success');
        setTimeout(() => router.replace('/login'), 3000);
      })
      .catch((err: { message?: string }) => {
        setStatus('error');
        setMessage(err.message ?? 'Link expirado ou já utilizado.');
      });
  }, [params.token, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {status === 'loading' && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gold-500 border-t-transparent" />
            <p className="text-sm text-neutral-600">Desbloqueando sua conta…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-7 w-7 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mb-2 text-lg font-semibold text-neutral-900">Conta desbloqueada</h1>
            <p className="text-sm text-neutral-500">
              Sua conta foi desbloqueada com sucesso. Redirecionando para o login…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-7 w-7 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-lg font-semibold text-neutral-900">Link inválido</h1>
            <p className="mb-6 text-sm text-neutral-500">{message}</p>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="w-full rounded-xl bg-gold-500 px-4 py-3 text-sm font-medium text-white active:opacity-80"
            >
              Ir para o login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

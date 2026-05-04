'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import { dermaosTransformer } from '@dermaos/shared';
import type { AppRouter } from '@dermaos/api/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: (failureCount, error) => {
          // Não retenta erros de autorização
          if (
            typeof error === 'object' &&
            error !== null &&
            'data' in error &&
            typeof (error as { data?: { code?: string } }).data?.code === 'string' &&
            ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'].includes(
              (error as { data: { code: string } }).data.code,
            )
          ) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: sempre cria novo QueryClient
    return makeQueryClient();
  }
  // Browser: reutiliza para não perder dados entre renders
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

const API_URL = (process.env['NEXT_PUBLIC_API_URL'] ?? '') + '/api/trpc';

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClientInstance] = useState(() =>
    trpc.createClient({
      links: [
        // Non-streaming batch link — Fastify precisa terminar a procedure
        // antes de commitar headers (Set-Cookie da auth.login depende disso).
        httpBatchLink({
          url: API_URL,
          transformer: dermaosTransformer,
          headers: () => ({ 'x-trpc-source': 'react' }),
          fetch: (url, options) =>
            fetch(url, { ...options, credentials: 'include' }),
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClientInstance} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

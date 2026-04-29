import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@dermaos/api/trpc/router';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''; // Browser: URL relativa
  if (process.env['NEXT_PUBLIC_API_URL']) return process.env['NEXT_PUBLIC_API_URL'];
  // SSR: dentro do Docker usa hostname `api`, local usa `localhost:3001`
  if (process.env['DOCKER'] === '1' || process.env['HOSTNAME']?.startsWith('dermaos-')) {
    return 'http://api:3001';
  }
  return 'http://localhost:3001';
};

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    // Non-streaming batch link — Fastify precisa terminar a procedure
    // antes de commitar headers (Set-Cookie da auth.login depende disso).
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      headers() {
        return {
          'x-trpc-source': 'web-client',
        };
      },
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include', // Envia cookies httpOnly
        });
      },
    }),
  ],
});

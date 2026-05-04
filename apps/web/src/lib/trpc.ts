import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { dermaosTransformer } from '@dermaos/shared';
import type { AppRouter } from '@dermaos/api/trpc/router';

const getBaseUrl = () => {
  // NEXT_PUBLIC_* is inlined at build time; must take precedence over browser check
  if (process.env['NEXT_PUBLIC_API_URL']) return process.env['NEXT_PUBLIC_API_URL'];
  if (typeof window !== 'undefined') return ''; // browser dev fallback (local Docker)
  return 'http://api:3001'; // SSR Docker
};

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    // Non-streaming batch link — Fastify precisa terminar a procedure
    // antes de commitar headers (Set-Cookie da auth.login depende disso).
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: dermaosTransformer,
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

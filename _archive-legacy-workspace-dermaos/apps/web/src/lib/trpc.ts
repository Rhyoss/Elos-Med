import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@dermaos/api/trpc/router';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''; // Browser: URL relativa
  if (process.env['NEXT_PUBLIC_API_URL']) return process.env['NEXT_PUBLIC_API_URL'];
  return 'http://api:3001'; // SSR dentro do Docker
};

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
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

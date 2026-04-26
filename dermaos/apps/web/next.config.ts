import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // App Router é o padrão no Next.js 15
  reactStrictMode: true,

  // Não redirecionar trailing slash — o engine.io do socket.io requer
  // o path canônico com `/` final (ex.: `/api/realtime/`). Sem isto, o Next
  // emite 308 → API responde 404 → conexão real-time nunca completa.
  skipTrailingSlashRedirect: true,

  // Transpila pacotes do monorepo
  transpilePackages: ['@dermaos/shared', '@dermaos/ui'],

  // Otimizações de imagem
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Headers de segurança (complementam o Nginx em prod)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  // Proxy para a API Fastify em dev (em prod o Nginx faz isso).
  // Em Docker, `localhost` aponta para o próprio container, então o destino
  // deve usar o hostname interno do serviço (`api`). Configurável via
  // API_INTERNAL_URL para que o mesmo config funcione em host e container.
  async rewrites() {
    const apiBase = process.env.API_INTERNAL_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/trpc/:path*',
        destination: `${apiBase}/api/trpc/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/api/v1/:path*`,
      },
      // socket.io: o engine.io requer o path canônico com `/` final.
      // O Next path-matcher remove o trailing slash; reescrevemos
      // explicitamente para `/api/realtime/` na origem da API.
      {
        source: '/api/realtime',
        destination: `${apiBase}/api/realtime/`,
      },
      {
        source: '/api/realtime/:path*',
        destination: `${apiBase}/api/realtime/:path*`,
      },
    ];
  },

  experimental: {},
};

export default nextConfig;

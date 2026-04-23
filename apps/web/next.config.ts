import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // App Router é o padrão no Next.js 15
  reactStrictMode: true,

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

  experimental: {
    // Habilita React Compiler (Next.js 15+)
    reactCompiler: true,
    // Otimiza bundle com partial pre-rendering
    ppr: 'incremental',
  },
};

export default nextConfig;

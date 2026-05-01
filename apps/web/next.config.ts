import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // App Router é o padrão no Next.js 15
  reactStrictMode: true,

  typescript: {
    ignoreBuildErrors: true,
  },

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

  // Proxy de /api/* para o backend Fastify durante o desenvolvimento.
  // Em produção, o Nginx faz esse roteamento. O env var NEXT_PUBLIC_API_BASE
  // (default http://localhost:3001) permite override em outros ambientes.
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';
    return [
      {
        source: '/api/trpc/:path*',
        destination: `${apiBase}/api/trpc/:path*`,
      },
      {
        source: '/api/socket.io/:path*',
        destination: `${apiBase}/socket.io/:path*`,
      },
    ];
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

  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/',
        permanent: true,
      },
      {
        source: '/estoque',
        destination: '/suprimentos',
        permanent: false,
      },
      {
        source: '/estoque/:path*',
        destination: '/suprimentos/:path*',
        permanent: false,
      },
    ];
  },

  experimental: {},
};

export default nextConfig;

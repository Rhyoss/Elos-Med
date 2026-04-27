import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Headers de segurança para o portal
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',         value: 'DENY' },
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          { key: 'X-XSS-Protection',         value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            // Nonces gerados por middleware para scripts inline necessários
            value: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      // HTTPS redirect expresso via header (nginx lida em prod, mas reforçado aqui)
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },

  // Redirecionar HTTP → HTTPS em produção
  async redirects() {
    return [];
  },

  // Configurações de otimização para PWA mobile
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // Variáveis de ambiente expostas ao cliente
  env: {
    NEXT_PUBLIC_API_URL:         process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001',
    NEXT_PUBLIC_PORTAL_URL:      process.env['NEXT_PUBLIC_PORTAL_URL'] ?? 'http://localhost:3002',
    NEXT_PUBLIC_CAPTCHA_SITE_KEY: process.env['NEXT_PUBLIC_CAPTCHA_SITE_KEY'] ?? '',
  },

  // Compress para produção
  compress: true,

  // Power pages
  poweredByHeader: false,

  // Standalone output para Docker multi-stage
  output: 'standalone',
};

export default nextConfig;

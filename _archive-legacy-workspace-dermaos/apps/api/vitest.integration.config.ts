import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' },
      {
        find: '@dermaos/shared',
        replacement: path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      },
    ],
  },
  test: {
    name: 'integration',
    include: ['src/__tests__/integration/**/*.test.ts'],
    exclude: ['src/__tests__/unit/**'],
    environment: 'node',
    timeout: 30_000,
    // Testes de integração NÃO rodam em paralelo — compartilham o container PG
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    reporters: process.env['CI'] ? ['verbose', 'junit'] : ['default'],
    outputFile: process.env['CI'] ? 'test-results/integration-junit.xml' : undefined,
    // Global setup inicia testcontainers (PostgreSQL + Redis)
    globalSetup: ['src/__tests__/integration/setup/global-setup.ts'],
    // Setup por arquivo: expõe cliente de DB nos testes
    setupFiles: ['src/__tests__/integration/setup/db-setup.ts'],
  },
});

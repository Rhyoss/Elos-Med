import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      // Node16 ESM: .js imports apontam para arquivos .ts
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' },
      // Workspace package resolvido diretamente pelo source
      {
        find: '@dermaos/shared',
        replacement: path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      },
    ],
  },
  test: {
    name: 'unit',
    include: ['src/__tests__/unit/**/*.test.ts'],
    exclude: ['src/__tests__/integration/**'],
    environment: 'node',
    timeout: 5_000,
    reporters: process.env['CI'] ? ['verbose', 'junit'] : ['default'],
    outputFile: process.env['CI'] ? 'test-results/unit-junit.xml' : undefined,
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**/*.ts',
        'src/modules/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/__tests__/**',
        'src/types/**',
        'src/config/**',
        'src/**/*.mock.ts',
        'src/**/*.factory.ts',
      ],
      thresholds: {
        lines:     80,
        functions: 80,
        branches:  75,
      },
      reporter: ['text', 'html', 'lcov'],
    },
  },
});

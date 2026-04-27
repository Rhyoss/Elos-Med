import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shared',
    include: ['src/__tests__/**/*.test.ts'],
    environment: 'node',
    timeout: 5_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/__tests__/**'],
      thresholds: { lines: 80, functions: 80, branches: 75 },
    },
  },
});

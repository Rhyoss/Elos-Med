import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // testes E2E têm estado compartilhado de UI
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 2 : 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ...(process.env['CI'] ? [['junit', { outputFile: 'test-results/e2e-junit.xml' }] as const] : []),
  ],
  use: {
    baseURL: BASE_URL,
    timeout: 60_000,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    trace: 'on',
  },
  projects: [
    // Setup: gera storageState de autenticação por role
    {
      name: 'setup-auth',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Chromium — obrigatório em CI
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/fixtures/storage/receptionist.json',
      },
      dependencies: ['setup-auth'],
      testIgnore: /login\.test\.ts/, // login test não usa storageState
    },

    // Firefox — opcional em CI (comentar para acelerar pipeline)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'], storageState: 'e2e/fixtures/storage/receptionist.json' },
    //   dependencies: ['setup-auth'],
    // },
  ],

  // Inicia a aplicação antes dos testes (apenas em CI)
  webServer: process.env['CI']
    ? {
        command: 'pnpm --filter @dermaos/web start',
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,

  outputDir: 'test-results',
});

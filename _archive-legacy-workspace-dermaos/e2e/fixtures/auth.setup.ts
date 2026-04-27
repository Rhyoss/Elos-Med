/**
 * Gera storageState (cookies + localStorage) por role.
 * Executa UMA VEZ antes de todos os E2E tests.
 * Os arquivos gerados são reutilizados entre testes do mesmo role.
 */
import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const STORAGE_DIR = resolve(import.meta.dirname, 'storage');
mkdirSync(STORAGE_DIR, { recursive: true });

const TEST_CREDENTIALS: Record<string, { email: string; password: string }> = {
  admin:         { email: process.env['E2E_ADMIN_EMAIL']         ?? 'admin@dermaos.test',         password: process.env['E2E_ADMIN_PASS']         ?? 'Admin@12345' },
  dermatologist: { email: process.env['E2E_DOCTOR_EMAIL']        ?? 'doctor@dermaos.test',        password: process.env['E2E_DOCTOR_PASS']        ?? 'Doctor@12345' },
  receptionist:  { email: process.env['E2E_RECEPTIONIST_EMAIL']  ?? 'receptionist@dermaos.test',  password: process.env['E2E_RECEPTIONIST_PASS']  ?? 'Recep@12345' },
};

for (const [role, creds] of Object.entries(TEST_CREDENTIALS)) {
  setup(`autenticar como ${role}`, async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(creds.email);
    await page.getByLabel(/senha/i).fill(creds.password);
    await page.getByRole('button', { name: /entrar/i }).click();

    // Aguarda redirecionamento para dashboard
    await expect(page).toHaveURL(/\/(dashboard|agenda|painel)/, { timeout: 15_000 });

    await page.context().storageState({ path: `${STORAGE_DIR}/${role}.json` });
  });
}

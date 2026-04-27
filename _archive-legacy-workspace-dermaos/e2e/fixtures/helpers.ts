/**
 * Helpers reutilizáveis para testes E2E.
 */
import { type Page, expect } from '@playwright/test';

/** Aguarda toast de sucesso com mensagem. */
export async function expectToastSuccess(page: Page, message: string | RegExp): Promise<void> {
  const toast = page.locator('[data-sonner-toast][data-type="success"], .toast-success, [role="status"]').filter({ hasText: message });
  await expect(toast).toBeVisible({ timeout: 8_000 });
}

/** Cria paciente diretamente via API (não via UI) para setup rápido. */
export async function createPatientViaApi(
  page: Page,
  data: { name: string; cpf: string; email?: string },
): Promise<string> {
  const response = await page.request.post('/api/trpc/patients.create', {
    data: {
      json: {
        name:      data.name,
        cpf:       data.cpf,
        email:     data.email ?? `${Date.now()}@test.com`,
        sex:       'other',
        birthDate: '1990-01-01',
      },
    },
  });

  const body = await response.json() as { result: { data: { json: { id: string } } } };
  return body.result.data.json.id;
}

/** Aguarda que todos os requests de rede pendentes sejam concluídos. */
export async function waitForNetworkIdle(page: Page, timeout = 5_000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/** Login rápido para testes que não testam o fluxo de login em si. */
export async function loginAs(
  page: Page,
  role: 'admin' | 'dermatologist' | 'receptionist',
): Promise<void> {
  const creds = {
    admin:         { email: process.env['E2E_ADMIN_EMAIL']        ?? 'admin@dermaos.test',        password: process.env['E2E_ADMIN_PASS']        ?? 'Admin@12345' },
    dermatologist: { email: process.env['E2E_DOCTOR_EMAIL']       ?? 'doctor@dermaos.test',       password: process.env['E2E_DOCTOR_PASS']       ?? 'Doctor@12345' },
    receptionist:  { email: process.env['E2E_RECEPTIONIST_EMAIL'] ?? 'receptionist@dermaos.test', password: process.env['E2E_RECEPTIONIST_PASS'] ?? 'Recep@12345' },
  }[role];

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/senha/i).fill(creds.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|agenda|painel)/, { timeout: 15_000 });
}

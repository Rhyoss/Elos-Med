/**
 * E2E — Fluxo de Login.
 * NÃO usa storageState — testa o fluxo de autenticação diretamente.
 */
import { test, expect } from '@playwright/test';

test.describe('Login flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // sem session pré-existente

  test('deve carregar o dashboard após login com credenciais válidas', async ({ page }) => {
    // Arrange
    await page.goto('/login');

    // Act
    await page.getByLabel(/email/i).fill(process.env['E2E_ADMIN_EMAIL'] ?? 'admin@dermaos.test');
    await page.getByLabel(/senha/i).fill(process.env['E2E_ADMIN_PASS']  ?? 'Admin@12345');
    await page.getByRole('button', { name: /entrar/i }).click();

    // Assert
    await expect(page).toHaveURL(/\/(dashboard|agenda|painel)/, { timeout: 20_000 });
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('deve exibir mensagem de erro para credenciais inválidas', async ({ page }) => {
    // Arrange
    await page.goto('/login');

    // Act
    await page.getByLabel(/email/i).fill('nao-existe@dermaos.test');
    await page.getByLabel(/senha/i).fill('senha-errada');
    await page.getByRole('button', { name: /entrar/i }).click();

    // Assert — mensagem de erro visível, URL não muda
    await expect(page.getByRole('alert').or(page.locator('[data-testid="login-error"]'))).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('deve redirecionar para /login após logout', async ({ page }) => {
    // Arrange — faz login primeiro
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env['E2E_ADMIN_EMAIL'] ?? 'admin@dermaos.test');
    await page.getByLabel(/senha/i).fill(process.env['E2E_ADMIN_PASS']  ?? 'Admin@12345');
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|agenda|painel)/, { timeout: 20_000 });

    // Act — clica em logout
    const logoutBtn = page.getByRole('button', { name: /sair|logout/i })
      .or(page.getByTestId('logout-button'));
    await logoutBtn.click();

    // Assert
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('deve exibir mensagem de bloqueio após 5 tentativas falhas', async ({ page }) => {
    // Arrange
    await page.goto('/login');
    const emailField = page.getByLabel(/email/i);
    const passField  = page.getByLabel(/senha/i);
    const submitBtn  = page.getByRole('button', { name: /entrar/i });

    // Act — 5 tentativas com senha errada
    for (let i = 0; i < 5; i++) {
      await emailField.fill('alvo@dermaos.test');
      await passField.fill(`senha-errada-${i}`);
      await submitBtn.click();
      await page.waitForTimeout(500); // aguarda resposta
    }

    // Assert — mensagem de bloqueio/rate limit visível
    await expect(
      page.getByText(/bloqueado|muitas tentativas|tente novamente|too many/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

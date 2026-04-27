/**
 * E2E — Fluxo completo de consulta (encounter).
 * Usa storageState de médico (dermatologist).
 */
import { test, expect } from '@playwright/test';
import { expectToastSuccess } from '../fixtures/helpers.js';

test.use({ storageState: 'e2e/fixtures/storage/dermatologist.json' });

test.describe('Fluxo completo de consulta', () => {
  test('deve completar ciclo: check-in → atendimento → SOAP → assinar', async ({ page }) => {
    // ── Navegar para a fila de espera ──────────────────────────────────────
    await page.goto('/agenda');
    await expect(page).toHaveURL(/\/agenda/, { timeout: 15_000 });

    // Verifica se há paciente aguardando (status 'waiting')
    const waitingCard = page
      .getByTestId('appointment-card')
      .filter({ hasText: /aguardando|check.in|waiting/i })
      .first();

    const hasWaiting = await waitingCard.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasWaiting) {
      test.skip(true, 'Nenhum paciente aguardando — configure um paciente de teste');
      return;
    }

    // ── Iniciar atendimento ────────────────────────────────────────────────
    await waitingCard.getByRole('button', { name: /iniciar|atender|chamar/i }).click();
    await expect(page).toHaveURL(/\/atendimento|\/encounter/, { timeout: 10_000 });

    // ── Preencher SOAP ─────────────────────────────────────────────────────
    const soapForm = page.getByTestId('soap-form').or(page.getByRole('form', { name: /soap|anamnese/i }));

    const subjetivo = soapForm.getByLabel(/subjetivo|queixa|sintomas/i).or(
      soapForm.getByPlaceholder(/subjetivo/i),
    );
    await subjetivo.fill('Paciente relata lesões na face há 2 semanas.');

    const objetivo = soapForm.getByLabel(/objetivo|exame físico/i).or(
      soapForm.getByPlaceholder(/objetivo/i),
    );
    await objetivo.fill('Lesões eritematosas em região malar bilateral.');

    const avaliacao = soapForm.getByLabel(/avaliação|diagnóstico/i).or(
      soapForm.getByPlaceholder(/avaliação/i),
    );
    await avaliacao.fill('Dermatite seborreica — CID L21.');

    const plano = soapForm.getByLabel(/plano|conduta/i).or(
      soapForm.getByPlaceholder(/plano/i),
    );
    await plano.fill('Cetoconazol shampoo 2% — aplicar 2x/semana por 4 semanas.');

    // ── Auto-save (aguardar indicador) ─────────────────────────────────────
    const savedIndicator = page.getByText(/salvo|rascunho salvo/i).or(
      page.getByTestId('autosave-indicator'),
    );
    await expect(savedIndicator).toBeVisible({ timeout: 8_000 });

    // ── Assinar prontuário ────────────────────────────────────────────────
    const signBtn = page.getByRole('button', { name: /assinar|finalizar consulta/i });
    await expect(signBtn).toBeVisible();
    await signBtn.click();

    // Pode abrir modal de confirmação
    const confirmBtn = page
      .getByRole('dialog')
      .getByRole('button', { name: /confirmar|assinar mesmo assim/i });
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Assert — encounter assinado
    await expectToastSuccess(page, /prontuário.*assinado|consulta.*finalizada/i);

    // ── Verificar que edição está bloqueada após assinatura ────────────────
    await expect(subjetivo.or(soapForm.locator('textarea').first())).toBeDisabled({ timeout: 5_000 });
  });

  test('deve impedir edição após assinatura (botão desabilitado ou erro)', async ({ page }) => {
    // Este teste pressupõe que já existe um encounter assinado acessível.
    // Navega para histórico de atendimentos e tenta editar o último assinado.
    await page.goto('/atendimentos?status=signed');

    const signedEncounter = page.getByTestId('encounter-card').filter({ hasText: /assinado/i }).first();

    const hasSignedEncounter = await signedEncounter.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasSignedEncounter) {
      test.skip(true, 'Nenhum encounter assinado disponível para testar edição pós-assinatura');
      return;
    }

    await signedEncounter.click();

    // O formulário deve estar desabilitado ou mostrar mensagem
    const editBlockedMsg = page.getByText(/prontuário assinado|edição não permitida|somente leitura/i);
    const formDisabled   = page.locator('form textarea:disabled, form input:disabled').first();

    const isBlocked = await editBlockedMsg.isVisible({ timeout: 5_000 }).catch(() => false)
                   || await formDisabled.isVisible({ timeout: 2_000 }).catch(() => false);

    expect(isBlocked, 'Esperava que edição fosse bloqueada após assinatura').toBe(true);
  });
});

test.describe('Dashboard role-based', () => {
  test('médico deve ver cards clínicos mas não cards financeiros', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Cards que médico deve ver
    await expect(page.getByTestId('card-agenda').or(page.getByText(/consultas hoje|agenda/i))).toBeVisible();

    // Cards que médico NÃO deve ver
    const financialCard = page.getByTestId('card-receita').or(page.getByText(/receita do dia|faturamento/i));
    await expect(financialCard).not.toBeVisible();
  });
});

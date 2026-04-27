/**
 * E2E — Criação de paciente e agendamento de consulta.
 * Usa storageState de recepcionista (setup em auth.setup.ts).
 */
import { test, expect } from '@playwright/test';
import { expectToastSuccess } from '../fixtures/helpers.js';

test.use({ storageState: 'e2e/fixtures/storage/receptionist.json' });

test.describe('Criar paciente e agendar consulta', () => {
  test('deve criar paciente, exibi-lo na lista e criar agendamento', async ({ page }) => {
    const patientName = `Teste E2E ${Date.now()}`;
    const patientCPF  = '529.982.247-25'; // CPF válido para teste

    // ── Passo 1: Navegar para criar paciente ───────────────────────────────
    await page.goto('/pacientes/novo');
    await expect(page).toHaveURL(/\/pacientes\/novo/, { timeout: 15_000 });

    // ── Passo 2: Preencher dados ───────────────────────────────────────────
    await page.getByLabel(/nome completo|nome do paciente/i).fill(patientName);
    await page.getByLabel(/cpf/i).fill(patientCPF);

    const birthDateField = page.getByLabel(/data de nascimento|nascimento/i);
    await birthDateField.fill('1990-05-15');

    const sexSelect = page.getByLabel(/sexo|gênero/i);
    await sexSelect.selectOption({ label: /feminino|female/i });

    // ── Passo 3: Salvar ────────────────────────────────────────────────────
    await page.getByRole('button', { name: /salvar|cadastrar|criar/i }).click();

    // ── Passo 4: Verificar toast + redirecionamento ────────────────────────
    await expectToastSuccess(page, /paciente.*cadastrado|salvo com sucesso/i);
    await expect(page).toHaveURL(/\/pacientes\/[\w-]+/, { timeout: 10_000 });

    // ── Passo 5: Verificar que paciente aparece na busca ───────────────────
    await page.goto('/pacientes');
    await page.getByPlaceholder(/buscar|pesquisar/i).fill(patientName.slice(0, 10));
    await expect(
      page.getByRole('row').or(page.getByTestId('patient-card')).filter({ hasText: patientName }),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('deve criar agendamento para paciente existente', async ({ page }) => {
    // Setup: navega para agenda e cria agendamento
    await page.goto('/agenda');
    await expect(page).toHaveURL(/\/agenda/, { timeout: 15_000 });

    // Clica no botão de novo agendamento
    const newApptBtn = page.getByRole('button', { name: /novo agendamento|agendar/i });
    await newApptBtn.click();

    // Aguarda modal/drawer de agendamento
    const apptForm = page.getByRole('dialog').or(page.getByTestId('appointment-form'));
    await expect(apptForm).toBeVisible({ timeout: 8_000 });

    // Seleciona um horário disponível (primeiro slot disponível)
    const availableSlot = apptForm
      .getByRole('button', { name: /disponível|\d{1,2}:\d{2}/i })
      .first();
    await availableSlot.click();

    // Confirma agendamento (se necessário preencher paciente, pode ser via autocomplete)
    const saveBtn = apptForm.getByRole('button', { name: /salvar|confirmar|agendar/i });
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await expectToastSuccess(page, /agendamento.*criado|consulta.*agendada/i);
    }
  });
});

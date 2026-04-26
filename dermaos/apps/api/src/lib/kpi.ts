/**
 * Funções puras de cálculo de KPIs clínicos e operacionais.
 * Sem dependência de banco — totalmente testáveis em unit tests.
 */

export class KpiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KpiValidationError';
  }
}

/**
 * Calcula o Índice de Massa Corporal (IMC).
 * @param pesoKg   Peso em quilogramas.
 * @param alturaM  Altura em metros.
 * @throws KpiValidationError se peso ou altura forem inválidos.
 */
export function calcIMC(pesoKg: number, alturaM: number): number {
  if (pesoKg <= 0) throw new KpiValidationError(`Peso inválido: ${pesoKg}. Deve ser > 0.`);
  if (alturaM <= 0) throw new KpiValidationError(`Altura inválida: ${alturaM}. Deve ser > 0.`);
  return pesoKg / (alturaM * alturaM);
}

/**
 * Estima dias de cobertura do estoque.
 * @returns null quando consumo médio é zero ou histórico insuficiente.
 */
export function calcDiasCobertura(
  qtdAtual: number,
  consumoMedioDiario: number,
  opts?: { historicoInsuficiente?: boolean },
): { dias: number | null; historicoInsuficiente: boolean } {
  if (opts?.historicoInsuficiente) {
    return { dias: null, historicoInsuficiente: true };
  }
  if (consumoMedioDiario === 0) {
    return { dias: null, historicoInsuficiente: false };
  }
  return {
    dias: qtdAtual / consumoMedioDiario,
    historicoInsuficiente: false,
  };
}

/**
 * Taxa de no-show: noShows / totalAgendados.
 * @returns null quando não há agendamentos (evita divisão por zero).
 */
export function calcTaxaNoShow(noShows: number, totalAgendados: number): number | null {
  if (totalAgendados === 0) return null;
  return noShows / totalAgendados;
}

/**
 * Taxa de ocupação de agenda: slotsOcupados / slotsTotal.
 * @returns null quando não há slots disponíveis.
 */
export function calcOcupacao(slotsOcupados: number, slotsTotal: number): number | null {
  if (slotsTotal === 0) return null;
  return slotsOcupados / slotsTotal;
}

/**
 * Ticket médio: totalReceita / numConsultas.
 * @returns null quando não há consultas.
 */
export function calcTicketMedio(totalReceita: number, numConsultas: number): number | null {
  if (numConsultas === 0) return null;
  return totalReceita / numConsultas;
}

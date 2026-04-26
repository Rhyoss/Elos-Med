/**
 * Heurística simples de sentimento — PT-BR.
 *
 * Usada apenas no builder de escalação (§3.5) e no teste de regra (§1.4).
 * NÃO é um classificador de produção; serve para:
 *   (a) simular "SE sentimento = negativo" no painel,
 *   (b) matchar palavras-chave emocionais em conversas reais.
 *
 * Para produção, o ideal é substituir por um classificador LLM — ficou fora
 * do escopo da Fase 4 para não acoplar o painel ao Anthropic.
 */

const MUITO_NEGATIVO = [
  'péssimo', 'pessimo', 'terrível', 'terrivel', 'odeio', 'nojo', 'horrível', 'horrivel',
  'furioso', 'revoltado', 'absurdo', 'inadmissível', 'inadmissivel', 'indignado',
  'vou processar', 'processar vocês', 'processar voces', 'procon',
];

const NEGATIVO = [
  'ruim', 'insatisfeito', 'insatisfeita', 'decepcionado', 'decepcionada', 'chateado',
  'chateada', 'frustrado', 'frustrada', 'triste', 'aborrecido', 'aborrecida',
  'reclamar', 'reclamação', 'reclamacao', 'demora', 'atrasado', 'atrasada',
  'não gostei', 'nao gostei', 'não funcionou', 'nao funcionou', 'errado', 'errada',
  'quero cancelar', 'perda de tempo',
];

const POSITIVO = [
  'ótimo', 'otimo', 'excelente', 'maravilhoso', 'maravilhosa', 'amei', 'adorei',
  'perfeito', 'perfeita', 'obrigado', 'obrigada', 'gratidão', 'gratidao',
  'recomendo', 'super bem', 'muito bom', 'muito boa',
];

export type SentimentLabel = 'negativo' | 'muito_negativo' | 'neutro' | 'positivo';

export function detectSentiment(text: string): SentimentLabel {
  const lower = text.toLowerCase();
  if (MUITO_NEGATIVO.some((w) => lower.includes(w))) return 'muito_negativo';
  if (NEGATIVO.some((w) => lower.includes(w)))       return 'negativo';
  if (POSITIVO.some((w) => lower.includes(w)))       return 'positivo';
  return 'neutro';
}

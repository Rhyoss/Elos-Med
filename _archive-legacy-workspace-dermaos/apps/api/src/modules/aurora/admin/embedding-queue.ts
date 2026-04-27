/**
 * Helper de enfileiramento para a fila `aurora-embed`.
 *
 * Chamado pelo service quando o usuário confirma um upload ou solicita
 * re-embedding. Idempotente por `jobId = embed:{documentId}` — múltiplas
 * chamadas para o mesmo documento não duplicam o processamento em andamento.
 */

import { auroraEmbedQueue, type AuroraEmbedJob } from '../../../jobs/queues.js';

const JOB_NAME = 'embed-document';

export async function enqueueEmbeddingJob(
  clinicId: string,
  agentId: string,
  documentId: string,
): Promise<void> {
  const payload: AuroraEmbedJob = { clinicId, agentId, documentId };
  await auroraEmbedQueue.add(JOB_NAME, payload, {
    jobId: `embed:${documentId}`,
  });
}

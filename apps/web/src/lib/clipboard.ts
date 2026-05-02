/**
 * Wrapper para `navigator.clipboard.writeText` que captura rejeições do browser
 * (sem foco da aba, contexto inseguro, permissão negada, ausente em browsers antigos).
 *
 * Use sempre este helper — o lint regra `no-restricted-syntax` proíbe chamada
 * direta a `navigator.clipboard` em código de UI.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    // eslint-disable-next-line no-restricted-syntax
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

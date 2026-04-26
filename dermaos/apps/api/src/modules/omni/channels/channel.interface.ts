import type { ChannelRow } from '../omni.types.js';

export interface SendMessagePayload {
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'template';
  content:     string | null;
  mediaUrl:    string | null;
  /** identificador externo do contato no canal — ex.: telefone E.164 para WhatsApp */
  toExternalId: string;
}

export interface SendMessageResult {
  /** ID retornado pelo provedor — undefined em modo mock */
  externalMessageId: string | null;
  /** Status inicial após enviar. Pode ser 'sent' (aceito pelo provedor) ou 'pending'. */
  initialStatus: 'sent' | 'pending';
}

export interface IMessageChannel {
  readonly type: ChannelRow['type'];
  /** Envia mensagem pelo provedor. Deve lançar em caso de falha para o caller marcar 'failed'. */
  send(channel: ChannelRow, payload: SendMessagePayload): Promise<SendMessageResult>;
  /** Valida signature/HMAC do webhook — retorna true se válido. */
  verifyWebhookSignature(channel: ChannelRow, rawBody: string, headers: Record<string, string | string[] | undefined>): boolean;
}

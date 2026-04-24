/**
 * Integração com provedores de prescrição digital.
 *
 * Esta interface existe para que no futuro possamos plugar provedores reais
 * (Memed, iClinic Sign, Nexo, ICP-Brasil) sem alterar o serviço principal.
 *
 * A implementação atual é um mock — persiste o envio no banco com status
 * `sent_mock` e retorna uma referência sintética.
 */

import { logger } from '../../../lib/logger.js';

export interface DigitalPrescriptionSendPayload {
  prescriptionId:     string;
  prescriptionNumber: string | null;
  patientId:          string;
  patientName:        string;
  prescriberId:       string;
  prescriberName:     string;
  prescriberCrm:      string | null;
  channel:            'email' | 'sms' | 'whatsapp' | 'portal';
  recipient?:         string;
  pdfUrl?:            string;
}

export interface DigitalPrescriptionSendResult {
  providerName:    string;
  externalRef:     string | null;
  status:          'sent_mock' | 'delivered' | 'failed';
  acceptedAt:      Date;
  rawResponse?:    Record<string, unknown>;
  errorMessage?:   string;
}

export interface IDigitalPrescriptionProvider {
  readonly name: string;

  send(payload: DigitalPrescriptionSendPayload): Promise<DigitalPrescriptionSendResult>;
}

/* ── Implementação Mock ─────────────────────────────────────────────────── */

export class MockDigitalPrescriptionProvider implements IDigitalPrescriptionProvider {
  readonly name = 'mock';

  async send(payload: DigitalPrescriptionSendPayload): Promise<DigitalPrescriptionSendResult> {
    const acceptedAt = new Date();
    const externalRef = `mock-${payload.prescriptionId}-${acceptedAt.getTime()}`;

    logger.info(
      {
        prescriptionId: payload.prescriptionId,
        channel:        payload.channel,
        providerName:   this.name,
        externalRef,
      },
      'MockDigitalPrescriptionProvider: pretend-sent',
    );

    return {
      providerName: this.name,
      externalRef,
      status:       'sent_mock',
      acceptedAt,
      rawResponse:  {
        mock: true,
        acceptedAt: acceptedAt.toISOString(),
        channel:    payload.channel,
      },
    };
  }
}

let singleton: IDigitalPrescriptionProvider | null = null;

export function getDigitalPrescriptionProvider(): IDigitalPrescriptionProvider {
  if (!singleton) singleton = new MockDigitalPrescriptionProvider();
  return singleton;
}

export function setDigitalPrescriptionProvider(provider: IDigitalPrescriptionProvider): void {
  singleton = provider;
}

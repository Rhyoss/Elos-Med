import { eventBus } from '../event-bus.js';
import { db } from '../../db/client.js';
import { logger } from '../../lib/logger.js';

/**
 * Quando um lead é convertido, cria o registro em shared.patients
 * e associa o patient_id canônico ao contato omni.
 */
export function registerLeadToPatientHandler(): void {
  eventBus.subscribe('lead.converted', async (event) => {
    const { contactId, patientId: existingPatientId, cpfHash, phone } = event.payload as {
      contactId: string;
      patientId?: string;
      cpfHash?: string;
      phone?: string;
    };

    const clinicId = event.clinicId;

    // Se já veio com patient_id, apenas garante o vínculo
    if (existingPatientId) {
      await db.query(
        `UPDATE omni.contacts SET patient_id = $1, converted_at = NOW() WHERE id = $2`,
        [existingPatientId, contactId],
      );
      return;
    }

    // Busca paciente existente por cpf_hash ou phone_hash
    let patientId: string | null = null;

    if (cpfHash) {
      const res = await db.query<{ id: string }>(
        `SELECT id FROM shared.patients WHERE clinic_id = $1 AND cpf_hash = $2 LIMIT 1`,
        [clinicId, cpfHash],
      );
      patientId = res.rows[0]?.id ?? null;
    }

    if (!patientId && phone) {
      // Busca por telefone via contato já existente
      const res = await db.query<{ patient_id: string }>(
        `SELECT patient_id FROM omni.contacts
         WHERE clinic_id = $1 AND phone = $2 AND patient_id IS NOT NULL
         LIMIT 1`,
        [clinicId, phone],
      );
      patientId = res.rows[0]?.patient_id ?? null;
    }

    if (!patientId) {
      // Obtém dados do contato para criar paciente
      const contactRes = await db.query<{
        name: string; email: string; phone: string;
        birth_date: string | null; gender: string | null;
      }>(
        `SELECT name, email, phone, birth_date, gender
         FROM omni.contacts WHERE id = $1 AND clinic_id = $2`,
        [contactId, clinicId],
      );

      const contact = contactRes.rows[0];
      if (!contact) {
        logger.warn({ contactId, clinicId }, 'lead.converted: contact not found, skipping patient creation');
        return;
      }

      const insertRes = await db.query<{ id: string }>(
        `INSERT INTO shared.patients
           (clinic_id, full_name_encrypted, email_encrypted, phone_encrypted,
            cpf_hash, birth_date, gender, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ativo')
         RETURNING id`,
        [
          clinicId,
          contact.name,       // Será criptografado na app antes de chegar aqui — placeholder
          contact.email,
          contact.phone,
          cpfHash ?? null,
          contact.birth_date ?? null,
          contact.gender ?? null,
        ],
      );

      patientId = insertRes.rows[0]!.id;
      logger.info({ patientId, contactId, clinicId }, 'lead.converted: patient created from lead');
    }

    await db.query(
      `UPDATE omni.contacts
       SET patient_id = $1, converted_at = NOW(), status = 'convertido'
       WHERE id = $2 AND clinic_id = $3`,
      [patientId, contactId, clinicId],
    );

    logger.info({ patientId, contactId, clinicId }, 'lead.converted: contact linked to patient');
  });
}

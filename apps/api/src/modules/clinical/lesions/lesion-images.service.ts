import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { db, withClinicContext } from '../../../db/client.js';
import { logger } from '../../../lib/logger.js';
import {
  CLINICAL_IMAGES_BUCKET,
  putObjectBuffer,
  presignGet,
  removeObject,
} from '../../../lib/storage.js';
import { validateImageUpload, sanitizeFilename } from '../../../lib/image-validation.js';
import { lesionImageQueue, QUEUE_NAMES } from '../../../jobs/queues.js';
import { emitToClinic } from '../../../lib/socket.js';
import {
  PRESIGNED_URL_TTL_SECONDS,
  MAX_UPLOAD_BATCH_SIZE,
  type BodyRegion,
  type CaptureType,
  type ImageProcessingStatus,
  type ListLesionImagesQuery,
  type ListPatientImagesQuery,
  type UploadImageMetadata,
} from '@dermaos/shared';

interface LesionImageRow {
  id:                  string;
  clinic_id:           string;
  lesion_id:           string;
  encounter_id:        string | null;
  captured_by:         string | null;
  image_url:           string;
  thumbnail_url:       string | null;
  medium_url:          string | null;
  equipment:           string | null;
  capture_type:        string | null;
  magnification:       string | null;
  metadata:            Record<string, unknown>;
  alt_text:            string | null;
  captured_at:         string;
  notes:               string | null;
  created_at:          string;
  processing_status:   ImageProcessingStatus;
  processing_error:    string | null;
  processed_at:        string | null;
  file_size_bytes:     number | null;
  mime_type:           string | null;
  original_filename:   string | null;
  width_px:            number | null;
  height_px:           number | null;
  is_corrupted:        boolean;
}

export interface LesionImagePublic {
  id:               string;
  lesionId:         string;
  captureType:      CaptureType | null;
  equipment:        string | null;
  magnification:    string | null;
  altText:          string | null;
  capturedAt:       Date;
  notes:            string | null;
  processingStatus: ImageProcessingStatus;
  isCorrupted:      boolean;
  originalUrl:      string | null;
  mediumUrl:        string | null;
  thumbnailUrl:     string | null;
  widthPx:          number | null;
  heightPx:         number | null;
  fileSizeBytes:    number | null;
  mimeType:         string | null;
  originalFilename: string | null;
  capturedBy:       string | null;
  encounterId:      string | null;
  processingError:  string | null;
  createdAt:        Date;
}

function buildAltText(bodyRegion: string, date: Date): string {
  const d = date.toISOString().slice(0, 10);
  return `Foto clínica - ${bodyRegion} - ${d}`;
}

function objectKeyFor(
  clinicId: string,
  lesionId: string,
  imageId:  string,
  variant:  'original' | 'medium' | 'thumbnail',
  extension: string,
): string {
  return `${clinicId}/${lesionId}/${imageId}/${variant}${extension}`;
}

async function presignVariant(row: LesionImageRow, variant: 'original' | 'medium' | 'thumbnail'):
  Promise<string | null>
{
  const key =
    variant === 'original'  ? row.image_url :
    variant === 'medium'    ? row.medium_url :
                              row.thumbnail_url;
  if (!key) return null;
  if (row.processing_status !== 'ready' && variant !== 'original') return null;
  try {
    return await presignGet(key, PRESIGNED_URL_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err, key }, 'Failed to presign object');
    return null;
  }
}

async function mapRowWithUrls(row: LesionImageRow): Promise<LesionImagePublic> {
  const [originalUrl, mediumUrl, thumbnailUrl] = await Promise.all([
    presignVariant(row, 'original'),
    presignVariant(row, 'medium'),
    presignVariant(row, 'thumbnail'),
  ]);
  return {
    id:               row.id,
    lesionId:         row.lesion_id,
    captureType:      (row.capture_type as CaptureType | null) ?? null,
    equipment:        row.equipment,
    magnification:    row.magnification,
    altText:          row.alt_text,
    capturedAt:       new Date(row.captured_at),
    notes:            row.notes,
    processingStatus: row.processing_status,
    isCorrupted:      row.is_corrupted,
    originalUrl,
    mediumUrl,
    thumbnailUrl,
    widthPx:          row.width_px,
    heightPx:         row.height_px,
    fileSizeBytes:    row.file_size_bytes,
    mimeType:         row.mime_type,
    originalFilename: row.original_filename,
    capturedBy:       row.captured_by,
    encounterId:      row.encounter_id,
    processingError:  row.processing_error,
    createdAt:        new Date(row.created_at),
  };
}

async function assertLesionInClinic(
  clinicId: string, lesionId: string, patientId?: string,
): Promise<{ patientId: string; bodyRegion: string }> {
  const res = await db.query<{ patient_id: string; location_body_map: string }>(
    `SELECT patient_id, location_body_map FROM clinical.lesions
      WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
    [lesionId, clinicId],
  );
  if (!res.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesão não encontrada' });
  }
  if (patientId && res.rows[0].patient_id !== patientId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Lesão não pertence ao paciente informado',
    });
  }
  return { patientId: res.rows[0].patient_id, bodyRegion: res.rows[0].location_body_map };
}

export interface UploadedFile {
  buffer:       Buffer;
  originalName: string;
  mimeType:     string;
}

export interface UploadResult {
  imageId:          string;
  processingStatus: ImageProcessingStatus;
  altText:          string;
}

/**
 * Salva o original no MinIO, cria registro em 'pending' e enfileira processamento.
 * Retorna imediatamente (202 Accepted no controller).
 */
export async function uploadImagesForLesion(
  files:    UploadedFile[],
  metadata: UploadImageMetadata,
  clinicId: string,
  userId:   string,
): Promise<UploadResult[]> {
  if (files.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nenhum arquivo enviado.' });
  }
  if (files.length > MAX_UPLOAD_BATCH_SIZE) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Máximo de ${MAX_UPLOAD_BATCH_SIZE} imagens por upload.`,
    });
  }

  // Resolve / cria lesão
  let lesionId = metadata.lesionId;
  let bodyRegion: string;

  if (lesionId) {
    const lesion = await assertLesionInClinic(clinicId, lesionId, metadata.patientId);
    bodyRegion = lesion.bodyRegion;
  } else {
    if (!metadata.bodyRegion) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'bodyRegion é obrigatório ao criar nova lesão.',
      });
    }
    // Verifica paciente antes de criar lesão
    const patientCheck = await db.query(
      `SELECT 1 FROM shared.patients WHERE id = $1 AND clinic_id = $2`,
      [metadata.patientId, clinicId],
    );
    if (patientCheck.rowCount === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado' });
    }
    const created = await withClinicContext(clinicId, async (client) => {
      return client.query<{ id: string }>(
        `INSERT INTO clinical.lesions
           (clinic_id, patient_id, location_body_map, description,
            status, created_by, updated_by, is_active)
         VALUES ($1, $2, $3, $4, 'active', $5, $5, TRUE)
         RETURNING id`,
        [
          clinicId, metadata.patientId, metadata.bodyRegion,
          metadata.description ?? '(criada via upload de imagem)',
          userId,
        ],
      );
    });
    lesionId   = created.rows[0]!.id;
    bodyRegion = metadata.bodyRegion;
  }

  const results: UploadResult[] = [];

  for (const file of files) {
    const validation = validateImageUpload(file.buffer, file.originalName, file.mimeType);
    if (!validation.ok) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: validation.message ?? 'Arquivo inválido.' });
    }

    const imageId    = crypto.randomUUID();
    const sanitized  = sanitizeFilename(file.originalName);
    const ext        = sanitized.slice(sanitized.lastIndexOf('.')) || '.jpg';
    const originalKey = objectKeyFor(clinicId, lesionId, imageId, 'original', ext);
    const capturedAt  = new Date();
    const altText     = buildAltText(bodyRegion as BodyRegion, capturedAt);

    try {
      await putObjectBuffer(originalKey, file.buffer, validation.mime!);
    } catch (err) {
      logger.error({ err, originalKey }, 'MinIO upload failed');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Serviço de armazenamento indisponível. Tente novamente em instantes.',
      });
    }

    await withClinicContext(clinicId, async (client) => {
      await client.query(
        `INSERT INTO clinical.lesion_images
           (id, clinic_id, lesion_id, encounter_id, captured_by,
            image_url, capture_type, equipment, magnification,
            metadata, alt_text, captured_at, notes,
            processing_status, file_size_bytes, mime_type, original_filename)
         VALUES ($1, $2, $3, $4, $5,
                 $6, $7, $8, $9,
                 $10::jsonb, $11, $12, $13,
                 'pending', $14, $15, $16)`,
        [
          imageId, clinicId, lesionId, metadata.encounterId ?? null, userId,
          originalKey, metadata.captureType, metadata.equipment ?? null, metadata.magnification ?? null,
          JSON.stringify({ uploadedBy: userId }), altText, capturedAt, metadata.notes ?? null,
          file.buffer.length, validation.mime!, sanitized,
        ],
      );
    });

    await lesionImageQueue.add(
      QUEUE_NAMES.LESION_IMAGE_PROCESSING,
      {
        imageId,
        clinicId,
        objectKey: originalKey,
        mimeType:  validation.mime!,
        originalName: sanitized,
      },
      { jobId: imageId },
    );

    setImmediate(() => {
      emitToClinic(clinicId, 'lesion_image.uploaded', {
        imageId, lesionId, processingStatus: 'pending',
      });
    });

    results.push({ imageId, processingStatus: 'pending', altText });
  }

  return results;
}

export async function listImagesByLesion(
  params:   ListLesionImagesQuery,
  clinicId: string,
): Promise<{ data: LesionImagePublic[]; total: number; page: number; pageSize: number }> {
  await assertLesionInClinic(clinicId, params.lesionId);

  const offset = (params.page - 1) * params.pageSize;

  const [countResult, dataResult] = await Promise.all([
    db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM clinical.lesion_images
        WHERE clinic_id = $1 AND lesion_id = $2`,
      [clinicId, params.lesionId],
    ),
    db.query<LesionImageRow>(
      `SELECT * FROM clinical.lesion_images
        WHERE clinic_id = $1 AND lesion_id = $2
        ORDER BY captured_at DESC
        LIMIT $3 OFFSET $4`,
      [clinicId, params.lesionId, params.pageSize, offset],
    ),
  ]);

  const data = await Promise.all(dataResult.rows.map(mapRowWithUrls));
  return {
    data,
    total:    parseInt(countResult.rows[0]?.count ?? '0', 10),
    page:     params.page,
    pageSize: params.pageSize,
  };
}

export async function listImagesByPatient(
  params:   ListPatientImagesQuery,
  clinicId: string,
): Promise<{ data: LesionImagePublic[]; total: number; page: number; pageSize: number }> {
  const where: string[] = ['li.clinic_id = $1', 'l.patient_id = $2', 'l.deleted_at IS NULL'];
  const values: unknown[] = [clinicId, params.patientId];
  let idx = 3;

  if (params.lesionId)    { where.push(`li.lesion_id = $${idx++}`);    values.push(params.lesionId); }
  if (params.captureType) { where.push(`li.capture_type = $${idx++}`); values.push(params.captureType); }
  if (params.fromDate)    { where.push(`li.captured_at >= $${idx++}`); values.push(params.fromDate); }
  if (params.toDate)      { where.push(`li.captured_at <= $${idx++}`); values.push(params.toDate); }

  const offset = (params.page - 1) * params.pageSize;

  const [countResult, dataResult] = await Promise.all([
    db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM clinical.lesion_images li
         JOIN clinical.lesions l ON l.id = li.lesion_id
        WHERE ${where.join(' AND ')}`,
      values,
    ),
    db.query<LesionImageRow>(
      `SELECT li.* FROM clinical.lesion_images li
         JOIN clinical.lesions l ON l.id = li.lesion_id
        WHERE ${where.join(' AND ')}
        ORDER BY li.captured_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.pageSize, offset],
    ),
  ]);

  const data = await Promise.all(dataResult.rows.map(mapRowWithUrls));
  return {
    data,
    total:    parseInt(countResult.rows[0]?.count ?? '0', 10),
    page:     params.page,
    pageSize: params.pageSize,
  };
}

export async function getImageById(
  imageId:  string,
  clinicId: string,
): Promise<LesionImagePublic> {
  const res = await db.query<LesionImageRow>(
    `SELECT * FROM clinical.lesion_images WHERE id = $1 AND clinic_id = $2`,
    [imageId, clinicId],
  );
  if (!res.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Imagem não encontrada' });
  }
  return mapRowWithUrls(res.rows[0]);
}

export async function requestPresignedUrl(
  imageId: string,
  variant: 'original' | 'medium' | 'thumbnail',
  clinicId: string,
): Promise<{ url: string; expiresIn: number }> {
  const res = await db.query<LesionImageRow>(
    `SELECT * FROM clinical.lesion_images WHERE id = $1 AND clinic_id = $2`,
    [imageId, clinicId],
  );
  if (!res.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Imagem não encontrada' });
  }
  const url = await presignVariant(res.rows[0], variant);
  if (!url) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Variante indisponível. Imagem pode ainda estar em processamento.',
    });
  }
  return { url, expiresIn: PRESIGNED_URL_TTL_SECONDS };
}

export async function retryProcessing(
  imageId: string,
  clinicId: string,
): Promise<{ queued: boolean }> {
  const res = await db.query<LesionImageRow>(
    `SELECT * FROM clinical.lesion_images WHERE id = $1 AND clinic_id = $2`,
    [imageId, clinicId],
  );
  const row = res.rows[0];
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Imagem não encontrada' });
  }
  if (row.processing_status !== 'processing_failed' && row.processing_status !== 'unprocessable') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Imagem não está em estado que permita retry.',
    });
  }
  await withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE clinical.lesion_images
          SET processing_status = 'pending', processing_error = NULL
        WHERE id = $1 AND clinic_id = $2`,
      [imageId, clinicId],
    );
  });
  await lesionImageQueue.add(
    QUEUE_NAMES.LESION_IMAGE_PROCESSING,
    {
      imageId,
      clinicId,
      objectKey: row.image_url,
      mimeType: row.mime_type ?? 'image/jpeg',
      originalName: row.original_filename ?? 'image.jpg',
    },
    { jobId: `${imageId}:retry:${Date.now()}` },
  );
  return { queued: true };
}

/** Usado pelos testes / cleanup — não exposto na UI. */
export async function hardDeleteImage(imageId: string, clinicId: string): Promise<void> {
  const res = await db.query<LesionImageRow>(
    `SELECT * FROM clinical.lesion_images WHERE id = $1 AND clinic_id = $2`,
    [imageId, clinicId],
  );
  const row = res.rows[0];
  if (!row) return;
  await Promise.all(
    [row.image_url, row.medium_url, row.thumbnail_url]
      .filter((k): k is string => !!k)
      .map((objectKey) => removeObject(objectKey)),
  );
  await db.query(
    `DELETE FROM clinical.lesion_images WHERE id = $1 AND clinic_id = $2`,
    [imageId, clinicId],
  );
}

export const _exported = { CLINICAL_IMAGES_BUCKET };

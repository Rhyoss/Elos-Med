import { Client as MinioClient } from 'minio';
import { Pool } from 'pg';
import sharp from 'sharp';
import type { Job } from 'bullmq';
import type pino from 'pino';

const BUCKET = 'clinical-images';

const MINIO_ENDPOINT  = process.env['MINIO_ENDPOINT']   ?? 'minio';
const MINIO_PORT      = Number(process.env['MINIO_PORT'] ?? 9000);
const MINIO_USE_SSL   = process.env['MINIO_USE_SSL']    === 'true';
const MINIO_ACCESS    = process.env['MINIO_ACCESS_KEY'] ?? '';
const MINIO_SECRET    = process.env['MINIO_SECRET_KEY'] ?? '';

const minio = new MinioClient({
  endPoint: MINIO_ENDPOINT,
  port:     MINIO_PORT,
  useSSL:   MINIO_USE_SSL,
  accessKey: MINIO_ACCESS,
  secretKey: MINIO_SECRET,
});

const db = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 5,
});

export interface LesionImageJobData {
  imageId:      string;
  clinicId:     string;
  objectKey:    string;
  mimeType:     string;
  originalName: string;
}

async function objectToBuffer(key: string): Promise<Buffer> {
  const stream = await minio.getObject(BUCKET, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function putBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await minio.putObject(BUCKET, key, buffer, buffer.length, { 'Content-Type': contentType });
}

function derivedKey(originalKey: string, variant: 'medium' | 'thumbnail', ext: string): string {
  // originalKey: {clinic}/{lesion}/{imageId}/original{ext}
  const parts = originalKey.split('/');
  parts[parts.length - 1] = `${variant}${ext}`;
  return parts.join('/');
}

export function buildLesionImageProcessor(logger: pino.Logger) {
  return async function process(job: Job<LesionImageJobData>): Promise<void> {
    const { imageId, clinicId, objectKey, mimeType } = job.data;
    logger.info({ imageId, clinicId }, 'Processing lesion image');

    await db.query(
      `UPDATE clinical.lesion_images
          SET processing_status = 'processing'
        WHERE id = $1 AND clinic_id = $2`,
      [imageId, clinicId],
    );

    let original: Buffer;
    try {
      original = await objectToBuffer(objectKey);
    } catch (err) {
      logger.error({ err, objectKey }, 'Failed to load original from MinIO');
      await db.query(
        `UPDATE clinical.lesion_images
            SET processing_status = 'processing_failed',
                processing_error = $3,
                is_corrupted = TRUE
          WHERE id = $1 AND clinic_id = $2`,
        [imageId, clinicId, 'minio_unavailable'],
      );
      throw err; // BullMQ retry exponencial
    }

    try {
      // preserva orientação (EXIF), remove geolocalização via withMetadata({exif: {}})
      const pipeline = sharp(original, { failOn: 'none' }).rotate();
      const meta     = await pipeline.metadata();

      // Converte HEIC para JPEG (Sharp requer libvips com suporte a HEIF; fallback para JPEG)
      const outFormat: 'jpeg' | 'png' | 'webp' =
        mimeType === 'image/png'  ? 'png' :
        mimeType === 'image/webp' ? 'webp' : 'jpeg';
      const outExt =
        outFormat === 'png'  ? '.png' :
        outFormat === 'webp' ? '.webp' : '.jpg';
      const outMime =
        outFormat === 'png'  ? 'image/png' :
        outFormat === 'webp' ? 'image/webp' : 'image/jpeg';

      async function buildVariant(size: number) {
        return sharp(original, { failOn: 'none' })
          .rotate()
          .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
          .withMetadata({ exif: {} }) // strip GPS + outros EXIF sensíveis
          .toFormat(outFormat, { quality: 85 })
          .toBuffer();
      }

      const [thumb, medium] = await Promise.all([buildVariant(200), buildVariant(800)]);

      const thumbKey  = derivedKey(objectKey, 'thumbnail', outExt);
      const mediumKey = derivedKey(objectKey, 'medium',    outExt);

      await Promise.all([
        putBuffer(thumbKey,  thumb,  outMime),
        putBuffer(mediumKey, medium, outMime),
      ]);

      await db.query(
        `UPDATE clinical.lesion_images
            SET processing_status = 'ready',
                processing_error  = NULL,
                processed_at      = NOW(),
                thumbnail_url     = $3,
                medium_url        = $4,
                width_px          = $5,
                height_px         = $6,
                is_corrupted      = FALSE
          WHERE id = $1 AND clinic_id = $2`,
        [imageId, clinicId, thumbKey, mediumKey, meta.width ?? null, meta.height ?? null],
      );

      logger.info({ imageId, width: meta.width, height: meta.height }, 'Lesion image ready');
    } catch (err) {
      logger.warn({ err, imageId }, 'Sharp processing failed — marking unprocessable');
      // Não é falha transitória: não dispara retry. Marca como unprocessable para UI oferecer retry manual.
      await db.query(
        `UPDATE clinical.lesion_images
            SET processing_status = 'unprocessable',
                processing_error  = $3,
                is_corrupted      = TRUE
          WHERE id = $1 AND clinic_id = $2`,
        [imageId, clinicId, (err as Error).message.slice(0, 500)],
      );
      // Não relança: falha de processamento não deve ficar retry loop
    }
  };
}

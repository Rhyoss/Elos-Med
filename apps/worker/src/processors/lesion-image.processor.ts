import { Storage } from '@google-cloud/storage';
import { Pool } from 'pg';
import sharp from 'sharp';
import type { Job } from 'bullmq';
import type pino from 'pino';

const BUCKET_PREFIX = process.env['GCS_BUCKET_PREFIX'] ?? '';
const BUCKET = BUCKET_PREFIX ? `${BUCKET_PREFIX}-clinical-images` : 'clinical-images';

const storage = new Storage({
  ...(process.env['GCS_PROJECT_ID'] && { projectId: process.env['GCS_PROJECT_ID'] }),
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
  const [contents] = await storage.bucket(BUCKET).file(key).download();
  return contents;
}

async function putBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await storage.bucket(BUCKET).file(key).save(buffer, {
    contentType,
    resumable: false,
    metadata: { contentType },
  });
}

function derivedKey(originalKey: string, variant: 'medium' | 'thumbnail', ext: string): string {
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
      logger.error({ err, objectKey }, 'Failed to load original from storage');
      await db.query(
        `UPDATE clinical.lesion_images
            SET processing_status = 'processing_failed',
                processing_error = $3,
                is_corrupted = TRUE
          WHERE id = $1 AND clinic_id = $2`,
        [imageId, clinicId, 'storage_unavailable'],
      );
      throw err;
    }

    try {
      const pipeline = sharp(original, { failOn: 'none' }).rotate();
      const meta     = await pipeline.metadata();

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
          .withMetadata({ exif: {} })
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
      await db.query(
        `UPDATE clinical.lesion_images
            SET processing_status = 'unprocessable',
                processing_error  = $3,
                is_corrupted      = TRUE
          WHERE id = $1 AND clinic_id = $2`,
        [imageId, clinicId, (err as Error).message.slice(0, 500)],
      );
    }
  };
}

import { Client as MinioClient } from 'minio';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export const CLINICAL_IMAGES_BUCKET = 'clinical-images';
export const PRESCRIPTIONS_BUCKET  = 'prescriptions';
export const PRODUCT_IMAGES_BUCKET  = 'product-images';
export const REPORTS_BUCKET         = 'reports';

export const minio = new MinioClient({
  endPoint:  env.MINIO_ENDPOINT,
  port:      env.MINIO_PORT,
  useSSL:    env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

async function ensureBucket(bucket: string): Promise<void> {
  try {
    const exists = await minio.bucketExists(bucket);
    if (!exists) {
      await minio.makeBucket(bucket);
      logger.info({ bucket }, 'Created MinIO bucket');
    }
  } catch (err) {
    logger.error({ err, bucket }, 'Failed to ensure MinIO bucket');
    throw err;
  }
}

/**
 * Cria o bucket clinical-images se ainda não existir.
 * Deve ser chamado no bootstrap da API (idempotente).
 */
export async function ensureClinicalImagesBucket(): Promise<void> {
  await ensureBucket(CLINICAL_IMAGES_BUCKET);
}

export async function ensurePrescriptionsBucket(): Promise<void> {
  await ensureBucket(PRESCRIPTIONS_BUCKET);
}

export async function ensureProductImagesBucket(): Promise<void> {
  await ensureBucket(PRODUCT_IMAGES_BUCKET);
}

export async function ensureReportsBucket(): Promise<void> {
  await ensureBucket(REPORTS_BUCKET);
}

/**
 * Gera URL temporária (presigned) para download da chave informada.
 * Nunca deve ser chamado sem prévia verificação de permissão do tenant.
 */
export async function presignGet(
  objectKey: string,
  ttlSeconds: number,
  bucket: string = CLINICAL_IMAGES_BUCKET,
): Promise<string> {
  return minio.presignedGetObject(bucket, objectKey, ttlSeconds);
}

export async function putObjectBuffer(
  objectKey: string,
  buffer:    Buffer,
  contentType: string,
  bucket: string = CLINICAL_IMAGES_BUCKET,
): Promise<void> {
  await minio.putObject(bucket, objectKey, buffer, buffer.length, {
    'Content-Type': contentType,
  });
}

export async function removeObject(
  objectKey: string,
  bucket: string = CLINICAL_IMAGES_BUCKET,
): Promise<void> {
  try {
    await minio.removeObject(bucket, objectKey);
  } catch (err) {
    logger.warn({ err, objectKey, bucket }, 'Failed to remove MinIO object');
  }
}

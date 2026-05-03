import { Storage } from '@google-cloud/storage';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const storage = new Storage({
  ...(env.GCS_PROJECT_ID && { projectId: env.GCS_PROJECT_ID }),
});

function bucketName(suffix: string): string {
  return env.GCS_BUCKET_PREFIX ? `${env.GCS_BUCKET_PREFIX}-${suffix}` : suffix;
}

export const CLINICAL_IMAGES_BUCKET = bucketName('clinical-images');
export const PRESCRIPTIONS_BUCKET = bucketName('prescriptions');
export const PRODUCT_IMAGES_BUCKET = bucketName('product-images');
export const REPORTS_BUCKET = bucketName('reports');
export const CLINIC_ASSETS_BUCKET = bucketName('clinic-assets');
export const AVATARS_BUCKET = bucketName('avatars');

export async function presignGet(
  objectKey: string,
  ttlSeconds: number,
  bucket: string = CLINICAL_IMAGES_BUCKET,
): Promise<string> {
  const [url] = await storage.bucket(bucket).file(objectKey).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + ttlSeconds * 1000,
  });
  return url;
}

export async function presignPut(
  objectKey: string,
  contentType: string,
  ttlSeconds: number,
  bucket: string = CLINICAL_IMAGES_BUCKET,
): Promise<string> {
  const [url] = await storage.bucket(bucket).file(objectKey).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + ttlSeconds * 1000,
    contentType,
  });
  return url;
}

export async function putObjectBuffer(
  objectKey: string,
  buffer: Buffer,
  contentType: string,
  bucket: string = CLINICAL_IMAGES_BUCKET,
): Promise<void> {
  const file = storage.bucket(bucket).file(objectKey);
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: { contentType },
  });
}

export async function getObjectBuffer(
  objectKey: string,
  bucket: string = CLINICAL_IMAGES_BUCKET,
): Promise<Buffer> {
  const [contents] = await storage.bucket(bucket).file(objectKey).download();
  return contents;
}

export async function removeObject(
  objectKey: string,
  bucket: string = CLINICAL_IMAGES_BUCKET,
): Promise<void> {
  try {
    await storage.bucket(bucket).file(objectKey).delete();
  } catch (err: any) {
    if (err?.code === 404) return;
    logger.warn({ err, objectKey, bucket }, 'Failed to remove storage object');
  }
}

export async function objectExists(
  objectKey: string,
  bucket: string = CLINICAL_IMAGES_BUCKET,
): Promise<boolean> {
  const [exists] = await storage.bucket(bucket).file(objectKey).exists();
  return exists;
}

export { storage };

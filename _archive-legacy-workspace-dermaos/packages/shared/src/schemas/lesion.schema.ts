import { z } from 'zod';

/**
 * Regiões anatômicas do Body Map (frente + costas).
 * Chaves usadas pelo frontend (SVG) E persistidas em clinical.lesions.location_body_map.
 */
export const BODY_REGIONS = [
  // Cabeça / pescoço
  'head_scalp', 'head_forehead', 'head_temple_left', 'head_temple_right',
  'face_cheek_left', 'face_cheek_right', 'face_nose', 'face_chin',
  'face_lip_upper', 'face_lip_lower', 'face_eyelid_left', 'face_eyelid_right',
  'face_ear_left', 'face_ear_right',
  'neck_front', 'neck_back',

  // Tronco anterior
  'chest_upper', 'chest_left', 'chest_right',
  'abdomen_upper', 'abdomen_lower', 'abdomen_left', 'abdomen_right',
  'pelvis_front',

  // Tronco posterior
  'back_upper', 'back_middle', 'back_lower', 'back_left', 'back_right',
  'gluteal_left', 'gluteal_right',

  // Membros superiores
  'shoulder_left', 'shoulder_right',
  'arm_upper_left', 'arm_upper_right',
  'elbow_left', 'elbow_right',
  'forearm_left', 'forearm_right',
  'wrist_left', 'wrist_right',
  'hand_dorsum_left', 'hand_dorsum_right',
  'hand_palm_left', 'hand_palm_right',
  'fingers_left', 'fingers_right',

  // Membros inferiores
  'thigh_anterior_left', 'thigh_anterior_right',
  'thigh_posterior_left', 'thigh_posterior_right',
  'knee_left', 'knee_right',
  'leg_anterior_left', 'leg_anterior_right',
  'leg_posterior_left', 'leg_posterior_right',
  'ankle_left', 'ankle_right',
  'foot_dorsum_left', 'foot_dorsum_right',
  'foot_sole_left', 'foot_sole_right',
] as const;

export type BodyRegion = (typeof BODY_REGIONS)[number];

export const bodyRegionSchema = z.enum(BODY_REGIONS);

export const lesionStatusSchema = z.enum(['active', 'monitoring', 'resolved']);
export type LesionStatus = z.infer<typeof lesionStatusSchema>;

export const imageProcessingStatusSchema = z.enum([
  'pending', 'processing', 'ready', 'processing_failed', 'unprocessable',
]);
export type ImageProcessingStatus = z.infer<typeof imageProcessingStatusSchema>;

export const captureTypeSchema = z.enum(['clinical', 'dermoscopy', 'macro']);
export type CaptureType = z.infer<typeof captureTypeSchema>;

/* ── Arquivos permitidos ─────────────────────────────────────────────────── */

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.webp'] as const;

export const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;    // 25 MB
export const MAX_UPLOAD_BATCH_SIZE = 10;
export const PRESIGNED_URL_TTL_SECONDS = 60 * 60;        // 1 hora

/* ── Create / Update ─────────────────────────────────────────────────────── */

export const createLesionSchema = z.object({
  patientId:    z.string().uuid('ID de paciente inválido'),
  bodyRegion:   bodyRegionSchema,
  description:  z.string()
                 .min(1, 'Descrição é obrigatória')
                 .max(2000, 'Descrição excede 2000 caracteres'),
  locationNotes: z.string().max(500).optional(),
  morphology:   z.array(z.string().max(60)).max(10).default([]),
  color:        z.array(z.string().max(40)).max(10).default([]),
  sizeMm:       z.number().min(0).max(999).optional(),
  firstNotedAt: z.coerce.date().optional(),
  reportedBy:   z.string().uuid('ID de profissional inválido'),
});
export type CreateLesionInput = z.infer<typeof createLesionSchema>;

export const updateLesionSchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    bodyRegion:   bodyRegionSchema.optional(),
    description:  z.string().min(1).max(2000).optional(),
    locationNotes: z.string().max(500).optional(),
    morphology:   z.array(z.string().max(60)).max(10).optional(),
    color:        z.array(z.string().max(40)).max(10).optional(),
    sizeMm:       z.number().min(0).max(999).nullable().optional(),
    firstNotedAt: z.coerce.date().nullable().optional(),
  }),
});
export type UpdateLesionInput = z.infer<typeof updateLesionSchema>;

export const resolveLesionSchema = z.object({
  id:     z.string().uuid(),
  reason: z.string().min(3, 'Motivo obrigatório').max(500),
});
export type ResolveLesionInput = z.infer<typeof resolveLesionSchema>;

export const reactivateLesionSchema = z.object({
  id:     z.string().uuid(),
  reason: z.string().min(3, 'Motivo obrigatório').max(500),
});
export type ReactivateLesionInput = z.infer<typeof reactivateLesionSchema>;

export const setMonitoringLesionSchema = z.object({
  id:     z.string().uuid(),
  reason: z.string().min(3, 'Motivo obrigatório').max(500),
});
export type SetMonitoringLesionInput = z.infer<typeof setMonitoringLesionSchema>;

export const deleteLesionSchema = z.object({
  id:     z.string().uuid(),
  reason: z.string().min(3, 'Motivo obrigatório').max(500),
});
export type DeleteLesionInput = z.infer<typeof deleteLesionSchema>;

/* ── Listings ────────────────────────────────────────────────────────────── */

export const listLesionsByPatientSchema = z.object({
  patientId: z.string().uuid(),
  status:    lesionStatusSchema.optional(),
  includeDeleted: z.boolean().default(false),
});
export type ListLesionsByPatientQuery = z.infer<typeof listLesionsByPatientSchema>;

export const getLesionByIdSchema = z.object({
  id: z.string().uuid(),
});

export const listLesionImagesSchema = z.object({
  lesionId: z.string().uuid(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});
export type ListLesionImagesQuery = z.infer<typeof listLesionImagesSchema>;

export const listPatientImagesSchema = z.object({
  patientId:   z.string().uuid(),
  lesionId:    z.string().uuid().optional(),
  captureType: captureTypeSchema.optional(),
  fromDate:    z.coerce.date().optional(),
  toDate:      z.coerce.date().optional(),
  page:        z.coerce.number().int().positive().default(1),
  pageSize:    z.coerce.number().int().positive().max(50).default(20),
});
export type ListPatientImagesQuery = z.infer<typeof listPatientImagesSchema>;

export const requestImageUrlSchema = z.object({
  imageId: z.string().uuid(),
  variant: z.enum(['original', 'medium', 'thumbnail']).default('medium'),
});
export type RequestImageUrlInput = z.infer<typeof requestImageUrlSchema>;

export const retryImageProcessingSchema = z.object({
  imageId: z.string().uuid(),
});

/* ── Upload metadata (multipart) ─────────────────────────────────────────── */

export const uploadImageMetadataSchema = z.object({
  lesionId:     z.string().uuid().optional(),
  patientId:    z.string().uuid(),
  bodyRegion:   bodyRegionSchema.optional(),
  description:  z.string().max(2000).optional(),
  captureType:  captureTypeSchema.default('clinical'),
  equipment:    z.string().max(100).optional(),
  magnification: z.string().max(50).optional(),
  encounterId:  z.string().uuid().optional(),
  notes:        z.string().max(2000).optional(),
});
export type UploadImageMetadata = z.infer<typeof uploadImageMetadataSchema>;

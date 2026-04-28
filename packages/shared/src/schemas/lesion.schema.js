"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImageMetadataSchema = exports.retryImageProcessingSchema = exports.requestImageUrlSchema = exports.listPatientImagesSchema = exports.listLesionImagesSchema = exports.getLesionByIdSchema = exports.listLesionsByPatientSchema = exports.deleteLesionSchema = exports.setMonitoringLesionSchema = exports.reactivateLesionSchema = exports.resolveLesionSchema = exports.updateLesionSchema = exports.createLesionSchema = exports.PRESIGNED_URL_TTL_SECONDS = exports.MAX_UPLOAD_BATCH_SIZE = exports.MAX_IMAGE_SIZE_BYTES = exports.ALLOWED_IMAGE_EXTENSIONS = exports.ALLOWED_IMAGE_MIME_TYPES = exports.captureTypeSchema = exports.imageProcessingStatusSchema = exports.lesionStatusSchema = exports.bodyRegionSchema = exports.BODY_REGIONS = void 0;
const zod_1 = require("zod");
/**
 * Regiões anatômicas do Body Map (frente + costas).
 * Chaves usadas pelo frontend (SVG) E persistidas em clinical.lesions.location_body_map.
 */
exports.BODY_REGIONS = [
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
];
exports.bodyRegionSchema = zod_1.z.enum(exports.BODY_REGIONS);
exports.lesionStatusSchema = zod_1.z.enum(['active', 'monitoring', 'resolved']);
exports.imageProcessingStatusSchema = zod_1.z.enum([
    'pending', 'processing', 'ready', 'processing_failed', 'unprocessable',
]);
exports.captureTypeSchema = zod_1.z.enum(['clinical', 'dermoscopy', 'macro']);
/* ── Arquivos permitidos ─────────────────────────────────────────────────── */
exports.ALLOWED_IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/webp',
];
exports.ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.webp'];
exports.MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
exports.MAX_UPLOAD_BATCH_SIZE = 10;
exports.PRESIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora
/* ── Create / Update ─────────────────────────────────────────────────────── */
exports.createLesionSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid('ID de paciente inválido'),
    bodyRegion: exports.bodyRegionSchema,
    description: zod_1.z.string()
        .min(1, 'Descrição é obrigatória')
        .max(2000, 'Descrição excede 2000 caracteres'),
    locationNotes: zod_1.z.string().max(500).optional(),
    morphology: zod_1.z.array(zod_1.z.string().max(60)).max(10).default([]),
    color: zod_1.z.array(zod_1.z.string().max(40)).max(10).default([]),
    sizeMm: zod_1.z.number().min(0).max(999).optional(),
    firstNotedAt: zod_1.z.coerce.date().optional(),
    reportedBy: zod_1.z.string().uuid('ID de profissional inválido'),
});
exports.updateLesionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    data: zod_1.z.object({
        bodyRegion: exports.bodyRegionSchema.optional(),
        description: zod_1.z.string().min(1).max(2000).optional(),
        locationNotes: zod_1.z.string().max(500).optional(),
        morphology: zod_1.z.array(zod_1.z.string().max(60)).max(10).optional(),
        color: zod_1.z.array(zod_1.z.string().max(40)).max(10).optional(),
        sizeMm: zod_1.z.number().min(0).max(999).nullable().optional(),
        firstNotedAt: zod_1.z.coerce.date().nullable().optional(),
    }),
});
exports.resolveLesionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reason: zod_1.z.string().min(3, 'Motivo obrigatório').max(500),
});
exports.reactivateLesionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reason: zod_1.z.string().min(3, 'Motivo obrigatório').max(500),
});
exports.setMonitoringLesionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reason: zod_1.z.string().min(3, 'Motivo obrigatório').max(500),
});
exports.deleteLesionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reason: zod_1.z.string().min(3, 'Motivo obrigatório').max(500),
});
/* ── Listings ────────────────────────────────────────────────────────────── */
exports.listLesionsByPatientSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid(),
    status: exports.lesionStatusSchema.optional(),
    includeDeleted: zod_1.z.boolean().default(false),
});
exports.getLesionByIdSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.listLesionImagesSchema = zod_1.z.object({
    lesionId: zod_1.z.string().uuid(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(50).default(20),
});
exports.listPatientImagesSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid(),
    lesionId: zod_1.z.string().uuid().optional(),
    captureType: exports.captureTypeSchema.optional(),
    fromDate: zod_1.z.coerce.date().optional(),
    toDate: zod_1.z.coerce.date().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(50).default(20),
});
exports.requestImageUrlSchema = zod_1.z.object({
    imageId: zod_1.z.string().uuid(),
    variant: zod_1.z.enum(['original', 'medium', 'thumbnail']).default('medium'),
});
exports.retryImageProcessingSchema = zod_1.z.object({
    imageId: zod_1.z.string().uuid(),
});
/* ── Upload metadata (multipart) ─────────────────────────────────────────── */
exports.uploadImageMetadataSchema = zod_1.z.object({
    lesionId: zod_1.z.string().uuid().optional(),
    patientId: zod_1.z.string().uuid(),
    bodyRegion: exports.bodyRegionSchema.optional(),
    description: zod_1.z.string().max(2000).optional(),
    captureType: exports.captureTypeSchema.default('clinical'),
    equipment: zod_1.z.string().max(100).optional(),
    magnification: zod_1.z.string().max(50).optional(),
    encounterId: zod_1.z.string().uuid().optional(),
    notes: zod_1.z.string().max(2000).optional(),
});
//# sourceMappingURL=lesion.schema.js.map
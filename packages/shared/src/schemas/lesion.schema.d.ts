import { z } from 'zod';
/**
 * Regiões anatômicas do Body Map (frente + costas).
 * Chaves usadas pelo frontend (SVG) E persistidas em clinical.lesions.location_body_map.
 */
export declare const BODY_REGIONS: readonly ["head_scalp", "head_forehead", "head_temple_left", "head_temple_right", "face_cheek_left", "face_cheek_right", "face_nose", "face_chin", "face_lip_upper", "face_lip_lower", "face_eyelid_left", "face_eyelid_right", "face_ear_left", "face_ear_right", "neck_front", "neck_back", "chest_upper", "chest_left", "chest_right", "abdomen_upper", "abdomen_lower", "abdomen_left", "abdomen_right", "pelvis_front", "back_upper", "back_middle", "back_lower", "back_left", "back_right", "gluteal_left", "gluteal_right", "shoulder_left", "shoulder_right", "arm_upper_left", "arm_upper_right", "elbow_left", "elbow_right", "forearm_left", "forearm_right", "wrist_left", "wrist_right", "hand_dorsum_left", "hand_dorsum_right", "hand_palm_left", "hand_palm_right", "fingers_left", "fingers_right", "thigh_anterior_left", "thigh_anterior_right", "thigh_posterior_left", "thigh_posterior_right", "knee_left", "knee_right", "leg_anterior_left", "leg_anterior_right", "leg_posterior_left", "leg_posterior_right", "ankle_left", "ankle_right", "foot_dorsum_left", "foot_dorsum_right", "foot_sole_left", "foot_sole_right"];
export type BodyRegion = (typeof BODY_REGIONS)[number];
export declare const bodyRegionSchema: z.ZodEnum<["head_scalp", "head_forehead", "head_temple_left", "head_temple_right", "face_cheek_left", "face_cheek_right", "face_nose", "face_chin", "face_lip_upper", "face_lip_lower", "face_eyelid_left", "face_eyelid_right", "face_ear_left", "face_ear_right", "neck_front", "neck_back", "chest_upper", "chest_left", "chest_right", "abdomen_upper", "abdomen_lower", "abdomen_left", "abdomen_right", "pelvis_front", "back_upper", "back_middle", "back_lower", "back_left", "back_right", "gluteal_left", "gluteal_right", "shoulder_left", "shoulder_right", "arm_upper_left", "arm_upper_right", "elbow_left", "elbow_right", "forearm_left", "forearm_right", "wrist_left", "wrist_right", "hand_dorsum_left", "hand_dorsum_right", "hand_palm_left", "hand_palm_right", "fingers_left", "fingers_right", "thigh_anterior_left", "thigh_anterior_right", "thigh_posterior_left", "thigh_posterior_right", "knee_left", "knee_right", "leg_anterior_left", "leg_anterior_right", "leg_posterior_left", "leg_posterior_right", "ankle_left", "ankle_right", "foot_dorsum_left", "foot_dorsum_right", "foot_sole_left", "foot_sole_right"]>;
export declare const lesionStatusSchema: z.ZodEnum<["active", "monitoring", "resolved"]>;
export type LesionStatus = z.infer<typeof lesionStatusSchema>;
export declare const imageProcessingStatusSchema: z.ZodEnum<["pending", "processing", "ready", "processing_failed", "unprocessable"]>;
export type ImageProcessingStatus = z.infer<typeof imageProcessingStatusSchema>;
export declare const captureTypeSchema: z.ZodEnum<["clinical", "dermoscopy", "macro"]>;
export type CaptureType = z.infer<typeof captureTypeSchema>;
export declare const ALLOWED_IMAGE_MIME_TYPES: readonly ["image/jpeg", "image/png", "image/heic", "image/webp"];
export declare const ALLOWED_IMAGE_EXTENSIONS: readonly [".jpg", ".jpeg", ".png", ".heic", ".webp"];
export declare const MAX_IMAGE_SIZE_BYTES: number;
export declare const MAX_UPLOAD_BATCH_SIZE = 10;
export declare const PRESIGNED_URL_TTL_SECONDS: number;
export declare const createLesionSchema: z.ZodObject<{
    patientId: z.ZodString;
    bodyRegion: z.ZodEnum<["head_scalp", "head_forehead", "head_temple_left", "head_temple_right", "face_cheek_left", "face_cheek_right", "face_nose", "face_chin", "face_lip_upper", "face_lip_lower", "face_eyelid_left", "face_eyelid_right", "face_ear_left", "face_ear_right", "neck_front", "neck_back", "chest_upper", "chest_left", "chest_right", "abdomen_upper", "abdomen_lower", "abdomen_left", "abdomen_right", "pelvis_front", "back_upper", "back_middle", "back_lower", "back_left", "back_right", "gluteal_left", "gluteal_right", "shoulder_left", "shoulder_right", "arm_upper_left", "arm_upper_right", "elbow_left", "elbow_right", "forearm_left", "forearm_right", "wrist_left", "wrist_right", "hand_dorsum_left", "hand_dorsum_right", "hand_palm_left", "hand_palm_right", "fingers_left", "fingers_right", "thigh_anterior_left", "thigh_anterior_right", "thigh_posterior_left", "thigh_posterior_right", "knee_left", "knee_right", "leg_anterior_left", "leg_anterior_right", "leg_posterior_left", "leg_posterior_right", "ankle_left", "ankle_right", "foot_dorsum_left", "foot_dorsum_right", "foot_sole_left", "foot_sole_right"]>;
    description: z.ZodString;
    locationNotes: z.ZodOptional<z.ZodString>;
    morphology: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    color: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sizeMm: z.ZodOptional<z.ZodNumber>;
    firstNotedAt: z.ZodOptional<z.ZodDate>;
    reportedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    patientId: string;
    description: string;
    bodyRegion: "head_scalp" | "head_forehead" | "head_temple_left" | "head_temple_right" | "face_cheek_left" | "face_cheek_right" | "face_nose" | "face_chin" | "face_lip_upper" | "face_lip_lower" | "face_eyelid_left" | "face_eyelid_right" | "face_ear_left" | "face_ear_right" | "neck_front" | "neck_back" | "chest_upper" | "chest_left" | "chest_right" | "abdomen_upper" | "abdomen_lower" | "abdomen_left" | "abdomen_right" | "pelvis_front" | "back_upper" | "back_middle" | "back_lower" | "back_left" | "back_right" | "gluteal_left" | "gluteal_right" | "shoulder_left" | "shoulder_right" | "arm_upper_left" | "arm_upper_right" | "elbow_left" | "elbow_right" | "forearm_left" | "forearm_right" | "wrist_left" | "wrist_right" | "hand_dorsum_left" | "hand_dorsum_right" | "hand_palm_left" | "hand_palm_right" | "fingers_left" | "fingers_right" | "thigh_anterior_left" | "thigh_anterior_right" | "thigh_posterior_left" | "thigh_posterior_right" | "knee_left" | "knee_right" | "leg_anterior_left" | "leg_anterior_right" | "leg_posterior_left" | "leg_posterior_right" | "ankle_left" | "ankle_right" | "foot_dorsum_left" | "foot_dorsum_right" | "foot_sole_left" | "foot_sole_right";
    morphology: string[];
    color: string[];
    reportedBy: string;
    locationNotes?: string | undefined;
    sizeMm?: number | undefined;
    firstNotedAt?: Date | undefined;
}, {
    patientId: string;
    description: string;
    bodyRegion: "head_scalp" | "head_forehead" | "head_temple_left" | "head_temple_right" | "face_cheek_left" | "face_cheek_right" | "face_nose" | "face_chin" | "face_lip_upper" | "face_lip_lower" | "face_eyelid_left" | "face_eyelid_right" | "face_ear_left" | "face_ear_right" | "neck_front" | "neck_back" | "chest_upper" | "chest_left" | "chest_right" | "abdomen_upper" | "abdomen_lower" | "abdomen_left" | "abdomen_right" | "pelvis_front" | "back_upper" | "back_middle" | "back_lower" | "back_left" | "back_right" | "gluteal_left" | "gluteal_right" | "shoulder_left" | "shoulder_right" | "arm_upper_left" | "arm_upper_right" | "elbow_left" | "elbow_right" | "forearm_left" | "forearm_right" | "wrist_left" | "wrist_right" | "hand_dorsum_left" | "hand_dorsum_right" | "hand_palm_left" | "hand_palm_right" | "fingers_left" | "fingers_right" | "thigh_anterior_left" | "thigh_anterior_right" | "thigh_posterior_left" | "thigh_posterior_right" | "knee_left" | "knee_right" | "leg_anterior_left" | "leg_anterior_right" | "leg_posterior_left" | "leg_posterior_right" | "ankle_left" | "ankle_right" | "foot_dorsum_left" | "foot_dorsum_right" | "foot_sole_left" | "foot_sole_right";
    reportedBy: string;
    locationNotes?: string | undefined;
    morphology?: string[] | undefined;
    color?: string[] | undefined;
    sizeMm?: number | undefined;
    firstNotedAt?: Date | undefined;
}>;
export type CreateLesionInput = z.infer<typeof createLesionSchema>;
export declare const updateLesionSchema: z.ZodObject<{
    id: z.ZodString;
    data: z.ZodObject<{
        bodyRegion: z.ZodOptional<z.ZodEnum<["head_scalp", "head_forehead", "head_temple_left", "head_temple_right", "face_cheek_left", "face_cheek_right", "face_nose", "face_chin", "face_lip_upper", "face_lip_lower", "face_eyelid_left", "face_eyelid_right", "face_ear_left", "face_ear_right", "neck_front", "neck_back", "chest_upper", "chest_left", "chest_right", "abdomen_upper", "abdomen_lower", "abdomen_left", "abdomen_right", "pelvis_front", "back_upper", "back_middle", "back_lower", "back_left", "back_right", "gluteal_left", "gluteal_right", "shoulder_left", "shoulder_right", "arm_upper_left", "arm_upper_right", "elbow_left", "elbow_right", "forearm_left", "forearm_right", "wrist_left", "wrist_right", "hand_dorsum_left", "hand_dorsum_right", "hand_palm_left", "hand_palm_right", "fingers_left", "fingers_right", "thigh_anterior_left", "thigh_anterior_right", "thigh_posterior_left", "thigh_posterior_right", "knee_left", "knee_right", "leg_anterior_left", "leg_anterior_right", "leg_posterior_left", "leg_posterior_right", "ankle_left", "ankle_right", "foot_dorsum_left", "foot_dorsum_right", "foot_sole_left", "foot_sole_right"]>>;
        description: z.ZodOptional<z.ZodString>;
        locationNotes: z.ZodOptional<z.ZodString>;
        morphology: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        color: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sizeMm: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        firstNotedAt: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
        bodyRegion?: "head_scalp" | "head_forehead" | "head_temple_left" | "head_temple_right" | "face_cheek_left" | "face_cheek_right" | "face_nose" | "face_chin" | "face_lip_upper" | "face_lip_lower" | "face_eyelid_left" | "face_eyelid_right" | "face_ear_left" | "face_ear_right" | "neck_front" | "neck_back" | "chest_upper" | "chest_left" | "chest_right" | "abdomen_upper" | "abdomen_lower" | "abdomen_left" | "abdomen_right" | "pelvis_front" | "back_upper" | "back_middle" | "back_lower" | "back_left" | "back_right" | "gluteal_left" | "gluteal_right" | "shoulder_left" | "shoulder_right" | "arm_upper_left" | "arm_upper_right" | "elbow_left" | "elbow_right" | "forearm_left" | "forearm_right" | "wrist_left" | "wrist_right" | "hand_dorsum_left" | "hand_dorsum_right" | "hand_palm_left" | "hand_palm_right" | "fingers_left" | "fingers_right" | "thigh_anterior_left" | "thigh_anterior_right" | "thigh_posterior_left" | "thigh_posterior_right" | "knee_left" | "knee_right" | "leg_anterior_left" | "leg_anterior_right" | "leg_posterior_left" | "leg_posterior_right" | "ankle_left" | "ankle_right" | "foot_dorsum_left" | "foot_dorsum_right" | "foot_sole_left" | "foot_sole_right" | undefined;
        locationNotes?: string | undefined;
        morphology?: string[] | undefined;
        color?: string[] | undefined;
        sizeMm?: number | null | undefined;
        firstNotedAt?: Date | null | undefined;
    }, {
        description?: string | undefined;
        bodyRegion?: "head_scalp" | "head_forehead" | "head_temple_left" | "head_temple_right" | "face_cheek_left" | "face_cheek_right" | "face_nose" | "face_chin" | "face_lip_upper" | "face_lip_lower" | "face_eyelid_left" | "face_eyelid_right" | "face_ear_left" | "face_ear_right" | "neck_front" | "neck_back" | "chest_upper" | "chest_left" | "chest_right" | "abdomen_upper" | "abdomen_lower" | "abdomen_left" | "abdomen_right" | "pelvis_front" | "back_upper" | "back_middle" | "back_lower" | "back_left" | "back_right" | "gluteal_left" | "gluteal_right" | "shoulder_left" | "shoulder_right" | "arm_upper_left" | "arm_upper_right" | "elbow_left" | "elbow_right" | "forearm_left" | "forearm_right" | "wrist_left" | "wrist_right" | "hand_dorsum_left" | "hand_dorsum_right" | "hand_palm_left" | "hand_palm_right" | "fingers_left" | "fingers_right" | "thigh_anterior_left" | "thigh_anterior_right" | "thigh_posterior_left" | "thigh_posterior_right" | "knee_left" | "knee_right" | "leg_anterior_left" | "leg_anterior_right" | "leg_posterior_left" | "leg_posterior_right" | "ankle_left" | "ankle_right" | "foot_dorsum_left" | "foot_dorsum_right" | "foot_sole_left" | "foot_sole_right" | undefined;
        locationNotes?: string | undefined;
        morphology?: string[] | undefined;
        color?: string[] | undefined;
        sizeMm?: number | null | undefined;
        firstNotedAt?: Date | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    data: {
        description?: string | undefined;
        bodyRegion?: "head_scalp" | "head_forehead" | "head_temple_left" | "head_temple_right" | "face_cheek_left" | "face_cheek_right" | "face_nose" | "face_chin" | "face_lip_upper" | "face_lip_lower" | "face_eyelid_left" | "face_eyelid_right" | "face_ear_left" | "face_ear_right" | "neck_front" | "neck_back" | "chest_upper" | "chest_left" | "chest_right" | "abdomen_upper" | "abdomen_lower" | "abdomen_left" | "abdomen_right" | "pelvis_front" | "back_upper" | "back_middle" | "back_lower" | "back_left" | "back_right" | "gluteal_left" | "gluteal_right" | "shoulder_left" | "shoulder_right" | "arm_upper_left" | "arm_upper_right" | "elbow_left" | "elbow_right" | "forearm_left" | "forearm_right" | "wrist_left" | "wrist_right" | "hand_dorsum_left" | "hand_dorsum_right" | "hand_palm_left" | "hand_palm_right" | "fingers_left" | "fingers_right" | "thigh_anterior_left" | "thigh_anterior_right" | "thigh_posterior_left" | "thigh_posterior_right" | "knee_left" | "knee_right" | "leg_anterior_left" | "leg_anterior_right" | "leg_posterior_left" | "leg_posterior_right" | "ankle_left" | "ankle_right" | "foot_dorsum_left" | "foot_dorsum_right" | "foot_sole_left" | "foot_sole_right" | undefined;
        locationNotes?: string | undefined;
        morphology?: string[] | undefined;
        color?: string[] | undefined;
        sizeMm?: number | null | undefined;
        firstNotedAt?: Date | null | undefined;
    };
}, {
    id: string;
    data: {
        description?: string | undefined;
        bodyRegion?: "head_scalp" | "head_forehead" | "head_temple_left" | "head_temple_right" | "face_cheek_left" | "face_cheek_right" | "face_nose" | "face_chin" | "face_lip_upper" | "face_lip_lower" | "face_eyelid_left" | "face_eyelid_right" | "face_ear_left" | "face_ear_right" | "neck_front" | "neck_back" | "chest_upper" | "chest_left" | "chest_right" | "abdomen_upper" | "abdomen_lower" | "abdomen_left" | "abdomen_right" | "pelvis_front" | "back_upper" | "back_middle" | "back_lower" | "back_left" | "back_right" | "gluteal_left" | "gluteal_right" | "shoulder_left" | "shoulder_right" | "arm_upper_left" | "arm_upper_right" | "elbow_left" | "elbow_right" | "forearm_left" | "forearm_right" | "wrist_left" | "wrist_right" | "hand_dorsum_left" | "hand_dorsum_right" | "hand_palm_left" | "hand_palm_right" | "fingers_left" | "fingers_right" | "thigh_anterior_left" | "thigh_anterior_right" | "thigh_posterior_left" | "thigh_posterior_right" | "knee_left" | "knee_right" | "leg_anterior_left" | "leg_anterior_right" | "leg_posterior_left" | "leg_posterior_right" | "ankle_left" | "ankle_right" | "foot_dorsum_left" | "foot_dorsum_right" | "foot_sole_left" | "foot_sole_right" | undefined;
        locationNotes?: string | undefined;
        morphology?: string[] | undefined;
        color?: string[] | undefined;
        sizeMm?: number | null | undefined;
        firstNotedAt?: Date | null | undefined;
    };
}>;
export type UpdateLesionInput = z.infer<typeof updateLesionSchema>;
export declare const resolveLesionSchema: z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    id: string;
}, {
    reason: string;
    id: string;
}>;
export type ResolveLesionInput = z.infer<typeof resolveLesionSchema>;
export declare const reactivateLesionSchema: z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    id: string;
}, {
    reason: string;
    id: string;
}>;
export type ReactivateLesionInput = z.infer<typeof reactivateLesionSchema>;
export declare const setMonitoringLesionSchema: z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    id: string;
}, {
    reason: string;
    id: string;
}>;
export type SetMonitoringLesionInput = z.infer<typeof setMonitoringLesionSchema>;
export declare const deleteLesionSchema: z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    id: string;
}, {
    reason: string;
    id: string;
}>;
export type DeleteLesionInput = z.infer<typeof deleteLesionSchema>;
export declare const listLesionsByPatientSchema: z.ZodObject<{
    patientId: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["active", "monitoring", "resolved"]>>;
    includeDeleted: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    patientId: string;
    includeDeleted: boolean;
    status?: "active" | "monitoring" | "resolved" | undefined;
}, {
    patientId: string;
    status?: "active" | "monitoring" | "resolved" | undefined;
    includeDeleted?: boolean | undefined;
}>;
export type ListLesionsByPatientQuery = z.infer<typeof listLesionsByPatientSchema>;
export declare const getLesionByIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const listLesionImagesSchema: z.ZodObject<{
    lesionId: z.ZodString;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    lesionId: string;
}, {
    lesionId: string;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type ListLesionImagesQuery = z.infer<typeof listLesionImagesSchema>;
export declare const listPatientImagesSchema: z.ZodObject<{
    patientId: z.ZodString;
    lesionId: z.ZodOptional<z.ZodString>;
    captureType: z.ZodOptional<z.ZodEnum<["clinical", "dermoscopy", "macro"]>>;
    fromDate: z.ZodOptional<z.ZodDate>;
    toDate: z.ZodOptional<z.ZodDate>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    patientId: string;
    lesionId?: string | undefined;
    captureType?: "clinical" | "dermoscopy" | "macro" | undefined;
    fromDate?: Date | undefined;
    toDate?: Date | undefined;
}, {
    patientId: string;
    page?: number | undefined;
    pageSize?: number | undefined;
    lesionId?: string | undefined;
    captureType?: "clinical" | "dermoscopy" | "macro" | undefined;
    fromDate?: Date | undefined;
    toDate?: Date | undefined;
}>;
export type ListPatientImagesQuery = z.infer<typeof listPatientImagesSchema>;
export declare const requestImageUrlSchema: z.ZodObject<{
    imageId: z.ZodString;
    variant: z.ZodDefault<z.ZodEnum<["original", "medium", "thumbnail"]>>;
}, "strip", z.ZodTypeAny, {
    imageId: string;
    variant: "original" | "medium" | "thumbnail";
}, {
    imageId: string;
    variant?: "original" | "medium" | "thumbnail" | undefined;
}>;
export type RequestImageUrlInput = z.infer<typeof requestImageUrlSchema>;
export declare const retryImageProcessingSchema: z.ZodObject<{
    imageId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    imageId: string;
}, {
    imageId: string;
}>;
export declare const uploadImageMetadataSchema: z.ZodObject<{
    lesionId: z.ZodOptional<z.ZodString>;
    patientId: z.ZodString;
    bodyRegion: z.ZodOptional<z.ZodEnum<["head_scalp", "head_forehead", "head_temple_left", "head_temple_right", "face_cheek_left", "face_cheek_right", "face_nose", "face_chin", "face_lip_upper", "face_lip_lower", "face_eyelid_left", "face_eyelid_right", "face_ear_left", "face_ear_right", "neck_front", "neck_back", "chest_upper", "chest_left", "chest_right", "abdomen_upper", "abdomen_lower", "abdomen_left", "abdomen_right", "pelvis_front", "back_upper", "back_middle", "back_lower", "back_left", "back_right", "gluteal_left", "gluteal_right", "shoulder_left", "shoulder_right", "arm_upper_left", "arm_upper_right", "elbow_left", "elbow_right", "forearm_left", "forearm_right", "wrist_left", "wrist_right", "hand_dorsum_left", "hand_dorsum_right", "hand_palm_left", "hand_palm_right", "fingers_left", "fingers_right", "thigh_anterior_left", "thigh_anterior_right", "thigh_posterior_left", "thigh_posterior_right", "knee_left", "knee_right", "leg_anterior_left", "leg_anterior_right", "leg_posterior_left", "leg_posterior_right", "ankle_left", "ankle_right", "foot_dorsum_left", "foot_dorsum_right", "foot_sole_left", "foot_sole_right"]>>;
    description: z.ZodOptional<z.ZodString>;
    captureType: z.ZodDefault<z.ZodEnum<["clinical", "dermoscopy", "macro"]>>;
    equipment: z.ZodOptional<z.ZodString>;
    magnification: z.ZodOptional<z.ZodString>;
    encounterId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    patientId: string;
    captureType: "clinical" | "dermoscopy" | "macro";
    notes?: string | undefined;
    description?: string | undefined;
    bodyRegion?: "head_scalp" | "head_forehead" | "head_temple_left" | "head_temple_right" | "face_cheek_left" | "face_cheek_right" | "face_nose" | "face_chin" | "face_lip_upper" | "face_lip_lower" | "face_eyelid_left" | "face_eyelid_right" | "face_ear_left" | "face_ear_right" | "neck_front" | "neck_back" | "chest_upper" | "chest_left" | "chest_right" | "abdomen_upper" | "abdomen_lower" | "abdomen_left" | "abdomen_right" | "pelvis_front" | "back_upper" | "back_middle" | "back_lower" | "back_left" | "back_right" | "gluteal_left" | "gluteal_right" | "shoulder_left" | "shoulder_right" | "arm_upper_left" | "arm_upper_right" | "elbow_left" | "elbow_right" | "forearm_left" | "forearm_right" | "wrist_left" | "wrist_right" | "hand_dorsum_left" | "hand_dorsum_right" | "hand_palm_left" | "hand_palm_right" | "fingers_left" | "fingers_right" | "thigh_anterior_left" | "thigh_anterior_right" | "thigh_posterior_left" | "thigh_posterior_right" | "knee_left" | "knee_right" | "leg_anterior_left" | "leg_anterior_right" | "leg_posterior_left" | "leg_posterior_right" | "ankle_left" | "ankle_right" | "foot_dorsum_left" | "foot_dorsum_right" | "foot_sole_left" | "foot_sole_right" | undefined;
    lesionId?: string | undefined;
    equipment?: string | undefined;
    magnification?: string | undefined;
    encounterId?: string | undefined;
}, {
    patientId: string;
    notes?: string | undefined;
    description?: string | undefined;
    bodyRegion?: "head_scalp" | "head_forehead" | "head_temple_left" | "head_temple_right" | "face_cheek_left" | "face_cheek_right" | "face_nose" | "face_chin" | "face_lip_upper" | "face_lip_lower" | "face_eyelid_left" | "face_eyelid_right" | "face_ear_left" | "face_ear_right" | "neck_front" | "neck_back" | "chest_upper" | "chest_left" | "chest_right" | "abdomen_upper" | "abdomen_lower" | "abdomen_left" | "abdomen_right" | "pelvis_front" | "back_upper" | "back_middle" | "back_lower" | "back_left" | "back_right" | "gluteal_left" | "gluteal_right" | "shoulder_left" | "shoulder_right" | "arm_upper_left" | "arm_upper_right" | "elbow_left" | "elbow_right" | "forearm_left" | "forearm_right" | "wrist_left" | "wrist_right" | "hand_dorsum_left" | "hand_dorsum_right" | "hand_palm_left" | "hand_palm_right" | "fingers_left" | "fingers_right" | "thigh_anterior_left" | "thigh_anterior_right" | "thigh_posterior_left" | "thigh_posterior_right" | "knee_left" | "knee_right" | "leg_anterior_left" | "leg_anterior_right" | "leg_posterior_left" | "leg_posterior_right" | "ankle_left" | "ankle_right" | "foot_dorsum_left" | "foot_dorsum_right" | "foot_sole_left" | "foot_sole_right" | undefined;
    lesionId?: string | undefined;
    captureType?: "clinical" | "dermoscopy" | "macro" | undefined;
    equipment?: string | undefined;
    magnification?: string | undefined;
    encounterId?: string | undefined;
}>;
export type UploadImageMetadata = z.infer<typeof uploadImageMetadataSchema>;
//# sourceMappingURL=lesion.schema.d.ts.map
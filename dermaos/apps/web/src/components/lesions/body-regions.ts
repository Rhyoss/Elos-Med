import type { BodyRegion } from '@dermaos/shared';

export interface BodyRegionDef {
  key:    BodyRegion;
  label:  string;
  view:   'front' | 'back';
  /** Coordenadas em porcentagem do SVG 0-100 (x, y, raio) para hit-targets circulares. */
  cx:     number;
  cy:     number;
  r:      number;
}

/**
 * Mapa de hit-targets. Para um Body Map 100% preciso, substituir por <path>
 * com SVG anatômico — mantemos targets circulares para começar com boa cobertura.
 */
export const BODY_REGION_DEFS: BodyRegionDef[] = [
  // ── Frente ─────────────────────────────────────────────────────────────
  { key: 'head_scalp',         label: 'Couro cabeludo',       view: 'front', cx: 50, cy: 5,  r: 3.5 },
  { key: 'head_forehead',      label: 'Testa',                view: 'front', cx: 50, cy: 8.5, r: 2.6 },
  { key: 'face_eyelid_left',   label: 'Pálpebra esq.',        view: 'front', cx: 47, cy: 10.8, r: 1.3 },
  { key: 'face_eyelid_right',  label: 'Pálpebra dir.',        view: 'front', cx: 53, cy: 10.8, r: 1.3 },
  { key: 'face_nose',          label: 'Nariz',                view: 'front', cx: 50, cy: 12.3, r: 1.4 },
  { key: 'face_cheek_left',    label: 'Bochecha esq.',        view: 'front', cx: 46, cy: 13.3, r: 1.8 },
  { key: 'face_cheek_right',   label: 'Bochecha dir.',        view: 'front', cx: 54, cy: 13.3, r: 1.8 },
  { key: 'face_lip_upper',     label: 'Lábio sup.',           view: 'front', cx: 50, cy: 14.5, r: 1.1 },
  { key: 'face_lip_lower',     label: 'Lábio inf.',           view: 'front', cx: 50, cy: 15.5, r: 1.1 },
  { key: 'face_chin',          label: 'Queixo',               view: 'front', cx: 50, cy: 17,   r: 1.4 },
  { key: 'face_ear_left',      label: 'Orelha esq.',          view: 'front', cx: 42, cy: 12.5, r: 1.5 },
  { key: 'face_ear_right',     label: 'Orelha dir.',          view: 'front', cx: 58, cy: 12.5, r: 1.5 },
  { key: 'neck_front',         label: 'Pescoço (frente)',     view: 'front', cx: 50, cy: 19.5, r: 2.2 },

  { key: 'shoulder_left',      label: 'Ombro esq.',           view: 'front', cx: 39, cy: 23,   r: 2.5 },
  { key: 'shoulder_right',     label: 'Ombro dir.',           view: 'front', cx: 61, cy: 23,   r: 2.5 },
  { key: 'chest_upper',        label: 'Tórax sup.',           view: 'front', cx: 50, cy: 25,   r: 2.5 },
  { key: 'chest_left',         label: 'Tórax esq.',           view: 'front', cx: 45, cy: 27,   r: 2.3 },
  { key: 'chest_right',        label: 'Tórax dir.',           view: 'front', cx: 55, cy: 27,   r: 2.3 },
  { key: 'abdomen_upper',      label: 'Abdome sup.',          view: 'front', cx: 50, cy: 32,   r: 2.5 },
  { key: 'abdomen_left',       label: 'Abdome esq.',          view: 'front', cx: 44, cy: 34,   r: 2.4 },
  { key: 'abdomen_right',      label: 'Abdome dir.',          view: 'front', cx: 56, cy: 34,   r: 2.4 },
  { key: 'abdomen_lower',      label: 'Abdome inf.',          view: 'front', cx: 50, cy: 37,   r: 2.5 },
  { key: 'pelvis_front',       label: 'Pelve',                view: 'front', cx: 50, cy: 42,   r: 2.5 },

  { key: 'arm_upper_left',     label: 'Braço esq.',           view: 'front', cx: 33, cy: 30,   r: 2.4 },
  { key: 'arm_upper_right',    label: 'Braço dir.',           view: 'front', cx: 67, cy: 30,   r: 2.4 },
  { key: 'elbow_left',         label: 'Cotovelo esq.',        view: 'front', cx: 30, cy: 37,   r: 1.9 },
  { key: 'elbow_right',        label: 'Cotovelo dir.',        view: 'front', cx: 70, cy: 37,   r: 1.9 },
  { key: 'forearm_left',       label: 'Antebraço esq.',       view: 'front', cx: 28, cy: 43,   r: 2.1 },
  { key: 'forearm_right',      label: 'Antebraço dir.',       view: 'front', cx: 72, cy: 43,   r: 2.1 },
  { key: 'wrist_left',         label: 'Punho esq.',           view: 'front', cx: 25, cy: 49,   r: 1.3 },
  { key: 'wrist_right',        label: 'Punho dir.',           view: 'front', cx: 75, cy: 49,   r: 1.3 },
  { key: 'hand_dorsum_left',   label: 'Mão esq. (dorso)',     view: 'front', cx: 23, cy: 53,   r: 1.8 },
  { key: 'hand_dorsum_right',  label: 'Mão dir. (dorso)',     view: 'front', cx: 77, cy: 53,   r: 1.8 },
  { key: 'fingers_left',       label: 'Dedos esq.',           view: 'front', cx: 21, cy: 57,   r: 1.4 },
  { key: 'fingers_right',      label: 'Dedos dir.',           view: 'front', cx: 79, cy: 57,   r: 1.4 },

  { key: 'thigh_anterior_left',  label: 'Coxa ant. esq.',     view: 'front', cx: 45, cy: 52,   r: 2.5 },
  { key: 'thigh_anterior_right', label: 'Coxa ant. dir.',     view: 'front', cx: 55, cy: 52,   r: 2.5 },
  { key: 'knee_left',          label: 'Joelho esq.',          view: 'front', cx: 45, cy: 63,   r: 2   },
  { key: 'knee_right',         label: 'Joelho dir.',          view: 'front', cx: 55, cy: 63,   r: 2   },
  { key: 'leg_anterior_left',  label: 'Perna ant. esq.',      view: 'front', cx: 45, cy: 73,   r: 2.2 },
  { key: 'leg_anterior_right', label: 'Perna ant. dir.',      view: 'front', cx: 55, cy: 73,   r: 2.2 },
  { key: 'ankle_left',         label: 'Tornozelo esq.',       view: 'front', cx: 45, cy: 86,   r: 1.6 },
  { key: 'ankle_right',        label: 'Tornozelo dir.',       view: 'front', cx: 55, cy: 86,   r: 1.6 },
  { key: 'foot_dorsum_left',   label: 'Pé esq. (dorso)',      view: 'front', cx: 44, cy: 92,   r: 1.8 },
  { key: 'foot_dorsum_right',  label: 'Pé dir. (dorso)',      view: 'front', cx: 56, cy: 92,   r: 1.8 },

  // ── Costas ─────────────────────────────────────────────────────────────
  { key: 'head_temple_left',    label: 'Têmpora esq.',        view: 'back',  cx: 47, cy: 8,    r: 1.5 },
  { key: 'head_temple_right',   label: 'Têmpora dir.',        view: 'back',  cx: 53, cy: 8,    r: 1.5 },
  { key: 'neck_back',           label: 'Nuca',                view: 'back',  cx: 50, cy: 19,   r: 2.2 },

  { key: 'back_upper',          label: 'Costas sup.',         view: 'back',  cx: 50, cy: 25,   r: 2.6 },
  { key: 'back_left',           label: 'Costas esq.',         view: 'back',  cx: 44, cy: 29,   r: 2.4 },
  { key: 'back_right',          label: 'Costas dir.',         view: 'back',  cx: 56, cy: 29,   r: 2.4 },
  { key: 'back_middle',         label: 'Costas méd.',         view: 'back',  cx: 50, cy: 33,   r: 2.4 },
  { key: 'back_lower',          label: 'Lombar',              view: 'back',  cx: 50, cy: 39,   r: 2.4 },
  { key: 'gluteal_left',        label: 'Glúteo esq.',         view: 'back',  cx: 46, cy: 45,   r: 2.3 },
  { key: 'gluteal_right',       label: 'Glúteo dir.',         view: 'back',  cx: 54, cy: 45,   r: 2.3 },

  { key: 'thigh_posterior_left',  label: 'Coxa post. esq.',   view: 'back',  cx: 45, cy: 52,   r: 2.5 },
  { key: 'thigh_posterior_right', label: 'Coxa post. dir.',   view: 'back',  cx: 55, cy: 52,   r: 2.5 },
  { key: 'leg_posterior_left',    label: 'Panturrilha esq.',  view: 'back',  cx: 45, cy: 73,   r: 2.2 },
  { key: 'leg_posterior_right',   label: 'Panturrilha dir.',  view: 'back',  cx: 55, cy: 73,   r: 2.2 },
  { key: 'foot_sole_left',        label: 'Planta esq.',       view: 'back',  cx: 44, cy: 92,   r: 1.8 },
  { key: 'foot_sole_right',       label: 'Planta dir.',       view: 'back',  cx: 56, cy: 92,   r: 1.8 },
  { key: 'hand_palm_left',        label: 'Mão esq. (palma)',  view: 'back',  cx: 23, cy: 53,   r: 1.8 },
  { key: 'hand_palm_right',       label: 'Mão dir. (palma)',  view: 'back',  cx: 77, cy: 53,   r: 1.8 },
];

export function getRegionDef(key: string): BodyRegionDef | undefined {
  return BODY_REGION_DEFS.find((r) => r.key === key);
}

export function regionLabel(key: string): string {
  return getRegionDef(key)?.label ?? key;
}

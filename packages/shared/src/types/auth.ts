import type { UserRole } from '../constants/roles';

export interface JWTPayload {
  sub: string;
  clinicId: string;
  email: string;
  role: UserRole;
  name: string;
  iat?: number;
  exp?: number;
}

export interface SessionClinic {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface SessionUser {
  id: string;
  clinicId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  crm: string | null;
  specialty: string | null;
}

export interface Session {
  user: SessionUser;
  clinic: SessionClinic;
  expiresAt: Date;
}

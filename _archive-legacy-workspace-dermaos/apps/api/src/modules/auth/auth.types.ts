export interface JwtUser {
  sub: string;        // user UUID
  clinicId: string;
  email: string;
  role: string;
  name: string;
  iat?: number;
  exp?: number;
}

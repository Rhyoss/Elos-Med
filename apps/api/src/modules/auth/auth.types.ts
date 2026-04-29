export interface JwtUser {
  sub: string;        // user UUID
  clinicId: string;
  email: string;
  role: string;
  name: string;

  // SEC-14: jti único por sessão (rotacionado em cada refresh) e
  // password_version — se a senha mudar, todos os tokens emitidos antes
  // ficam inválidos imediatamente sem precisar derrubar via Redis.
  jti?: string;
  pv?: number;

  // Padrões JWT
  iat?: number;
  exp?: number;
  aud?: string | string[];
  iss?: string;
}

/**
 * Token do Patient Portal — payload distinto, audience separada.
 * SEC-21.
 */
export interface PatientJwt {
  sub: string;        // patient UUID
  clinicId: string;
  email: string;
  jti?: string;
  iat?: number;
  exp?: number;
  aud?: string | string[];
  iss?: string;
}

// Tipos de resposta padronizados para a API DermaOS

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

// Tipos de entidade base

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditableEntity extends BaseEntity {
  createdBy: string | null;
}

// Address JSONB

export interface Address {
  street?:     string;
  number?:     string;
  complement?: string;
  district?:   string;
  city?:       string;
  state?:      string;
  zip?:        string;
}

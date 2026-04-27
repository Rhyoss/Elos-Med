// API client para o Portal do Paciente.
// Tokens são armazenados APENAS em cookies httpOnly — nunca em localStorage.
// Implementa refresh token transparente (401 → refresh → retry).

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const PORTAL_BASE = `${API_BASE}/portal`;

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
}

let isRefreshing = false;
let refreshQueue: Array<() => void> = [];

async function refreshTokens(): Promise<boolean> {
  try {
    const res = await fetch(`${PORTAL_BASE}/auth/refresh`, {
      method:      'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = path.startsWith('http') ? path : `${PORTAL_BASE}${path}`;

  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  let res = await fetch(url, fetchOptions);

  // Refresh token automático ao receber 401
  if (res.status === 401) {
    if (isRefreshing) {
      // Enfileirar para depois que o refresh terminar
      return new Promise((resolve) => {
        refreshQueue.push(async () => {
          const retryRes = await fetch(url, fetchOptions);
          const data = retryRes.ok ? await retryRes.json().catch(() => null) : null;
          resolve({ data, status: retryRes.status, ok: retryRes.ok });
        });
      });
    }

    isRefreshing = true;
    const refreshed = await refreshTokens();
    isRefreshing = false;

    // Processar fila
    const queue = refreshQueue;
    refreshQueue = [];
    queue.forEach((fn) => fn());

    if (!refreshed) {
      // Sessão expirada — redirecionar para login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return { status: 401, ok: false, error: 'Sessão expirada.' };
    }

    // Retry da requisição original
    res = await fetch(url, fetchOptions);
  }

  const responseData = res.status !== 204
    ? await res.json().catch(() => null)
    : null;

  return {
    data:   res.ok ? (responseData as T) : undefined,
    error:  !res.ok ? (responseData?.error ?? 'Erro inesperado. Tente novamente.') : undefined,
    status: res.status,
    ok:     res.ok,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const portalAuth = {
  login: (data: { email: string; password: string; clinicSlug: string; captchaToken?: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: () =>
    request('/auth/logout', { method: 'POST' }),

  refresh: () =>
    request('/auth/refresh', { method: 'POST' }),

  me: () =>
    request<{ patientId: string; email: string; emailVerified: boolean }>('/auth/me'),

  requestMagicLink: (data: { email: string; clinicSlug: string }) =>
    request('/auth/magic-link', { method: 'POST', body: JSON.stringify(data) }),

  validateMagicLink: (token: string) =>
    request<{ valid: boolean; purpose: string }>(`/auth/magic-link/${token}/validate`),

  firstAccess: (data: { token: string; password: string; confirmPassword: string }) =>
    request('/auth/primeiro-acesso', { method: 'POST', body: JSON.stringify(data) }),

  resetPassword: (data: { token: string; password: string; confirmPassword: string }) =>
    request('/auth/redefinir-senha', { method: 'POST', body: JSON.stringify(data) }),

  unlockAccount: (token: string) =>
    request(`/auth/desbloquear/${token}`),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request('/auth/alterar-senha', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Home ─────────────────────────────────────────────────────────────────────

export const portalHome = {
  get: () => request<{
    nextAppointment: null | {
      id: string; scheduledAt: string; durationMin: number;
      providerName: string; serviceName: string | null; status: string;
    };
    activePrescriptions: Array<{
      id: string; type: string; validUntil: string | null;
      createdAt: string; prescriptionNumber: string | null;
    }>;
    unreadNotices: Array<{ id: string; type: string; title: string; body: string; createdAt: string }>;
    unreadCount: number;
  }>('/home'),

  markNoticeRead: (id: string) =>
    request(`/home/notices/${id}/read`, { method: 'POST' }),
};

// ─── Appointments ─────────────────────────────────────────────────────────────

export const portalAppointments = {
  list: (params: { page?: number; limit?: number; filter?: 'upcoming' | 'past' | 'all' }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<{
      data: Array<{
        id: string; scheduledAt: string; durationMin: number; status: string;
        type: string; providerName: string; serviceName: string | null;
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/appointments?${qs}`);
  },

  providers: () => request<{
    providers: Array<{ id: string; name: string; specialty: string | null; avatarUrl: string | null }>;
  }>('/appointments/providers'),

  services: () => request<{
    services: Array<{ id: string; name: string; description: string | null; durationMin: number; category: string | null }>;
  }>('/appointments/services'),

  slots: (params: { providerId: string; date: string; serviceId?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ slots: Array<{ start: string; end: string }> }>(`/appointments/slots?${qs}`);
  },

  createHold: (data: { providerId: string; scheduledAt: string; serviceId?: string }) =>
    request<{ holdId: string; expiresAt: string }>('/appointments/hold', {
      method: 'POST', body: JSON.stringify(data),
    }),

  deleteHold: (id: string) =>
    request(`/appointments/hold/${id}`, { method: 'DELETE' }),

  book: (data: { holdId: string; notes?: string }) =>
    request<{ appointmentId: string; scheduledAt: string }>('/appointments', {
      method: 'POST', body: JSON.stringify(data),
    }),

  cancel: (id: string) =>
    request(`/appointments/${id}`, { method: 'DELETE' }),
};

// ─── Prescriptions ────────────────────────────────────────────────────────────

export const portalPrescriptions = {
  list: (params: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<{
      data: Array<{
        id: string; type: string; status: string; validUntil: string | null;
        createdAt: string; prescriptionNumber: string | null;
        prescriberName: string; hasPdf: boolean;
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/prescriptions?${qs}`);
  },

  getDownloadUrl: (id: string) =>
    request<{ url: string; expiresIn: number }>(`/prescriptions/${id}/download`),
};

// ─── Results ──────────────────────────────────────────────────────────────────

export const portalResults = {
  list: (params: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<{
      data: Array<{
        id: string; type: string; status: string; collectedAt: string;
        releasedAt: string; releasedByName: string; labName: string | null; hasPdf: boolean;
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/results?${qs}`);
  },

  getDownloadUrl: (id: string) =>
    request<{ url: string; expiresIn: number }>(`/results/${id}/download`),
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const portalMessages = {
  list: () => request<{
    conversations: Array<{
      id: string; subject: string | null; status: string;
      lastMessageAt: string; unreadCount: number;
    }>;
  }>('/messages'),

  get: (id: string) => request<{
    messages: Array<{ id: string; body: string; direction: string; createdAt: string }>;
  }>(`/messages/${id}`),

  create: (data: { body: string; subject?: string }) =>
    request<{ conversationId: string }>('/messages', {
      method: 'POST', body: JSON.stringify(data),
    }),

  reply: (id: string, data: { body: string }) =>
    request(`/messages/${id}/reply`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Profile ──────────────────────────────────────────────────────────────────

export const portalProfile = {
  get: () => request<{
    displayName: string; birthDate: string | null; phone: string | null;
    address: Record<string, string> | null; email: string | null;
    emailVerified: boolean; bloodType: string | null;
  }>('/profile'),

  update: (data: {
    phone?: string;
    address?: Record<string, string>;
  }) => request('/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  requestEmailChange: (newEmail: string) =>
    request('/profile/request-email-change', {
      method: 'POST', body: JSON.stringify({ newEmail }),
    }),
};

// ─── Push ─────────────────────────────────────────────────────────────────────

export const portalPush = {
  getVapidKey: () =>
    request<{ publicKey: string }>('/push/vapid-public-key'),

  subscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    request('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),

  unsubscribe: (endpoint?: string) =>
    request('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
};

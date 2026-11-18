const PORTAL_TOKEN_KEY = 'it_exam_student_token';
const ADMIN_TOKEN_KEY = 'it_exam_admin_token';

export function getPortalToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

export function setPortalToken(token: string) {
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
}

export function clearPortalToken() {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
}

// Legacy aliases so existing imports keep working smoothly
export const getStudentToken = getPortalToken;
export const setStudentToken = setPortalToken;
export const clearStudentToken = clearPortalToken;

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function portalFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getPortalToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(url, { ...options, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 401) {
      clearPortalToken();
    }
    throw new Error(data.error || `请求失败 (${resp.status})`);
  }
  return data as T;
}

export const studentFetch = portalFetch;

export async function adminFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(url, { ...options, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 401) {
      clearAdminToken();
    }
    throw new Error(data.error || `请求失败 (${resp.status})`);
  }
  return data as T;
}

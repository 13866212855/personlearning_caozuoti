const STUDENT_TOKEN_KEY = 'it_exam_student_token';
const ADMIN_TOKEN_KEY = 'it_exam_admin_token';

export function getStudentToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STUDENT_TOKEN_KEY);
}

export function setStudentToken(token: string) {
  localStorage.setItem(STUDENT_TOKEN_KEY, token);
}

export function clearStudentToken() {
  localStorage.removeItem(STUDENT_TOKEN_KEY);
}

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

export async function studentFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStudentToken();
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
      clearStudentToken();
    }
    throw new Error(data.error || `请求失败 (${resp.status})`);
  }
  return data as T;
}

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

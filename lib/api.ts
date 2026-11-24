import type { PortalUser } from './types';

const PORTAL_TOKEN_KEY = 'it_exam_student_token';
const PORTAL_USER_CACHE_KEY = 'it_exam_portal_user_cache';
const ADMIN_TOKEN_KEY = 'it_exam_admin_token';

export function getPortalToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

export function setPortalToken(token: string) {
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
}

export function getCachedPortalUser(): PortalUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = getPortalToken();
    if (!token) return null;
    const raw = sessionStorage.getItem(PORTAL_USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; user?: PortalUser };
    if (parsed.token !== token || !parsed.user) return null;
    return parsed.user;
  } catch {
    return null;
  }
}

export function setCachedPortalUser(user: PortalUser) {
  if (typeof window === 'undefined') return;
  try {
    const token = getPortalToken();
    if (!token) return;
    sessionStorage.setItem(
      PORTAL_USER_CACHE_KEY,
      JSON.stringify({ token, user })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function clearCachedPortalUser() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PORTAL_USER_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function clearPortalToken() {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
  clearCachedPortalUser();
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

function getDefaultTimeoutMs(url: string): number {
  if (
    url.includes('/ai-') ||
    url.includes('/generate') ||
    url.includes('/regenerate') ||
    url.includes('/llm-config/test')
  ) {
    return 95000;
  }
  return 15000;
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

async function fetchWithTimeout(
  url: string,
  options: ApiFetchOptions
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? getDefaultTimeoutMs(url);
  const controller = new AbortController();
  const externalSignal = options.signal;

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const { timeoutMs: _omit, ...rest } = options;
    void _omit;
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (err) {
    if (timedOut) {
      throw new Error('请求响应超时，请检查网络连接后重试');
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('请求已取消');
    }
    throw new Error('网络连接失败，请稍后重试');
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export async function portalFetch<T>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const token = getPortalToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetchWithTimeout(url, { ...options, headers });
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
  options: ApiFetchOptions = {}
): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetchWithTimeout(url, { ...options, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 401) {
      clearAdminToken();
    }
    throw new Error(data.error || `请求失败 (${resp.status})`);
  }
  return data as T;
}

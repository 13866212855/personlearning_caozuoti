import { APP_CONFIG } from '../config';

/**
 * 个性化学习平台（personlearning）HTTP 客户端。
 * 只使用平台"成员模块"里现成的接口，并且只带"用户本人的平台凭证"调用，
 * 不需要平台创建服务账号，也不改动平台的任何代码。
 */

/** 平台返回的结构化错误；status 为 0 表示网络不通或超时 */
export class PlatformError extends Error {
  status: number;
  code: string;
  hasSecurityQuestions?: boolean;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'PlatformError';
    this.status = status;
    this.code = code;
  }
}

export interface PlatformAuthUser {
  id: number;
  username: string;
  name: string;
  role: string;
}

export interface PlatformClassBrief {
  id: number;
  className: string;
  gradeLevel: string;
}

export const PLATFORM_UNAVAILABLE = 'PLATFORM_UNAVAILABLE';

// 熔断：平台连续连接失败后，短时间内直接快速失败，避免每个学生各等一个超时
const BREAKER_FAILURE_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 30 * 1000;

let consecutiveFailures = 0;
let breakerOpenUntil = 0;
let lastOkAt = '';
let lastErrorAt = '';
let lastErrorMessage = '';

export function getPlatformStatus() {
  return {
    configured: APP_CONFIG.platform.baseUrl !== '',
    circuitOpen: Date.now() < breakerOpenUntil,
    lastOkAt,
    lastErrorAt,
    lastError: lastErrorMessage,
  };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  token?: string;
  body?: unknown;
  ignoreBreaker?: boolean;
  extraHeaders?: Record<string, string>;
}

/** 平台按这个请求头识别来源地址。代为登录时带一个固定标识，平台的"学生IP"列就不会被写成一个内网地址 */
const DIRECT_LOGIN_MARKER = 'caozuoti-direct-login';

interface PlatformErrorBody {
  code?: string;
  message?: string;
  hasSecurityQuestions?: boolean;
}

/**
 * 平台接口的正常答复里必须带有的对象。缺失说明拿到的不是预期的结构，
 * 按"平台答复异常"处理（502），避免下游把残缺的数据当成"没有数据"去覆盖本地记录。
 */
function expectShape(value: unknown, message: string): void {
  if (!value || typeof value !== 'object') {
    throw new PlatformError(502, 'BAD_RESPONSE', message);
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = APP_CONFIG.platform.baseUrl;
  if (!base) {
    throw new PlatformError(0, PLATFORM_UNAVAILABLE, '未配置平台地址');
  }
  if (!options.ignoreBreaker && Date.now() < breakerOpenUntil) {
    throw new PlatformError(0, PLATFORM_UNAVAILABLE, '成员验证服务暂时不可用');
  }
  // 平台凭证是 JWT，只含可见 ASCII 字符。先在这里挡掉格式明显不对的输入：
  // 否则非法字符会让 fetch 在发出请求之前就抛错，而那样的错误不该算作"平台不通"。
  if (options.token !== undefined && !/^[\x21-\x7e]{1,4096}$/.test(options.token)) {
    throw new PlatformError(401, 'INVALID_TOKEN', '无效的认证令牌');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APP_CONFIG.platform.timeoutMs);
  try {
    const response = await fetch(base + path, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'caozuoti-platform-client',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.extraHeaders || {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    let data: unknown = {};
    const raw = await response.text();
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = undefined;
      }
    }
    if (!response.ok) {
      const error = (data as { error?: PlatformErrorBody } | null)?.error;
      const platformError = new PlatformError(
        response.status,
        String(error?.code || 'HTTP_ERROR'),
        String(error?.message || `平台接口错误 ${response.status}`)
      );
      platformError.hasSecurityQuestions = Boolean(error?.hasSecurityQuestions);
      throw platformError;
    }
    // 平台接口都返回 JSON；成功状态却不是 JSON，说明拿到的不是平台接口的正常答复
    if (data === undefined || data === null) {
      throw new PlatformError(502, 'BAD_RESPONSE', '平台返回了无法识别的内容');
    }
    consecutiveFailures = 0;
    breakerOpenUntil = 0;
    lastOkAt = new Date().toISOString();
    return data as T;
  } catch (err) {
    if (err instanceof PlatformError) throw err;
    consecutiveFailures += 1;
    if (consecutiveFailures >= BREAKER_FAILURE_THRESHOLD) {
      breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
    }
    lastErrorAt = new Date().toISOString();
    lastErrorMessage = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new PlatformError(0, PLATFORM_UNAVAILABLE, '成员验证服务暂时不可用');
  } finally {
    clearTimeout(timer);
  }
}

/** 用平台凭证核对身份（GET /api/auth/me）；凭证失效时抛 401 */
export async function verifyPlatformToken(token: string): Promise<{ user: PlatformAuthUser }> {
  const data = await request<{ user?: PlatformAuthUser }>('/api/auth/me', { token });
  expectShape(data.user, '平台返回的用户信息无法识别');
  return data as { user: PlatformAuthUser };
}

export interface PlatformLoginResult {
  token: string;
  user: PlatformAuthUser;
  nameConflict?: unknown;
}

/** 代为校验平台账号密码（POST /api/auth/login）。注意：学生账号每调用一次会在平台上换一个会话 */
export async function requestPlatformLogin(
  username: string,
  password: string
): Promise<PlatformLoginResult> {
  const data = await request<Partial<PlatformLoginResult>>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
    extraHeaders: { 'X-Client-Real-IP': DIRECT_LOGIN_MARKER },
  });
  expectShape(data.user, '平台返回的用户信息无法识别');
  if (typeof data.token !== 'string' || !data.token) {
    throw new PlatformError(502, 'BAD_RESPONSE', '平台没有返回登录凭证');
  }
  return data as PlatformLoginResult;
}

/** 学生本人的班级与年级（GET /api/student/profile，需要学生本人的凭证） */
export async function getStudentProfile(token: string) {
  const data = await request<{ user?: { class_id?: number | null; gradeLevel?: string } }>(
    '/api/student/profile',
    { token }
  );
  expectShape(data.user, '平台返回的学生档案无法识别');
  return data as { user: { class_id?: number | null; gradeLevel?: string } };
}

/** 班主任本人的带班班级（GET /api/parent/teacher/class-info） */
export async function getHomeroomClassInfo(token: string) {
  const data = await request<{ classInfo?: PlatformClassBrief }>(
    '/api/parent/teacher/class-info',
    { token }
  );
  expectShape(data.classInfo, '平台返回的班级信息无法识别');
  return data as { classInfo: PlatformClassBrief };
}

/**
 * 学科教师本人所带的全部班级（GET /api/parent/subject-teacher/info）。
 * 结构不对时按"平台答复异常"处理：当成空列表会让该教师的授课关系被全部清掉。
 */
export async function getSubjectTeacherClasses(token: string): Promise<PlatformClassBrief[]> {
  const data = await request<{ classes?: PlatformClassBrief[] }>(
    '/api/parent/subject-teacher/info',
    { token }
  );
  if (!Array.isArray(data.classes)) {
    throw new PlatformError(502, 'BAD_RESPONSE', '平台返回的授课班级无法识别');
  }
  return data.classes;
}

/** 修改平台账号密码（PUT /api/auth/profile/password，需要本人凭证） */
export function changePlatformPassword(token: string, oldPassword: string, newPassword: string) {
  return request<{ message?: string }>('/api/auth/profile/password', {
    method: 'PUT',
    token,
    body: { oldPassword, newPassword },
  });
}

/** 平台健康检查，返回耗时（毫秒）；失败时抛 PlatformError */
export async function checkPlatformHealth(): Promise<number> {
  const startedAt = Date.now();
  await request<{ status?: string }>('/health', { ignoreBreaker: true });
  return Date.now() - startedAt;
}

// 平台公开的班级表（GET /api/auth/public/classes，不需要登录），进程内缓存 10 分钟
const PUBLIC_CLASSES_TTL_MS = 10 * 60 * 1000;
let publicClassesCache: { fetchedAt: number; classes: PlatformClassBrief[] } | null = null;
let publicClassesInflight: Promise<PlatformClassBrief[]> | null = null;

/**
 * 读平台班级表。forceRefresh 用于"缓存里找不到某个班"的场景（多半是平台刚建的新班）。
 * 刷新失败时若手上有旧表，先返回旧表：查不到班名不应该让一次已经通过平台验证的登录整个失败。
 */
function loadPublicClasses(options: { forceRefresh?: boolean } = {}): Promise<PlatformClassBrief[]> {
  if (
    !options.forceRefresh &&
    publicClassesCache &&
    Date.now() - publicClassesCache.fetchedAt < PUBLIC_CLASSES_TTL_MS
  ) {
    return Promise.resolve(publicClassesCache.classes);
  }
  if (!publicClassesInflight) {
    publicClassesInflight = request<{
      classes?: Array<{ id: number; class_name: string; grade_level: string }>;
    }>('/api/auth/public/classes')
      .then((data) => {
        // 班级表结构不对时按"平台答复异常"处理，不能当成"平台上一个班都没有"
        if (!Array.isArray(data.classes)) {
          throw new PlatformError(502, 'BAD_RESPONSE', '平台返回的班级表无法识别');
        }
        return data.classes.map((c) => ({
          id: Number(c.id),
          className: c.class_name,
          gradeLevel: c.grade_level,
        }));
      })
      .then((classes) => {
        publicClassesCache = { fetchedAt: Date.now(), classes };
        return classes;
      })
      .catch((err: unknown) => {
        if (publicClassesCache) return publicClassesCache.classes;
        throw err;
      })
      .finally(() => {
        publicClassesInflight = null;
      });
  }
  return publicClassesInflight;
}

export async function findPlatformClass(classId: number): Promise<PlatformClassBrief | null> {
  const cached = await loadPublicClasses();
  const hit = cached.find((c) => c.id === classId);
  if (hit) return hit;
  // 缓存里没有：强制刷新一次再下结论，避免新班在缓存有效期内一直被当成"不存在"
  const fresh = await loadPublicClasses({ forceRefresh: true });
  return fresh.find((c) => c.id === classId) ?? null;
}

export function listPlatformClasses(): Promise<PlatformClassBrief[]> {
  return loadPublicClasses();
}

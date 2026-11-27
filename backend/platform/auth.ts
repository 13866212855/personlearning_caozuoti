import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { signPortalToken } from '../middleware/auth';
import { getDb } from '../db';
import { APP_CONFIG } from '../config';
import {
  PlatformError,
  changePlatformPassword,
  getHomeroomClassInfo,
  getStudentProfile,
  getSubjectTeacherClasses,
  requestPlatformLogin,
  verifyPlatformToken,
  type PlatformAuthUser,
  type PlatformClassBrief,
} from './client';
import {
  loadPortalUserPayload,
  mapPlatformRole,
  syncPlatformMember,
  type PlatformMember,
  type PortalUserPayload,
} from './memberSync';

/** 面向用户的登录类错误：status 直接作为 HTTP 状态码，message 直接显示在页面上 */
export class AuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export function sendAuthError(res: Response, err: unknown) {
  if (err instanceof AuthError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[platform] 登录链路出现未预期的错误:', err);
  res.status(500).json({ error: '登录失败，请稍后重试' });
}

/** 公开的前端配置：前端据此决定显示哪些入口，回滚到本地模式时界面自动恢复 */
export function publicAuthConfig() {
  const platform = APP_CONFIG.platform;
  const isPlatform = platform.authMode === 'platform';
  const ssoEnabled = isPlatform && platform.ssoEnabled && platform.webUrl !== '';
  return {
    mode: platform.authMode,
    platformName: '个性化学习平台',
    platformWebUrl: platform.webUrl,
    platformRegisterUrl: platform.webUrl ? `${platform.webUrl}/register` : '',
    ssoEnabled,
    ssoEntryUrl: ssoEnabled ? `${platform.webUrl}/caozuoti/` : '',
    studentDirectLogin: platform.studentDirectLogin,
    registrationEnabled: !isPlatform,
    memberManagement: !isPlatform,
  };
}

function isNoClassError(err: unknown): boolean {
  return (
    err instanceof PlatformError &&
    ((err.status === 400 && err.code === 'NO_CLASS') ||
      (err.status === 404 && err.code === 'CLASS_NOT_FOUND'))
  );
}

/** 用用户本人的平台凭证补齐班级信息 */
async function buildPlatformMember(
  token: string,
  user: PlatformAuthUser
): Promise<PlatformMember> {
  const role = mapPlatformRole(user.role);
  if (!role) {
    throw new AuthError(403, '当前平台账号类型不能登录本系统（仅支持学生与教师）');
  }

  if (role === 'student') {
    const profile = await getStudentProfile(token);
    return {
      platformId: user.id,
      username: user.username,
      name: user.name,
      platformRole: user.role,
      role,
      gradeLevel: profile.user.gradeLevel || '',
      classId: profile.user.class_id ?? null,
      teacherRelation: 'subject',
      teacherClasses: [],
    };
  }

  let classes: PlatformClassBrief[] = [];
  let relation: PlatformMember['teacherRelation'] = 'subject';
  if (user.role === 'teacher') {
    relation = 'homeroom';
    try {
      classes = [(await getHomeroomClassInfo(token)).classInfo];
    } catch (err) {
      if (!isNoClassError(err)) throw err;
    }
  } else {
    classes = await getSubjectTeacherClasses(token);
  }

  return {
    platformId: user.id,
    username: user.username,
    name: user.name,
    platformRole: user.role,
    role,
    gradeLevel: '',
    classId: null,
    teacherRelation: relation,
    teacherClasses: classes,
  };
}

async function createSession(
  token: string,
  user: PlatformAuthUser,
  options: { password?: string }
): Promise<{ token: string; user: PortalUserPayload }> {
  const member = await buildPlatformMember(token, user);
  const synced = await syncPlatformMember(member, options);
  if (synced.isDisabled) {
    throw new AuthError(403, '该账号已被本系统禁用，请联系管理员');
  }
  const payload = loadPortalUserPayload(getDb(), synced.id);
  return {
    // 平台凭证只在这里用一次，用完即弃；之后只认本项目签发的凭证
    token: signPortalToken({
      sub: payload.id,
      username: payload.username,
      role: payload.role,
      pid: synced.platformId,
    }),
    user: payload,
  };
}

function toAuthError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;
  if (!(err instanceof PlatformError)) return new AuthError(500, '登录失败，请稍后重试');
  if (err.status === 0) {
    return new AuthError(503, '成员验证服务（个性化学习平台）暂时不可用，请稍后再试或联系管理员');
  }
  switch (err.code) {
    case 'MISSING_FIELDS':
      return new AuthError(400, '请输入用户名和密码');
    case 'INVALID_CREDENTIALS':
      return new AuthError(
        401,
        err.hasSecurityQuestions ? '账号或密码错误（可通过平台登录页的密保找回）' : '账号或密码错误'
      );
    case 'APPLICATION_PENDING':
      return new AuthError(403, '该账号的角色申请正在平台审核，暂不能登录');
    case 'APPLICATION_REJECTED':
      return new AuthError(403, '该账号的角色申请未通过平台审核，请联系平台管理员');
    case 'WEAK_PASSWORD':
      return new AuthError(400, '新密码长度至少为 6 位');
    case 'INVALID_PASSWORD':
      return new AuthError(400, '原密码不正确');
  }
  if (err.status === 429) return new AuthError(429, '登录过于频繁，请稍后再试');
  return new AuthError(502, '成员验证失败，请稍后重试');
}

const STUDENT_USE_SSO_MESSAGE = '学生请从个性化学习平台进入操作题系统';

/**
 * 独立登录入口：把用户名密码交给平台校验。
 * 学生账号每走一次都会在平台上换一个会话（顶掉该生在平台网页端的登录），
 * 所以配置为 deny 时，已经在本系统出现过的学生账号在调用平台之前就被拒绝。
 */
export async function loginWithPlatformPassword(
  username: string,
  password: string
): Promise<{ token: string; user: PortalUserPayload }> {
  const denyStudentDirectLogin = APP_CONFIG.platform.studentDirectLogin === 'deny';
  if (denyStudentDirectLogin) {
    const knownStudent = getDb()
      .prepare(
        `SELECT 1 FROM users
         WHERE platform_username = ? AND platform_user_id IS NOT NULL AND role = 'student'`
      )
      .get(username);
    if (knownStudent) throw new AuthError(403, STUDENT_USE_SSO_MESSAGE);
  }

  let result;
  try {
    result = await requestPlatformLogin(username, password);
  } catch (err) {
    throw toAuthError(err);
  }

  const role = mapPlatformRole(result.user.role);
  if (result.nameConflict) {
    throw new AuthError(403, '检测到班级内有同名账号，请先在个性化学习平台登录并按提示处理');
  }
  if (denyStudentDirectLogin && role === 'student') {
    throw new AuthError(403, STUDENT_USE_SSO_MESSAGE);
  }
  // 密码已通过平台校验；后续取档案/班级时平台若再出问题，同样按平台错误映射，不能变成 500
  try {
    return await createSession(result.token, result.user, { password });
  } catch (err) {
    throw toAuthError(err);
  }
}

/** 单点入口：学生或教师已在平台登录，带平台凭证进入，不调用平台的登录接口 */
export async function loginWithPlatformToken(
  platformToken: string
): Promise<{ token: string; user: PortalUserPayload }> {
  let me;
  try {
    me = await verifyPlatformToken(platformToken);
    return await createSession(platformToken, me.user, {});
  } catch (err) {
    if (err instanceof PlatformError && err.status === 401) {
      throw new AuthError(401, '平台登录已过期，请回到平台重新登录');
    }
    throw toAuthError(err);
  }
}

/** 修改密码：用原密码向平台换一个凭证，再提交新密码。本项目不再保存密码，无需更新本地 */
export async function changePasswordViaPlatform(
  req: AuthedRequest,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const row = getDb()
    .prepare('SELECT username, platform_username FROM users WHERE id = ?')
    .get(req.user!.id) as { username: string; platform_username: string } | undefined;
  const platformUsername = row?.platform_username || row?.username || req.user!.username;

  try {
    const result = await requestPlatformLogin(platformUsername, oldPassword);
    await changePlatformPassword(result.token, oldPassword, newPassword);
  } catch (err) {
    if (err instanceof PlatformError && err.status === 401) {
      throw new AuthError(400, '原密码不正确');
    }
    throw toAuthError(err);
  }

  getDb()
    .prepare(
      'UPDATE users SET must_change_password = 0, updated_at = ? WHERE id = ?'
    )
    .run(new Date().toISOString(), req.user!.id);
}

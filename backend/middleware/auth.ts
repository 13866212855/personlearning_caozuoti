import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { APP_CONFIG } from '../config';
import { getDb } from '../db';
import type { UserRole } from '../types';

export interface PortalJwtPayload {
  sub: string;
  username: string;
  role: 'teacher' | 'student';
  /** 平台对接模式下绑定的平台用户编号；令牌必须与镜像行上的绑定一致 */
  pid?: number;
}

export interface AdminJwtPayload {
  sub: string;
  username: string;
  role: 'super_admin';
}

export interface PortalUser {
  id: string;
  username: string;
  role: 'teacher' | 'student';
  realName: string;
  grade: string;
  className: string;
  studentNo: string;
  teacherId: string;
  classId: string;
  mustChangePassword: boolean;
}

export interface AuthedRequest extends Request {
  user?: PortalUser;
  student?: {
    id: string;
    username: string;
    realName: string;
    grade: string;
    className: string;
    studentNo: string;
    teacherId: string;
    classId: string;
  };
  teacher?: {
    id: string;
    username: string;
    realName: string;
  };
  admin?: {
    id: string;
    username: string;
    role: 'super_admin';
  };
}

function extractClientIp(req: Request): string {
  const forwarded = req.headers.forwarded;
  const rawForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (rawForwarded) {
    const match = rawForwarded.match(
      /for=(?:"?\[([^\]]+)\](?::\d+)?"?|"([^";,\s]+)"|([^;,\s]+))/i
    );
    let candidate = (match?.[1] || match?.[2] || match?.[3] || '').trim();
    if (candidate) {
      if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
        candidate = candidate.replace(/:\d+$/, '');
      }
      if (candidate && candidate.toLowerCase() !== 'unknown') {
        return ipKeyGenerator(candidate);
      }
    }
  }
  const fallbackIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  return ipKeyGenerator(fallbackIp);
}

export const loginRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = extractClientIp(req);
    const uname = String(req.body?.username || '').trim().toLowerCase();
    return uname ? `${ip}:${uname}` : ip;
  },
  message: { error: '登录尝试过于频繁，请 10 分钟后再试' },
});

// Student self-registration rate limiter: allow full classrooms sharing a school NAT IP
// while blocking automated flood abuse and ignoring failed validation attempts.
export const registerRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 500,
  skipFailedRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => extractClientIp(req),
  message: { error: '注册操作过于频繁，请稍后再试' },
});

export function signPortalToken(payload: PortalJwtPayload): string {
  return jwt.sign(payload, APP_CONFIG.studentJwtSecret, { expiresIn: '7d' });
}

export function signAdminToken(payload: AdminJwtPayload): string {
  return jwt.sign(payload, APP_CONFIG.adminJwtSecret, { expiresIn: '12h' });
}

interface UserDbRow {
  id: string;
  username: string;
  role: UserRole;
  real_name: string;
  grade: string;
  class_name: string;
  student_no: string;
  teacher_id: string;
  class_id: string;
  is_disabled: number;
  must_change_password: number;
  platform_user_id: number | null;
  platform_status: string;
}

function verifyPortalUser(
  req: AuthedRequest,
  res: Response,
  allowedRoles: Array<'teacher' | 'student'>
): PortalUser | null {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: '请先登录账号' });
    return null;
  }

  try {
    const decoded = jwt.verify(
      token,
      APP_CONFIG.studentJwtSecret
    ) as PortalJwtPayload;
    if (decoded.role !== 'teacher' && decoded.role !== 'student') {
      res.status(403).json({ error: '权限不足' });
      return null;
    }

    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, username, role, real_name, grade, class_name, student_no,
                teacher_id, class_id, is_disabled, must_change_password,
                platform_user_id, platform_status
         FROM users WHERE id = ?`
      )
      .get(decoded.sub) as UserDbRow | undefined;

    if (!row) {
      res.status(401).json({ error: '账号不存在，请重新登录' });
      return null;
    }
    if (row.role === 'super_admin') {
      res.status(403).json({ error: '权限不足' });
      return null;
    }
    if (row.is_disabled) {
      res.status(403).json({ error: '该账号已被禁用，请联系管理员或任课教师' });
      return null;
    }
    if (!allowedRoles.includes(row.role)) {
      res.status(403).json({ error: '无权访问该角色功能' });
      return null;
    }
    if (APP_CONFIG.platform.authMode === 'platform') {
      // 平台对接模式：令牌必须绑定到该账号的平台身份，且该平台账号未被注销
      if (row.platform_status === 'deleted') {
        res.status(401).json({ error: '账号已在个性化学习平台注销' });
        return null;
      }
      if (!row.platform_user_id || decoded.pid !== row.platform_user_id) {
        res.status(401).json({ error: '登录已失效，请重新登录' });
        return null;
      }
    }

    const user: PortalUser = {
      id: row.id,
      username: row.username,
      role: row.role,
      realName: row.real_name,
      grade: row.grade,
      className: row.class_name,
      studentNo: row.student_no,
      teacherId: row.teacher_id || '',
      classId: row.class_id || '',
      mustChangePassword: Boolean(row.must_change_password),
    };
    req.user = user;
    if (row.role === 'student') {
      req.student = {
        id: row.id,
        username: row.username,
        realName: row.real_name,
        grade: row.grade,
        className: row.class_name,
        studentNo: row.student_no,
        teacherId: row.teacher_id || '',
        classId: row.class_id || '',
      };
    } else if (row.role === 'teacher') {
      req.teacher = {
        id: row.id,
        username: row.username,
        realName: row.real_name,
      };
    }
    return user;
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' });
    return null;
  }
}

export function requirePortalAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (verifyPortalUser(req, res, ['teacher', 'student'])) {
    next();
  }
}

export function requireStudentAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (verifyPortalUser(req, res, ['student'])) {
    next();
  }
}

export function requireTeacherAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (verifyPortalUser(req, res, ['teacher'])) {
    next();
  }
}

export function requireAdminAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: '请先登录超级管理员账号' });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      APP_CONFIG.adminJwtSecret
    ) as AdminJwtPayload;
    if (decoded.role !== 'super_admin') {
      res.status(403).json({ error: '权限不足' });
      return;
    }

    const db = getDb();
    const admin = db
      .prepare(
        "SELECT id, username, role, is_disabled FROM users WHERE id = ? AND role = 'super_admin'"
      )
      .get(decoded.sub) as
      | { id: string; username: string; role: string; is_disabled: number }
      | undefined;

    if (!admin) {
      res.status(401).json({ error: '管理员凭证无效' });
      return;
    }
    if (admin.is_disabled) {
      res.status(403).json({ error: '该管理员账号已被禁用' });
      return;
    }

    req.admin = { id: admin.id, username: admin.username, role: 'super_admin' };
    next();
  } catch {
    res.status(401).json({ error: '管理员登录已过期，请重新登录' });
  }
}

export function requireAnyUserAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: '请先登录账号' });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      APP_CONFIG.studentJwtSecret
    ) as PortalJwtPayload;
    if (decoded.role === 'teacher' || decoded.role === 'student') {
      if (verifyPortalUser(req, res, ['teacher', 'student'])) {
        next();
      }
      return;
    }
  } catch {
    // Fall through to admin JWT verification
  }

  requireAdminAuth(req, res, next);
}


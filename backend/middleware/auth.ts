import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { APP_CONFIG } from '../config';
import { getDb } from '../db';

export interface StudentJwtPayload {
  sub: string;
  username: string;
  role: 'student';
}

export interface AdminJwtPayload {
  sub: string;
  username: string;
  role: 'admin';
}

export interface AuthedRequest extends Request {
  student?: {
    id: string;
    username: string;
    realName: string;
    grade: string;
    className: string;
  };
  admin?: {
    id: string;
    username: string;
  };
}

function extractClientIp(req: Request): string {
  const forwarded = req.headers.forwarded;
  const rawForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (rawForwarded) {
    const match = rawForwarded.match(/for=(?:"?\[([^\]]+)\](?::\d+)?"?|"([^";,\s]+)"|([^;,\s]+))/i);
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
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => extractClientIp(req),
  message: { error: '登录尝试过于频繁，请 10 分钟后再试' },
});

export function signStudentToken(payload: StudentJwtPayload): string {
  return jwt.sign(payload, APP_CONFIG.studentJwtSecret, { expiresIn: '7d' });
}

export function signAdminToken(payload: AdminJwtPayload): string {
  return jwt.sign(payload, APP_CONFIG.adminJwtSecret, { expiresIn: '12h' });
}

export function requireStudentAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: '请先登录学生账号' });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      APP_CONFIG.studentJwtSecret
    ) as StudentJwtPayload;
    if (decoded.role !== 'student') {
      res.status(403).json({ error: '无效的学生身份凭证' });
      return;
    }

    const db = getDb();
    const student = db
      .prepare(
        'SELECT id, username, real_name, grade, class_name, is_disabled FROM students WHERE id = ?'
      )
      .get(decoded.sub) as
      | {
          id: string;
          username: string;
          real_name: string;
          grade: string;
          class_name: string;
          is_disabled: number;
        }
      | undefined;

    if (!student) {
      res.status(401).json({ error: '账号不存在，请重新登录' });
      return;
    }
    if (student.is_disabled) {
      res.status(403).json({ error: '该学生账号已被禁用，请联系老师' });
      return;
    }

    req.student = {
      id: student.id,
      username: student.username,
      realName: student.real_name,
      grade: student.grade,
      className: student.class_name,
    };
    next();
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' });
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
    res.status(401).json({ error: '请先登录管理员账号' });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      APP_CONFIG.adminJwtSecret
    ) as AdminJwtPayload;
    if (decoded.role !== 'admin') {
      res.status(403).json({ error: '权限不足' });
      return;
    }

    const db = getDb();
    const admin = db
      .prepare('SELECT id, username FROM admins WHERE id = ?')
      .get(decoded.sub) as { id: string; username: string } | undefined;

    if (!admin) {
      res.status(401).json({ error: '管理员凭证无效' });
      return;
    }

    req.admin = { id: admin.id, username: admin.username };
    next();
  } catch {
    res.status(401).json({ error: '管理员登录已过期，请重新登录' });
  }
}

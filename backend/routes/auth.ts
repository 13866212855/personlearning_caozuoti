import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db';
import {
  type AuthedRequest,
  loginRateLimiter,
  requireStudentAuth,
  signStudentToken,
} from '../middleware/auth';

const router = Router();

const RegisterSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, '用户名至少 3 个字符')
      .max(32, '用户名最多 32 个字符')
      .regex(/^[a-zA-Z0-9_]+$/, '用户名仅支持字母、数字和下划线'),
    password: z.string().min(6, '密码至少 6 位').max(64, '密码最多 64 位'),
    confirmPassword: z.string(),
    realName: z.string().trim().min(1, '请输入真实姓名').max(32),
    grade: z.string().trim().min(1, '请选择或输入年级').max(20),
    className: z.string().trim().min(1, '请输入班级').max(20),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

const LoginSchema = z.object({
  username: z.string().trim().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

router.post('/register', (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || '注册信息格式不正确',
    });
    return;
  }

  const { username, password, realName, grade, className } = parsed.data;
  const db = getDb();

  const existing = db
    .prepare('SELECT id FROM students WHERE username = ?')
    .get(username);
  if (existing) {
    res.status(409).json({ error: '该用户名已被注册，请更换' });
    return;
  }

  const id = `stu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO students (id, username, password_hash, real_name, grade, class_name, student_no, is_disabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(id, username, passwordHash, realName, grade, className, username, now);

  const token = signStudentToken({ sub: id, username, role: 'student' });

  res.status(201).json({
    token,
    student: {
      id,
      username,
      realName,
      grade,
      className,
    },
  });
});

router.post('/login', loginRateLimiter, (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || '请输入用户名和密码',
    });
    return;
  }

  const { username, password } = parsed.data;
  const db = getDb();

  const student = db
    .prepare('SELECT * FROM students WHERE username = ?')
    .get(username) as
    | {
        id: string;
        username: string;
        password_hash: string;
        real_name: string;
        grade: string;
        class_name: string;
        is_disabled: number;
      }
    | undefined;

  if (!student || !bcrypt.compareSync(password, student.password_hash)) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  if (student.is_disabled) {
    res.status(403).json({ error: '该账号已被禁用，请联系管理员' });
    return;
  }

  const token = signStudentToken({
    sub: student.id,
    username: student.username,
    role: 'student',
  });

  res.json({
    token,
    student: {
      id: student.id,
      username: student.username,
      realName: student.real_name,
      grade: student.grade,
      className: student.class_name,
    },
  });
});

router.get('/me', requireStudentAuth, (req: AuthedRequest, res) => {
  res.json({ student: req.student });
});

router.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

export default router;

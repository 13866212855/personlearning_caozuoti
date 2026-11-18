import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db';
import {
  type AuthedRequest,
  loginRateLimiter,
  requirePortalAuth,
  signPortalToken,
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
    grade: z.string().trim().min(1, '请选择年级').max(20),
    className: z.string().trim().min(1, '请输入班级').max(30),
    inviteCode: z.string().trim().min(4, '请输入教师提供的班级邀请码').max(20),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

const LoginSchema = z.object({
  username: z.string().trim().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

// Student self-registration ONLY (requires valid teacher class invite code)
router.post('/register', (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || '注册信息格式不正确',
    });
    return;
  }

  const { username, password, realName, grade, className, inviteCode } =
    parsed.data;
  const db = getDb();

  const existing = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username);
  if (existing) {
    res.status(409).json({ error: '该用户名已被注册，请更换' });
    return;
  }

  const cls = db
    .prepare(
      'SELECT id, name, grade, teacher_id FROM classes WHERE UPPER(invite_code) = UPPER(?)'
    )
    .get(inviteCode) as
    | { id: string; name: string; grade: string; teacher_id: string }
    | undefined;
  if (!cls) {
    res.status(400).json({ error: '班级邀请码无效，请向任课教师确认' });
    return;
  }

  const id = `stu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (
      id, username, password_hash, role, real_name, grade, class_name,
      student_no, teacher_id, class_id, is_disabled, must_change_password,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'student', ?, ?, ?, '', ?, ?, 0, 0, ?, ?)`
  ).run(
    id,
    username,
    passwordHash,
    realName,
    grade || cls.grade,
    className || cls.name,
    cls.teacher_id,
    cls.id,
    now,
    now
  );

  const token = signPortalToken({
    sub: id,
    username,
    role: 'student',
  });

  res.status(201).json({
    token,
    user: {
      id,
      username,
      role: 'student',
      realName,
      grade: grade || cls.grade,
      className: className || cls.name,
      teacherId: cls.teacher_id,
      classId: cls.id,
      mustChangePassword: false,
    },
  });
});

// Teacher & Student unified login (super_admin is strictly rejected here with generic error)
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
  const user = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username) as
    | {
        id: string;
        username: string;
        password_hash: string;
        role: 'super_admin' | 'teacher' | 'student';
        real_name: string;
        grade: string;
        class_name: string;
        student_no: string;
        teacher_id: string;
        class_id: string;
        is_disabled: number;
        must_change_password: number;
      }
    | undefined;

  // Reject super_admin on /login without revealing anything
  if (
    !user ||
    user.role === 'super_admin' ||
    !bcrypt.compareSync(password, user.password_hash)
  ) {
    res.status(401).json({ error: '账号或密码错误' });
    return;
  }

  if (user.is_disabled) {
    res.status(403).json({ error: '该账号已被禁用，请联系管理员或任课教师' });
    return;
  }

  const token = signPortalToken({
    sub: user.id,
    username: user.username,
    role: user.role,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      realName: user.real_name,
      grade: user.grade,
      className: user.class_name,
      studentNo: user.student_no,
      teacherId: user.teacher_id || '',
      classId: user.class_id || '',
      mustChangePassword: Boolean(user.must_change_password),
    },
  });
});

router.get('/me', requirePortalAuth, (req: AuthedRequest, res) => {
  const db = getDb();
  const u = req.user!;

  let teacherName = '';
  let classDisplayName = u.className;
  if (u.role === 'student') {
    if (u.teacherId) {
      const t = db
        .prepare('SELECT real_name, username FROM users WHERE id = ?')
        .get(u.teacherId) as { real_name: string; username: string } | undefined;
      teacherName = t ? t.real_name || t.username : '';
    }
    if (u.classId) {
      const c = db
        .prepare('SELECT name FROM classes WHERE id = ?')
        .get(u.classId) as { name: string } | undefined;
      if (c) classDisplayName = c.name;
    }
  }

  const unreadRow = db
    .prepare(
      'SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0'
    )
    .get(u.id) as { cnt: number };

  res.json({
    user: {
      ...u,
      className: classDisplayName,
      teacherName,
      unreadNotifications: Number(unreadRow?.cnt || 0),
    },
  });
});

router.post('/change-password', requirePortalAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    oldPassword: z.string().min(1, '请输入原密码'),
    newPassword: z.string().min(6, '新密码不能少于 6 位').max(64),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || '参数错误' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .get(req.user!.id) as { password_hash: string } | undefined;
  if (!row || !bcrypt.compareSync(parsed.data.oldPassword, row.password_hash)) {
    res.status(400).json({ error: '原密码不正确' });
    return;
  }

  const newHash = bcrypt.hashSync(parsed.data.newPassword, 10);
  db.prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
  ).run(newHash, new Date().toISOString(), req.user!.id);

  res.json({ ok: true });
});

router.put('/profile', requirePortalAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    realName: z.string().trim().min(1, '姓名不能为空').max(32),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '姓名格式不正确' });
    return;
  }
  const db = getDb();
  db.prepare('UPDATE users SET real_name = ?, updated_at = ? WHERE id = ?').run(
    parsed.data.realName,
    new Date().toISOString(),
    req.user!.id
  );
  res.json({ ok: true });
});

router.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

export default router;

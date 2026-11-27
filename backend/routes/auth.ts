import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb, getDefaultRegistrationTarget } from '../db';
import {
  type AuthedRequest,
  loginRateLimiter,
  registerRateLimiter,
  requirePortalAuth,
  signPortalToken,
} from '../middleware/auth';
import { APP_CONFIG } from '../config';
import {
  changePasswordViaPlatform,
  loginWithPlatformPassword,
  loginWithPlatformToken,
  publicAuthConfig,
  sendAuthError,
} from '../platform/auth';

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
    confirmPassword: z.string().optional(),
    realName: z.string().trim().min(1, '请输入真实姓名').max(32),
    grade: z.string().trim().max(20).optional(),
    className: z.string().trim().max(30).optional(),
  })
  .refine(
    (d) =>
      d.confirmPassword === undefined ||
      d.confirmPassword === '' ||
      d.password === d.confirmPassword,
    {
      message: '两次输入的密码不一致',
      path: ['confirmPassword'],
    }
  );

const LoginSchema = z.object({
  username: z.string().trim().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

// Student self-registration ONLY (automatically binds to configured default teacher & class)
router.post('/register', registerRateLimiter, async (req, res) => {
  if (APP_CONFIG.platform.authMode === 'platform') {
    res.status(403).json({ error: '账号由个性化学习平台统一管理，请到平台注册' });
    return;
  }

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
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username);
  if (existing) {
    res.status(409).json({ error: '该用户名已被注册，请更换' });
    return;
  }

  const defaultTarget = getDefaultRegistrationTarget(db);
  const assignedTeacherId = defaultTarget?.teacherId || '';
  const assignedClassId = defaultTarget?.classId || '';
  const assignedGrade = (grade || '').trim() || defaultTarget?.grade || '高一';
  const assignedClassName =
    (className || '').trim() || defaultTarget?.className || '待分班';

  const id = `stu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const passwordHash = await bcrypt.hash(password, 8);
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
    assignedGrade,
    assignedClassName,
    assignedTeacherId,
    assignedClassId,
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
      grade: assignedGrade,
      className: assignedClassName,
      teacherId: assignedTeacherId,
      teacherName: defaultTarget?.teacherName || '',
      classId: assignedClassId,
      mustChangePassword: false,
      unreadNotifications: 0,
    },
  });
});

// Teacher & Student unified login (super_admin is strictly rejected here with generic error)
router.post('/login', loginRateLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || '请输入用户名和密码',
    });
    return;
  }

  const { username, password } = parsed.data;

  // 平台对接模式：把账号密码交给平台校验（见 backend/platform/auth.ts）
  if (APP_CONFIG.platform.authMode === 'platform') {
    try {
      res.json(await loginWithPlatformPassword(username, password));
    } catch (err) {
      sendAuthError(res, err);
    }
    return;
  }

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
    !(await bcrypt.compare(password, user.password_hash))
  ) {
    res.status(401).json({ error: '账号或密码错误' });
    return;
  }

  if (user.is_disabled) {
    res.status(403).json({ error: '该账号已被禁用，请联系管理员或任课教师' });
    return;
  }

  let teacherName = '';
  let classDisplayName = user.class_name;
  if (user.role === 'student') {
    if (user.teacher_id) {
      const t = db
        .prepare('SELECT real_name, username FROM users WHERE id = ?')
        .get(user.teacher_id) as { real_name: string; username: string } | undefined;
      teacherName = t ? t.real_name || t.username : '';
    }
    if (user.class_id) {
      const c = db
        .prepare('SELECT name FROM classes WHERE id = ?')
        .get(user.class_id) as { name: string } | undefined;
      if (c) classDisplayName = c.name;
    }
  }

  const unreadRow = db
    .prepare(
      'SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0'
    )
    .get(user.id) as { cnt: number };

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
      className: classDisplayName,
      studentNo: user.student_no,
      teacherId: user.teacher_id || '',
      teacherName,
      classId: user.class_id || '',
      mustChangePassword: Boolean(user.must_change_password),
      unreadNotifications: Number(unreadRow?.cnt || 0),
    },
  });
});

// 公开的前端配置：当前是本地账号模式还是平台对接模式、哪些入口开放
router.get('/config', (_req, res) => {
  res.json(publicAuthConfig());
});

// 单点入口：学生或教师已在平台登录，带平台凭证进入（不调用平台的登录接口）
// 每次调用都会去平台核对一次凭证，所以与登录一样限流
router.post('/sso', loginRateLimiter, async (req, res) => {
  if (APP_CONFIG.platform.authMode !== 'platform') {
    res.status(403).json({ error: '当前未启用平台对接' });
    return;
  }
  const platformToken =
    typeof req.body?.platformToken === 'string' ? req.body.platformToken : '';
  if (!platformToken) {
    res.status(400).json({ error: '缺少平台登录凭证' });
    return;
  }
  try {
    res.json(await loginWithPlatformToken(platformToken));
  } catch (err) {
    sendAuthError(res, err);
  }
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

router.post('/change-password', requirePortalAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    oldPassword: z.string().min(1, '请输入原密码'),
    newPassword: z.string().min(6, '新密码不能少于 6 位').max(64),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || '参数错误' });
    return;
  }

  // 平台对接模式：密码由平台保存，改密代为提交给平台
  if (APP_CONFIG.platform.authMode === 'platform') {
    try {
      await changePasswordViaPlatform(
        req,
        parsed.data.oldPassword,
        parsed.data.newPassword
      );
    } catch (err) {
      sendAuthError(res, err);
      return;
    }
    res.json({ ok: true });
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
  if (APP_CONFIG.platform.authMode === 'platform') {
    res.status(403).json({ error: '姓名由个性化学习平台统一维护，请在平台修改' });
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

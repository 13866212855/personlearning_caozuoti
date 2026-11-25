import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  generateInviteCode,
  getDb,
  getDefaultRegistrationTarget,
  rowToQuestion,
  setDefaultRegistrationTarget,
} from '../db';
import { gradeAnswerDeterministic } from '../grader';
import { type AuthedRequest, requireTeacherAuth } from '../middleware/auth';
import {
  generateQuestionWithAi,
  getTeacherTodayAiUsage,
  recordAiGenerationUsage,
} from '../services/llm';
import type {
  DifficultyLevel,
  ExamQuestionResult,
  QuestionType,
  SimulatorState,
} from '../types';

const router = Router();
router.use(requireTeacherAuth);

function resolveTargetStudentIds(
  db: ReturnType<typeof getDb>,
  examId: string
): string[] {
  const assignments = db
    .prepare('SELECT target_type, target_id FROM exam_assignments WHERE exam_id = ?')
    .all(examId) as Array<{ target_type: string; target_id: string }>;

  const set = new Set<string>();
  for (const a of assignments) {
    if (a.target_type === 'student') {
      set.add(a.target_id);
    } else if (a.target_type === 'class') {
      const students = db
        .prepare("SELECT id FROM users WHERE role = 'student' AND class_id = ?")
        .all(a.target_id) as Array<{ id: string }>;
      for (const s of students) set.add(s.id);
    }
  }
  return Array.from(set);
}

function insertNotification(
  db: ReturnType<typeof getDb>,
  userId: string,
  senderId: string,
  type: string,
  title: string,
  content: string,
  link = '/'
) {
  db.prepare(
    `INSERT INTO notifications (id, user_id, sender_id, type, title, content, link, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    senderId,
    type,
    title,
    content,
    link,
    new Date().toISOString()
  );
}

// ==================== 1. Teacher Overview ====================
router.get('/overview', (req: AuthedRequest, res) => {
  const db = getDb();
  const teacherId = req.teacher!.id;

  const classRows = db
    .prepare('SELECT id, name, grade, invite_code FROM classes WHERE teacher_id = ?')
    .all(teacherId) as Array<{
    id: string;
    name: string;
    grade: string;
    invite_code: string;
  }>;

  const studentCountRow = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM users WHERE role = 'student' AND teacher_id = ?"
    )
    .get(teacherId) as { cnt: number };

  const examRows = db
    .prepare('SELECT * FROM exams WHERE teacher_id = ? ORDER BY created_at DESC')
    .all(teacherId) as Array<Record<string, unknown>>;

  const nowMs = Date.now();
  let activeOrPendingExams = 0;
  for (const e of examRows) {
    if (
      e.status === 'published' &&
      new Date(String(e.end_time)).getTime() >= nowMs
    ) {
      activeOrPendingExams += 1;
    }
  }

  const recentSubs = db
    .prepare(
      `SELECT es.final_score, es.max_score, es.exam_id
       FROM exam_submissions es
       INNER JOIN exams e ON es.exam_id = e.id
       WHERE e.teacher_id = ? AND es.status = 'submitted'
       ORDER BY es.submitted_at DESC LIMIT 100`
    )
    .all(teacherId) as Array<{
    final_score: number;
    max_score: number;
    exam_id: string;
  }>;

  let avgRate = 0;
  if (recentSubs.length > 0) {
    const sumPct = recentSubs.reduce(
      (s, r) => s + (r.max_score > 0 ? (r.final_score / r.max_score) * 100 : 0),
      0
    );
    avgRate = Math.round((sumPct / recentSubs.length) * 10) / 10;
  }

  const quota = getTeacherTodayAiUsage(teacherId);

  const recentExams = examRows.slice(0, 5).map((e) => {
    const assigned = resolveTargetStudentIds(db, String(e.id));
    const subCount = db
      .prepare(
        "SELECT COUNT(DISTINCT student_id) as cnt, AVG(CASE WHEN max_score > 0 THEN final_score * 100.0 / max_score ELSE 0 END) as avg_pct FROM exam_submissions WHERE exam_id = ? AND status = 'submitted'"
      )
      .get(e.id) as { cnt: number; avg_pct: number | null };

    return {
      id: e.id,
      title: e.title,
      status: e.status,
      startTime: e.start_time,
      endTime: e.end_time,
      assignedCount: assigned.length,
      submittedCount: Number(subCount?.cnt || 0),
      avgPct:
        subCount?.avg_pct !== null && subCount?.avg_pct !== undefined
          ? Math.round(Number(subCount.avg_pct) * 10) / 10
          : null,
    };
  });

  res.json({
    classCount: classRows.length,
    studentCount: studentCountRow.cnt,
    activeExamCount: activeOrPendingExams,
    totalExamCount: examRows.length,
    recentAvgScoreRate: avgRate,
    aiQuota: quota,
    classes: classRows,
    recentExams,
  });
});

// ==================== 2. Classes & Students ====================
router.get('/classes', (req: AuthedRequest, res) => {
  const db = getDb();
  const teacherId = req.teacher!.id;
  const rows = db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM users u WHERE u.role = 'student' AND u.class_id = c.id) as student_count
       FROM classes c
       WHERE c.teacher_id = ?
       ORDER BY c.created_at DESC`
    )
    .all(teacherId) as Array<Record<string, unknown>>;

  const defaultTarget = getDefaultRegistrationTarget(db);
  const isDefaultTeacher = defaultTarget?.teacherId === teacherId;

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      grade: r.grade,
      inviteCode: r.invite_code,
      studentCount: Number(r.student_count || 0),
      isDefaultRegistration:
        isDefaultTeacher && defaultTarget?.classId === String(r.id),
      createdAt: r.created_at,
    })),
    defaultRegistration: {
      isDefaultTeacher,
      defaultClassId: isDefaultTeacher ? defaultTarget?.classId || '' : '',
      defaultClassName: isDefaultTeacher ? defaultTarget?.className || '' : '',
    },
  });
});

router.get('/settings/default-registration', (req: AuthedRequest, res) => {
  const db = getDb();
  const teacherId = req.teacher!.id;
  const classes = db
    .prepare(
      'SELECT id, name, grade FROM classes WHERE teacher_id = ? ORDER BY created_at DESC'
    )
    .all(teacherId) as Array<{ id: string; name: string; grade: string }>;

  const defaultTarget = getDefaultRegistrationTarget(db);
  const isDefaultTeacher = defaultTarget?.teacherId === teacherId;

  res.json({
    isDefaultTeacher,
    defaultClassId: isDefaultTeacher ? defaultTarget?.classId || '' : '',
    defaultClassName: isDefaultTeacher ? defaultTarget?.className || '' : '',
    classes,
  });
});

router.put('/settings/default-registration', (req: AuthedRequest, res) => {
  const schema = z.object({
    enabled: z.boolean().default(true),
    classId: z.string().trim().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数格式不正确' });
    return;
  }

  const db = getDb();
  const teacherId = req.teacher!.id;

  try {
    if (!parsed.data.enabled) {
      const current = getDefaultRegistrationTarget(db);
      if (current?.teacherId === teacherId) {
        setDefaultRegistrationTarget(db, '');
      }
      res.json({
        ok: true,
        isDefaultTeacher: false,
        defaultClassId: '',
        defaultClassName: '',
      });
      return;
    }

    const updated = setDefaultRegistrationTarget(
      db,
      teacherId,
      parsed.data.classId || undefined
    );
    res.json({
      ok: true,
      isDefaultTeacher: true,
      defaultClassId: updated?.classId || '',
      defaultClassName: updated?.className || '',
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : '设置失败',
    });
  }
});

router.post('/classes', (req: AuthedRequest, res) => {
  const schema = z.object({
    name: z.string().trim().min(1, '班级名称不能为空').max(40),
    grade: z.string().trim().min(1, '年级不能为空').max(20),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || '参数错误' });
    return;
  }

  const db = getDb();
  const id = `cls-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let inviteCode = generateInviteCode();
  while (
    db.prepare('SELECT id FROM classes WHERE invite_code = ?').get(inviteCode)
  ) {
    inviteCode = generateInviteCode();
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO classes (id, name, grade, teacher_id, invite_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    parsed.data.name,
    parsed.data.grade,
    req.teacher!.id,
    inviteCode,
    now,
    now
  );

  res.status(201).json({
    item: {
      id,
      name: parsed.data.name,
      grade: parsed.data.grade,
      inviteCode,
      studentCount: 0,
      createdAt: now,
    },
  });
});

router.put('/classes/:id', (req: AuthedRequest, res) => {
  const schema = z.object({
    name: z.string().trim().min(1).max(40),
    grade: z.string().trim().min(1).max(20),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数不正确' });
    return;
  }
  const db = getDb();
  const cls = db
    .prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?')
    .get(String(req.params.id), req.teacher!.id);
  if (!cls) {
    res.status(404).json({ error: '班级不存在或无权编辑' });
    return;
  }
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE classes SET name = ?, grade = ?, updated_at = ? WHERE id = ?'
  ).run(parsed.data.name, parsed.data.grade, now, String(req.params.id));
  db.prepare(
    "UPDATE users SET class_name = ?, grade = ?, updated_at = ? WHERE class_id = ? AND role = 'student'"
  ).run(parsed.data.name, parsed.data.grade, now, String(req.params.id));
  res.json({ ok: true });
});

router.post('/classes/:id/reset-invite', (req: AuthedRequest, res) => {
  const db = getDb();
  const cls = db
    .prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?')
    .get(String(req.params.id), req.teacher!.id);
  if (!cls) {
    res.status(404).json({ error: '班级不存在' });
    return;
  }

  let inviteCode = generateInviteCode();
  while (
    db.prepare('SELECT id FROM classes WHERE invite_code = ?').get(inviteCode)
  ) {
    inviteCode = generateInviteCode();
  }

  db.prepare('UPDATE classes SET invite_code = ?, updated_at = ? WHERE id = ?').run(
    inviteCode,
    new Date().toISOString(),
    String(req.params.id)
  );
  res.json({ inviteCode });
});

router.get('/classes/:id/students', (req: AuthedRequest, res) => {
  const db = getDb();
  const classId = String(req.params.id);
  const cls = db
    .prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?')
    .get(classId, req.teacher!.id) as Record<string, unknown> | undefined;
  if (!cls) {
    res.status(404).json({ error: '班级不存在或无权查看' });
    return;
  }

  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 15)));
  const keyword = String(req.query.keyword || '').trim();

  const where = ["role = 'student'", 'class_id = ?', 'teacher_id = ?'];
  const args: unknown[] = [classId, req.teacher!.id];
  if (keyword) {
    where.push('(username LIKE ? OR real_name LIKE ? OR student_no LIKE ?)');
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const totalRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM users WHERE ${where.join(' AND ')}`)
    .get(...args) as { cnt: number };

  const rows = db
    .prepare(
      `SELECT id, username, real_name, grade, class_name, student_no, is_disabled, created_at
       FROM users WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, (page - 1) * pageSize) as Array<
    Record<string, unknown>
  >;

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      username: r.username,
      realName: r.real_name,
      grade: r.grade,
      className: r.class_name,
      studentNo: r.student_no,
      isDisabled: Boolean(r.is_disabled),
      createdAt: r.created_at,
    })),
    total: totalRow.cnt,
    page,
    pageSize,
  });
});

router.post('/classes/:id/students', async (req: AuthedRequest, res) => {
  const schema = z.object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9_]+$/, '用户名仅支持字母、数字和下划线'),
    realName: z.string().trim().min(1).max(32),
    studentNo: z.string().trim().max(32).default(''),
    password: z.string().min(6).max(64).default('123456'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || '格式不正确' });
    return;
  }

  const db = getDb();
  const classId = String(req.params.id);
  const cls = db
    .prepare('SELECT id, name, grade FROM classes WHERE id = ? AND teacher_id = ?')
    .get(classId, req.teacher!.id) as
    | { id: string; name: string; grade: string }
    | undefined;
  if (!cls) {
    res.status(404).json({ error: '班级不存在' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(parsed.data.username);
  if (existing) {
    res.status(409).json({ error: '该用户名已存在' });
    return;
  }

  const id = `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const hash = await bcrypt.hash(parsed.data.password, 8);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (
      id, username, password_hash, role, real_name, grade, class_name,
      student_no, teacher_id, class_id, is_disabled, must_change_password,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`
  ).run(
    id,
    parsed.data.username,
    hash,
    parsed.data.realName,
    cls.grade,
    cls.name,
    parsed.data.studentNo,
    req.teacher!.id,
    cls.id,
    now,
    now
  );

  res.status(201).json({ ok: true, studentId: id });
});

router.post('/classes/:id/import-csv', async (req: AuthedRequest, res) => {
  const schema = z.object({
    csvText: z.string().min(1, '请粘贴或上传 CSV 内容'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'CSV 内容不能为空' });
    return;
  }

  const db = getDb();
  const classId = String(req.params.id);
  const cls = db
    .prepare('SELECT id, name, grade FROM classes WHERE id = ? AND teacher_id = ?')
    .get(classId, req.teacher!.id) as
    | { id: string; name: string; grade: string }
    | undefined;
  if (!cls) {
    res.status(404).json({ error: '班级不存在' });
    return;
  }

  const lines = parsed.data.csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let createdCount = 0;
  const skipped: string[] = [];
  const now = new Date().toISOString();
  const hashCache = new Map<string, string>();

  const insertStmt = db.prepare(
    `INSERT INTO users (
      id, username, password_hash, role, real_name, grade, class_name,
      student_no, teacher_id, class_id, is_disabled, must_change_password,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`
  );

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.trim());
    if (
      i === 0 &&
      (parts[0]?.includes('用户名') || parts[0]?.toLowerCase() === 'username')
    ) {
      continue;
    }
    const [username, realName, studentNo = '', rawPwd = '123456'] = parts;
    if (!username || !realName || !/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      skipped.push(`第 ${i + 1} 行格式无效(${username || '空'})`);
      continue;
    }
    const exists = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(username);
    if (exists) {
      skipped.push(`用户名 ${username} 已存在`);
      continue;
    }
    const pwd = rawPwd.length >= 6 ? rawPwd : '123456';
    let pwdHash = hashCache.get(pwd);
    if (!pwdHash) {
      pwdHash = await bcrypt.hash(pwd, 8);
      hashCache.set(pwd, pwdHash);
    }
    insertStmt.run(
      `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
      username,
      pwdHash,
      realName,
      cls.grade,
      cls.name,
      studentNo,
      req.teacher!.id,
      cls.id,
      now,
      now
    );
    createdCount += 1;
  }

  res.json({ createdCount, skipped });
});

router.delete('/classes/:id/students/:studentId', (req: AuthedRequest, res) => {
  const db = getDb();
  const cls = db
    .prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?')
    .get(String(req.params.id), req.teacher!.id);
  if (!cls) {
    res.status(404).json({ error: '班级不存在' });
    return;
  }

  db.prepare(
    "UPDATE users SET class_id = '', teacher_id = '', class_name = '未分配班级', updated_at = ? WHERE id = ? AND class_id = ? AND teacher_id = ? AND role = 'student'"
  ).run(
    new Date().toISOString(),
    String(req.params.studentId),
    String(req.params.id),
    req.teacher!.id
  );

  res.json({ ok: true });
});

router.post('/students/:studentId/reset-password', async (req: AuthedRequest, res) => {
  const schema = z.object({
    newPassword: z.string().min(6, '密码不能少于 6 位').max(64),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || '参数错误' });
    return;
  }

  const db = getDb();
  const stu = db
    .prepare(
      "SELECT id FROM users WHERE id = ? AND role = 'student' AND teacher_id = ?"
    )
    .get(String(req.params.studentId), req.teacher!.id);
  if (!stu) {
    res.status(404).json({ error: '学生不存在或不属于您名下班级' });
    return;
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 8);
  db.prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?'
  ).run(
    newHash,
    new Date().toISOString(),
    String(req.params.studentId)
  );
  res.json({ ok: true });
});

router.get('/students', (req: AuthedRequest, res) => {
  const db = getDb();
  const classId = String(req.query.classId || '');
  const keyword = String(req.query.keyword || '').trim();
  const where = ["role = 'student'", 'teacher_id = ?'];
  const args: unknown[] = [req.teacher!.id];
  if (classId) {
    where.push('class_id = ?');
    args.push(classId);
  }
  if (keyword) {
    where.push('(real_name LIKE ? OR username LIKE ? OR student_no LIKE ?)');
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const rows = db
    .prepare(
      `SELECT id, username, real_name, grade, class_name, student_no, class_id
       FROM users WHERE ${where.join(' AND ')} ORDER BY real_name ASC`
    )
    .all(...args) as Array<Record<string, unknown>>;

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      username: r.username,
      realName: r.real_name,
      grade: r.grade,
      className: r.class_name,
      studentNo: r.student_no,
      classId: r.class_id,
    })),
  });
});

// ==================== 3. Knowledge Points & Question Bank / AI Studio ====================
router.get('/knowledge-points', (req: AuthedRequest, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT * FROM knowledge_points WHERE is_system = 1 OR owner_id = ? ORDER BY type ASC, is_system DESC, chapter ASC, name ASC'
    )
    .all(req.teacher!.id) as Array<{
    id: string;
    type: QuestionType;
    chapter: string;
    name: string;
    is_system: number;
    owner_id: string;
  }>;

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      chapter: r.chapter,
      name: r.name,
      isSystem: Boolean(r.is_system),
    })),
  });
});

router.post('/knowledge-points', (req: AuthedRequest, res) => {
  const schema = z.object({
    type: z.enum(['word', 'excel', 'web', 'file']),
    chapter: z.string().trim().min(1).max(40).default('教师自定义'),
    name: z.string().trim().min(1, '知识点名称不能为空').max(40),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || '参数错误' });
    return;
  }

  const db = getDb();
  const id = `kp-t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(
    `INSERT INTO knowledge_points (id, type, chapter, name, is_system, owner_id, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    parsed.data.type,
    parsed.data.chapter,
    parsed.data.name,
    req.teacher!.id,
    new Date().toISOString()
  );

  res.status(201).json({
    item: {
      id,
      type: parsed.data.type,
      chapter: parsed.data.chapter,
      name: parsed.data.name,
      isSystem: false,
    },
  });
});

router.post('/questions/ai-generate', async (req: AuthedRequest, res) => {
  const schema = z.object({
    type: z.enum(['word', 'excel', 'web', 'file']),
    difficulty: z.enum(['基础', '中等', '提高']).default('中等'),
    count: z.number().int().min(1).max(5).default(1),
    stepCount: z.number().int().min(3).max(8).default(4),
    totalScore: z.number().int().min(10).max(200).default(100),
    needsImage: z.boolean().optional(),
    knowledgePoints: z.array(z.string()).default([]),
    knowledgePointIds: z.array(z.string()).default([]),
    customPrompt: z.string().max(600).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '出题参数格式错误' });
    return;
  }

  const quota = getTeacherTodayAiUsage(req.teacher!.id);
  if (quota.used + parsed.data.count > quota.limit) {
    res.status(429).json({
      error: `今日 AI 生成题目额度已用尽（已生成 ${quota.used}/${quota.limit} 题），请联系超级管理员调整限额`,
    });
    return;
  }

  const generated = [];
  const errors: string[] = [];

  for (let i = 0; i < parsed.data.count; i++) {
    try {
      const q = await generateQuestionWithAi({
        type: parsed.data.type,
        difficulty: parsed.data.difficulty,
        knowledgePoints: parsed.data.knowledgePoints,
        knowledgePointIds: parsed.data.knowledgePointIds,
        customPrompt: parsed.data.customPrompt,
        stepCount: parsed.data.stepCount,
        totalScore: parsed.data.totalScore,
        needsImage: parsed.data.needsImage,
        status: 'published',
        ownerId: req.teacher!.id,
        visibility: 'private',
      });
      recordAiGenerationUsage(req.teacher!.id, 'teacher', 1);
      generated.push(q);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : '生成失败');
    }
  }

  if (generated.length === 0) {
    res.status(502).json({
      error: errors[0] || 'AI 生成题目失败，请调整知识点或重试',
    });
    return;
  }

  res.json({
    questions: generated,
    errors,
    quota: getTeacherTodayAiUsage(req.teacher!.id),
  });
});

// Teacher "试做" simulator verification
router.post('/questions/test-grade', (req: AuthedRequest, res) => {
  const schema = z.object({
    type: z.enum(['word', 'excel', 'web', 'file']),
    checkpoints: z.array(z.record(z.string(), z.unknown())),
    answer: z.record(z.string(), z.unknown()),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '试做判分参数错误' });
    return;
  }

  const grade = gradeAnswerDeterministic(
    parsed.data.type,
    parsed.data.checkpoints as never,
    parsed.data.answer as unknown as SimulatorState
  );
  res.json(grade);
});

router.get('/questions', (req: AuthedRequest, res) => {
  const db = getDb();
  const scope = String(req.query.scope || 'all'); // all | mine | system | shared
  const type = String(req.query.type || '');
  const difficulty = String(req.query.difficulty || '');
  const kp = String(req.query.knowledgePoint || '');
  const keyword = String(req.query.keyword || '').trim();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 10)));

  const where: string[] = ["q.status = 'published'"];
  const args: unknown[] = [];

  if (scope === 'mine') {
    where.push('q.owner_id = ?');
    args.push(req.teacher!.id);
  } else if (scope === 'system') {
    where.push("q.visibility = 'public'");
  } else if (scope === 'shared') {
    where.push("q.visibility = 'shared'");
  } else {
    where.push(
      "(q.owner_id = ? OR q.visibility IN ('public', 'shared'))"
    );
    args.push(req.teacher!.id);
  }

  if (type && ['word', 'excel', 'web', 'file'].includes(type)) {
    where.push('q.type = ?');
    args.push(type);
  }
  if (difficulty && ['基础', '中等', '提高'].includes(difficulty)) {
    where.push('q.difficulty = ?');
    args.push(difficulty);
  }
  if (kp) {
    where.push('q.knowledge_points_json LIKE ?');
    args.push(`%${kp}%`);
  }
  if (keyword) {
    where.push('(q.title LIKE ? OR q.scenario LIKE ? OR q.knowledge_points_json LIKE ?)');
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const whereSql = where.join(' AND ');
  const totalRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM questions q WHERE ${whereSql}`)
    .get(...args) as { cnt: number };

  const rows = db
    .prepare(
      `SELECT q.*, u.real_name as owner_name
       FROM questions q
       LEFT JOIN users u ON q.owner_id = u.id
       WHERE ${whereSql}
       ORDER BY q.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, (page - 1) * pageSize) as Array<
    Record<string, unknown>
  >;

  res.json({
    items: rows.map((r) => ({
      ...rowToQuestion(r),
      ownerName:
        String(r.owner_id) === 'system'
          ? '系统题库'
          : String(r.owner_name || '教师'),
      isOwner: String(r.owner_id) === req.teacher!.id,
    })),
    total: totalRow.cnt,
    page,
    pageSize,
  });
});

router.post('/questions', (req: AuthedRequest, res) => {
  const schema = z.object({
    title: z.string().trim().min(2),
    type: z.enum(['word', 'excel', 'web', 'file']),
    difficulty: z.enum(['基础', '中等', '提高']),
    knowledgePoints: z.array(z.string()).default([]),
    knowledgePointIds: z.array(z.string()).default([]),
    scenario: z.string().min(5),
    totalScore: z.number().positive().default(100),
    materials: z.record(z.string(), z.unknown()),
    steps: z.array(z.record(z.string(), z.unknown())),
    checkpoints: z.array(z.record(z.string(), z.unknown())),
    referenceAnswer: z.record(z.string(), z.unknown()),
    analysis: z.array(z.string()).default([]),
    commonMistakes: z.array(z.string()).default([]),
    visibility: z.enum(['private', 'shared']).default('private'),
    source: z.enum(['seed', 'ai']).default('ai'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '题目字段格式不完整' });
    return;
  }

  const db = getDb();
  const d = parsed.data;
  const id = `tq-${d.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO questions (
      id, title, type, difficulty, knowledge_points_json, knowledge_point_ids_json,
      scenario, total_score, materials_json, steps_json, checkpoints_json,
      reference_answer_json, analysis_json, common_mistakes_json,
      status, source, owner_id, visibility, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)`
  ).run(
    id,
    d.title,
    d.type,
    d.difficulty,
    JSON.stringify(d.knowledgePoints),
    JSON.stringify(d.knowledgePointIds),
    d.scenario,
    d.totalScore,
    JSON.stringify(d.materials),
    JSON.stringify(d.steps),
    JSON.stringify(d.checkpoints),
    JSON.stringify(d.referenceAnswer),
    JSON.stringify(d.analysis),
    JSON.stringify(d.commonMistakes),
    d.source,
    req.teacher!.id,
    d.visibility,
    now,
    now
  );

  res.status(201).json({ id });
});

router.put('/questions/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM questions WHERE id = ?')
    .get(String(req.params.id)) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }
  if (String(row.owner_id) !== req.teacher!.id) {
    res.status(403).json({ error: '仅可编辑自己创建的题目，系统或共享题请先复制后再编辑' });
    return;
  }

  const q = rowToQuestion(row);
  const body = req.body as Record<string, unknown>;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE questions SET
      title = ?, difficulty = ?, knowledge_points_json = ?, scenario = ?,
      total_score = ?, materials_json = ?, steps_json = ?, checkpoints_json = ?,
      reference_answer_json = ?, analysis_json = ?, common_mistakes_json = ?,
      visibility = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    String(body.title ?? q.title),
    String(body.difficulty ?? q.difficulty),
    JSON.stringify(body.knowledgePoints ?? q.knowledgePoints),
    String(body.scenario ?? q.scenario),
    Number(body.totalScore ?? q.totalScore),
    JSON.stringify(body.materials ?? q.materials),
    JSON.stringify(body.steps ?? q.steps),
    JSON.stringify(body.checkpoints ?? q.checkpoints),
    JSON.stringify(body.referenceAnswer ?? q.referenceAnswer),
    JSON.stringify(body.analysis ?? q.analysis),
    JSON.stringify(body.commonMistakes ?? q.commonMistakes),
    body.visibility === 'shared' ? 'shared' : 'private',
    now,
    q.id
  );

  res.json({ ok: true });
});

router.post('/questions/:id/copy', (req: AuthedRequest, res) => {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM questions WHERE id = ? AND (owner_id = ? OR visibility IN ('public', 'shared'))"
    )
    .get(String(req.params.id), req.teacher!.id) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    res.status(404).json({ error: '原题目不存在或无权复制' });
    return;
  }

  const q = rowToQuestion(row);
  const newId = `tq-${q.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO questions (
      id, title, type, difficulty, knowledge_points_json, knowledge_point_ids_json,
      scenario, total_score, materials_json, steps_json, checkpoints_json,
      reference_answer_json, analysis_json, common_mistakes_json,
      status, source, owner_id, visibility, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, 'private', ?, ?)`
  ).run(
    newId,
    `${q.title}（副本）`,
    q.type,
    q.difficulty,
    JSON.stringify(q.knowledgePoints),
    JSON.stringify(q.knowledgePointIds || []),
    q.scenario,
    q.totalScore,
    JSON.stringify(q.materials),
    JSON.stringify(q.steps),
    JSON.stringify(q.checkpoints),
    JSON.stringify(q.referenceAnswer),
    JSON.stringify(q.analysis),
    JSON.stringify(q.commonMistakes),
    q.source,
    req.teacher!.id,
    now,
    now
  );

  res.status(201).json({ id: newId });
});

router.delete('/questions/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const info = db
    .prepare('DELETE FROM questions WHERE id = ? AND owner_id = ?')
    .run(String(req.params.id), req.teacher!.id);
  if (info.changes === 0) {
    res.status(403).json({ error: '仅可删除自己创建的题目' });
    return;
  }
  res.json({ ok: true });
});

router.post('/questions/assign', (req: AuthedRequest, res) => {
  const schema = z.object({
    title: z.string().trim().max(80).optional(),
    questionIds: z
      .array(z.string().trim().min(1))
      .min(1, '请至少选择 1 道试题')
      .max(30),
    targetType: z.enum(['class', 'student']).default('class'),
    targetIds: z
      .array(z.string().trim().min(1))
      .min(1, '请至少选择 1 个班级或学生'),
    duration: z.number().int().min(5).max(300).default(40),
    maxAttempts: z.number().int().min(1).max(20).default(3),
    showAnswerPolicy: z
      .enum(['immediate', 'after_end', 'never'])
      .default('immediate'),
    antiCheatSwitch: z.boolean().default(false),
    validDays: z.number().int().min(1).max(365).default(90),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message || '分配参数错误' });
    return;
  }

  const db = getDb();
  const teacherId = req.teacher!.id;
  const d = parsed.data;
  const uniqueQuestionIds = Array.from(new Set(d.questionIds));
  const uniqueTargetIds = Array.from(new Set(d.targetIds));

  const qPlaceholders = uniqueQuestionIds.map(() => '?').join(', ');
  const qRows = db
    .prepare(
      `SELECT id, title, total_score
       FROM questions
       WHERE status = 'published'
         AND (owner_id = ? OR visibility IN ('public', 'shared'))
         AND id IN (${qPlaceholders})`
    )
    .all(teacherId, ...uniqueQuestionIds) as Array<{
    id: string;
    title: string;
    total_score: number;
  }>;

  const qMap = new Map(qRows.map((q) => [q.id, q]));
  if (qMap.size !== uniqueQuestionIds.length) {
    res.status(400).json({ error: '部分所选试题不存在或无权使用' });
    return;
  }

  const tPlaceholders = uniqueTargetIds.map(() => '?').join(', ');
  if (d.targetType === 'class') {
    const ownedClasses = db
      .prepare(
        `SELECT id FROM classes WHERE teacher_id = ? AND id IN (${tPlaceholders})`
      )
      .all(teacherId, ...uniqueTargetIds) as Array<{ id: string }>;
    if (ownedClasses.length !== uniqueTargetIds.length) {
      res.status(403).json({ error: '只能将试题分配给本人名下的班级' });
      return;
    }
  } else {
    const ownedStudents = db
      .prepare(
        `SELECT id FROM users WHERE role = 'student' AND teacher_id = ? AND id IN (${tPlaceholders})`
      )
      .all(teacherId, ...uniqueTargetIds) as Array<{ id: string }>;
    if (ownedStudents.length !== uniqueTargetIds.length) {
      res.status(403).json({ error: '只能将试题分配给本人名下的学生' });
      return;
    }
  }

  const firstTitle = qMap.get(uniqueQuestionIds[0])?.title || '操作题练习';
  const examTitle =
    d.title && d.title.length >= 2
      ? d.title
      : uniqueQuestionIds.length === 1
        ? `操作练习：${firstTitle}`.slice(0, 78)
        : `专项操作练习（共 ${uniqueQuestionIds.length} 题）`;

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const endTime = new Date(
    nowDate.getTime() + d.validDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const examId = `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let notifiedCount = 0;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO exams (
        id, title, description, teacher_id, duration, start_time, end_time,
        max_attempts, score_policy, show_score_immediately, show_answer_policy,
        shuffle, anti_cheat_switch, allow_late, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'highest', 1, ?, 0, ?, 1, 'published', ?, ?)`
    ).run(
      examId,
      examTitle,
      '教师从题库直接分配的专项操作练习，完成后可立即查看判分与解析。',
      teacherId,
      d.duration,
      now,
      endTime,
      d.maxAttempts,
      d.showAnswerPolicy,
      d.antiCheatSwitch ? 1 : 0,
      now,
      now
    );

    const insQ = db.prepare(
      'INSERT INTO exam_questions (id, exam_id, question_id, sort_order, score) VALUES (?, ?, ?, ?, ?)'
    );
    uniqueQuestionIds.forEach((qid, idx) => {
      const qRow = qMap.get(qid)!;
      insQ.run(
        `eq-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        examId,
        qid,
        idx + 1,
        Number(qRow.total_score || 100)
      );
    });

    const insA = db.prepare(
      'INSERT INTO exam_assignments (id, exam_id, target_type, target_id) VALUES (?, ?, ?, ?)'
    );
    uniqueTargetIds.forEach((tid, idx) => {
      insA.run(
        `ea-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        examId,
        d.targetType,
        tid
      );
    });

    const targetStudents = resolveTargetStudentIds(db, examId);
    notifiedCount = targetStudents.length;
    for (const sid of targetStudents) {
      insertNotification(
        db,
        sid,
        teacherId,
        'exam_published',
        `新练习任务：${examTitle}`,
        `${req.teacher!.realName}老师为您分配了「${examTitle}」（共 ${uniqueQuestionIds.length} 道操作题），可前往开始作答。`,
        '/'
      );
    }
  });

  tx();
  res.status(201).json({
    examId,
    title: examTitle,
    questionCount: uniqueQuestionIds.length,
    assignedStudentCount: notifiedCount,
  });
});

// ==================== 4. Teacher Exam Management ====================
router.post('/exams/auto-pick', (req: AuthedRequest, res) => {
  const schema = z.object({
    type: z.enum(['word', 'excel', 'web', 'file', '']).default(''),
    difficulty: z.enum(['基础', '中等', '提高', '']).default(''),
    knowledgePoint: z.string().default(''),
    count: z.number().int().min(1).max(20).default(2),
    excludeIds: z.array(z.string()).default([]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '随机抽题参数错误' });
    return;
  }

  const db = getDb();
  const where = [
    "status = 'published'",
    "(owner_id = ? OR visibility IN ('public', 'shared'))",
  ];
  const args: unknown[] = [req.teacher!.id];
  if (parsed.data.type) {
    where.push('type = ?');
    args.push(parsed.data.type);
  }
  if (parsed.data.difficulty) {
    where.push('difficulty = ?');
    args.push(parsed.data.difficulty);
  }
  if (parsed.data.knowledgePoint) {
    where.push('knowledge_points_json LIKE ?');
    args.push(`%${parsed.data.knowledgePoint}%`);
  }

  let candidates = db
    .prepare(`SELECT * FROM questions WHERE ${where.join(' AND ')}`)
    .all(...args) as Array<Record<string, unknown>>;

  const excludeSet = new Set(parsed.data.excludeIds);
  candidates = candidates.filter((c) => !excludeSet.has(String(c.id)));

  // Shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const picked = candidates.slice(0, parsed.data.count).map(rowToQuestion);
  res.json({ questions: picked });
});

const ExamPayloadSchema = z.object({
  title: z.string().trim().min(2, '考试名称至少 2 个字').max(80),
  description: z.string().max(500).default(''),
  duration: z.number().int().min(5).max(300).default(40),
  startTime: z.string().min(10),
  endTime: z.string().min(10),
  maxAttempts: z.number().int().min(1).max(20).default(1),
  scorePolicy: z.enum(['highest', 'latest']).default('highest'),
  showScoreImmediately: z.boolean().default(true),
  showAnswerPolicy: z.enum(['immediate', 'after_end', 'never']).default('after_end'),
  shuffle: z.boolean().default(false),
  antiCheatSwitch: z.boolean().default(true),
  allowLate: z.boolean().default(false),
  publishNow: z.boolean().default(false),
  questions: z
    .array(
      z.object({
        questionId: z.string().min(1),
        score: z.number().int().min(1).max(500).default(100),
      })
    )
    .min(1, '请至少选择 1 道题目'),
  assignments: z
    .array(
      z.object({
        targetType: z.enum(['class', 'student']),
        targetId: z.string().min(1),
      })
    )
    .min(1, '请至少指派 1 个班级或学生'),
});

router.get('/exams', (req: AuthedRequest, res) => {
  const db = getDb();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)));
  const statusFilter = String(req.query.status || '');
  const keyword = String(req.query.keyword || '').trim();

  const where = ['teacher_id = ?'];
  const args: unknown[] = [req.teacher!.id];
  if (statusFilter) {
    where.push('status = ?');
    args.push(statusFilter);
  }
  if (keyword) {
    where.push('title LIKE ?');
    args.push(`%${keyword}%`);
  }

  const totalRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM exams WHERE ${where.join(' AND ')}`)
    .get(...args) as { cnt: number };

  const rows = db
    .prepare(
      `SELECT * FROM exams WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, (page - 1) * pageSize) as Array<
    Record<string, unknown>
  >;

  const nowMs = Date.now();
  const items = rows.map((e) => {
    const examId = String(e.id);
    const qInfo = db
      .prepare(
        'SELECT COUNT(*) as cnt, COALESCE(SUM(score), 0) as total_score FROM exam_questions WHERE exam_id = ?'
      )
      .get(examId) as { cnt: number; total_score: number };

    const assignRows = db
      .prepare('SELECT target_type, target_id FROM exam_assignments WHERE exam_id = ?')
      .all(examId) as Array<{ target_type: string; target_id: string }>;

    const targetNames: string[] = [];
    for (const a of assignRows) {
      if (a.target_type === 'class') {
        const c = db
          .prepare('SELECT name FROM classes WHERE id = ?')
          .get(a.target_id) as { name: string } | undefined;
        if (c) targetNames.push(c.name);
      } else {
        const u = db
          .prepare('SELECT real_name FROM users WHERE id = ?')
          .get(a.target_id) as { real_name: string } | undefined;
        if (u) targetNames.push(u.real_name);
      }
    }

    const assignedStudents = resolveTargetStudentIds(db, examId);
    const subStats = db
      .prepare(
        "SELECT COUNT(DISTINCT student_id) as sub_cnt, AVG(final_score) as avg_score FROM exam_submissions WHERE exam_id = ? AND status = 'submitted'"
      )
      .get(examId) as { sub_cnt: number; avg_score: number | null };

    let runtimeStatus = String(e.status);
    if (runtimeStatus === 'published') {
      const startMs = new Date(String(e.start_time)).getTime();
      const endMs = new Date(String(e.end_time)).getTime();
      if (nowMs >= startMs && nowMs <= endMs) {
        runtimeStatus = 'in_progress';
      } else if (nowMs > endMs) {
        runtimeStatus = 'ended';
      }
    }

    return {
      id: examId,
      title: e.title,
      description: e.description,
      duration: e.duration,
      startTime: e.start_time,
      endTime: e.end_time,
      status: e.status,
      runtimeStatus,
      questionCount: qInfo.cnt,
      totalScore: qInfo.total_score,
      targetSummary: targetNames.join('、') || '未指派',
      assignedCount: assignedStudents.length,
      submittedCount: Number(subStats?.sub_cnt || 0),
      avgScore:
        subStats?.avg_score !== null && subStats?.avg_score !== undefined
          ? Math.round(Number(subStats.avg_score) * 10) / 10
          : null,
      createdAt: e.created_at,
    };
  });

  res.json({ items, total: totalRow.cnt, page, pageSize });
});

router.get('/exams/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const exam = db
    .prepare('SELECT * FROM exams WHERE id = ? AND teacher_id = ?')
    .get(String(req.params.id), req.teacher!.id) as
    | Record<string, unknown>
    | undefined;
  if (!exam) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }

  const eqRows = db
    .prepare(
      `SELECT eq.sort_order, eq.score, q.*
       FROM exam_questions eq
       INNER JOIN questions q ON eq.question_id = q.id
       WHERE eq.exam_id = ?
       ORDER BY eq.sort_order ASC`
    )
    .all(String(exam.id)) as Array<Record<string, unknown>>;

  const assignRows = db
    .prepare('SELECT target_type, target_id FROM exam_assignments WHERE exam_id = ?')
    .all(String(exam.id)) as Array<{ target_type: string; target_id: string }>;

  res.json({
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      duration: exam.duration,
      startTime: exam.start_time,
      endTime: exam.end_time,
      maxAttempts: exam.max_attempts,
      scorePolicy: exam.score_policy,
      showScoreImmediately: Boolean(exam.show_score_immediately),
      showAnswerPolicy: exam.show_answer_policy,
      shuffle: Boolean(exam.shuffle),
      antiCheatSwitch: Boolean(exam.anti_cheat_switch),
      allowLate: Boolean(exam.allow_late),
      status: exam.status,
    },
    questions: eqRows.map((r) => ({
      ...rowToQuestion(r),
      examScore: Number(r.score),
      sortOrder: Number(r.sort_order),
    })),
    assignments: assignRows.map((a) => ({
      targetType: a.target_type,
      targetId: a.target_id,
    })),
  });
});

router.post('/exams', (req: AuthedRequest, res) => {
  const parsed = ExamPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || '考试参数错误' });
    return;
  }

  const db = getDb();
  const d = parsed.data;
  const examId = `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const status = d.publishNow ? 'published' : 'draft';

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO exams (
        id, title, description, teacher_id, duration, start_time, end_time,
        max_attempts, score_policy, show_score_immediately, show_answer_policy,
        shuffle, anti_cheat_switch, allow_late, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      examId,
      d.title,
      d.description,
      req.teacher!.id,
      d.duration,
      d.startTime,
      d.endTime,
      d.maxAttempts,
      d.scorePolicy,
      d.showScoreImmediately ? 1 : 0,
      d.showAnswerPolicy,
      d.shuffle ? 1 : 0,
      d.antiCheatSwitch ? 1 : 0,
      d.allowLate ? 1 : 0,
      status,
      now,
      now
    );

    const insQ = db.prepare(
      'INSERT INTO exam_questions (id, exam_id, question_id, sort_order, score) VALUES (?, ?, ?, ?, ?)'
    );
    d.questions.forEach((q, idx) => {
      insQ.run(
        `eq-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        examId,
        q.questionId,
        idx + 1,
        q.score
      );
    });

    const insA = db.prepare(
      'INSERT INTO exam_assignments (id, exam_id, target_type, target_id) VALUES (?, ?, ?, ?)'
    );
    d.assignments.forEach((a, idx) => {
      insA.run(
        `ea-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        examId,
        a.targetType,
        a.targetId
      );
    });

    if (status === 'published') {
      const targetStudents = resolveTargetStudentIds(db, examId);
      for (const sid of targetStudents) {
        insertNotification(
          db,
          sid,
          req.teacher!.id,
          'exam_published',
          `新考试发布：${d.title}`,
          `${req.teacher!.realName}发布了新考试「${d.title}」，截止时间 ${new Date(d.endTime).toLocaleString('zh-CN')}，请按时参加。`,
          '/'
        );
      }
    }
  });

  tx();
  res.status(201).json({ examId, status });
});

router.put('/exams/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const examId = String(req.params.id);
  const existing = db
    .prepare('SELECT status FROM exams WHERE id = ? AND teacher_id = ?')
    .get(examId, req.teacher!.id) as { status: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }
  if (existing.status !== 'draft') {
    res.status(400).json({ error: '已发布的考试不允许修改题目，如需调整请先「复制为新考试」' });
    return;
  }

  const parsed = ExamPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || '参数错误' });
    return;
  }
  const d = parsed.data;
  const now = new Date().toISOString();
  const status = d.publishNow ? 'published' : 'draft';

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE exams SET
        title = ?, description = ?, duration = ?, start_time = ?, end_time = ?,
        max_attempts = ?, score_policy = ?, show_score_immediately = ?,
        show_answer_policy = ?, shuffle = ?, anti_cheat_switch = ?, allow_late = ?,
        status = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      d.title,
      d.description,
      d.duration,
      d.startTime,
      d.endTime,
      d.maxAttempts,
      d.scorePolicy,
      d.showScoreImmediately ? 1 : 0,
      d.showAnswerPolicy,
      d.shuffle ? 1 : 0,
      d.antiCheatSwitch ? 1 : 0,
      d.allowLate ? 1 : 0,
      status,
      now,
      examId
    );

    db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(examId);
    const insQ = db.prepare(
      'INSERT INTO exam_questions (id, exam_id, question_id, sort_order, score) VALUES (?, ?, ?, ?, ?)'
    );
    d.questions.forEach((q, idx) => {
      insQ.run(
        `eq-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        examId,
        q.questionId,
        idx + 1,
        q.score
      );
    });

    db.prepare('DELETE FROM exam_assignments WHERE exam_id = ?').run(examId);
    const insA = db.prepare(
      'INSERT INTO exam_assignments (id, exam_id, target_type, target_id) VALUES (?, ?, ?, ?)'
    );
    d.assignments.forEach((a, idx) => {
      insA.run(
        `ea-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        examId,
        a.targetType,
        a.targetId
      );
    });

    if (status === 'published') {
      const targetStudents = resolveTargetStudentIds(db, examId);
      for (const sid of targetStudents) {
        insertNotification(
          db,
          sid,
          req.teacher!.id,
          'exam_published',
          `新考试发布：${d.title}`,
          `${req.teacher!.realName}发布了新考试「${d.title}」，请及时作答。`,
          '/'
        );
      }
    }
  });

  tx();
  res.json({ ok: true, status });
});

router.post('/exams/:id/publish', (req: AuthedRequest, res) => {
  const db = getDb();
  const examId = String(req.params.id);
  const exam = db
    .prepare('SELECT * FROM exams WHERE id = ? AND teacher_id = ?')
    .get(examId, req.teacher!.id) as Record<string, unknown> | undefined;
  if (!exam) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }
  db.prepare(
    "UPDATE exams SET status = 'published', updated_at = ? WHERE id = ?"
  ).run(new Date().toISOString(), examId);

  const targets = resolveTargetStudentIds(db, examId);
  for (const sid of targets) {
    insertNotification(
      db,
      sid,
      req.teacher!.id,
      'exam_published',
      `新考试发布：${exam.title}`,
      `${req.teacher!.realName}发布了考试「${exam.title}」，请进入模拟考试页面作答。`,
      '/'
    );
  }
  res.json({ ok: true });
});

router.post('/exams/:id/end', (req: AuthedRequest, res) => {
  const db = getDb();
  const info = db
    .prepare(
      "UPDATE exams SET status = 'ended', updated_at = ? WHERE id = ? AND teacher_id = ?"
    )
    .run(new Date().toISOString(), String(req.params.id), req.teacher!.id);
  if (info.changes === 0) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }
  res.json({ ok: true });
});

router.post('/exams/:id/copy', (req: AuthedRequest, res) => {
  const db = getDb();
  const srcId = String(req.params.id);
  const exam = db
    .prepare('SELECT * FROM exams WHERE id = ? AND teacher_id = ?')
    .get(srcId, req.teacher!.id) as Record<string, unknown> | undefined;
  if (!exam) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }

  const newId = `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const qs = db
    .prepare('SELECT question_id, sort_order, score FROM exam_questions WHERE exam_id = ?')
    .all(srcId) as Array<{ question_id: string; sort_order: number; score: number }>;
  const assigns = db
    .prepare('SELECT target_type, target_id FROM exam_assignments WHERE exam_id = ?')
    .all(srcId) as Array<{ target_type: string; target_id: string }>;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO exams (
        id, title, description, teacher_id, duration, start_time, end_time,
        max_attempts, score_policy, show_score_immediately, show_answer_policy,
        shuffle, anti_cheat_switch, allow_late, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
    ).run(
      newId,
      `${exam.title}（副本）`,
      exam.description,
      req.teacher!.id,
      exam.duration,
      exam.start_time,
      exam.end_time,
      exam.max_attempts,
      exam.score_policy,
      exam.show_score_immediately,
      exam.show_answer_policy,
      exam.shuffle,
      exam.anti_cheat_switch,
      exam.allow_late,
      now,
      now
    );

    const insQ = db.prepare(
      'INSERT INTO exam_questions (id, exam_id, question_id, sort_order, score) VALUES (?, ?, ?, ?, ?)'
    );
    qs.forEach((q, idx) => {
      insQ.run(
        `eq-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        newId,
        q.question_id,
        q.sort_order,
        q.score
      );
    });

    const insA = db.prepare(
      'INSERT INTO exam_assignments (id, exam_id, target_type, target_id) VALUES (?, ?, ?, ?)'
    );
    assigns.forEach((a, idx) => {
      insA.run(
        `ea-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        newId,
        a.target_type,
        a.target_id
      );
    });
  });

  tx();
  res.status(201).json({ examId: newId });
});

router.delete('/exams/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const examId = String(req.params.id);
  const exam = db
    .prepare('SELECT status FROM exams WHERE id = ? AND teacher_id = ?')
    .get(examId, req.teacher!.id) as { status: string } | undefined;
  if (!exam) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }
  if (exam.status !== 'draft') {
    res.status(400).json({ error: '仅草稿状态的考试可以直接删除' });
    return;
  }

  db.transaction(() => {
    db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(examId);
    db.prepare('DELETE FROM exam_assignments WHERE exam_id = ?').run(examId);
    db.prepare('DELETE FROM exams WHERE id = ?').run(examId);
  })();
  res.json({ ok: true });
});

// ==================== 5. Grading, Analytics & Remedial Loop ====================
router.get('/exams/:id/results', (req: AuthedRequest, res) => {
  const db = getDb();
  const examId = String(req.params.id);
  const exam = db
    .prepare('SELECT * FROM exams WHERE id = ? AND teacher_id = ?')
    .get(examId, req.teacher!.id) as Record<string, unknown> | undefined;
  if (!exam) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }

  const classIdFilter = String(req.query.classId || '');
  const keyword = String(req.query.keyword || '').trim();
  const lateOnly = req.query.lateOnly === 'true';

  const where = ['es.exam_id = ?', "es.status = 'submitted'"];
  const args: unknown[] = [examId];
  if (classIdFilter) {
    where.push('u.class_id = ?');
    args.push(classIdFilter);
  }
  if (keyword) {
    where.push('(u.real_name LIKE ? OR u.username LIKE ? OR u.student_no LIKE ?)');
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (lateOnly) {
    where.push('es.is_late = 1');
  }

  const rows = db
    .prepare(
      `SELECT es.*, u.real_name, u.username, u.student_no, u.class_name, u.class_id
       FROM exam_submissions es
       INNER JOIN users u ON es.student_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY es.submitted_at DESC`
    )
    .all(...args) as Array<Record<string, unknown>>;

  res.json({
    exam: {
      id: exam.id,
      title: exam.title,
      status: exam.status,
    },
    items: rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      studentName: r.real_name,
      username: r.username,
      studentNo: r.student_no || '-',
      className: r.class_name,
      classId: r.class_id,
      attemptNo: r.attempt_no,
      autoScore: r.auto_score,
      finalScore: r.final_score,
      maxScore: r.max_score,
      durationSeconds: r.duration_seconds,
      switchCount: r.switch_count,
      isLate: Boolean(r.is_late),
      teacherComment: r.teacher_comment,
      submittedAt: r.submitted_at,
    })),
  });
});

router.get('/exams/:id/export', (req: AuthedRequest, res) => {
  const db = getDb();
  const examId = String(req.params.id);
  const exam = db
    .prepare('SELECT id, title FROM exams WHERE id = ? AND teacher_id = ?')
    .get(examId, req.teacher!.id) as { id: string; title: string } | undefined;
  if (!exam) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }

  const rows = db
    .prepare(
      `SELECT es.*, u.real_name, u.username, u.student_no, u.class_name
       FROM exam_submissions es
       INNER JOIN users u ON es.student_id = u.id
       WHERE es.exam_id = ? AND es.status = 'submitted'
       ORDER BY es.final_score DESC`
    )
    .all(examId) as Array<Record<string, unknown>>;

  const header = '姓名,用户名,学号,班级,作答次数,系统得分,最终得分,满分,用时(秒),切屏次数,是否迟交,提交时间,教师评语';
  const lines = rows.map((r) =>
    [
      r.real_name,
      r.username,
      r.student_no || '',
      r.class_name,
      r.attempt_no,
      r.auto_score,
      r.final_score,
      r.max_score,
      r.duration_seconds,
      r.switch_count,
      r.is_late ? '是' : '否',
      r.submitted_at || '',
      String(r.teacher_comment || '').replace(/[\r\n,]/g, ' '),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  );

  const csv = `\uFEFF${header}\n${lines.join('\n')}`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="exam_${examId}_scores.csv"`
  );
  res.send(csv);
});

router.get('/exam-submissions/:subId', (req: AuthedRequest, res) => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT es.*, e.teacher_id, e.title as exam_title, u.real_name, u.username, u.class_name, u.student_no
       FROM exam_submissions es
       INNER JOIN exams e ON es.exam_id = e.id
       INNER JOIN users u ON es.student_id = u.id
       WHERE es.id = ? AND e.teacher_id = ?`
    )
    .get(String(req.params.subId), req.teacher!.id) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    res.status(404).json({ error: '提交记录不存在' });
    return;
  }

  const answers = JSON.parse(String(row.answers_json || '{}')) as Record<
    string,
    SimulatorState
  >;
  const results = JSON.parse(
    String(row.question_results_json || '[]')
  ) as ExamQuestionResult[];

  res.json({
    submission: {
      id: row.id,
      examId: row.exam_id,
      examTitle: row.exam_title,
      studentId: row.student_id,
      studentName: row.real_name,
      username: row.username,
      className: row.class_name,
      studentNo: row.student_no,
      autoScore: row.auto_score,
      finalScore: row.final_score,
      maxScore: row.max_score,
      durationSeconds: row.duration_seconds,
      switchCount: row.switch_count,
      isLate: Boolean(row.is_late),
      teacherComment: row.teacher_comment,
      submittedAt: row.submitted_at,
      answers,
      questionResults: results,
    },
  });
});

router.put('/exam-submissions/:subId/adjust', (req: AuthedRequest, res) => {
  const schema = z.object({
    finalScore: z.number().min(0),
    teacherComment: z.string().max(500).default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '调分参数无效' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT es.*, e.teacher_id, e.title as exam_title
       FROM exam_submissions es
       INNER JOIN exams e ON es.exam_id = e.id
       WHERE es.id = ? AND e.teacher_id = ?`
    )
    .get(String(req.params.subId), req.teacher!.id) as
    | {
        id: string;
        student_id: string;
        max_score: number;
        exam_title: string;
      }
    | undefined;
  if (!row) {
    res.status(404).json({ error: '提交记录不存在' });
    return;
  }

  const clamped = Math.min(row.max_score, Math.max(0, parsed.data.finalScore));
  db.prepare(
    'UPDATE exam_submissions SET final_score = ?, teacher_comment = ?, adjusted_by = ?, updated_at = ? WHERE id = ?'
  ).run(
    clamped,
    parsed.data.teacherComment,
    req.teacher!.username,
    new Date().toISOString(),
    row.id
  );

  insertNotification(
    db,
    row.student_id,
    req.teacher!.id,
    'score_published',
    `成绩复核更新：${row.exam_title}`,
    `老师对您的「${row.exam_title}」答卷进行了批阅，最终得分 ${clamped}/${row.max_score}${parsed.data.teacherComment ? `，评语：${parsed.data.teacherComment}` : ''}。`,
    '/profile'
  );

  res.json({ ok: true, finalScore: clamped });
});

router.post('/exam-submissions/:subId/regrade', (req: AuthedRequest, res) => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT es.*, e.teacher_id
       FROM exam_submissions es
       INNER JOIN exams e ON es.exam_id = e.id
       WHERE es.id = ? AND e.teacher_id = ?`
    )
    .get(String(req.params.subId), req.teacher!.id) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    res.status(404).json({ error: '提交记录不存在' });
    return;
  }

  const eqRows = db
    .prepare(
      `SELECT eq.score, q.*
       FROM exam_questions eq
       INNER JOIN questions q ON eq.question_id = q.id
       WHERE eq.exam_id = ?
       ORDER BY eq.sort_order ASC`
    )
    .all(String(row.exam_id)) as Array<Record<string, unknown>>;

  const answers = JSON.parse(String(row.answers_json || '{}')) as Record<
    string,
    SimulatorState
  >;

  let autoTotal = 0;
  let maxTotal = 0;
  const results: ExamQuestionResult[] = [];

  for (const eq of eqRows) {
    const q = rowToQuestion(eq);
    const examScore = Number(eq.score || q.totalScore);
    const ans = answers[q.id] || q.materials.initialState;
    const grade = gradeAnswerDeterministic(q.type, q.checkpoints, ans);
    const scale = grade.maxScore > 0 ? examScore / grade.maxScore : 1;
    const scaledScore = Math.round(grade.autoScore * scale * 10) / 10;

    autoTotal += scaledScore;
    maxTotal += examScore;
    results.push({
      questionId: q.id,
      title: q.title,
      type: q.type,
      maxScore: examScore,
      autoScore: scaledScore,
      finalScore: scaledScore,
      checkpointResults: grade.checkpointResults,
      gradedByAi: grade.gradedByAi,
    });
  }

  db.prepare(
    `UPDATE exam_submissions SET
      question_results_json = ?, auto_score = ?, final_score = ?, max_score = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    JSON.stringify(results),
    autoTotal,
    autoTotal,
    maxTotal,
    new Date().toISOString(),
    String(row.id)
  );

  res.json({ autoScore: autoTotal, maxScore: maxTotal, questionResults: results });
});

router.get('/exams/:id/analytics', (req: AuthedRequest, res) => {
  const db = getDb();
  const examId = String(req.params.id);
  const exam = db
    .prepare('SELECT * FROM exams WHERE id = ? AND teacher_id = ?')
    .get(examId, req.teacher!.id) as Record<string, unknown> | undefined;
  if (!exam) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }

  const eqRows = db
    .prepare(
      `SELECT eq.score, q.*
       FROM exam_questions eq
       INNER JOIN questions q ON eq.question_id = q.id
       WHERE eq.exam_id = ?
       ORDER BY eq.sort_order ASC`
    )
    .all(examId) as Array<Record<string, unknown>>;

  const questionsMap = new Map(
    eqRows.map((r) => [String(r.id), { q: rowToQuestion(r), examScore: Number(r.score) }])
  );

  const subs = db
    .prepare(
      "SELECT * FROM exam_submissions WHERE exam_id = ? AND status = 'submitted'"
    )
    .all(examId) as Array<Record<string, unknown>>;

  // Pick best/latest attempt per student for analytics
  const perStudent = new Map<string, Record<string, unknown>>();
  for (const s of subs) {
    const sid = String(s.student_id);
    const prev = perStudent.get(sid);
    if (!prev || Number(s.final_score) >= Number(prev.final_score)) {
      perStudent.set(sid, s);
    }
  }

  const questionStats: Record<
    string,
    {
      questionId: string;
      title: string;
      type: QuestionType;
      sumPct: number;
      count: number;
      missedMap: Record<string, { description: string; failCount: number }>;
    }
  > = {};
  for (const [qid, info] of questionsMap.entries()) {
    questionStats[qid] = {
      questionId: qid,
      title: info.q.title,
      type: info.q.type,
      sumPct: 0,
      count: 0,
      missedMap: {},
    };
  }

  const kpStats: Record<string, { sumPct: number; count: number }> = {};

  for (const s of perStudent.values()) {
    const qResults = JSON.parse(
      String(s.question_results_json || '[]')
    ) as ExamQuestionResult[];

    for (const qr of qResults) {
      const stat = questionStats[qr.questionId];
      if (!stat) continue;
      const pct = qr.maxScore > 0 ? (qr.finalScore / qr.maxScore) * 100 : 0;
      stat.sumPct += pct;
      stat.count += 1;

      for (const cp of qr.checkpointResults || []) {
        if (!cp.passed) {
          if (!stat.missedMap[cp.checkpointId]) {
            stat.missedMap[cp.checkpointId] = {
              description: cp.description,
              failCount: 0,
            };
          }
          stat.missedMap[cp.checkpointId].failCount += 1;
        }
      }

      const qObj = questionsMap.get(qr.questionId)?.q;
      if (qObj) {
        for (const kp of qObj.knowledgePoints) {
          if (!kpStats[kp]) kpStats[kp] = { sumPct: 0, count: 0 };
          kpStats[kp].sumPct += pct;
          kpStats[kp].count += 1;
        }
      }
    }
  }

  const assignedStudentIds = resolveTargetStudentIds(db, examId);
  const submittedIds = new Set(Array.from(perStudent.keys()));
  const unsubmittedIds = assignedStudentIds.filter((id) => !submittedIds.has(id));
  const unsubmittedStudents =
    unsubmittedIds.length > 0
      ? (db
          .prepare(
            `SELECT id, username, real_name, class_name, student_no FROM users WHERE id IN (${unsubmittedIds
              .map(() => '?')
              .join(',')})`
          )
          .all(...unsubmittedIds) as Array<Record<string, unknown>>).map((u) => ({
          id: u.id,
          username: u.username,
          realName: u.real_name,
          className: u.class_name,
          studentNo: u.student_no,
        }))
      : [];

  const lowScoreStudents = Array.from(perStudent.values())
    .filter((s) => {
      const max = Number(s.max_score || 100);
      return max > 0 && (Number(s.final_score) / max) * 100 < 60;
    })
    .map((s) => {
      const u = db
        .prepare('SELECT id, real_name, username, class_name FROM users WHERE id = ?')
        .get(String(s.student_id)) as Record<string, unknown> | undefined;
      return {
        id: String(s.student_id),
        realName: String(u?.real_name || ''),
        username: String(u?.username || ''),
        className: String(u?.class_name || ''),
        score: Number(s.final_score),
        maxScore: Number(s.max_score),
      };
    });

  const knowledgeMastery = Object.entries(kpStats)
    .map(([name, k]) => ({
      name,
      masteryRate: k.count > 0 ? Math.round((k.sumPct / k.count) * 10) / 10 : 0,
      sampleCount: k.count,
      isWeak: k.count > 0 && k.sumPct / k.count < 70,
    }))
    .sort((a, b) => a.masteryRate - b.masteryRate);

  res.json({
    assignedCount: assignedStudentIds.length,
    submittedCount: submittedIds.size,
    unsubmittedStudents,
    lowScoreStudents,
    questionAnalysis: Object.values(questionStats).map((qs) => ({
      questionId: qs.questionId,
      title: qs.title,
      type: qs.type,
      avgScoreRate:
        qs.count > 0 ? Math.round((qs.sumPct / qs.count) * 10) / 10 : 0,
      topMissedCheckpoints: Object.values(qs.missedMap)
        .sort((a, b) => b.failCount - a.failCount)
        .slice(0, 3),
    })),
    knowledgeMastery,
  });
});

router.get('/students/:studentId/analytics', (req: AuthedRequest, res) => {
  const db = getDb();
  const studentId = String(req.params.studentId);
  const student = db
    .prepare(
      "SELECT id, username, real_name, grade, class_name, student_no FROM users WHERE id = ? AND role = 'student' AND teacher_id = ?"
    )
    .get(studentId, req.teacher!.id) as Record<string, unknown> | undefined;
  if (!student) {
    res.status(404).json({ error: '学生不存在或不属于您的班级' });
    return;
  }

  const subs = db
    .prepare(
      `SELECT es.*, e.title as exam_title
       FROM exam_submissions es
       INNER JOIN exams e ON es.exam_id = e.id
       WHERE es.student_id = ? AND e.teacher_id = ? AND es.status = 'submitted'
       ORDER BY es.submitted_at ASC`
    )
    .all(studentId, req.teacher!.id) as Array<Record<string, unknown>>;

  const kpMap: Record<string, { sumPct: number; count: number }> = {};
  const trend = subs.map((s) => {
    const pct =
      Number(s.max_score) > 0
        ? Math.round((Number(s.final_score) / Number(s.max_score)) * 1000) / 10
        : 0;
    const qResults = JSON.parse(
      String(s.question_results_json || '[]')
    ) as ExamQuestionResult[];
    for (const qr of qResults) {
      const qRow = db
        .prepare('SELECT knowledge_points_json FROM questions WHERE id = ?')
        .get(qr.questionId) as { knowledge_points_json: string } | undefined;
      if (qRow) {
        const kps = JSON.parse(qRow.knowledge_points_json || '[]') as string[];
        const qPct = qr.maxScore > 0 ? (qr.finalScore / qr.maxScore) * 100 : 0;
        for (const kp of kps) {
          if (!kpMap[kp]) kpMap[kp] = { sumPct: 0, count: 0 };
          kpMap[kp].sumPct += qPct;
          kpMap[kp].count += 1;
        }
      }
    }
    return {
      examId: s.exam_id,
      examTitle: s.exam_title,
      score: s.final_score,
      maxScore: s.max_score,
      pct,
      submittedAt: s.submitted_at,
    };
  });

  const weakKnowledgePoints = Object.entries(kpMap)
    .map(([name, st]) => ({
      name,
      masteryRate: Math.round((st.sumPct / st.count) * 10) / 10,
      count: st.count,
    }))
    .sort((a, b) => a.masteryRate - b.masteryRate);

  res.json({
    student: {
      id: student.id,
      username: student.username,
      realName: student.real_name,
      grade: student.grade,
      className: student.class_name,
      studentNo: student.student_no,
    },
    trend,
    weakKnowledgePoints,
  });
});

router.post('/exams/:id/remind-unsubmitted', (req: AuthedRequest, res) => {
  const db = getDb();
  const examId = String(req.params.id);
  const exam = db
    .prepare('SELECT id, title, end_time FROM exams WHERE id = ? AND teacher_id = ?')
    .get(examId, req.teacher!.id) as
    | { id: string; title: string; end_time: string }
    | undefined;
  if (!exam) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }

  const assigned = resolveTargetStudentIds(db, examId);
  const submittedRows = db
    .prepare(
      "SELECT DISTINCT student_id FROM exam_submissions WHERE exam_id = ? AND status = 'submitted'"
    )
    .all(examId) as Array<{ student_id: string }>;
  const submittedSet = new Set(submittedRows.map((r) => r.student_id));
  const pending = assigned.filter((id) => !submittedSet.has(id));

  for (const sid of pending) {
    insertNotification(
      db,
      sid,
      req.teacher!.id,
      'exam_reminder',
      `考试未交提醒：${exam.title}`,
      `${req.teacher!.realName}提醒您：您尚未提交「${exam.title}」，截止时间为 ${new Date(exam.end_time).toLocaleString('zh-CN')}，请尽快完成交卷。`,
      '/'
    );
  }

  res.json({ notifiedCount: pending.length });
});

router.post('/exams/:id/remedial-practice', async (req: AuthedRequest, res) => {
  const schema = z.object({
    knowledgePoint: z.string().min(1),
    type: z.enum(['word', 'excel', 'web', 'file']).default('excel'),
    targetStudentIds: z.array(z.string()).min(1, '请选择需要推送补练的学生'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || '参数错误' });
    return;
  }

  const db = getDb();
  const examId = String(req.params.id);
  const exam = db
    .prepare('SELECT id, title FROM exams WHERE id = ? AND teacher_id = ?')
    .get(examId, req.teacher!.id) as { id: string; title: string } | undefined;
  if (!exam) {
    res.status(404).json({ error: '原考试不存在' });
    return;
  }

  const quota = getTeacherTodayAiUsage(req.teacher!.id);
  if (quota.used + 1 > quota.limit) {
    res.status(429).json({ error: '今日 AI 生成额度已达上限，无法生成补练题' });
    return;
  }

  try {
    const q = await generateQuestionWithAi({
      type: parsed.data.type,
      difficulty: '基础',
      knowledgePoints: [parsed.data.knowledgePoint],
      customPrompt: `针对学生在「${exam.title}」中知识点「${parsed.data.knowledgePoint}」的薄弱失分情况，出一道巩固强化操作题。`,
      stepCount: 4,
      totalScore: 100,
      status: 'published',
      ownerId: req.teacher!.id,
      visibility: 'private',
    });
    recordAiGenerationUsage(req.teacher!.id, 'teacher', 1);

    const newExamId = `exam-rem-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    db.transaction(() => {
      db.prepare(
        `INSERT INTO questions (
          id, title, type, difficulty, knowledge_points_json, knowledge_point_ids_json,
          scenario, total_score, materials_json, steps_json, checkpoints_json,
          reference_answer_json, analysis_json, common_mistakes_json,
          status, source, owner_id, visibility, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'ai', ?, 'private', ?, ?)`
      ).run(
        q.id,
        q.title,
        q.type,
        q.difficulty,
        JSON.stringify(q.knowledgePoints),
        q.scenario,
        q.totalScore,
        JSON.stringify(q.materials),
        JSON.stringify(q.steps),
        JSON.stringify(q.checkpoints),
        JSON.stringify(q.referenceAnswer),
        JSON.stringify(q.analysis),
        JSON.stringify(q.commonMistakes),
        req.teacher!.id,
        now.toISOString(),
        now.toISOString()
      );

      db.prepare(
        `INSERT INTO exams (
          id, title, description, teacher_id, duration, start_time, end_time,
          max_attempts, score_policy, show_score_immediately, show_answer_policy,
          shuffle, anti_cheat_switch, allow_late, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 25, ?, ?, 2, 'highest', 1, 'immediate', 0, 0, 1, 'published', ?, ?)`
      ).run(
        newExamId,
        `专项补练：${parsed.data.knowledgePoint}（${exam.title}）`,
        `针对薄弱知识点「${parsed.data.knowledgePoint}」的巩固强化练习，请在 7 天内完成。`,
        req.teacher!.id,
        now.toISOString(),
        end.toISOString(),
        now.toISOString(),
        now.toISOString()
      );

      db.prepare(
        'INSERT INTO exam_questions (id, exam_id, question_id, sort_order, score) VALUES (?, ?, ?, 1, 100)'
      ).run(`eq-rem-${Date.now()}`, newExamId, q.id);

      const insA = db.prepare(
        'INSERT INTO exam_assignments (id, exam_id, target_type, target_id) VALUES (?, ?, ?, ?)'
      );
      for (const sid of parsed.data.targetStudentIds) {
        insA.run(
          `ea-rem-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          newExamId,
          'student',
          sid
        );
        insertNotification(
          db,
          sid,
          req.teacher!.id,
          'practice_assigned',
          `教师推送专项补练：${parsed.data.knowledgePoint}`,
          `${req.teacher!.realName}为您推送了针对薄弱知识点「${parsed.data.knowledgePoint}」的补练任务，请进入「模拟考试」完成巩固。`,
          '/'
        );
      }
    })();

    res.status(201).json({
      examId: newExamId,
      questionTitle: q.title,
      assignedCount: parsed.data.targetStudentIds.length,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : '生成补练任务失败',
    });
  }
});

export default router;

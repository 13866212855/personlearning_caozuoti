import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { generateInviteCode, getDb, logAdminAction, rowToQuestion } from '../db';
import { gradeAnswerDeterministic } from '../grader';
import {
  type AuthedRequest,
  loginRateLimiter,
  requireAdminAuth,
  signAdminToken,
} from '../middleware/auth';
import {
  callChatCompletions,
  callImageGenerations,
  generateQuestionWithAi,
  getLlmConfig,
  regenerateQuestionAnswer,
} from '../services/llm';
import { maskApiKey } from '../utils/mask';
import type {
  DifficultyLevel,
  ExamQuestionResult,
  QuestionType,
  SimulatorState,
  UserRole,
} from '../types';

const router = Router();

// Super Admin Login ONLY (isolated from /login)
router.post('/auth/login', loginRateLimiter, (req, res) => {
  const schema = z.object({
    username: z.string().trim().min(1),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: '账号或密码错误' });
    return;
  }

  const { username, password } = parsed.data;
  const db = getDb();
  const admin = db
    .prepare(
      "SELECT * FROM users WHERE username = ? AND role = 'super_admin'"
    )
    .get(username) as
    | {
        id: string;
        username: string;
        password_hash: string;
        is_disabled: number;
        must_change_password: number;
      }
    | undefined;

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    res.status(401).json({ error: '账号或密码错误' });
    return;
  }

  if (admin.is_disabled) {
    res.status(403).json({ error: '该管理员账号已被禁用' });
    return;
  }

  const token = signAdminToken({
    sub: admin.id,
    username: admin.username,
    role: 'super_admin',
  });

  res.json({
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      role: 'super_admin',
      mustChangePassword: Boolean(admin.must_change_password),
    },
  });
});

// Protect all subsequent super_admin routes
router.use(requireAdminAuth);

router.get('/auth/me', (req: AuthedRequest, res) => {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, username, must_change_password FROM users WHERE id = ? AND role = 'super_admin' AND is_disabled = 0"
    )
    .get(req.admin!.id) as
    | { id: string; username: string; must_change_password: number }
    | undefined;
  if (!row) {
    res.status(401).json({ error: '管理员不存在或已禁用' });
    return;
  }
  res.json({
    admin: {
      id: row.id,
      username: row.username,
      role: 'super_admin',
      mustChangePassword: Boolean(row.must_change_password),
    },
  });
});

router.post('/auth/change-password', (req: AuthedRequest, res) => {
  const schema = z.object({
    oldPassword: z.string().min(1, '请输入原密码'),
    newPassword: z.string().min(6, '新密码至少 6 位').max(64),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message || '参数校验失败' });
    return;
  }

  const db = getDb();
  const admin = db
    .prepare("SELECT id, password_hash FROM users WHERE id = ? AND role = 'super_admin'")
    .get(req.admin!.id) as { id: string; password_hash: string } | undefined;

  if (!admin || !bcrypt.compareSync(parsed.data.oldPassword, admin.password_hash)) {
    res.status(400).json({ error: '原密码不正确' });
    return;
  }

  const newHash = bcrypt.hashSync(parsed.data.newPassword, 10);
  db.prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
  ).run(newHash, new Date().toISOString(), admin.id);

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '修改超级管理员密码',
    'user',
    admin.id,
    '超级管理员密码已更新'
  );

  res.json({ ok: true });
});

// ==================== Overview Dashboard ====================
router.get('/overview', (_req, res) => {
  const db = getDb();
  const studentCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'student'").get() as {
      cnt: number;
    }
  ).cnt;
  const teacherCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'teacher'").get() as {
      cnt: number;
    }
  ).cnt;
  const classCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM classes').get() as { cnt: number }
  ).cnt;
  const examTotal = (
    db.prepare('SELECT COUNT(*) as cnt FROM exams').get() as { cnt: number }
  ).cnt;
  const questionTotal = (
    db.prepare('SELECT COUNT(*) as cnt FROM questions').get() as { cnt: number }
  ).cnt;
  const publishedCount = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM questions WHERE status = 'published'")
      .get() as { cnt: number }
  ).cnt;
  const legacySubTotal = (
    db.prepare('SELECT COUNT(*) as cnt FROM submissions').get() as { cnt: number }
  ).cnt;
  const examSubTotal = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM exam_submissions WHERE status = 'submitted'")
      .get() as { cnt: number }
  ).cnt;

  const avgExamRow = db
    .prepare(
      "SELECT AVG(CASE WHEN max_score > 0 THEN final_score * 100.0 / max_score ELSE NULL END) as avg_pct FROM exam_submissions WHERE status = 'submitted'"
    )
    .get() as { avg_pct: number | null };
  const avgLegacyRow = db
    .prepare(
      'SELECT AVG(CASE WHEN max_score > 0 THEN final_score * 100.0 / max_score ELSE NULL END) as avg_pct FROM submissions'
    )
    .get() as { avg_pct: number | null };

  const avgPct =
    avgExamRow.avg_pct !== null
      ? avgExamRow.avg_pct
      : avgLegacyRow.avg_pct !== null
        ? avgLegacyRow.avg_pct
        : 0;

  const typeMap: Record<QuestionType, { sum: number; count: number }> = {
    word: { sum: 0, count: 0 },
    excel: { sum: 0, count: 0 },
    web: { sum: 0, count: 0 },
    file: { sum: 0, count: 0 },
  };

  const legacyByType = db
    .prepare(
      `SELECT q.type as type, COUNT(s.id) as count,
              SUM(CASE WHEN s.max_score > 0 THEN s.final_score * 100.0 / s.max_score ELSE 0 END) as sum_pct
       FROM submissions s
       LEFT JOIN questions q ON s.question_id = q.id
       GROUP BY q.type`
    )
    .all() as Array<{ type: QuestionType; count: number; sum_pct: number }>;

  for (const r of legacyByType) {
    if (r.type && typeMap[r.type]) {
      typeMap[r.type].count += r.count;
      typeMap[r.type].sum += r.sum_pct || 0;
    }
  }

  const examSubs = db
    .prepare(
      "SELECT question_results_json FROM exam_submissions WHERE status = 'submitted'"
    )
    .all() as Array<{ question_results_json: string }>;
  for (const es of examSubs) {
    const qrs = JSON.parse(es.question_results_json || '[]') as ExamQuestionResult[];
    for (const qr of qrs) {
      if (qr.type && typeMap[qr.type]) {
        typeMap[qr.type].count += 1;
        typeMap[qr.type].sum +=
          qr.maxScore > 0 ? (qr.finalScore / qr.maxScore) * 100 : 0;
      }
    }
  }

  res.json({
    studentCount,
    teacherCount,
    classCount,
    examTotal,
    questionTotal,
    publishedCount,
    submissionTotal: legacySubTotal + examSubTotal,
    avgScore: Math.round((avgPct || 0) * 10) / 10,
    submissionsByType: Object.entries(typeMap).map(([type, v]) => ({
      type,
      count: v.count,
      avgScore: v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : 0,
    })),
  });
});

// ==================== LLM Configuration (strictly masks apiKey!) ====================
router.get('/llm-config', (_req, res) => {
  const cfg = getLlmConfig();
  res.json({
    baseUrl: cfg.base_url,
    apiKeyMasked: maskApiKey(cfg.api_key),
    textModel: cfg.text_model,
    imageModel: cfg.image_model,
    temperature: cfg.temperature,
    maxTokens: cfg.max_tokens,
    timeoutMs: cfg.timeout_ms,
    teacherDailyAiLimit: cfg.teacher_daily_ai_limit ?? 30,
    updatedAt: cfg.updated_at,
  });
});

router.put('/llm-config', (req: AuthedRequest, res) => {
  const schema = z.object({
    baseUrl: z.string().trim().url('请输入合法的 Base URL'),
    apiKey: z.string().optional(),
    textModel: z.string().trim().min(1, '请输入文本模型名称'),
    imageModel: z.string().trim().min(1, '请输入图片模型名称'),
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().int().min(256).max(32768),
    timeoutMs: z.number().int().min(5000).max(180000),
    teacherDailyAiLimit: z.number().int().min(0).max(500).default(30),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message || '配置参数无效' });
    return;
  }

  const db = getDb();
  const current = getLlmConfig();
  const inputKey = (parsed.data.apiKey || '').trim();
  const finalApiKey =
    inputKey && !inputKey.includes('****') ? inputKey : current.api_key;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE llm_configs
     SET base_url = ?, api_key = ?, text_model = ?, image_model = ?,
         temperature = ?, max_tokens = ?, timeout_ms = ?, teacher_daily_ai_limit = ?, updated_at = ?
     WHERE id = 1`
  ).run(
    parsed.data.baseUrl.replace(/\/+$/, ''),
    finalApiKey,
    parsed.data.textModel,
    parsed.data.imageModel,
    parsed.data.temperature,
    parsed.data.maxTokens,
    parsed.data.timeoutMs,
    parsed.data.teacherDailyAiLimit,
    now
  );

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '更新大模型配置',
    'llm_config',
    '1',
    `BaseURL=${parsed.data.baseUrl}, TextModel=${parsed.data.textModel}, TeacherLimit=${parsed.data.teacherDailyAiLimit}, KeyUpdated=${Boolean(inputKey && !inputKey.includes('****'))}`
  );

  res.json({
    ok: true,
    apiKeyMasked: maskApiKey(finalApiKey),
    updatedAt: now,
  });
});

router.post('/llm-config/test-text', async (req, res) => {
  const body = req.body || {};
  const override: Record<string, unknown> = {};
  if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) {
    override.base_url = body.baseUrl.trim();
  }
  if (
    typeof body.apiKey === 'string' &&
    body.apiKey.trim() &&
    !body.apiKey.includes('****')
  ) {
    override.api_key = body.apiKey.trim();
  }
  if (typeof body.textModel === 'string' && body.textModel.trim()) {
    override.text_model = body.textModel.trim();
  }
  if (typeof body.timeoutMs === 'number') {
    override.timeout_ms = body.timeoutMs;
  }

  try {
    const result = await callChatCompletions(
      [
        {
          role: 'user',
          content: '请用一句话回复：高中信息技术会考操作题练习系统连通测试正常。',
        },
      ],
      override
    );
    res.json({
      success: true,
      latencyMs: result.latencyMs,
      output: result.text,
    });
  } catch (err) {
    res.json({
      success: false,
      latencyMs: 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post('/llm-config/test-image', async (req, res) => {
  const body = req.body || {};
  const override: Record<string, unknown> = {};
  if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) {
    override.base_url = body.baseUrl.trim();
  }
  if (
    typeof body.apiKey === 'string' &&
    body.apiKey.trim() &&
    !body.apiKey.includes('****')
  ) {
    override.api_key = body.apiKey.trim();
  }
  if (typeof body.imageModel === 'string' && body.imageModel.trim()) {
    override.image_model = body.imageModel.trim();
  }
  if (typeof body.timeoutMs === 'number') {
    override.timeout_ms = body.timeoutMs;
  }

  try {
    const result = await callImageGenerations(
      'Clean flat educational vector illustration of a computer lab desk with a monitor and spreadsheet chart, bright blue and teal palette',
      override
    );
    res.json({
      success: true,
      latencyMs: result.latencyMs,
      imageUrl: result.localUrl,
    });
  } catch (err) {
    res.json({
      success: false,
      latencyMs: 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// ==================== Global Question Bank Management ====================
router.get('/questions', (req, res) => {
  const db = getDb();
  const keyword = String(req.query.keyword || '').trim();
  const type = String(req.query.type || '');
  const difficulty = String(req.query.difficulty || '');
  const status = String(req.query.status || '');
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)));

  const where: string[] = ['1=1'];
  const args: unknown[] = [];

  if (keyword) {
    where.push('(q.title LIKE ? OR q.scenario LIKE ? OR q.knowledge_points_json LIKE ?)');
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (type && ['word', 'excel', 'web', 'file'].includes(type)) {
    where.push('q.type = ?');
    args.push(type);
  }
  if (difficulty && ['基础', '中等', '提高'].includes(difficulty)) {
    where.push('q.difficulty = ?');
    args.push(difficulty);
  }
  if (status && ['draft', 'published'].includes(status)) {
    where.push('q.status = ?');
    args.push(status);
  }

  const whereSql = where.join(' AND ');
  const total = (
    db
      .prepare(`SELECT COUNT(*) as cnt FROM questions q WHERE ${whereSql}`)
      .get(...args) as { cnt: number }
  ).cnt;

  const rows = db
    .prepare(
      `SELECT q.*, u.real_name as owner_name
       FROM questions q
       LEFT JOIN users u ON q.owner_id = u.id
       WHERE ${whereSql}
       ORDER BY q.updated_at DESC LIMIT ? OFFSET ?`
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
    })),
    total,
    page,
    pageSize,
  });
});

router.get('/questions/:id', (req, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM questions WHERE id = ?')
    .get(String(req.params.id)) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }
  res.json({ question: rowToQuestion(row) });
});

router.post('/questions', (req: AuthedRequest, res) => {
  const schema = z.object({
    title: z.string().trim().min(2),
    type: z.enum(['word', 'excel', 'web', 'file']),
    difficulty: z.enum(['基础', '中等', '提高']),
    knowledgePoints: z.array(z.string()).min(1),
    scenario: z.string().min(5),
    totalScore: z.number().int().positive().default(100),
    materials: z.record(z.string(), z.unknown()),
    steps: z.array(z.record(z.string(), z.unknown())).min(1),
    checkpoints: z.array(z.record(z.string(), z.unknown())).min(1),
    referenceAnswer: z.record(z.string(), z.unknown()),
    analysis: z.array(z.string()).default([]),
    commonMistakes: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published']).default('draft'),
    visibility: z.enum(['private', 'shared', 'public']).default('public'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '题目结构校验失败，请检查 JSON 字段' });
    return;
  }

  const db = getDb();
  const id = `manual-${parsed.data.type}-${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO questions (
      id, title, type, difficulty, knowledge_points_json, knowledge_point_ids_json, scenario,
      total_score, materials_json, steps_json, checkpoints_json,
      reference_answer_json, analysis_json, common_mistakes_json,
      status, source, owner_id, visibility, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', 'system', ?, ?, ?)`
  ).run(
    id,
    parsed.data.title,
    parsed.data.type,
    parsed.data.difficulty,
    JSON.stringify(parsed.data.knowledgePoints),
    parsed.data.scenario,
    parsed.data.totalScore,
    JSON.stringify(parsed.data.materials),
    JSON.stringify(parsed.data.steps),
    JSON.stringify(parsed.data.checkpoints),
    JSON.stringify(parsed.data.referenceAnswer),
    JSON.stringify(parsed.data.analysis),
    JSON.stringify(parsed.data.commonMistakes),
    parsed.data.status,
    parsed.data.visibility,
    now,
    now
  );

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '新建系统题目',
    'question',
    id,
    parsed.data.title
  );

  res.status(201).json({ id });
});

router.put('/questions/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM questions WHERE id = ?')
    .get(String(req.params.id)) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }

  const body = req.body || {};
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE questions SET
      title = ?, type = ?, difficulty = ?, knowledge_points_json = ?,
      scenario = ?, total_score = ?, materials_json = ?, steps_json = ?,
      checkpoints_json = ?, reference_answer_json = ?, analysis_json = ?,
      common_mistakes_json = ?, status = ?, visibility = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    body.title ?? existing.title,
    body.type ?? existing.type,
    body.difficulty ?? existing.difficulty,
    body.knowledgePoints
      ? JSON.stringify(body.knowledgePoints)
      : existing.knowledge_points_json,
    body.scenario ?? existing.scenario,
    body.totalScore ?? existing.total_score,
    body.materials ? JSON.stringify(body.materials) : existing.materials_json,
    body.steps ? JSON.stringify(body.steps) : existing.steps_json,
    body.checkpoints
      ? JSON.stringify(body.checkpoints)
      : existing.checkpoints_json,
    body.referenceAnswer
      ? JSON.stringify(body.referenceAnswer)
      : existing.reference_answer_json,
    body.analysis ? JSON.stringify(body.analysis) : existing.analysis_json,
    body.commonMistakes
      ? JSON.stringify(body.commonMistakes)
      : existing.common_mistakes_json,
    body.status ?? existing.status,
    body.visibility ?? existing.visibility ?? 'public',
    now,
    String(req.params.id)
  );

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '编辑题目',
    'question',
    String(req.params.id),
    String(body.title ?? existing.title)
  );

  res.json({ ok: true });
});

router.patch('/questions/:id/status', (req: AuthedRequest, res) => {
  const schema = z.object({ status: z.enum(['draft', 'published']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '状态无效' });
    return;
  }

  const db = getDb();
  const info = db
    .prepare('UPDATE questions SET status = ?, updated_at = ? WHERE id = ?')
    .run(parsed.data.status, new Date().toISOString(), String(req.params.id));

  if (info.changes === 0) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    parsed.data.status === 'published' ? '发布题目' : '下架题目',
    'question',
    String(req.params.id),
    `状态变更为 ${parsed.data.status}`
  );

  res.json({ ok: true });
});

router.delete('/questions/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT title FROM questions WHERE id = ?')
    .get(String(req.params.id)) as { title: string } | undefined;
  if (!row) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }

  db.prepare('DELETE FROM questions WHERE id = ?').run(String(req.params.id));
  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '删除题目',
    'question',
    String(req.params.id),
    row.title
  );

  res.json({ ok: true });
});

router.post('/questions/batch-generate', (req: AuthedRequest, res) => {
  const schema = z.object({
    type: z.enum(['word', 'excel', 'web', 'file']),
    difficulty: z.enum(['基础', '中等', '提高']),
    count: z.number().int().min(1).max(10),
    knowledgePoint: z.string().trim().optional(),
    autoPublish: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '生成参数无效' });
    return;
  }

  const db = getDb();
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO generation_jobs (id, admin_id, type, difficulty, count, knowledge_point, status, completed_count, failed_count, errors_json, created_question_ids_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'running', 0, 0, '[]', '[]', ?, ?)`
  ).run(
    jobId,
    req.admin!.id,
    parsed.data.type,
    parsed.data.difficulty,
    parsed.data.count,
    parsed.data.knowledgePoint || '',
    now,
    now
  );

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '发起批量AI出题',
    'generation_job',
    jobId,
    `${parsed.data.type} / ${parsed.data.difficulty} / ${parsed.data.count} 题`
  );

  void runBatchGenerationJob(
    jobId,
    parsed.data.type,
    parsed.data.difficulty,
    parsed.data.count,
    parsed.data.knowledgePoint,
    parsed.data.autoPublish
  );

  res.status(202).json({ jobId });
});

async function runBatchGenerationJob(
  jobId: string,
  type: QuestionType,
  difficulty: DifficultyLevel,
  count: number,
  knowledgePoint?: string,
  autoPublish?: boolean
) {
  const db = getDb();
  const createdIds: string[] = [];
  const errors: string[] = [];
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < count; i++) {
    try {
      const q = await generateQuestionWithAi({
        type,
        difficulty,
        knowledgePoints: knowledgePoint ? [knowledgePoint] : undefined,
        status: autoPublish ? 'published' : 'draft',
        ownerId: 'system',
        visibility: 'public',
      });

      db.prepare(
        `INSERT INTO questions (
          id, title, type, difficulty, knowledge_points_json, knowledge_point_ids_json, scenario,
          total_score, materials_json, steps_json, checkpoints_json,
          reference_answer_json, analysis_json, common_mistakes_json,
          status, source, owner_id, visibility, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', 'public', ?, ?)`
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
        q.status,
        q.source,
        q.createdAt,
        q.updatedAt
      );
      createdIds.push(q.id);
      completed++;
    } catch (err) {
      failed++;
      errors.push(
        `第 ${i + 1} 题生成失败：${err instanceof Error ? err.message : String(err)}`
      );
    }

    db.prepare(
      `UPDATE generation_jobs SET completed_count = ?, failed_count = ?, errors_json = ?, created_question_ids_json = ?, updated_at = ? WHERE id = ?`
    ).run(
      completed,
      failed,
      JSON.stringify(errors),
      JSON.stringify(createdIds),
      new Date().toISOString(),
      jobId
    );
  }

  db.prepare(
    `UPDATE generation_jobs SET status = ?, updated_at = ? WHERE id = ?`
  ).run(
    completed > 0 ? 'completed' : 'failed',
    new Date().toISOString(),
    jobId
  );
}

router.get('/generation-jobs/:id', (req, res) => {
  const db = getDb();
  const job = db
    .prepare('SELECT * FROM generation_jobs WHERE id = ?')
    .get(String(req.params.id)) as Record<string, unknown> | undefined;
  if (!job) {
    res.status(404).json({ error: '生成任务不存在' });
    return;
  }
  res.json({
    id: job.id,
    type: job.type,
    difficulty: job.difficulty,
    count: job.count,
    status: job.status,
    completedCount: job.completed_count,
    failedCount: job.failed_count,
    errors: JSON.parse(String(job.errors_json || '[]')),
    createdQuestionIds: JSON.parse(
      String(job.created_question_ids_json || '[]')
    ),
  });
});

router.post('/questions/:id/regenerate-answer', async (req: AuthedRequest, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM questions WHERE id = ?')
    .get(String(req.params.id)) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }
  const q = rowToQuestion(row);
  try {
    const regenerated = await regenerateQuestionAnswer(q);
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE questions SET reference_answer_json = ?, analysis_json = ?, common_mistakes_json = ?, updated_at = ? WHERE id = ?'
    ).run(
      JSON.stringify(regenerated.referenceAnswer),
      JSON.stringify(regenerated.analysis),
      JSON.stringify(regenerated.commonMistakes),
      now,
      q.id
    );
    logAdminAction(
      req.admin!.id,
      req.admin!.username,
      '重新生成参考答案与解析',
      'question',
      q.id,
      q.title
    );
    res.json({ ok: true, ...regenerated });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : '重新生成失败',
    });
  }
});

// ==================== Submissions Management (Unified users table) ====================
router.get('/submissions', (req, res) => {
  const db = getDb();
  const studentKeyword = String(req.query.studentKeyword || '').trim();
  const className = String(req.query.className || '').trim();
  const type = String(req.query.type || '');
  const startDate = String(req.query.startDate || '');
  const endDate = String(req.query.endDate || '');
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 12)));

  const where: string[] = ['1=1'];
  const args: unknown[] = [];

  if (studentKeyword) {
    where.push(
      '(st.real_name LIKE ? OR st.username LIKE ? OR st.student_no LIKE ?)'
    );
    args.push(
      `%${studentKeyword}%`,
      `%${studentKeyword}%`,
      `%${studentKeyword}%`
    );
  }
  if (className) {
    where.push('st.class_name LIKE ?');
    args.push(`%${className}%`);
  }
  if (type && ['word', 'excel', 'web', 'file'].includes(type)) {
    where.push('q.type = ?');
    args.push(type);
  }
  if (startDate) {
    where.push('s.created_at >= ?');
    args.push(startDate);
  }
  if (endDate) {
    where.push('s.created_at <= ?');
    args.push(`${endDate}T23:59:59.999Z`);
  }

  const whereSql = where.join(' AND ');
  const total = (
    db
      .prepare(
        `SELECT COUNT(*) as cnt FROM submissions s
         LEFT JOIN users st ON s.student_id = st.id
         LEFT JOIN questions q ON s.question_id = q.id
         WHERE ${whereSql}`
      )
      .get(...args) as { cnt: number }
  ).cnt;

  const rows = db
    .prepare(
      `SELECT s.*, st.real_name, st.username, st.grade, st.class_name, st.student_no,
              q.title as question_title, q.type as question_type
       FROM submissions s
       LEFT JOIN users st ON s.student_id = st.id
       LEFT JOIN questions q ON s.question_id = q.id
       WHERE ${whereSql}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, (page - 1) * pageSize) as Array<
    Record<string, unknown>
  >;

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      studentName: r.real_name || '未知学生',
      username: r.username || '',
      grade: r.grade || '',
      className: r.class_name || '',
      studentNo: r.student_no || '',
      questionId: r.question_id,
      questionTitle: r.question_title || '已删除题目',
      questionType: r.question_type || 'word',
      autoScore: r.auto_score,
      finalScore: r.final_score,
      maxScore: r.max_score,
      durationSeconds: r.duration_seconds,
      teacherComment: r.teacher_comment,
      createdAt: r.created_at,
    })),
    total,
    page,
    pageSize,
  });
});

router.get('/submissions/export', (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.id, st.real_name, st.grade, st.class_name, st.student_no,
              q.title as question_title, q.type as question_type,
              s.auto_score, s.final_score, s.max_score, s.duration_seconds,
              s.teacher_comment, s.created_at
       FROM submissions s
       LEFT JOIN users st ON s.student_id = st.id
       LEFT JOIN questions q ON s.question_id = q.id
       ORDER BY s.created_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const escapeCsv = (v: unknown) => {
    const str = String(v ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = [
    '提交ID',
    '学生姓名',
    '年级',
    '班级',
    '学号/用户名',
    '题目名称',
    '题型',
    '系统判分',
    '最终得分',
    '满分',
    '用时(秒)',
    '教师评语',
    '提交时间',
  ];

  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.id,
        r.real_name,
        r.grade,
        r.class_name,
        r.student_no,
        r.question_title,
        r.question_type,
        r.auto_score,
        r.final_score,
        r.max_score,
        r.duration_seconds,
        r.teacher_comment,
        r.created_at,
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];

  const csvContent = '\uFEFF' + lines.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="submissions_${Date.now()}.csv"`
  );
  res.send(csvContent);
});

router.get('/submissions/:id', (req, res) => {
  const db = getDb();
  const sub = db
    .prepare(
      `SELECT s.*, st.real_name, st.grade, st.class_name, st.username,
              q.title as question_title, q.type as question_type
       FROM submissions s
       LEFT JOIN users st ON s.student_id = st.id
       LEFT JOIN questions q ON s.question_id = q.id
       WHERE s.id = ?`
    )
    .get(String(req.params.id)) as Record<string, unknown> | undefined;

  if (!sub) {
    res.status(404).json({ error: '提交记录不存在' });
    return;
  }

  res.json({
    submission: {
      id: sub.id,
      studentName: sub.real_name,
      grade: sub.grade,
      className: sub.class_name,
      username: sub.username,
      questionId: sub.question_id,
      questionTitle: sub.question_title,
      questionType: sub.question_type,
      answer: JSON.parse(String(sub.answer_json)),
      autoScore: sub.auto_score,
      finalScore: sub.final_score,
      maxScore: sub.max_score,
      checkpointResults: JSON.parse(String(sub.checkpoint_results_json || '[]')),
      hintsUsedCount: sub.hints_used_count,
      hintPenalty: sub.hint_penalty,
      durationSeconds: sub.duration_seconds,
      teacherComment: sub.teacher_comment,
      createdAt: sub.created_at,
    },
  });
});

router.put('/submissions/:id/adjust-score', (req: AuthedRequest, res) => {
  const schema = z.object({
    finalScore: z.number().min(0).max(200),
    teacherComment: z.string().max(500).default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '分数或评语格式无效' });
    return;
  }

  const db = getDb();
  const sub = db
    .prepare('SELECT final_score, max_score FROM submissions WHERE id = ?')
    .get(String(req.params.id)) as
    | { final_score: number; max_score: number }
    | undefined;
  if (!sub) {
    res.status(404).json({ error: '提交记录不存在' });
    return;
  }

  const clamped = Math.min(sub.max_score, Math.max(0, parsed.data.finalScore));
  db.prepare(
    'UPDATE submissions SET final_score = ?, teacher_comment = ?, adjusted_by = ? WHERE id = ?'
  ).run(clamped, parsed.data.teacherComment, req.admin!.username, String(req.params.id));

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '人工调整提交分数',
    'submission',
    String(req.params.id),
    `原分 ${sub.final_score} → ${clamped}；评语：${parsed.data.teacherComment}`
  );

  res.json({ ok: true, finalScore: clamped });
});

router.post('/submissions/:id/regrade', (req: AuthedRequest, res) => {
  const db = getDb();
  const sub = db
    .prepare('SELECT * FROM submissions WHERE id = ?')
    .get(String(req.params.id)) as Record<string, unknown> | undefined;
  if (!sub) {
    res.status(404).json({ error: '提交记录不存在' });
    return;
  }

  const qRow = db
    .prepare('SELECT * FROM questions WHERE id = ?')
    .get(sub.question_id) as Record<string, unknown> | undefined;
  if (!qRow) {
    res.status(404).json({ error: '关联题目已不存在，无法重判' });
    return;
  }

  const q = rowToQuestion(qRow);
  const answer = JSON.parse(String(sub.answer_json)) as SimulatorState;
  const result = gradeAnswerDeterministic(q.type, q.checkpoints, answer);
  const penalty = Number(sub.hint_penalty || 0);
  const newFinal = Math.max(0, result.autoScore - penalty);

  db.prepare(
    'UPDATE submissions SET auto_score = ?, final_score = ?, max_score = ?, checkpoint_results_json = ? WHERE id = ?'
  ).run(
    result.autoScore,
    newFinal,
    result.maxScore,
    JSON.stringify(result.checkpointResults),
    String(req.params.id)
  );

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '重新自动判分',
    'submission',
    String(req.params.id),
    `重判得分 ${newFinal}/${result.maxScore}`
  );

  res.json({
    ok: true,
    autoScore: result.autoScore,
    finalScore: newFinal,
    checkpointResults: result.checkpointResults,
  });
});

router.delete('/submissions/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const info = db
    .prepare('DELETE FROM submissions WHERE id = ?')
    .run(String(req.params.id));
  if (info.changes === 0) {
    res.status(404).json({ error: '记录不存在' });
    return;
  }
  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '删除提交记录',
    'submission',
    String(req.params.id),
    ''
  );
  res.json({ ok: true });
});

// ==================== Global Exam Monitor ====================
router.get('/exams', (req, res) => {
  const db = getDb();
  const keyword = String(req.query.keyword || '').trim();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 12)));

  const where = ['1=1'];
  const args: unknown[] = [];
  if (keyword) {
    where.push('(e.title LIKE ? OR u.real_name LIKE ? OR u.username LIKE ?)');
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) as cnt FROM exams e LEFT JOIN users u ON e.teacher_id = u.id WHERE ${where.join(' AND ')}`
      )
      .get(...args) as { cnt: number }
  ).cnt;

  const rows = db
    .prepare(
      `SELECT e.*, u.real_name as teacher_name, u.username as teacher_username
       FROM exams e
       LEFT JOIN users u ON e.teacher_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY e.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, (page - 1) * pageSize) as Array<
    Record<string, unknown>
  >;

  const items = rows.map((e) => {
    const qInfo = db
      .prepare(
        'SELECT COUNT(*) as cnt, COALESCE(SUM(score), 0) as total_score FROM exam_questions WHERE exam_id = ?'
      )
      .get(e.id) as { cnt: number; total_score: number };
    const subInfo = db
      .prepare(
        "SELECT COUNT(*) as cnt, AVG(final_score) as avg_score FROM exam_submissions WHERE exam_id = ? AND status = 'submitted'"
      )
      .get(e.id) as { cnt: number; avg_score: number | null };

    return {
      id: e.id,
      title: e.title,
      teacherName: e.teacher_name || e.teacher_username || '未知教师',
      status: e.status,
      duration: e.duration,
      startTime: e.start_time,
      endTime: e.end_time,
      questionCount: qInfo.cnt,
      totalScore: qInfo.total_score,
      submissionCount: subInfo.cnt,
      avgScore:
        subInfo.avg_score !== null && subInfo.avg_score !== undefined
          ? Math.round(Number(subInfo.avg_score) * 10) / 10
          : null,
      createdAt: e.created_at,
    };
  });

  res.json({ items, total, page, pageSize });
});

router.get('/exams/:id/results', (req, res) => {
  const db = getDb();
  const exam = db
    .prepare(
      `SELECT e.*, u.real_name as teacher_name
       FROM exams e LEFT JOIN users u ON e.teacher_id = u.id
       WHERE e.id = ?`
    )
    .get(String(req.params.id)) as Record<string, unknown> | undefined;
  if (!exam) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }

  const rows = db
    .prepare(
      `SELECT es.*, u.real_name, u.username, u.class_name, u.student_no
       FROM exam_submissions es
       INNER JOIN users u ON es.student_id = u.id
       WHERE es.exam_id = ? AND es.status = 'submitted'
       ORDER BY es.submitted_at DESC`
    )
    .all(String(req.params.id)) as Array<Record<string, unknown>>;

  res.json({
    exam: {
      id: exam.id,
      title: exam.title,
      teacherName: exam.teacher_name || '未知教师',
    },
    items: rows.map((r) => ({
      id: r.id,
      studentName: r.real_name,
      username: r.username,
      className: r.class_name,
      studentNo: r.student_no,
      attemptNo: r.attempt_no,
      finalScore: r.final_score,
      maxScore: r.max_score,
      switchCount: r.switch_count,
      isLate: Boolean(r.is_late),
      submittedAt: r.submitted_at,
    })),
  });
});

// ==================== Unified User & Role Management ====================
router.get('/classes', (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.grade, c.teacher_id, c.invite_code, u.real_name as teacher_name, u.username as teacher_username
       FROM classes c
       LEFT JOIN users u ON c.teacher_id = u.id
       ORDER BY c.created_at DESC`
    )
    .all() as Array<Record<string, unknown>>;
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      grade: r.grade,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name || r.teacher_username || '',
      inviteCode: r.invite_code,
    })),
  });
});

router.get('/users', (req, res) => {
  const db = getDb();
  const role = String(req.query.role || '');
  const keyword = String(req.query.keyword || '').trim();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 15)));

  const where = ['1=1'];
  const args: unknown[] = [];
  if (role && ['super_admin', 'teacher', 'student'].includes(role)) {
    where.push('u.role = ?');
    args.push(role);
  }
  if (keyword) {
    where.push(
      '(u.username LIKE ? OR u.real_name LIKE ? OR u.class_name LIKE ?)'
    );
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const whereSql = where.join(' AND ');
  const total = (
    db
      .prepare(`SELECT COUNT(*) as cnt FROM users u WHERE ${whereSql}`)
      .get(...args) as { cnt: number }
  ).cnt;

  const rows = db
    .prepare(
      `SELECT u.*, t.real_name as teacher_name, t.username as teacher_username
       FROM users u
       LEFT JOIN users t ON u.teacher_id = t.id
       WHERE ${whereSql}
       ORDER BY CASE u.role WHEN 'super_admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END, u.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, (page - 1) * pageSize) as Array<
    Record<string, unknown>
  >;

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      username: r.username,
      role: r.role as UserRole,
      realName: r.real_name,
      grade: r.grade,
      className: r.class_name,
      studentNo: r.student_no,
      teacherId: r.teacher_id || '',
      teacherName: r.teacher_name || r.teacher_username || '',
      classId: r.class_id || '',
      isDisabled: Boolean(r.is_disabled),
      mustChangePassword: Boolean(r.must_change_password),
      createdAt: r.created_at,
    })),
    total,
    page,
    pageSize,
  });
});

router.post('/users/teacher', (req: AuthedRequest, res) => {
  const schema = z.object({
    username: z
      .string()
      .trim()
      .min(3, '用户名至少 3 个字符')
      .max(32)
      .regex(/^[a-zA-Z0-9_]+$/, '用户名仅支持字母、数字和下划线'),
    realName: z.string().trim().min(1, '教师姓名不能为空').max(32),
    password: z.string().min(6, '初始密码至少 6 位').max(64),
    defaultClassName: z.string().trim().max(40).default('高一(1)班'),
    defaultGrade: z.string().trim().max(20).default('高一'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || '参数无效' });
    return;
  }

  const db = getDb();
  const exists = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(parsed.data.username);
  if (exists) {
    res.status(409).json({ error: '该用户名已存在' });
    return;
  }

  const teacherId = `tch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const hash = bcrypt.hashSync(parsed.data.password, 10);
  const now = new Date().toISOString();

  let inviteCode = generateInviteCode();
  while (
    db.prepare('SELECT id FROM classes WHERE invite_code = ?').get(inviteCode)
  ) {
    inviteCode = generateInviteCode();
  }

  db.transaction(() => {
    db.prepare(
      `INSERT INTO users (
        id, username, password_hash, role, real_name, grade, class_name,
        student_no, teacher_id, class_id, is_disabled, must_change_password,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'teacher', ?, '', '', '', '', '', 0, 1, ?, ?)`
    ).run(teacherId, parsed.data.username, hash, parsed.data.realName, now, now);

    db.prepare(
      `INSERT INTO classes (id, name, grade, teacher_id, invite_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `cls-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      parsed.data.defaultClassName || '高一(1)班',
      parsed.data.defaultGrade || '高一',
      teacherId,
      inviteCode,
      now,
      now
    );
  })();

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '创建教师账号',
    'user',
    teacherId,
    `${parsed.data.realName} (${parsed.data.username})`
  );

  res.status(201).json({ id: teacherId, inviteCode });
});

router.patch('/users/:id/role', (req: AuthedRequest, res) => {
  const schema = z.object({
    role: z.enum(['super_admin', 'teacher', 'student']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '角色无效' });
    return;
  }

  const db = getDb();
  const targetId = String(req.params.id);
  const user = db
    .prepare('SELECT id, username, role FROM users WHERE id = ?')
    .get(targetId) as { id: string; username: string; role: UserRole } | undefined;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  if (user.role === 'super_admin' && parsed.data.role !== 'super_admin') {
    const cntRow = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM users WHERE role = 'super_admin' AND is_disabled = 0"
      )
      .get() as { cnt: number };
    if (cntRow.cnt <= 1) {
      res.status(400).json({ error: '不能降级系统最后一个超级管理员' });
      return;
    }
  }

  db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(
    parsed.data.role,
    new Date().toISOString(),
    targetId
  );

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '变更用户角色',
    'user',
    targetId,
    `${user.username}: ${user.role} -> ${parsed.data.role}`
  );

  res.json({ ok: true });
});

router.patch('/users/:id/status', (req: AuthedRequest, res) => {
  const schema = z.object({ isDisabled: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数无效' });
    return;
  }

  const db = getDb();
  const targetId = String(req.params.id);
  const user = db
    .prepare('SELECT id, username, role FROM users WHERE id = ?')
    .get(targetId) as { id: string; username: string; role: UserRole } | undefined;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  if (user.role === 'super_admin' && parsed.data.isDisabled) {
    const cntRow = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM users WHERE role = 'super_admin' AND is_disabled = 0"
      )
      .get() as { cnt: number };
    if (cntRow.cnt <= 1) {
      res.status(400).json({ error: '不能禁用系统最后一个超级管理员' });
      return;
    }
  }

  db.prepare('UPDATE users SET is_disabled = ?, updated_at = ? WHERE id = ?').run(
    parsed.data.isDisabled ? 1 : 0,
    new Date().toISOString(),
    targetId
  );

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    parsed.data.isDisabled ? '禁用用户账号' : '启用用户账号',
    'user',
    targetId,
    user.username
  );

  res.json({ ok: true });
});

router.post('/users/:id/reset-password', (req: AuthedRequest, res) => {
  const schema = z.object({
    newPassword: z.string().min(6, '新密码至少 6 位').max(64),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || '密码无效' });
    return;
  }

  const db = getDb();
  const targetId = String(req.params.id);
  const user = db
    .prepare('SELECT id, username FROM users WHERE id = ?')
    .get(targetId) as { id: string; username: string } | undefined;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  db.prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?'
  ).run(
    bcrypt.hashSync(parsed.data.newPassword, 10),
    new Date().toISOString(),
    targetId
  );

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '重置用户密码',
    'user',
    targetId,
    user.username
  );

  res.json({ ok: true });
});

router.patch('/users/:id/assign', (req: AuthedRequest, res) => {
  const schema = z.object({
    classId: z.string().min(1, '请选择目标班级'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '请选择班级' });
    return;
  }

  const db = getDb();
  const targetId = String(req.params.id);
  const student = db
    .prepare("SELECT id, username FROM users WHERE id = ? AND role = 'student'")
    .get(targetId) as { id: string; username: string } | undefined;
  if (!student) {
    res.status(404).json({ error: '学生不存在' });
    return;
  }

  const cls = db
    .prepare('SELECT id, name, grade, teacher_id FROM classes WHERE id = ?')
    .get(parsed.data.classId) as
    | { id: string; name: string; grade: string; teacher_id: string }
    | undefined;
  if (!cls) {
    res.status(404).json({ error: '目标班级不存在' });
    return;
  }

  db.prepare(
    'UPDATE users SET teacher_id = ?, class_id = ?, class_name = ?, grade = ?, updated_at = ? WHERE id = ?'
  ).run(
    cls.teacher_id,
    cls.id,
    cls.name,
    cls.grade,
    new Date().toISOString(),
    targetId
  );

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '调整学生所属班级与教师',
    'user',
    targetId,
    `${student.username} -> ${cls.name}`
  );

  res.json({ ok: true });
});

// Legacy /students endpoints kept compatible (now reading from users where role='student')
router.get('/students', (req, res) => {
  const db = getDb();
  const keyword = String(req.query.keyword || '').trim();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 12)));

  const where: string[] = ["st.role = 'student'"];
  const args: unknown[] = [];
  if (keyword) {
    where.push(
      '(st.username LIKE ? OR st.real_name LIKE ? OR st.class_name LIKE ?)'
    );
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  const whereSql = where.join(' AND ');

  const total = (
    db
      .prepare(`SELECT COUNT(*) as cnt FROM users st WHERE ${whereSql}`)
      .get(...args) as { cnt: number }
  ).cnt;

  const rows = db
    .prepare(
      `SELECT st.id, st.username, st.real_name, st.grade, st.class_name,
              st.is_disabled, st.created_at,
              (SELECT COUNT(*) FROM exam_submissions es WHERE es.student_id = st.id AND es.status = 'submitted') as exam_count,
              (SELECT AVG(CASE WHEN es.max_score > 0 THEN es.final_score * 100.0 / es.max_score ELSE NULL END) FROM exam_submissions es WHERE es.student_id = st.id AND es.status = 'submitted') as avg_score
       FROM users st
       WHERE ${whereSql}
       ORDER BY st.created_at DESC
       LIMIT ? OFFSET ?`
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
      isDisabled: Boolean(r.is_disabled),
      practiceCount: Number(r.exam_count || 0),
      avgScore:
        r.avg_score !== null ? Math.round(Number(r.avg_score) * 10) / 10 : 0,
      createdAt: r.created_at,
    })),
    total,
    page,
    pageSize,
  });
});

router.post('/students/:id/reset-password', (req: AuthedRequest, res) => {
  const schema = z.object({
    newPassword: z.string().min(6, '密码至少 6 位').max(64),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message || '密码格式无效' });
    return;
  }

  const db = getDb();
  const hash = bcrypt.hashSync(parsed.data.newPassword, 10);
  const info = db
    .prepare(
      "UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ? AND role = 'student'"
    )
    .run(hash, new Date().toISOString(), String(req.params.id));
  if (info.changes === 0) {
    res.status(404).json({ error: '学生不存在' });
    return;
  }

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '重置学生密码',
    'user',
    String(req.params.id),
    ''
  );
  res.json({ ok: true });
});

router.patch('/students/:id/status', (req: AuthedRequest, res) => {
  const schema = z.object({ isDisabled: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数无效' });
    return;
  }

  const db = getDb();
  const info = db
    .prepare(
      "UPDATE users SET is_disabled = ?, updated_at = ? WHERE id = ? AND role = 'student'"
    )
    .run(
      parsed.data.isDisabled ? 1 : 0,
      new Date().toISOString(),
      String(req.params.id)
    );
  if (info.changes === 0) {
    res.status(404).json({ error: '学生不存在' });
    return;
  }

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    parsed.data.isDisabled ? '禁用学生账号' : '启用学生账号',
    'user',
    String(req.params.id),
    ''
  );
  res.json({ ok: true });
});

router.get('/students/:id/stats', (req, res) => {
  const db = getDb();
  const student = db
    .prepare(
      "SELECT id, username, real_name, grade, class_name FROM users WHERE id = ? AND role = 'student'"
    )
    .get(String(req.params.id)) as Record<string, unknown> | undefined;
  if (!student) {
    res.status(404).json({ error: '学生不存在' });
    return;
  }

  const examSubs = db
    .prepare(
      `SELECT es.id, es.final_score, es.max_score, es.submitted_at, e.title
       FROM exam_submissions es
       INNER JOIN exams e ON es.exam_id = e.id
       WHERE es.student_id = ? AND es.status = 'submitted'
       ORDER BY es.submitted_at DESC LIMIT 20`
    )
    .all(String(req.params.id)) as Array<Record<string, unknown>>;

  res.json({
    student: {
      id: student.id,
      username: student.username,
      realName: student.real_name,
      grade: student.grade,
      className: student.class_name,
    },
    recentSubmissions: examSubs.map((s) => ({
      id: s.id,
      title: s.title,
      type: 'word',
      finalScore: s.final_score,
      maxScore: s.max_score,
      createdAt: s.submitted_at,
    })),
  });
});

// ==================== Operation Logs ====================
router.get('/logs', (req, res) => {
  const db = getDb();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 15)));

  const total = (
    db.prepare('SELECT COUNT(*) as cnt FROM admin_logs').get() as { cnt: number }
  ).cnt;
  const rows = db
    .prepare(
      'SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
    .all(pageSize, (page - 1) * pageSize) as Array<Record<string, unknown>>;

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      adminUsername: r.admin_username,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details,
      createdAt: r.created_at,
    })),
    total,
    page,
    pageSize,
  });
});

export default router;

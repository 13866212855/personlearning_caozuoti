import { Router } from 'express';
import { z } from 'zod';
import { getDb, rowToQuestion } from '../db';
import { gradeAnswerDeterministic } from '../grader';
import { type AuthedRequest, requireStudentAuth } from '../middleware/auth';
import { generateQuestionWithAi } from '../services/llm';
import type {
  DifficultyLevel,
  QuestionType,
  SimulatorState,
} from '../types';

const router = Router();
router.use(requireStudentAuth);

router.get('/meta', (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT type, difficulty, knowledge_points_json FROM questions WHERE status = 'published'"
    )
    .all() as Array<{
    type: QuestionType;
    difficulty: DifficultyLevel;
    knowledge_points_json: string;
  }>;

  const countsByType: Record<string, number> = {
    word: 0,
    excel: 0,
    web: 0,
    file: 0,
  };
  const kpByType: Record<string, Set<string>> = {
    word: new Set(),
    excel: new Set(),
    web: new Set(),
    file: new Set(),
  };

  for (const r of rows) {
    countsByType[r.type] = (countsByType[r.type] || 0) + 1;
    try {
      const kps = JSON.parse(r.knowledge_points_json) as string[];
      for (const kp of kps) {
        kpByType[r.type]?.add(kp);
      }
    } catch {
      // ignore
    }
  }

  res.json({
    countsByType,
    knowledgePointsByType: {
      word: Array.from(kpByType.word),
      excel: Array.from(kpByType.excel),
      web: Array.from(kpByType.web),
      file: Array.from(kpByType.file),
    },
  });
});

router.get('/', (req, res) => {
  const db = getDb();
  const type = String(req.query.type || '');
  const difficulty = String(req.query.difficulty || '');
  const kp = String(req.query.knowledgePoint || '');
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 12)));

  const where: string[] = ["status = 'published'"];
  const args: unknown[] = [];

  if (type && ['word', 'excel', 'web', 'file'].includes(type)) {
    where.push('type = ?');
    args.push(type);
  }
  if (difficulty && ['基础', '中等', '提高'].includes(difficulty)) {
    where.push('difficulty = ?');
    args.push(difficulty);
  }
  if (kp) {
    where.push('knowledge_points_json LIKE ?');
    args.push(`%${kp}%`);
  }

  const whereSql = where.join(' AND ');
  const totalRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM questions WHERE ${whereSql}`)
    .get(...args) as { cnt: number };

  const rows = db
    .prepare(
      `SELECT id, title, type, difficulty, knowledge_points_json, scenario, total_score, source, created_at
       FROM questions WHERE ${whereSql}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, (page - 1) * pageSize) as Array<
    Record<string, unknown>
  >;

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      difficulty: r.difficulty,
      knowledgePoints: JSON.parse(String(r.knowledge_points_json || '[]')),
      scenario: r.scenario,
      totalScore: r.total_score,
      source: r.source,
      createdAt: r.created_at,
    })),
    total: totalRow.cnt,
    page,
    pageSize,
  });
});

const DrawSchema = z.object({
  type: z.enum(['word', 'excel', 'web', 'file']),
  difficulty: z.enum(['基础', '中等', '提高']).default('基础'),
  knowledgePoint: z.string().optional(),
  mode: z.enum(['bank', 'ai', 'auto']).default('auto'),
});

router.post('/draw', async (req: AuthedRequest, res) => {
  const parsed = DrawSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数校验失败' });
    return;
  }

  const { type, difficulty, knowledgePoint, mode } = parsed.data;
  const db = getDb();

  if (mode !== 'ai') {
    const where: string[] = ["status = 'published'", 'type = ?'];
    const args: unknown[] = [type];
    if (difficulty) {
      where.push('difficulty = ?');
      args.push(difficulty);
    }
    if (knowledgePoint) {
      where.push('knowledge_points_json LIKE ?');
      args.push(`%${knowledgePoint}%`);
    }

    let candidates = db
      .prepare(`SELECT * FROM questions WHERE ${where.join(' AND ')}`)
      .all(...args) as Array<Record<string, unknown>>;

    // Fallback to any difficulty of same type if mode is bank/auto and no exact difficulty match
    if (candidates.length === 0 && !knowledgePoint) {
      candidates = db
        .prepare(
          "SELECT * FROM questions WHERE status = 'published' AND type = ?"
        )
        .all(type) as Array<Record<string, unknown>>;
    }

    if (candidates.length > 0) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      res.json({ questionId: picked.id, source: 'bank' });
      return;
    }

    if (mode === 'bank') {
      res
        .status(404)
        .json({ error: '当前筛选条件下题库暂无匹配题目，请切换条件或选择“AI 实时生成新题”' });
      return;
    }
  }

  // Generate via AI in real time and save into database
  try {
    const generated = await generateQuestionWithAi({
      type,
      difficulty,
      knowledgePoint,
      status: 'published',
    });

    db.prepare(
      `INSERT INTO questions (
        id, title, type, difficulty, knowledge_points_json, scenario,
        total_score, materials_json, steps_json, checkpoints_json,
        reference_answer_json, analysis_json, common_mistakes_json,
        status, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generated.id,
      generated.title,
      generated.type,
      generated.difficulty,
      JSON.stringify(generated.knowledgePoints),
      generated.scenario,
      generated.totalScore,
      JSON.stringify(generated.materials),
      JSON.stringify(generated.steps),
      JSON.stringify(generated.checkpoints),
      JSON.stringify(generated.referenceAnswer),
      JSON.stringify(generated.analysis),
      JSON.stringify(generated.commonMistakes),
      generated.status,
      generated.source,
      generated.createdAt,
      generated.updatedAt
    );

    res.json({ questionId: generated.id, source: 'ai' });
  } catch (err) {
    res.status(502).json({
      error:
        err instanceof Error
          ? `实时出题服务暂时不可用：${err.message}`
          : '实时出题失败，请稍后重试或从题库抽题',
    });
  }
});

router.get('/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM questions WHERE id = ? AND status = 'published'")
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: '题目不存在或尚未发布' });
    return;
  }

  const q = rowToQuestion(row);
  const examId = String(req.query.examId || '');

  const draft = db
    .prepare(
      'SELECT * FROM drafts WHERE student_id = ? AND question_id = ? AND exam_id = ?'
    )
    .get(req.student!.id, q.id, examId) as
    | {
        state_json: string;
        hints_used_json: string;
        elapsed_seconds: number;
      }
    | undefined;

  // Strip hints/referenceAnswer/analysis before submission
  const safeSteps = q.steps.map((s) => ({
    index: s.index,
    instruction: s.instruction,
    score: s.score,
  }));

  res.json({
    question: {
      id: q.id,
      title: q.title,
      type: q.type,
      difficulty: q.difficulty,
      knowledgePoints: q.knowledgePoints,
      scenario: q.scenario,
      totalScore: q.totalScore,
      materials: q.materials,
      steps: safeSteps,
      source: q.source,
    },
    draft: draft
      ? {
          state: JSON.parse(draft.state_json),
          hintsUsed: JSON.parse(draft.hints_used_json || '[]'),
          elapsedSeconds: draft.elapsed_seconds,
        }
      : null,
  });
});

router.put('/:id/draft', (req: AuthedRequest, res) => {
  const schema = z.object({
    examId: z.string().default(''),
    state: z.record(z.string(), z.unknown()),
    elapsedSeconds: z.number().int().min(0).default(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '草稿数据格式错误' });
    return;
  }

  const db = getDb();
  const now = new Date().toISOString();
  const { examId, state, elapsedSeconds } = parsed.data;
  const studentId = req.student!.id;
  const questionId = String(req.params.id);

  const existing = db
    .prepare(
      'SELECT id FROM drafts WHERE student_id = ? AND question_id = ? AND exam_id = ?'
    )
    .get(studentId, questionId, examId) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      'UPDATE drafts SET state_json = ?, elapsed_seconds = ?, updated_at = ? WHERE id = ?'
    ).run(JSON.stringify(state), elapsedSeconds, now, existing.id);
  } else {
    db.prepare(
      `INSERT INTO drafts (id, student_id, question_id, exam_id, state_json, hints_used_json, elapsed_seconds, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', ?, ?)`
    ).run(
      `drf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      questionId,
      examId,
      JSON.stringify(state),
      elapsedSeconds,
      now
    );
  }

  res.json({ ok: true, savedAt: now });
});

router.post('/:id/hint', (req: AuthedRequest, res) => {
  const schema = z.object({
    stepIndex: z.number().int().min(1),
    examId: z.string().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数错误' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare('SELECT * FROM questions WHERE id = ?')
    .get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }

  const q = rowToQuestion(row);
  const step = q.steps.find((s) => s.index === parsed.data.stepIndex);
  if (!step) {
    res.status(404).json({ error: '步骤不存在' });
    return;
  }

  const studentId = req.student!.id;
  const examId = parsed.data.examId;
  let draft = db
    .prepare(
      'SELECT * FROM drafts WHERE student_id = ? AND question_id = ? AND exam_id = ?'
    )
    .get(studentId, q.id, examId) as
    | { id: string; hints_used_json: string }
    | undefined;

  let hintsUsed: number[] = [];
  if (draft) {
    hintsUsed = JSON.parse(draft.hints_used_json || '[]');
  } else {
    const now = new Date().toISOString();
    const id = `drf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(
      `INSERT INTO drafts (id, student_id, question_id, exam_id, state_json, hints_used_json, elapsed_seconds, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', 0, ?)`
    ).run(id, studentId, q.id, examId, JSON.stringify(q.materials.initialState), now);
    draft = { id, hints_used_json: '[]' };
  }

  if (!hintsUsed.includes(step.index)) {
    if (hintsUsed.length >= 3) {
      res.status(400).json({ error: '本题最多查看 3 次操作提示' });
      return;
    }
    hintsUsed.push(step.index);
    db.prepare('UPDATE drafts SET hints_used_json = ? WHERE id = ?').run(
      JSON.stringify(hintsUsed),
      draft.id
    );
  }

  res.json({
    stepIndex: step.index,
    hint: step.hint || q.analysis[step.index - 1] || '请仔细阅读题目步骤要求进行操作。',
    hintsUsed,
    penaltyPerHint: 5,
  });
});

router.post('/:id/submit', (req: AuthedRequest, res) => {
  const schema = z.object({
    answer: z.record(z.string(), z.unknown()),
    durationSeconds: z.number().int().min(0).default(0),
    examId: z.string().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '提交数据格式错误' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare('SELECT * FROM questions WHERE id = ?')
    .get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }

  const q = rowToQuestion(row);
  const studentId = req.student!.id;
  const { answer, durationSeconds, examId } = parsed.data;

  const draft = db
    .prepare(
      'SELECT hints_used_json FROM drafts WHERE student_id = ? AND question_id = ? AND exam_id = ?'
    )
    .get(studentId, q.id, examId) as { hints_used_json: string } | undefined;

  const hintsUsed: number[] = draft
    ? JSON.parse(draft.hints_used_json || '[]')
    : [];
  const hintPenalty = hintsUsed.length * 5;

  const gradeResult = gradeAnswerDeterministic(
    q.type,
    q.checkpoints,
    answer as unknown as SimulatorState
  );

  const finalScore = Math.max(0, gradeResult.autoScore - hintPenalty);
  const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO submissions (
      id, student_id, question_id, exam_id, answer_json,
      auto_score, final_score, max_score, checkpoint_results_json,
      hints_used_count, hint_penalty, duration_seconds,
      teacher_comment, adjusted_by, graded_by_ai, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?)`
  ).run(
    subId,
    studentId,
    q.id,
    examId,
    JSON.stringify(answer),
    gradeResult.autoScore,
    finalScore,
    gradeResult.maxScore,
    JSON.stringify(gradeResult.checkpointResults),
    hintsUsed.length,
    hintPenalty,
    durationSeconds,
    gradeResult.gradedByAi ? 1 : 0,
    now
  );

  // Clear draft after single-question submission
  if (!examId) {
    db.prepare(
      'DELETE FROM drafts WHERE student_id = ? AND question_id = ? AND exam_id = ?'
    ).run(studentId, q.id, '');
  }

  res.json({
    submissionId: subId,
    autoScore: gradeResult.autoScore,
    hintPenalty,
    hintsUsedCount: hintsUsed.length,
    finalScore,
    maxScore: gradeResult.maxScore,
    checkpointResults: gradeResult.checkpointResults,
    gradedByAi: gradeResult.gradedByAi,
    referenceAnswer: q.referenceAnswer,
    analysis: q.analysis,
    commonMistakes: q.commonMistakes,
  });
});

export default router;

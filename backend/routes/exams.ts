import { Router } from 'express';
import { z } from 'zod';
import { getDb, rowToQuestion } from '../db';
import { gradeAnswerDeterministic } from '../grader';
import { type AuthedRequest, requireStudentAuth } from '../middleware/auth';
import type { QuestionType, SimulatorState } from '../types';

const router = Router();
router.use(requireStudentAuth);

router.post('/start', (req: AuthedRequest, res) => {
  const db = getDb();
  const types: QuestionType[] = ['word', 'excel', 'web', 'file'];
  const pickedIds: string[] = [];

  for (const t of types) {
    const rows = db
      .prepare(
        "SELECT id FROM questions WHERE status = 'published' AND type = ?"
      )
      .all(t) as Array<{ id: string }>;
    if (rows.length > 0) {
      const rand = rows[Math.floor(Math.random() * rows.length)];
      pickedIds.push(rand.id);
    }
  }

  if (pickedIds.length === 0) {
    res.status(400).json({ error: '题库暂无已发布题目，无法生成模拟试卷' });
    return;
  }

  const durationSeconds = 40 * 60; // 40 minutes
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + durationSeconds * 1000);
  const examId = `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  db.prepare(
    `INSERT INTO exams (id, student_id, title, question_ids_json, duration_seconds, status, total_score, max_score, started_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 'in_progress', 0, ?, ?, ?)`
  ).run(
    examId,
    req.student!.id,
    '高中信息技术会考操作题全真模拟卷',
    JSON.stringify(pickedIds),
    durationSeconds,
    pickedIds.length * 100,
    startedAt.toISOString(),
    expiresAt.toISOString()
  );

  res.json({ examId });
});

router.get('/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const exam = db
    .prepare('SELECT * FROM exams WHERE id = ? AND student_id = ?')
    .get(req.params.id, req.student!.id) as
    | {
        id: string;
        title: string;
        question_ids_json: string;
        duration_seconds: number;
        status: string;
        total_score: number;
        max_score: number;
        started_at: string;
        expires_at: string;
        submitted_at: string | null;
      }
    | undefined;

  if (!exam) {
    res.status(404).json({ error: '模拟考试记录不存在' });
    return;
  }

  const qIds = JSON.parse(exam.question_ids_json) as string[];
  const questions = qIds
    .map((id) =>
      db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as
        | Record<string, unknown>
        | undefined
    )
    .filter((r): r is Record<string, unknown> => Boolean(r))
    .map(rowToQuestion);

  const drafts = db
    .prepare('SELECT question_id, state_json FROM drafts WHERE student_id = ? AND exam_id = ?')
    .all(req.student!.id, exam.id) as Array<{
    question_id: string;
    state_json: string;
  }>;
  const draftMap: Record<string, unknown> = {};
  for (const d of drafts) {
    draftMap[d.question_id] = JSON.parse(d.state_json);
  }

  let submissionResults: unknown[] = [];
  if (exam.status === 'submitted') {
    const subs = db
      .prepare('SELECT * FROM submissions WHERE exam_id = ? AND student_id = ?')
      .all(exam.id, req.student!.id) as Array<Record<string, unknown>>;
    submissionResults = subs.map((s) => ({
      questionId: s.question_id,
      autoScore: s.auto_score,
      finalScore: s.final_score,
      maxScore: s.max_score,
      checkpointResults: JSON.parse(String(s.checkpoint_results_json || '[]')),
    }));
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((new Date(exam.expires_at).getTime() - Date.now()) / 1000)
  );

  res.json({
    exam: {
      id: exam.id,
      title: exam.title,
      durationSeconds: exam.duration_seconds,
      remainingSeconds,
      status: exam.status,
      totalScore: exam.total_score,
      maxScore: exam.max_score,
      startedAt: exam.started_at,
      expiresAt: exam.expires_at,
      submittedAt: exam.submitted_at,
    },
    questions: questions.map((q) => ({
      id: q.id,
      title: q.title,
      type: q.type,
      difficulty: q.difficulty,
      knowledgePoints: q.knowledgePoints,
      scenario: q.scenario,
      totalScore: q.totalScore,
      materials: q.materials,
      steps: q.steps.map((s) => ({
        index: s.index,
        instruction: s.instruction,
        score: s.score,
      })),
      ...(exam.status === 'submitted'
        ? {
            referenceAnswer: q.referenceAnswer,
            analysis: q.analysis,
            commonMistakes: q.commonMistakes,
          }
        : {}),
    })),
    draftMap,
    submissionResults,
  });
});

router.post('/:id/submit', (req: AuthedRequest, res) => {
  const schema = z.object({
    answers: z.record(z.string(), z.record(z.string(), z.unknown())),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '交卷数据格式错误' });
    return;
  }

  const db = getDb();
  const exam = db
    .prepare('SELECT * FROM exams WHERE id = ? AND student_id = ?')
    .get(req.params.id, req.student!.id) as
    | {
        id: string;
        question_ids_json: string;
        status: string;
        started_at: string;
      }
    | undefined;

  if (!exam) {
    res.status(404).json({ error: '模拟考试不存在' });
    return;
  }
  if (exam.status === 'submitted') {
    res.status(400).json({ error: '该试卷已提交，请勿重复交卷' });
    return;
  }

  const qIds = JSON.parse(exam.question_ids_json) as string[];
  const now = new Date();
  const durationSeconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(exam.started_at).getTime()) / 1000)
  );

  let totalScore = 0;
  let maxScore = 0;
  const results: Array<Record<string, unknown>> = [];

  const tx = db.transaction(() => {
    for (const qId of qIds) {
      const qRow = db
        .prepare('SELECT * FROM questions WHERE id = ?')
        .get(qId) as Record<string, unknown> | undefined;
      if (!qRow) continue;
      const q = rowToQuestion(qRow);
      const ans =
        (parsed.data.answers[qId] as unknown as SimulatorState) ||
        q.materials.initialState;
      const grade = gradeAnswerDeterministic(q.type, q.checkpoints, ans);

      totalScore += grade.autoScore;
      maxScore += grade.maxScore;

      const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      db.prepare(
        `INSERT INTO submissions (
          id, student_id, question_id, exam_id, answer_json,
          auto_score, final_score, max_score, checkpoint_results_json,
          hints_used_count, hint_penalty, duration_seconds,
          teacher_comment, adjusted_by, graded_by_ai, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, '', '', 0, ?)`
      ).run(
        subId,
        req.student!.id,
        q.id,
        exam.id,
        JSON.stringify(ans),
        grade.autoScore,
        grade.autoScore,
        grade.maxScore,
        JSON.stringify(grade.checkpointResults),
        durationSeconds,
        now.toISOString()
      );

      results.push({
        questionId: q.id,
        title: q.title,
        type: q.type,
        autoScore: grade.autoScore,
        finalScore: grade.autoScore,
        maxScore: grade.maxScore,
        checkpointResults: grade.checkpointResults,
        referenceAnswer: q.referenceAnswer,
        analysis: q.analysis,
        commonMistakes: q.commonMistakes,
      });
    }

    db.prepare(
      `UPDATE exams SET status = 'submitted', total_score = ?, max_score = ?, submitted_at = ? WHERE id = ?`
    ).run(totalScore, maxScore, now.toISOString(), exam.id);

    db.prepare('DELETE FROM drafts WHERE student_id = ? AND exam_id = ?').run(
      req.student!.id,
      exam.id
    );
  });

  tx();

  res.json({
    examId: exam.id,
    totalScore,
    maxScore,
    results,
  });
});

export default router;

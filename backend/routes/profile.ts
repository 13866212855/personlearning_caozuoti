import { Router } from 'express';
import { getDb, rowToQuestion } from '../db';
import { type AuthedRequest, requireStudentAuth } from '../middleware/auth';

const router = Router();
router.use(requireStudentAuth);

router.get('/history', (req: AuthedRequest, res) => {
  const db = getDb();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)));
  const studentId = req.student!.id;

  const totalRow = db
    .prepare('SELECT COUNT(*) as cnt FROM submissions WHERE student_id = ?')
    .get(studentId) as { cnt: number };

  const rows = db
    .prepare(
      `SELECT s.*, q.title as question_title, q.type as question_type, q.difficulty as question_difficulty
       FROM submissions s
       LEFT JOIN questions q ON s.question_id = q.id
       WHERE s.student_id = ?
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(studentId, pageSize, (page - 1) * pageSize) as Array<
    Record<string, unknown>
  >;

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      questionId: r.question_id,
      questionTitle: r.question_title || '已删除题目',
      questionType: r.question_type || 'word',
      difficulty: r.question_difficulty || '基础',
      examId: r.exam_id,
      autoScore: r.auto_score,
      finalScore: r.final_score,
      maxScore: r.max_score,
      durationSeconds: r.duration_seconds,
      teacherComment: r.teacher_comment,
      createdAt: r.created_at,
    })),
    total: totalRow.cnt,
    page,
    pageSize,
  });
});

router.get('/submissions/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const sub = db
    .prepare('SELECT * FROM submissions WHERE id = ? AND student_id = ?')
    .get(req.params.id, req.student!.id) as
    | Record<string, unknown>
    | undefined;

  if (!sub) {
    res.status(404).json({ error: '提交记录不存在' });
    return;
  }

  const qRow = db
    .prepare('SELECT * FROM questions WHERE id = ?')
    .get(sub.question_id) as Record<string, unknown> | undefined;

  const question = qRow ? rowToQuestion(qRow) : null;

  res.json({
    submission: {
      id: sub.id,
      questionId: sub.question_id,
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
    question,
  });
});

router.get('/mistakes', (req: AuthedRequest, res) => {
  const db = getDb();
  const studentId = req.student!.id;

  const rows = db
    .prepare(
      `SELECT s.question_id,
              MAX(s.final_score) as best_score,
              MIN(s.final_score) as lowest_score,
              MAX(s.max_score) as max_score,
              COUNT(*) as attempt_count,
              MAX(s.created_at) as last_attempt_at,
              q.title, q.type, q.difficulty, q.knowledge_points_json
       FROM submissions s
       INNER JOIN questions q ON s.question_id = q.id
       WHERE s.student_id = ? AND s.final_score < s.max_score
       GROUP BY s.question_id
       ORDER BY last_attempt_at DESC`
    )
    .all(studentId) as Array<Record<string, unknown>>;

  res.json({
    items: rows.map((r) => ({
      questionId: r.question_id,
      title: r.title,
      type: r.type,
      difficulty: r.difficulty,
      knowledgePoints: JSON.parse(String(r.knowledge_points_json || '[]')),
      bestScore: r.best_score,
      lowestScore: r.lowest_score,
      maxScore: r.max_score,
      attemptCount: r.attempt_count,
      lastAttemptAt: r.last_attempt_at,
    })),
  });
});

router.get('/stats', (req: AuthedRequest, res) => {
  const db = getDb();
  const studentId = req.student!.id;

  const rows = db
    .prepare(
      `SELECT s.final_score, s.max_score, s.checkpoint_results_json, s.created_at,
              q.type, q.knowledge_points_json
       FROM submissions s
       LEFT JOIN questions q ON s.question_id = q.id
       WHERE s.student_id = ?
       ORDER BY s.created_at ASC`
    )
    .all(studentId) as Array<Record<string, unknown>>;

  const typeBuckets: Record<string, { sum: number; count: number }> = {
    word: { sum: 0, count: 0 },
    excel: { sum: 0, count: 0 },
    web: { sum: 0, count: 0 },
    file: { sum: 0, count: 0 },
  };

  const kpStats: Record<string, { passed: number; total: number }> = {};

  let totalScoreSum = 0;
  for (const r of rows) {
    const score = Number(r.final_score || 0);
    const max = Number(r.max_score || 100);
    const pct = max > 0 ? (score / max) * 100 : 0;
    totalScoreSum += pct;

    const t = String(r.type || 'word');
    if (typeBuckets[t]) {
      typeBuckets[t].sum += pct;
      typeBuckets[t].count += 1;
    }

    const kps = JSON.parse(String(r.knowledge_points_json || '[]')) as string[];
    for (const kp of kps) {
      if (!kpStats[kp]) kpStats[kp] = { passed: 0, total: 0 };
      kpStats[kp].total += 1;
      if (pct >= 80) kpStats[kp].passed += 1;
    }
  }

  const avgByType = Object.entries(typeBuckets).map(([type, b]) => ({
    type,
    avgScore: b.count > 0 ? Math.round((b.sum / b.count) * 10) / 10 : 0,
    count: b.count,
  }));

  const trend = rows.slice(-12).map((r, idx) => {
    const score = Number(r.final_score || 0);
    const max = Number(r.max_score || 100);
    return {
      index: idx + 1,
      score: max > 0 ? Math.round((score / max) * 100) : 0,
      type: String(r.type || 'word'),
      date: String(r.created_at).slice(5, 10),
    };
  });

  const weakKnowledgePoints = Object.entries(kpStats)
    .map(([name, st]) => ({
      name,
      masteryRate: Math.round((st.passed / st.total) * 100),
      attempts: st.total,
    }))
    .sort((a, b) => a.masteryRate - b.masteryRate)
    .slice(0, 6);

  res.json({
    totalPractices: rows.length,
    overallAvg:
      rows.length > 0 ? Math.round((totalScoreSum / rows.length) * 10) / 10 : 0,
    avgByType,
    trend,
    weakKnowledgePoints,
  });
});

export default router;

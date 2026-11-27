import { Router } from 'express';
import { z } from 'zod';
import { getDb, rowToQuestion } from '../db';
import { gradeAnswerDeterministic } from '../grader';
import { type AuthedRequest, requireStudentAuth } from '../middleware/auth';
import type { ExamQuestionResult, QuestionType, SimulatorState } from '../types';

const router = Router();
router.use(requireStudentAuth);

function canRevealExamAnswers(
  policy: string,
  examStatus: string,
  endTime: string
): boolean {
  if (policy === 'immediate') return true;
  if (policy === 'never') return false;
  if (policy === 'after_end') {
    return examStatus === 'ended' || Date.now() > new Date(endTime).getTime();
  }
  return false;
}

// Unified Student History: Exam submissions + legacy practice submissions (read-only historical label)
router.get('/history', (req: AuthedRequest, res) => {
  const db = getDb();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)));
  const studentId = req.student!.id;

  const examRows = db
    .prepare(
      `SELECT es.*, e.title as exam_title, e.end_time, e.status as exam_status,
              e.show_score_immediately, e.show_answer_policy
       FROM exam_submissions es
       INNER JOIN exams e ON es.exam_id = e.id
       WHERE es.student_id = ? AND es.status = 'submitted'
       ORDER BY es.submitted_at DESC`
    )
    .all(studentId) as Array<Record<string, unknown>>;

  const legacyRows = db
    .prepare(
      `SELECT s.*, q.title as question_title, q.type as question_type
       FROM submissions s
       LEFT JOIN questions q ON s.question_id = q.id
       WHERE s.student_id = ?
       ORDER BY s.created_at DESC`
    )
    .all(studentId) as Array<Record<string, unknown>>;

  const nowMs = Date.now();
  const unified: Array<Record<string, unknown>> = [];

  for (const r of examRows) {
    const isEnded =
      String(r.exam_status) === 'ended' ||
      nowMs > new Date(String(r.end_time)).getTime();
    const scoreVisible = Boolean(r.show_score_immediately) || isEnded;
    const answerVisible = canRevealExamAnswers(
      String(r.show_answer_policy),
      String(r.exam_status),
      String(r.end_time)
    );
    unified.push({
      id: r.id,
      kind: 'exam',
      examId: r.exam_id,
      title: r.exam_title,
      sourceLabel: '模拟考试',
      questionType: 'exam',
      finalScore: scoreVisible ? r.final_score : null,
      maxScore: r.max_score,
      scoreVisible,
      answerVisible,
      durationSeconds: r.duration_seconds,
      teacherComment: r.teacher_comment || '',
      isLate: Boolean(r.is_late),
      createdAt: r.submitted_at || r.updated_at,
    });
  }

  for (const r of legacyRows) {
    const isRedo = String(r.exam_id || '') === 'redo-practice';
    unified.push({
      id: r.id,
      kind: isRedo ? 'redo' : 'legacy_practice',
      examId: r.exam_id || '',
      questionId: r.question_id,
      title: r.question_title || '已删除题目',
      sourceLabel: isRedo ? '错题重做' : '自由练习（历史）',
      questionType: r.question_type || 'word',
      finalScore: r.final_score,
      maxScore: r.max_score,
      scoreVisible: true,
      answerVisible: true,
      durationSeconds: r.duration_seconds,
      teacherComment: r.teacher_comment || '',
      isLate: false,
      createdAt: r.created_at,
    });
  }

  unified.sort(
    (a, b) =>
      new Date(String(b.createdAt)).getTime() -
      new Date(String(a.createdAt)).getTime()
  );

  const total = unified.length;
  const items = unified.slice((page - 1) * pageSize, page * pageSize);

  res.json({ items, total, page, pageSize });
});

// Review a legacy or redo submission
router.get('/submissions/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const sub = db
    .prepare('SELECT * FROM submissions WHERE id = ? AND student_id = ?')
    .get(String(req.params.id), req.student!.id) as
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

// Mistake Notebook: collected automatically from exam_submissions + legacy submissions
router.get('/mistakes', (req: AuthedRequest, res) => {
  const db = getDb();
  const studentId = req.student!.id;

  const map = new Map<
    string,
    {
      questionId: string;
      bestScore: number;
      lowestScore: number;
      maxScore: number;
      attemptCount: number;
      lastAttemptAt: string;
      canViewAnswer: boolean;
    }
  >();

  // 1. Collect from exam_submissions (only where score is not full marks, respecting answer visibility if possible)
  const examSubs = db
    .prepare(
      `SELECT es.question_results_json, es.submitted_at, e.show_answer_policy, e.status, e.end_time
       FROM exam_submissions es
       INNER JOIN exams e ON es.exam_id = e.id
       WHERE es.student_id = ? AND es.status = 'submitted'
       ORDER BY es.submitted_at DESC`
    )
    .all(studentId) as Array<Record<string, unknown>>;

  for (const es of examSubs) {
    const qResults = JSON.parse(
      String(es.question_results_json || '[]')
    ) as ExamQuestionResult[];
    const answerVisible = canRevealExamAnswers(
      String(es.show_answer_policy),
      String(es.status),
      String(es.end_time)
    );
    const ts = String(es.submitted_at || '');

    for (const qr of qResults) {
      if (qr.finalScore < qr.maxScore) {
        const cur = map.get(qr.questionId);
        if (!cur) {
          map.set(qr.questionId, {
            questionId: qr.questionId,
            bestScore: qr.finalScore,
            lowestScore: qr.finalScore,
            maxScore: qr.maxScore,
            attemptCount: 1,
            lastAttemptAt: ts,
            canViewAnswer: answerVisible,
          });
        } else {
          cur.bestScore = Math.max(cur.bestScore, qr.finalScore);
          cur.lowestScore = Math.min(cur.lowestScore, qr.finalScore);
          cur.attemptCount += 1;
          cur.canViewAnswer = cur.canViewAnswer || answerVisible;
          if (ts > cur.lastAttemptAt) cur.lastAttemptAt = ts;
        }
      }
    }
  }

  // 2. Also include historical practice mistakes
  const legacySubs = db
    .prepare(
      `SELECT question_id, final_score, max_score, created_at, exam_id
       FROM submissions
       WHERE student_id = ? AND final_score < max_score`
    )
    .all(studentId) as Array<Record<string, unknown>>;

  for (const ls of legacySubs) {
    const qid = String(ls.question_id);
    const score = Number(ls.final_score);
    const maxScore = Number(ls.max_score);
    const ts = String(ls.created_at);
    const cur = map.get(qid);
    if (!cur) {
      map.set(qid, {
        questionId: qid,
        bestScore: score,
        lowestScore: score,
        maxScore,
        attemptCount: 1,
        lastAttemptAt: ts,
        canViewAnswer: true,
      });
    } else {
      cur.bestScore = Math.max(cur.bestScore, score);
      cur.lowestScore = Math.min(cur.lowestScore, score);
      cur.attemptCount += 1;
      cur.canViewAnswer = true;
      if (ts > cur.lastAttemptAt) cur.lastAttemptAt = ts;
    }
  }

  const items: Array<Record<string, unknown>> = [];
  for (const entry of map.values()) {
    const qRow = db
      .prepare('SELECT id, title, type, difficulty, knowledge_points_json FROM questions WHERE id = ?')
      .get(entry.questionId) as Record<string, unknown> | undefined;
    if (!qRow) continue;
    items.push({
      questionId: qRow.id,
      title: qRow.title,
      type: qRow.type,
      difficulty: qRow.difficulty,
      knowledgePoints: JSON.parse(String(qRow.knowledge_points_json || '[]')),
      bestScore: entry.bestScore,
      lowestScore: entry.lowestScore,
      maxScore: entry.maxScore,
      attemptCount: entry.attemptCount,
      lastAttemptAt: entry.lastAttemptAt,
      canViewAnswer: entry.canViewAnswer,
    });
  }

  items.sort(
    (a, b) =>
      new Date(String(b.lastAttemptAt)).getTime() -
      new Date(String(a.lastAttemptAt)).getTime()
  );

  res.json({ items });
});

// Load a mistake question ONLY if it exists in student's mistake records (no open bank access)
router.get('/mistakes/:questionId', (req: AuthedRequest, res) => {
  const db = getDb();
  const studentId = req.student!.id;
  const questionId = String(req.params.questionId);

  let foundInMistakes = false;
  let allowAnswerPreview = true;

  const examSubs = db
    .prepare(
      `SELECT es.question_results_json, e.show_answer_policy, e.status, e.end_time
       FROM exam_submissions es
       INNER JOIN exams e ON es.exam_id = e.id
       WHERE es.student_id = ? AND es.status = 'submitted'`
    )
    .all(studentId) as Array<Record<string, unknown>>;

  for (const es of examSubs) {
    const qResults = JSON.parse(
      String(es.question_results_json || '[]')
    ) as ExamQuestionResult[];
    const hit = qResults.find(
      (qr) => qr.questionId === questionId && qr.finalScore < qr.maxScore
    );
    if (hit) {
      foundInMistakes = true;
      allowAnswerPreview = canRevealExamAnswers(
        String(es.show_answer_policy),
        String(es.status),
        String(es.end_time)
      );
      break;
    }
  }

  if (!foundInMistakes) {
    const legacy = db
      .prepare(
        'SELECT id FROM submissions WHERE student_id = ? AND question_id = ? AND final_score < max_score LIMIT 1'
      )
      .get(studentId, questionId);
    if (legacy) {
      foundInMistakes = true;
      allowAnswerPreview = true;
    }
  }

  if (!foundInMistakes) {
    res.status(403).json({ error: '仅支持对本人错题本中的题目进行重做' });
    return;
  }

  const row = db
    .prepare('SELECT * FROM questions WHERE id = ?')
    .get(questionId) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: '题目已不存在' });
    return;
  }

  const q = rowToQuestion(row);
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
      steps: q.steps.map((s) => ({
        index: s.index,
        instruction: s.instruction,
        score: s.score,
      })),
      source: q.source,
    },
    allowAnswerPreview,
    ...(allowAnswerPreview
      ? {
          referenceAnswer: q.referenceAnswer,
          analysis: q.analysis,
          commonMistakes: q.commonMistakes,
        }
      : {}),
  });
});

// Submit a mistake redo (saved with exam_id='redo-practice' so teacher exam grades remain unaffected)
router.post('/mistakes/:questionId/redo', (req: AuthedRequest, res) => {
  const schema = z.object({
    answer: z.record(z.string(), z.unknown()),
    durationSeconds: z.number().int().min(0).default(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '提交数据格式错误' });
    return;
  }

  const db = getDb();
  const questionId = String(req.params.questionId);
  const row = db
    .prepare('SELECT * FROM questions WHERE id = ?')
    .get(questionId) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: '题目不存在' });
    return;
  }

  const q = rowToQuestion(row);
  const grade = gradeAnswerDeterministic(
    q.type,
    q.checkpoints,
    parsed.data.answer as unknown as SimulatorState
  );

  const subId = `redo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO submissions (
      id, student_id, question_id, exam_id, answer_json,
      auto_score, final_score, max_score, checkpoint_results_json,
      hints_used_count, hint_penalty, duration_seconds,
      teacher_comment, adjusted_by, graded_by_ai, created_at
    ) VALUES (?, ?, ?, 'redo-practice', ?, ?, ?, ?, ?, 0, 0, ?, '', '', ?, ?)`
  ).run(
    subId,
    req.student!.id,
    q.id,
    JSON.stringify(parsed.data.answer),
    grade.autoScore,
    grade.autoScore,
    grade.maxScore,
    JSON.stringify(grade.checkpointResults),
    parsed.data.durationSeconds,
    grade.gradedByAi ? 1 : 0,
    now
  );

  res.json({
    submissionId: subId,
    autoScore: grade.autoScore,
    hintPenalty: 0,
    hintsUsedCount: 0,
    finalScore: grade.autoScore,
    maxScore: grade.maxScore,
    checkpointResults: grade.checkpointResults,
    gradedByAi: grade.gradedByAi,
    referenceAnswer: q.referenceAnswer,
    analysis: q.analysis,
    commonMistakes: q.commonMistakes,
  });
});

// Student Learning Stats (combining exam_submissions & legacy submissions)
router.get('/stats', (req: AuthedRequest, res) => {
  const db = getDb();
  const student = req.student!;

  const examSubs = db
    .prepare(
      `SELECT es.final_score, es.max_score, es.question_results_json, es.submitted_at, e.title as exam_title
       FROM exam_submissions es
       INNER JOIN exams e ON es.exam_id = e.id
       WHERE es.student_id = ? AND es.status = 'submitted'
       ORDER BY es.submitted_at ASC`
    )
    .all(student.id) as Array<Record<string, unknown>>;

  const legacySubs = db
    .prepare(
      `SELECT s.final_score, s.max_score, s.created_at, q.type, q.knowledge_points_json
       FROM submissions s
       LEFT JOIN questions q ON s.question_id = q.id
       WHERE s.student_id = ?
       ORDER BY s.created_at ASC`
    )
    .all(student.id) as Array<Record<string, unknown>>;

  const typeBuckets: Record<QuestionType, { sum: number; count: number }> = {
    word: { sum: 0, count: 0 },
    excel: { sum: 0, count: 0 },
    web: { sum: 0, count: 0 },
    file: { sum: 0, count: 0 },
    python: { sum: 0, count: 0 },
    database: { sum: 0, count: 0 },
  };
  const kpStats: Record<string, { sumPct: number; count: number }> = {};

  let totalScorePctSum = 0;
  let totalCount = 0;
  const trendRaw: Array<{ score: number; label: string; date: string; ts: number }> = [];

  for (const es of examSubs) {
    const score = Number(es.final_score || 0);
    const max = Number(es.max_score || 100);
    const pct = max > 0 ? Math.round((score / max) * 100) : 0;
    totalScorePctSum += pct;
    totalCount += 1;
    const dateStr = String(es.submitted_at || '');
    trendRaw.push({
      score: pct,
      label: String(es.exam_title || '模拟考试'),
      date: dateStr.slice(5, 10),
      ts: new Date(dateStr).getTime(),
    });

    const qResults = JSON.parse(
      String(es.question_results_json || '[]')
    ) as ExamQuestionResult[];
    for (const qr of qResults) {
      const qPct = qr.maxScore > 0 ? (qr.finalScore / qr.maxScore) * 100 : 0;
      if (typeBuckets[qr.type]) {
        typeBuckets[qr.type].sum += qPct;
        typeBuckets[qr.type].count += 1;
      }
      const qRow = db
        .prepare('SELECT knowledge_points_json FROM questions WHERE id = ?')
        .get(qr.questionId) as { knowledge_points_json: string } | undefined;
      if (qRow) {
        const kps = JSON.parse(qRow.knowledge_points_json || '[]') as string[];
        for (const kp of kps) {
          if (!kpStats[kp]) kpStats[kp] = { sumPct: 0, count: 0 };
          kpStats[kp].sumPct += qPct;
          kpStats[kp].count += 1;
        }
      }
    }
  }

  for (const r of legacySubs) {
    const score = Number(r.final_score || 0);
    const max = Number(r.max_score || 100);
    const pct = max > 0 ? (score / max) * 100 : 0;
    totalScorePctSum += pct;
    totalCount += 1;
    const t = String(r.type || 'word') as QuestionType;
    if (typeBuckets[t]) {
      typeBuckets[t].sum += pct;
      typeBuckets[t].count += 1;
    }
    const kps = JSON.parse(String(r.knowledge_points_json || '[]')) as string[];
    for (const kp of kps) {
      if (!kpStats[kp]) kpStats[kp] = { sumPct: 0, count: 0 };
      kpStats[kp].sumPct += pct;
      kpStats[kp].count += 1;
    }
    const dateStr = String(r.created_at || '');
    trendRaw.push({
      score: Math.round(pct),
      label: '历史练习',
      date: dateStr.slice(5, 10),
      ts: new Date(dateStr).getTime(),
    });
  }

  trendRaw.sort((a, b) => a.ts - b.ts);
  const trend = trendRaw.slice(-12).map((pt, idx) => ({
    index: idx + 1,
    score: pt.score,
    type: pt.label,
    date: pt.date,
  }));

  const avgByType = Object.entries(typeBuckets).map(([type, b]) => ({
    type,
    avgScore: b.count > 0 ? Math.round((b.sum / b.count) * 10) / 10 : 0,
    count: b.count,
  }));

  const weakKnowledgePoints = Object.entries(kpStats)
    .map(([name, st]) => ({
      name,
      masteryRate: Math.round((st.sumPct / st.count) * 10) / 10,
      attempts: st.count,
    }))
    .sort((a, b) => a.masteryRate - b.masteryRate)
    .slice(0, 8);

  let teacherName = '';
  let classInfo = { name: student.className, grade: student.grade, inviteCode: '' };
  if (student.teacherId) {
    const t = db
      .prepare('SELECT real_name, username FROM users WHERE id = ?')
      .get(student.teacherId) as { real_name: string; username: string } | undefined;
    teacherName = t ? t.real_name || t.username : '';
  }
  if (student.classId) {
    const c = db
      .prepare('SELECT name, grade, invite_code FROM classes WHERE id = ?')
      .get(student.classId) as
      | { name: string; grade: string; invite_code: string }
      | undefined;
    if (c) {
      classInfo = { name: c.name, grade: c.grade, inviteCode: c.invite_code };
    }
  }

  res.json({
    totalPractices: totalCount,
    examCount: examSubs.length,
    overallAvg:
      totalCount > 0 ? Math.round((totalScorePctSum / totalCount) * 10) / 10 : 0,
    avgByType,
    trend,
    weakKnowledgePoints,
    classInfo: {
      ...classInfo,
      teacherName,
    },
  });
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { getDb, rowToQuestion } from '../db';
import { gradeAnswerDeterministic } from '../grader';
import { type AuthedRequest, requireStudentAuth } from '../middleware/auth';
import type { ExamQuestionResult, SimulatorState } from '../types';
import { buildStepGuidance } from '../utils/stepGuidance';

const router = Router();
router.use(requireStudentAuth);

function isStudentAssignedToExam(
  db: ReturnType<typeof getDb>,
  examId: string,
  studentId: string,
  classId: string
): boolean {
  const rows = db
    .prepare('SELECT target_type, target_id FROM exam_assignments WHERE exam_id = ?')
    .all(examId) as Array<{ target_type: string; target_id: string }>;

  return rows.some(
    (a) =>
      (a.target_type === 'student' && a.target_id === studentId) ||
      (a.target_type === 'class' && classId && a.target_id === classId)
  );
}

function deterministicShuffle<T>(arr: T[], seedStr: string): T[] {
  const copy = [...arr];
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function canRevealAnswers(
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

// List assigned exams grouped into pending / inProgress / completed
router.get('/', (req: AuthedRequest, res) => {
  const db = getDb();
  const student = req.student!;
  const nowMs = Date.now();

  const examRows = db
    .prepare(
      `SELECT DISTINCT e.*, u.real_name as teacher_name, u.username as teacher_username
       FROM exams e
       INNER JOIN exam_assignments ea ON e.id = ea.exam_id
       LEFT JOIN users u ON e.teacher_id = u.id
       WHERE e.status IN ('published', 'ended')
         AND (
           (ea.target_type = 'student' AND ea.target_id = ?)
           OR (ea.target_type = 'class' AND ea.target_id = ?)
         )
       ORDER BY e.start_time DESC`
    )
    .all(student.id, student.classId || '__none__') as Array<
    Record<string, unknown>
  >;

  const pending: Array<Record<string, unknown>> = [];
  const inProgress: Array<Record<string, unknown>> = [];
  const completed: Array<Record<string, unknown>> = [];

  if (examRows.length === 0) {
    res.json({ pending, inProgress, completed });
    return;
  }

  const examIds = examRows.map((e) => String(e.id));
  const placeholders = examIds.map(() => '?').join(', ');

  const qInfoRows = db
    .prepare(
      `SELECT exam_id, COUNT(*) as cnt, COALESCE(SUM(score), 0) as total_score
       FROM exam_questions
       WHERE exam_id IN (${placeholders})
       GROUP BY exam_id`
    )
    .all(...examIds) as Array<{
    exam_id: string;
    cnt: number;
    total_score: number;
  }>;
  const qInfoMap = new Map(qInfoRows.map((r) => [r.exam_id, r]));

  const allSubs = db
    .prepare(
      `SELECT * FROM exam_submissions
       WHERE student_id = ? AND exam_id IN (${placeholders})
       ORDER BY attempt_no DESC`
    )
    .all(student.id, ...examIds) as Array<Record<string, unknown>>;
  const subsByExam = new Map<string, Array<Record<string, unknown>>>();
  for (const s of allSubs) {
    const eid = String(s.exam_id);
    const list = subsByExam.get(eid) || [];
    list.push(s);
    subsByExam.set(eid, list);
  }

  for (const e of examRows) {
    const examId = String(e.id);
    const qInfo = qInfoMap.get(examId) || { cnt: 0, total_score: 0 };
    const subs = subsByExam.get(examId) || [];

    const activeDraft = subs.find((s) => s.status === 'in_progress');
    const submittedSubs = subs.filter((s) => s.status === 'submitted');

    const startMs = new Date(String(e.start_time)).getTime();
    const endMs = new Date(String(e.end_time)).getTime();
    const allowLate = Boolean(e.allow_late);
    const maxAttempts = Number(e.max_attempts || 1);
    const isEnded = String(e.status) === 'ended';

    let canEnter = true;
    let statusReason = '';
    if (isEnded) {
      canEnter = false;
      statusReason = '考试已由教师结束';
    } else if (nowMs < startMs) {
      canEnter = false;
      statusReason = '尚未到达开考时间';
    } else if (nowMs > endMs && !allowLate) {
      canEnter = false;
      statusReason = '已超过截止时间';
    } else if (!activeDraft && submittedSubs.length >= maxAttempts) {
      canEnter = false;
      statusReason = '已达到最大作答次数';
    }

    let bestScore: number | null = null;
    let latestScore: number | null = null;
    if (submittedSubs.length > 0) {
      latestScore = Number(submittedSubs[0].final_score);
      bestScore = Math.max(...submittedSubs.map((s) => Number(s.final_score)));
    }
    const displayScore =
      e.score_policy === 'latest' ? latestScore : bestScore;

    let draftRemainingSeconds: number | null = null;
    if (activeDraft) {
      const startedMs = new Date(String(activeDraft.started_at)).getTime();
      const totalSec = Number(e.duration || 40) * 60;
      const elapsedSec = Math.floor((nowMs - startedMs) / 1000);
      draftRemainingSeconds = Math.max(0, totalSec - elapsedSec);
    }

    const showScoreImmediately = Boolean(e.show_score_immediately);
    const answerVisible = canRevealAnswers(
      String(e.show_answer_policy),
      String(e.status),
      String(e.end_time)
    );

    const card = {
      id: examId,
      title: e.title,
      description: e.description,
      teacherName: e.teacher_name || e.teacher_username || '任课教师',
      questionCount: Number(qInfo.cnt || 0),
      totalScore: Number(qInfo.total_score || 0),
      duration: Number(e.duration || 40),
      startTime: e.start_time,
      endTime: e.end_time,
      maxAttempts,
      attemptsUsed: submittedSubs.length,
      scorePolicy: e.score_policy,
      showScoreImmediately,
      showAnswerPolicy: e.show_answer_policy,
      answerVisible,
      antiCheatSwitch: Boolean(e.anti_cheat_switch),
      allowLate,
      examStatus: e.status,
      canEnter,
      statusReason,
      hasInProgress: Boolean(activeDraft),
      inProgressSubmissionId: activeDraft ? activeDraft.id : null,
      remainingSeconds: draftRemainingSeconds,
      displayScore:
        showScoreImmediately || isEnded || nowMs > endMs ? displayScore : null,
      lastSubmittedAt: submittedSubs[0]?.submitted_at || null,
      isPastDeadline: nowMs > endMs,
    };

    if (activeDraft) {
      inProgress.push(card);
    } else if (submittedSubs.length > 0) {
      completed.push(card);
    } else {
      pending.push(card);
    }
  }

  res.json({ pending, inProgress, completed });
});

// Start or resume an exam attempt
router.post('/:id/start', (req: AuthedRequest, res) => {
  const db = getDb();
  const student = req.student!;
  const examId = String(req.params.id);

  const exam = db
    .prepare('SELECT * FROM exams WHERE id = ?')
    .get(examId) as Record<string, unknown> | undefined;
  if (!exam || exam.status === 'draft') {
    res.status(404).json({ error: '考试不存在或尚未发布' });
    return;
  }

  if (
    !isStudentAssignedToExam(db, examId, student.id, student.classId || '')
  ) {
    res.status(403).json({ error: '您不在本次考试的参与名单中' });
    return;
  }

  const existingInProgress = db
    .prepare(
      "SELECT * FROM exam_submissions WHERE exam_id = ? AND student_id = ? AND status = 'in_progress' ORDER BY attempt_no DESC LIMIT 1"
    )
    .get(examId, student.id) as Record<string, unknown> | undefined;

  const nowMs = Date.now();
  const startMs = new Date(String(exam.start_time)).getTime();
  const endMs = new Date(String(exam.end_time)).getTime();

  if (!existingInProgress) {
    if (exam.status === 'ended') {
      res.status(400).json({ error: '考试已结束，无法新开作答' });
      return;
    }
    if (nowMs < startMs) {
      res.status(400).json({ error: '尚未到达开考时间' });
      return;
    }
    if (nowMs > endMs && !exam.allow_late) {
      res.status(400).json({ error: '已过考试截止时间且不允许迟交' });
      return;
    }
  }

  const submittedCountRow = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM exam_submissions WHERE exam_id = ? AND student_id = ? AND status = 'submitted'"
    )
    .get(examId, student.id) as { cnt: number };
  const maxAttempts = Number(exam.max_attempts || 1);

  if (!existingInProgress && submittedCountRow.cnt >= maxAttempts) {
    res.status(400).json({ error: '已达到本场考试最大作答次数' });
    return;
  }

  const eqRows = db
    .prepare(
      `SELECT eq.sort_order, eq.score as exam_score, q.*
       FROM exam_questions eq
       INNER JOIN questions q ON eq.question_id = q.id
       WHERE eq.exam_id = ?
       ORDER BY eq.sort_order ASC`
    )
    .all(examId) as Array<Record<string, unknown>>;

  let questions = eqRows.map((r) => {
    const q = rowToQuestion(r);
    return {
      id: q.id,
      title: q.title,
      type: q.type,
      difficulty: q.difficulty,
      knowledgePoints: q.knowledgePoints,
      scenario: q.scenario,
      totalScore: Number(r.exam_score || q.totalScore),
      materials: q.materials,
      steps: q.steps.map((s) => ({
        index: s.index,
        instruction: s.instruction,
        score: s.score,
      })),
      source: q.source,
    };
  });

  if (exam.shuffle) {
    questions = deterministicShuffle(questions, `${examId}-${student.id}`);
  }

  let subRow = existingInProgress;
  const nowIso = new Date().toISOString();

  if (!subRow) {
    const subId = `esub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const initialAnswers: Record<string, SimulatorState> = {};
    for (const q of questions) {
      initialAnswers[q.id] = q.materials.initialState;
    }
    const maxTotal = questions.reduce((sum, q) => sum + q.totalScore, 0);
    const attemptNo = submittedCountRow.cnt + 1;

    db.prepare(
      `INSERT INTO exam_submissions (
        id, exam_id, student_id, attempt_no, status, answers_json,
        question_results_json, auto_score, final_score, max_score,
        duration_seconds, switch_count, is_late, teacher_comment,
        adjusted_by, started_at, submitted_at, updated_at
      ) VALUES (?, ?, ?, ?, 'in_progress', ?, '[]', 0, 0, ?, 0, 0, 0, '', '', ?, NULL, ?)`
    ).run(
      subId,
      examId,
      student.id,
      attemptNo,
      JSON.stringify(initialAnswers),
      maxTotal,
      nowIso,
      nowIso
    );

    subRow = db
      .prepare('SELECT * FROM exam_submissions WHERE id = ?')
      .get(subId) as Record<string, unknown>;
  }

  const startedMs = new Date(String(subRow.started_at)).getTime();
  const totalSec = Number(exam.duration || 40) * 60;
  const elapsedSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
  const remainingSeconds = Math.max(0, totalSec - elapsedSec);

  res.json({
    submissionId: subRow.id,
    attemptNo: subRow.attempt_no,
    exam: {
      id: examId,
      title: exam.title,
      description: exam.description,
      duration: exam.duration,
      endTime: exam.end_time,
      antiCheatSwitch: Boolean(exam.anti_cheat_switch),
      showScoreImmediately: Boolean(exam.show_score_immediately),
      showAnswerPolicy: exam.show_answer_policy,
    },
    questions,
    answers: JSON.parse(String(subRow.answers_json || '{}')),
    durationSeconds: Number(subRow.duration_seconds || elapsedSec),
    switchCount: Number(subRow.switch_count || 0),
    remainingSeconds,
  });
});

// Auto-save exam draft & anti-cheat switch counter
router.put('/:id/draft', (req: AuthedRequest, res) => {
  const schema = z.object({
    answers: z.record(z.string(), z.record(z.string(), z.unknown())),
    durationSeconds: z.number().int().min(0).default(0),
    switchCount: z.number().int().min(0).default(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '草稿格式错误' });
    return;
  }

  const db = getDb();
  const examId = String(req.params.id);
  const sub = db
    .prepare(
      "SELECT id, switch_count FROM exam_submissions WHERE exam_id = ? AND student_id = ? AND status = 'in_progress' ORDER BY attempt_no DESC LIMIT 1"
    )
    .get(examId, req.student!.id) as
    | { id: string; switch_count: number }
    | undefined;

  if (!sub) {
    res.status(404).json({ error: '未找到进行中的答卷' });
    return;
  }

  const nowIso = new Date().toISOString();
  const safeSwitch = Math.max(sub.switch_count || 0, parsed.data.switchCount);
  db.prepare(
    `UPDATE exam_submissions
     SET answers_json = ?, duration_seconds = ?, switch_count = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    JSON.stringify(parsed.data.answers),
    parsed.data.durationSeconds,
    safeSwitch,
    nowIso,
    sub.id
  );

  res.json({ ok: true, savedAt: nowIso });
});

// Live per-step check & beginner operation guidance (never leaks referenceAnswer)
router.post('/:id/check-step', (req: AuthedRequest, res) => {
  const schema = z.object({
    questionId: z.string().min(1),
    answer: z.record(z.string(), z.unknown()),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '步骤检查请求格式错误' });
    return;
  }

  const db = getDb();
  const examId = String(req.params.id);
  const student = req.student!;

  const exam = db
    .prepare('SELECT id, status FROM exams WHERE id = ?')
    .get(examId) as { id: string; status: string } | undefined;
  if (!exam || exam.status === 'draft') {
    res.status(404).json({ error: '考试不存在或尚未发布' });
    return;
  }

  if (
    !isStudentAssignedToExam(db, examId, student.id, student.classId || '')
  ) {
    res.status(403).json({ error: '您不在本次考试的参与名单中' });
    return;
  }

  const eqRow = db
    .prepare(
      `SELECT q.*
       FROM exam_questions eq
       INNER JOIN questions q ON eq.question_id = q.id
       WHERE eq.exam_id = ? AND q.id = ?`
    )
    .get(examId, parsed.data.questionId) as Record<string, unknown> | undefined;

  if (!eqRow) {
    res.status(404).json({ error: '该题目不属于本场考试' });
    return;
  }

  const q = rowToQuestion(eqRow);
  const answerState = parsed.data.answer as unknown as SimulatorState;
  const grade = gradeAnswerDeterministic(q.type, q.checkpoints, answerState);
  const touched =
    JSON.stringify(parsed.data.answer) !==
    JSON.stringify(q.materials.initialState);

  const steps = buildStepGuidance(
    q.type,
    q.steps,
    q.checkpoints,
    grade.checkpointResults,
    touched
  );

  res.json({
    questionId: q.id,
    steps,
    passedCount: steps.filter((s) => s.passed).length,
    totalSteps: steps.length,
  });
});

// Submit exam for deterministic grading
router.post('/:id/submit', (req: AuthedRequest, res) => {
  const schema = z.object({
    answers: z.record(z.string(), z.record(z.string(), z.unknown())),
    durationSeconds: z.number().int().min(0).optional(),
    switchCount: z.number().int().min(0).default(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '交卷数据格式错误' });
    return;
  }

  const db = getDb();
  const examId = String(req.params.id);
  const student = req.student!;

  const exam = db
    .prepare('SELECT * FROM exams WHERE id = ?')
    .get(examId) as Record<string, unknown> | undefined;
  if (!exam) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }

  const sub = db
    .prepare(
      "SELECT * FROM exam_submissions WHERE exam_id = ? AND student_id = ? AND status = 'in_progress' ORDER BY attempt_no DESC LIMIT 1"
    )
    .get(examId, student.id) as Record<string, unknown> | undefined;
  if (!sub) {
    res.status(400).json({ error: '当前没有未交卷的答卷记录' });
    return;
  }

  const eqRows = db
    .prepare(
      `SELECT eq.score as exam_score, q.*
       FROM exam_questions eq
       INNER JOIN questions q ON eq.question_id = q.id
       WHERE eq.exam_id = ?
       ORDER BY eq.sort_order ASC`
    )
    .all(examId) as Array<Record<string, unknown>>;

  let autoTotal = 0;
  let maxTotal = 0;
  const results: ExamQuestionResult[] = [];
  const fullDetails: Array<Record<string, unknown>> = [];

  for (const eq of eqRows) {
    const q = rowToQuestion(eq);
    const examScore = Number(eq.exam_score || q.totalScore);
    const ans =
      (parsed.data.answers[q.id] as unknown as SimulatorState) ||
      q.materials.initialState;
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

    fullDetails.push({
      questionId: q.id,
      title: q.title,
      type: q.type,
      maxScore: examScore,
      autoScore: scaledScore,
      finalScore: scaledScore,
      checkpointResults: grade.checkpointResults,
      referenceAnswer: q.referenceAnswer,
      analysis: q.analysis,
      commonMistakes: q.commonMistakes,
    });
  }

  autoTotal = Math.round(autoTotal * 10) / 10;
  const now = new Date();
  const isLate = now.getTime() > new Date(String(exam.end_time)).getTime() ? 1 : 0;
  const computedDuration =
    parsed.data.durationSeconds ??
    Math.max(
      0,
      Math.floor(
        (now.getTime() - new Date(String(sub.started_at)).getTime()) / 1000
      )
    );
  const safeSwitch = Math.max(
    Number(sub.switch_count || 0),
    parsed.data.switchCount
  );

  db.prepare(
    `UPDATE exam_submissions
     SET status = 'submitted',
         answers_json = ?,
         question_results_json = ?,
         auto_score = ?,
         final_score = ?,
         max_score = ?,
         duration_seconds = ?,
         switch_count = ?,
         is_late = ?,
         submitted_at = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    JSON.stringify(parsed.data.answers),
    JSON.stringify(results),
    autoTotal,
    autoTotal,
    maxTotal,
    computedDuration,
    safeSwitch,
    isLate,
    now.toISOString(),
    now.toISOString(),
    sub.id
  );

  const showScore = Boolean(exam.show_score_immediately);
  const showAnswer = canRevealAnswers(
    String(exam.show_answer_policy),
    String(exam.status),
    String(exam.end_time)
  );

  res.json({
    submissionId: sub.id,
    examId,
    showScoreImmediately: showScore,
    showAnswerPolicy: exam.show_answer_policy,
    answerVisible: showAnswer,
    totalScore: showScore ? autoTotal : null,
    maxScore: maxTotal,
    isLate: Boolean(isLate),
    results: showScore
      ? fullDetails.map((d) =>
          showAnswer
            ? d
            : {
                questionId: d.questionId,
                title: d.title,
                type: d.type,
                maxScore: d.maxScore,
                autoScore: d.autoScore,
                finalScore: d.finalScore,
                checkpointResults: d.checkpointResults,
              }
        )
      : [],
  });
});

// View submitted result for an exam (respecting teacher score & answer visibility policy)
router.get('/:id/result', (req: AuthedRequest, res) => {
  const db = getDb();
  const examId = String(req.params.id);
  const student = req.student!;

  const exam = db
    .prepare('SELECT * FROM exams WHERE id = ?')
    .get(examId) as Record<string, unknown> | undefined;
  if (!exam) {
    res.status(404).json({ error: '考试不存在' });
    return;
  }

  const subs = db
    .prepare(
      "SELECT * FROM exam_submissions WHERE exam_id = ? AND student_id = ? AND status = 'submitted' ORDER BY attempt_no DESC"
    )
    .all(examId, student.id) as Array<Record<string, unknown>>;

  if (subs.length === 0) {
    res.status(404).json({ error: '您尚未提交过该考试' });
    return;
  }

  const targetSubId = String(req.query.submissionId || '');
  const sub =
    (targetSubId ? subs.find((s) => s.id === targetSubId) : subs[0]) || subs[0];

  const nowMs = Date.now();
  const endMs = new Date(String(exam.end_time)).getTime();
  const isEnded = String(exam.status) === 'ended' || nowMs > endMs;
  const showScore = Boolean(exam.show_score_immediately) || isEnded;
  const showAnswer = canRevealAnswers(
    String(exam.show_answer_policy),
    String(exam.status),
    String(exam.end_time)
  );

  const qResults = JSON.parse(
    String(sub.question_results_json || '[]')
  ) as ExamQuestionResult[];
  const answers = JSON.parse(String(sub.answers_json || '{}')) as Record<
    string,
    SimulatorState
  >;

  const enrichedResults = qResults.map((qr) => {
    const qRow = db
      .prepare('SELECT * FROM questions WHERE id = ?')
      .get(qr.questionId) as Record<string, unknown> | undefined;
    const q = qRow ? rowToQuestion(qRow) : null;
    return {
      ...qr,
      studentAnswer: answers[qr.questionId] || q?.materials.initialState || null,
      ...(showAnswer && q
        ? {
            referenceAnswer: q.referenceAnswer,
            analysis: q.analysis,
            commonMistakes: q.commonMistakes,
          }
        : {}),
    };
  });

  res.json({
    exam: {
      id: exam.id,
      title: exam.title,
      endTime: exam.end_time,
      status: exam.status,
      showScoreImmediately: Boolean(exam.show_score_immediately),
      showAnswerPolicy: exam.show_answer_policy,
    },
    scoreVisible: showScore,
    answerVisible: showAnswer,
    submission: {
      id: sub.id,
      attemptNo: sub.attempt_no,
      finalScore: showScore ? sub.final_score : null,
      autoScore: showScore ? sub.auto_score : null,
      maxScore: sub.max_score,
      durationSeconds: sub.duration_seconds,
      switchCount: sub.switch_count,
      isLate: Boolean(sub.is_late),
      teacherComment: sub.teacher_comment,
      submittedAt: sub.submitted_at,
    },
    results: showScore ? enrichedResults : [],
    attempts: subs.map((s) => ({
      id: s.id,
      attemptNo: s.attempt_no,
      finalScore: showScore ? s.final_score : null,
      maxScore: s.max_score,
      submittedAt: s.submitted_at,
    })),
  });
});

export default router;

'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Send,
  XCircle,
} from 'lucide-react';
import StudentHeader from '@/components/StudentHeader';
import SimulatorRenderer from '@/components/simulators/SimulatorRenderer';
import { getStudentToken, studentFetch } from '@/lib/api';
import {
  TYPE_LABELS,
  type CheckpointResult,
  type ClientQuestion,
  type SimulatorState,
  type StudentProfile,
} from '@/lib/types';

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface ExamSubmitItem {
  questionId: string;
  title: string;
  type: ClientQuestion['type'];
  autoScore: number;
  finalScore: number;
  maxScore: number;
  checkpointResults: CheckpointResult[];
  analysis: string[];
}

function ExamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examIdParam = searchParams.get('examId');

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const [examInfo, setExamInfo] = useState<{
    id: string;
    title: string;
    status: string;
    totalScore: number;
    maxScore: number;
  } | null>(null);
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, SimulatorState>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [examResults, setExamResults] = useState<ExamSubmitItem[] | null>(null);

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  const submittedOnceRef = useRef(false);

  const loadExam = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await studentFetch<{
        exam: {
          id: string;
          title: string;
          remainingSeconds: number;
          status: string;
          totalScore: number;
          maxScore: number;
        };
        questions: ClientQuestion[];
        draftMap: Record<string, SimulatorState>;
        submissionResults: ExamSubmitItem[];
      }>(`/api/exams/${id}`);
      setExamInfo(data.exam);
      setQuestions(data.questions);
      setRemaining(data.exam.remainingSeconds);

      const initAnswers: Record<string, SimulatorState> = {};
      for (const q of data.questions) {
        initAnswers[q.id] =
          data.draftMap[q.id] || structuredClone(q.materials.initialState);
      }
      setAnswers(initAnswers);

      if (data.exam.status === 'submitted') {
        setExamResults(
          data.submissionResults.map((r) => {
            const q = data.questions.find((x) => x.id === r.questionId);
            return {
              ...r,
              title: q?.title || '题目',
              type: q?.type || 'word',
              analysis: [],
            };
          })
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载模拟试卷失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getStudentToken()) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const me = await studentFetch<{ student: StudentProfile }>(
          '/api/auth/me'
        );
        setStudent(me.student);
        if (examIdParam) {
          await loadExam(examIdParam);
        } else {
          setLoading(false);
        }
      } catch {
        router.replace('/login');
      }
    })();
  }, [router, examIdParam, loadExam]);

  const handleSubmitExam = useCallback(async () => {
    if (!examInfo || submittedOnceRef.current) return;
    submittedOnceRef.current = true;
    setSubmitting(true);
    try {
      const res = await studentFetch<{
        totalScore: number;
        maxScore: number;
        results: ExamSubmitItem[];
      }>(`/api/exams/${examInfo.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: answersRef.current }),
      });
      setExamInfo((prev) =>
        prev
          ? {
              ...prev,
              status: 'submitted',
              totalScore: res.totalScore,
              maxScore: res.maxScore,
            }
          : prev
      );
      setExamResults(res.results);
    } catch (err) {
      submittedOnceRef.current = false;
      setError(err instanceof Error ? err.message : '交卷失败');
    } finally {
      setSubmitting(false);
    }
  }, [examInfo]);

  // Countdown timer with automatic submission on timeout
  useEffect(() => {
    if (!examInfo || examInfo.status === 'submitted' || examResults) return;
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          void handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [examInfo, examResults, handleSubmitExam]);

  // Auto-save current question draft every 10 seconds during exam
  useEffect(() => {
    if (!examInfo || examInfo.status === 'submitted' || questions.length === 0) {
      return;
    }
    const timer = setInterval(() => {
      const q = questions[activeIdx];
      const st = answersRef.current[q.id];
      if (!q || !st) return;
      void studentFetch(`/api/questions/${q.id}/draft`, {
        method: 'PUT',
        body: JSON.stringify({
          examId: examInfo.id,
          state: st,
          elapsedSeconds: 0,
        }),
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [examInfo, questions, activeIdx]);

  const handleStartNewExam = async () => {
    setStarting(true);
    setError('');
    try {
      const res = await studentFetch<{ examId: string }>('/api/exams/start', {
        method: 'POST',
      });
      router.replace(`/exam?examId=${res.examId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建模拟试卷失败');
      setStarting(false);
    }
  };

  if (loading || !student) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  // Landing state when no examId selected
  if (!examInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StudentHeader student={student} />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-12">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">
                全真会考模拟考试
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                系统将依据高中信息技术学业水平考试标准，从题库中组合 Word 文字处理、Excel 电子表格、网页制作与文件管理操作题各 1 道，总分 400 分，限时 40 分钟。倒计时结束系统将自动交卷并统一判分。
              </p>
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={handleStartNewExam}
              disabled={starting}
              className="w-full h-11 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2"
            >
              {starting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>{starting ? '正在组卷...' : '开始模拟考试'}</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Submitted Report View
  if (examResults) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StudentHeader student={student} />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">模拟考试成绩单</div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                {examInfo.title}
              </h1>
            </div>
            <div className="text-right tabular-nums">
              <div className="text-3xl font-bold text-teal-700">
                {examInfo.totalScore}{' '}
                <span className="text-sm font-normal text-slate-500">
                  / {examInfo.maxScore} 分
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {examResults.map((r, idx) => (
              <div
                key={r.questionId}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500">
                      第 {idx + 1} 题 · {TYPE_LABELS[r.type]}
                    </div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {r.title}
                    </h2>
                  </div>
                  <div className="text-lg font-bold text-sky-700 tabular-nums">
                    {r.finalScore} / {r.maxScore}
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {r.checkpointResults.map((cp) => (
                    <div
                      key={cp.checkpointId}
                      className="py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {cp.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                        <span className="text-slate-800">{cp.description}</span>
                        <span className="text-slate-500">— {cp.feedback}</span>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {cp.earnedScore}/{cp.maxScore}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-5 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700"
            >
              返回练习中心
            </button>
          </div>
        </main>
      </div>
    );
  }

  const currentQ = questions[activeIdx];
  const currentState = currentQ ? answers[currentQ.id] : null;

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Exam Top Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeIdx === idx
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              第 {idx + 1} 题 · {TYPE_LABELS[q.type].split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg tabular-nums ${
              remaining < 300
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-slate-100 text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>剩余 {formatCountdown(remaining)}</span>
          </div>
          <button
            type="button"
            onClick={handleSubmitExam}
            disabled={submitting}
            className="h-9 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{submitting ? '正在交卷...' : '统一交卷'}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {currentQ && currentState && (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          <aside className="w-full lg:w-[380px] bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto p-4 space-y-4 shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="text-xs text-sky-700 font-medium">
                {TYPE_LABELS[currentQ.type]} · 满分 {currentQ.totalScore} 分
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {currentQ.title}
              </h2>
              <p className="text-xs text-slate-700 leading-relaxed">
                {currentQ.scenario}
              </p>
              <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                素材说明：{currentQ.materials.description}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-900">
                分步任务要求
              </h3>
              {currentQ.steps.map((s) => (
                <div
                  key={s.index}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs space-y-1"
                >
                  <div className="flex justify-between font-semibold text-sky-700">
                    <span>第 {s.index} 步</span>
                    <span className="tabular-nums text-slate-500">
                      {s.score} 分
                    </span>
                  </div>
                  <p className="text-slate-800 leading-relaxed">
                    {s.instruction}
                  </p>
                </div>
              ))}
            </div>
          </aside>

          <section className="flex-1 p-3 sm:p-4 overflow-hidden flex flex-col min-h-[420px]">
            <SimulatorRenderer
              type={currentQ.type}
              value={currentState}
              onChange={(next) =>
                setAnswers((prev) => ({ ...prev, [currentQ.id]: next }))
              }
              assets={currentQ.materials.assets}
            />
          </section>
        </div>
      )}
    </div>
  );
}

export default function ExamPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
        </div>
      }
    >
      <ExamContent />
    </Suspense>
  );
}

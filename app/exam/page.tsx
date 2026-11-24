'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  EyeOff,
  Loader2,
  Save,
  Send,
  XCircle,
} from 'lucide-react';
import GradingReport from '@/components/GradingReport';
import StudentHeader from '@/components/StudentHeader';
import SimulatorRenderer from '@/components/simulators/SimulatorRenderer';
import {
  clearPortalToken,
  getCachedPortalUser,
  getPortalToken,
  portalFetch,
  setCachedPortalUser,
} from '@/lib/api';
import {
  TYPE_LABELS,
  type CheckpointResult,
  type ClientQuestion,
  type PortalUser,
  type SimulatorState,
} from '@/lib/types';

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface ResultItem {
  questionId: string;
  title: string;
  type: ClientQuestion['type'];
  autoScore: number;
  finalScore: number;
  maxScore: number;
  checkpointResults: CheckpointResult[];
  studentAnswer?: SimulatorState | null;
  referenceAnswer?: SimulatorState;
  analysis?: string[];
  commonMistakes?: string[];
}

function ExamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examIdParam = searchParams.get('examId');
  const modeParam = searchParams.get('mode');
  const subIdParam = searchParams.get('submissionId');

  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [examInfo, setExamInfo] = useState<{
    id: string;
    title: string;
    description?: string;
    duration?: number;
    endTime?: string;
    antiCheatSwitch: boolean;
    showScoreImmediately: boolean;
    showAnswerPolicy: 'immediate' | 'after_end' | 'never';
  } | null>(null);

  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, SimulatorState>>({});
  const [touchedIds, setTouchedIds] = useState<Record<string, boolean>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [switchCount, setSwitchCount] = useState(0);
  const [switchWarning, setSwitchWarning] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMsg, setDraftMsg] = useState('');

  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [resultView, setResultView] = useState<{
    scoreVisible: boolean;
    answerVisible: boolean;
    totalScore: number | null;
    maxScore: number;
    isLate: boolean;
    teacherComment?: string;
    results: ResultItem[];
    attempts?: Array<{
      id: string;
      attemptNo: number;
      finalScore: number | null;
      maxScore: number;
      submittedAt: string;
    }>;
  } | null>(null);

  const answersRef = useRef(answers);
  const elapsedRef = useRef(elapsedSeconds);
  const switchRef = useRef(switchCount);
  const submittedOnceRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);
  useEffect(() => {
    switchRef.current = switchCount;
  }, [switchCount]);

  useEffect(() => {
    if (!getPortalToken()) {
      router.replace('/login');
      return;
    }
    if (!examIdParam) {
      router.replace('/');
      return;
    }

    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const cached = getCachedPortalUser();
      if (cached?.role === 'student') {
        setUser((prev) => prev ?? cached);
      }

      try {
        const mePromise = portalFetch<{ user: PortalUser }>('/api/auth/me');

        if (modeParam === 'result') {
          const qs = subIdParam ? `?submissionId=${subIdParam}` : '';
          const [me, res] = await Promise.all([
            mePromise,
            portalFetch<{
              exam: {
                id: string;
                title: string;
                endTime: string;
                showScoreImmediately: boolean;
                showAnswerPolicy: 'immediate' | 'after_end' | 'never';
              };
              scoreVisible: boolean;
              answerVisible: boolean;
              submission: {
                finalScore: number | null;
                maxScore: number;
                isLate: boolean;
                teacherComment: string;
              };
              results: ResultItem[];
              attempts: Array<{
                id: string;
                attemptNo: number;
                finalScore: number | null;
                maxScore: number;
                submittedAt: string;
              }>;
            }>(`/api/exams/${examIdParam}/result${qs}`),
          ]);
          if (cancelled) return;
          if (me.user.role === 'teacher') {
            setCachedPortalUser(me.user);
            router.replace('/teacher');
            return;
          }
          setCachedPortalUser(me.user);
          setUser(me.user);
          setExamInfo({
            ...res.exam,
            antiCheatSwitch: false,
          });
          setResultView({
            scoreVisible: res.scoreVisible,
            answerVisible: res.answerVisible,
            totalScore: res.submission.finalScore,
            maxScore: res.submission.maxScore,
            isLate: res.submission.isLate,
            teacherComment: res.submission.teacherComment,
            results: res.results,
            attempts: res.attempts,
          });
        } else {
          const [me, started] = await Promise.all([
            mePromise,
            portalFetch<{
              exam: {
                id: string;
                title: string;
                description: string;
                duration: number;
                endTime: string;
                antiCheatSwitch: boolean;
                showScoreImmediately: boolean;
                showAnswerPolicy: 'immediate' | 'after_end' | 'never';
              };
              questions: ClientQuestion[];
              answers: Record<string, SimulatorState>;
              durationSeconds: number;
              switchCount: number;
              remainingSeconds: number;
            }>(`/api/exams/${examIdParam}/start`, { method: 'POST' }),
          ]);

          if (cancelled) return;
          if (me.user.role === 'teacher') {
            setCachedPortalUser(me.user);
            router.replace('/teacher');
            return;
          }
          setCachedPortalUser(me.user);
          setUser(me.user);
          setExamInfo(started.exam);
          setQuestions(started.questions);
          const initAns: Record<string, SimulatorState> = {};
          const touched: Record<string, boolean> = {};
          for (const q of started.questions) {
            const restored = started.answers?.[q.id];
            initAns[q.id] =
              restored || structuredClone(q.materials.initialState);
            if (
              restored &&
              JSON.stringify(restored) !==
                JSON.stringify(q.materials.initialState)
            ) {
              touched[q.id] = true;
            }
          }
          setAnswers(initAns);
          setTouchedIds(touched);
          setElapsedSeconds(started.durationSeconds || 0);
          setSwitchCount(started.switchCount || 0);
          setRemaining(started.remainingSeconds);
        }
      } catch (e) {
        if (!cancelled) {
          if (!getPortalToken()) {
            router.replace('/login');
            return;
          }
          setError(e instanceof Error ? e.message : '加载模拟考试失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [examIdParam, modeParam, subIdParam, router]);

  const saveDraft = useCallback(
    async (silent = true) => {
      if (!examInfo || resultView || submittedOnceRef.current) return;
      if (!silent) setSavingDraft(true);
      try {
        await portalFetch(`/api/exams/${examInfo.id}/draft`, {
          method: 'PUT',
          body: JSON.stringify({
            answers: answersRef.current,
            durationSeconds: elapsedRef.current,
            switchCount: switchRef.current,
          }),
        });
        if (!silent) {
          setDraftMsg('已保存草稿');
          setTimeout(() => setDraftMsg(''), 2000);
        }
      } catch {
        // silent autosave
      } finally {
        if (!silent) setSavingDraft(false);
      }
    },
    [examInfo, resultView]
  );

  const handleSubmitExam = useCallback(async () => {
    if (!examInfo || submittedOnceRef.current) return;
    submittedOnceRef.current = true;
    setConfirmSubmitOpen(false);
    setSubmitting(true);
    setError('');
    try {
      const res = await portalFetch<{
        showScoreImmediately: boolean;
        answerVisible: boolean;
        totalScore: number | null;
        maxScore: number;
        isLate: boolean;
        results: ResultItem[];
      }>(`/api/exams/${examInfo.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers: answersRef.current,
          durationSeconds: elapsedRef.current,
          switchCount: switchRef.current,
        }),
      });
      setResultView({
        scoreVisible: res.showScoreImmediately,
        answerVisible: res.answerVisible,
        totalScore: res.totalScore,
        maxScore: res.maxScore,
        isLate: res.isLate,
        results: res.results,
      });
    } catch (e) {
      submittedOnceRef.current = false;
      setError(e instanceof Error ? e.message : '交卷失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [examInfo]);

  // Countdown + elapsed timer with auto-submit on timeout
  useEffect(() => {
    if (!examInfo || resultView || questions.length === 0) return;
    const timer = setInterval(() => {
      setElapsedSeconds((e) => e + 1);
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
  }, [examInfo, resultView, questions.length, handleSubmitExam]);

  // Auto-save draft every 10 seconds
  useEffect(() => {
    if (!examInfo || resultView || questions.length === 0) return;
    const timer = setInterval(() => {
      void saveDraft(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [examInfo, resultView, questions.length, saveDraft]);

  // Anti-tab-switch warning
  useEffect(() => {
    if (!examInfo?.antiCheatSwitch || resultView || questions.length === 0) {
      return;
    }
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') {
        setSwitchCount((prev) => {
          const next = prev + 1;
          setSwitchWarning(
            `系统检测到您离开了考试界面（累计切屏 ${next} 次），请专注作答！`
          );
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, [examInfo?.antiCheatSwitch, resultView, questions.length]);

  if (error && !examInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {user && <StudentHeader user={user} />}
        <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 max-w-md text-center">
            {error}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium"
            >
              返回模拟考试列表
            </button>
            {!user && (
              <button
                type="button"
                onClick={() => {
                  clearPortalToken();
                  router.replace('/login');
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
              >
                重新登录
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-3">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
        <p className="text-sm text-slate-600">正在加载模拟试卷...</p>
      </div>
    );
  }

  // Submitted / Result View
  if (resultView && examInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">
                模拟考试交卷回执{resultView.isLate ? ' · 迟交记录' : ''}
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                {examInfo.title}
              </h1>
              {resultView.teacherComment && (
                <p className="mt-2 text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                  教师评语：{resultView.teacherComment}
                </p>
              )}
            </div>

            {resultView.scoreVisible && resultView.totalScore !== null ? (
              <div className="text-right tabular-nums">
                <div className="text-xs text-slate-500">本场得分</div>
                <div className="text-3xl font-bold text-teal-700">
                  {resultView.totalScore}{' '}
                  <span className="text-sm font-normal text-slate-500">
                    / {resultView.maxScore} 分
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-3.5 py-2 rounded-xl">
                <EyeOff className="w-4 h-4 text-slate-500" />
                <span>试卷已提交，教师暂未开放成绩查看</span>
              </div>
            )}
          </div>

          {resultView.attempts && resultView.attempts.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">历次作答记录：</span>
              {resultView.attempts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    router.replace(
                      `/exam?examId=${examInfo.id}&mode=result&submissionId=${a.id}`
                    )
                  }
                  className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 tabular-nums"
                >
                  第 {a.attemptNo} 次
                  {a.finalScore !== null ? ` (${a.finalScore}分)` : ''}
                </button>
              ))}
            </div>
          )}

          {resultView.scoreVisible ? (
            <div className="space-y-4">
              {!resultView.answerVisible && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  教师设置为「
                  {examInfo.showAnswerPolicy === 'after_end'
                    ? '考试结束后公布答案与解析'
                    : '不公开参考答案'}
                  」，当前仅展示得分点明细。
                </div>
              )}

              {resultView.results.map((r, idx) => (
                <div
                  key={r.questionId}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <div className="text-xs text-slate-500">
                        第 {idx + 1} 题 · {TYPE_LABELS[r.type]}
                      </div>
                      <h2 className="text-base font-bold text-slate-900">
                        {r.title}
                      </h2>
                    </div>
                    <div className="text-lg font-bold text-sky-700 tabular-nums">
                      {r.finalScore} / {r.maxScore} 分
                    </div>
                  </div>

                  {resultView.answerVisible &&
                  r.referenceAnswer &&
                  r.studentAnswer ? (
                    <GradingReport
                      type={r.type}
                      studentAnswer={r.studentAnswer}
                      result={{
                        submissionId: '',
                        autoScore: r.autoScore,
                        hintPenalty: 0,
                        hintsUsedCount: 0,
                        finalScore: r.finalScore,
                        maxScore: r.maxScore,
                        checkpointResults: r.checkpointResults,
                        gradedByAi: false,
                        referenceAnswer: r.referenceAnswer,
                        analysis: r.analysis || [],
                        commonMistakes: r.commonMistakes || [],
                      }}
                    />
                  ) : (
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
                            <span className="text-slate-800">
                              {cp.description}
                            </span>
                            <span className="text-slate-500">
                              — {cp.feedback}
                            </span>
                          </div>
                          <span className="font-semibold tabular-nums">
                            {cp.earnedScore}/{cp.maxScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-5 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700"
            >
              返回模拟考试列表
            </button>
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50"
            >
              前往个人中心
            </button>
          </div>
        </main>
      </div>
    );
  }

  const currentQ = questions[activeIdx];
  const currentState = currentQ ? answers[currentQ.id] : null;
  const untouchedCount = questions.filter((q) => !touchedIds[q.id]).length;

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Exam Top Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto min-w-0">
          <button
            type="button"
            onClick={() => {
              void saveDraft(true);
              router.push('/');
            }}
            className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-1 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>暂离</span>
          </button>

          {questions.map((q, idx) => {
            const touched = Boolean(touchedIds[q.id]);
            const isCurrent = activeIdx === idx;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  void saveDraft(true);
                  setActiveIdx(idx);
                }}
                className={`h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  isCurrent
                    ? 'bg-sky-600 text-white'
                    : touched
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>
                  第 {idx + 1} 题 · {TYPE_LABELS[q.type].split(' ')[0]}
                </span>
                <span className="text-[10px] opacity-80">
                  {touched ? '已作答' : '未操作'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {draftMsg && (
            <span className="text-xs text-teal-700 hidden sm:inline">
              {draftMsg}
            </span>
          )}
          <button
            type="button"
            disabled={savingDraft}
            onClick={() => void saveDraft(false)}
            className="h-8 px-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium hidden sm:flex items-center gap-1"
          >
            <Save className="w-3.5 h-3.5" />
            <span>暂存</span>
          </button>

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
            onClick={() => setConfirmSubmitOpen(true)}
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

      {switchWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{switchWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setSwitchWarning('')}
            className="text-amber-700 hover:underline shrink-0"
          >
            知道了
          </button>
        </div>
      )}

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
                {TYPE_LABELS[currentQ.type]} · 本题 {currentQ.totalScore} 分
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
              onChange={(next) => {
                setAnswers((prev) => ({ ...prev, [currentQ.id]: next }));
                setTouchedIds((prev) => ({ ...prev, [currentQ.id]: true }));
              }}
              assets={currentQ.materials.assets}
            />
          </section>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {confirmSubmitOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              确认提交整套模拟试卷？
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {untouchedCount > 0
                ? `您还有 ${untouchedCount} 道题目未在模拟器中进行修改操作，交卷后本次作答将立即锁定并判分。`
                : '所有题目均已操作，确认交卷后系统将自动判分并提交成绩。'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                继续作答
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitExam()}
                className="px-4 py-2 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold"
              >
                确认交卷
              </button>
            </div>
          </div>
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

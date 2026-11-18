'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Clock,
  HelpCircle,
  Loader2,
  RotateCcw,
  Save,
  Send,
} from 'lucide-react';
import GradingReport from '@/components/GradingReport';
import SimulatorRenderer from '@/components/simulators/SimulatorRenderer';
import { getStudentToken, studentFetch } from '@/lib/api';
import {
  TYPE_LABELS,
  type ClientQuestion,
  type SimulatorState,
  type SubmitResponse,
} from '@/lib/types';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PracticeWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const questionId = params.id;

  const [question, setQuestion] = useState<ClientQuestion | null>(null);
  const [simState, setSimState] = useState<SimulatorState | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [hintsUsed, setHintsUsed] = useState<number[]>([]);
  const [hintTexts, setHintTexts] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedMsg, setDraftSavedMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const latestStateRef = useRef<SimulatorState | null>(null);
  const latestElapsedRef = useRef<number>(0);
  useEffect(() => {
    latestStateRef.current = simState;
    latestElapsedRef.current = elapsed;
  }, [simState, elapsed]);

  useEffect(() => {
    const token = getStudentToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    (async () => {
      try {
        const res = await studentFetch<{
          question: ClientQuestion;
          draft: {
            state: SimulatorState;
            hintsUsed: number[];
            elapsedSeconds: number;
          } | null;
        }>(`/api/questions/${questionId}`);
        setQuestion(res.question);
        if (res.draft) {
          setSimState(res.draft.state);
          setHintsUsed(res.draft.hintsUsed || []);
          setElapsed(res.draft.elapsedSeconds || 0);
        } else {
          setSimState(structuredClone(res.question.materials.initialState));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载题目失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [questionId, router]);

  // Timer tick (stops after submission)
  useEffect(() => {
    if (loading || !question || submitResult) return;
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, question, submitResult]);

  const saveDraft = useCallback(
    async (silent = false) => {
      if (!question || !latestStateRef.current || submitResult) return;
      if (!silent) setSavingDraft(true);
      try {
        await studentFetch(`/api/questions/${question.id}/draft`, {
          method: 'PUT',
          body: JSON.stringify({
            examId: '',
            state: latestStateRef.current,
            elapsedSeconds: latestElapsedRef.current,
          }),
        });
        setDraftSavedMsg('草稿已保存');
        setTimeout(() => setDraftSavedMsg(''), 2000);
      } catch {
        // silent autosave failure shouldn't disrupt answering
      } finally {
        if (!silent) setSavingDraft(false);
      }
    },
    [question, submitResult]
  );

  // Auto-save draft every 12 seconds
  useEffect(() => {
    if (loading || !question || submitResult) return;
    const interval = setInterval(() => {
      void saveDraft(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [loading, question, submitResult, saveDraft]);

  const handleRequestHint = async (stepIndex: number) => {
    if (!question || submitResult) return;
    try {
      const res = await studentFetch<{
        stepIndex: number;
        hint: string;
        hintsUsed: number[];
      }>(`/api/questions/${question.id}/hint`, {
        method: 'POST',
        body: JSON.stringify({ stepIndex, examId: '' }),
      });
      setHintsUsed(res.hintsUsed);
      setHintTexts((prev) => ({ ...prev, [stepIndex]: res.hint }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取提示失败');
    }
  };

  const handleReset = () => {
    if (!question || submitResult) return;
    const fresh = structuredClone(question.materials.initialState);
    setSimState(fresh);
    latestStateRef.current = fresh;
    setShowResetConfirm(false);
    void saveDraft(true);
  };

  const handleSubmit = async () => {
    if (!question || !simState || submitResult) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await studentFetch<SubmitResponse>(
        `/api/questions/${question.id}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({
            answer: simState,
            durationSeconds: elapsed,
            examId: '',
          }),
        }
      );
      setSubmitResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交评分失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  if (!question || !simState) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 space-y-4">
        <p className="text-sm text-red-600">{error || '题目不存在'}</p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm"
        >
          返回练习中心
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Workspace Top Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate">
              {question.title}
            </h1>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <span>{TYPE_LABELS[question.type]}</span>
              <span>·</span>
              <span>难度 {question.difficulty}</span>
              <span>·</span>
              <span className="tabular-nums">满分 {question.totalScore} 分</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg tabular-nums">
            <Clock className="w-3.5 h-3.5 text-sky-700" />
            <span>{formatTime(elapsed)}</span>
          </div>

          {draftSavedMsg && (
            <span className="text-xs text-teal-700 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {draftSavedMsg}
            </span>
          )}

          {!submitResult && (
            <>
              <button
                type="button"
                onClick={() => saveDraft(false)}
                disabled={savingDraft}
                className="h-9 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>保存草稿</span>
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="h-9 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重置</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="h-9 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{submitting ? '判分中...' : '提交评分'}</span>
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Split Screen Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left: Task Prompt or Grading Report */}
        <aside className="w-full lg:w-[400px] xl:w-[440px] bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto p-4 space-y-4 shrink-0">
          {submitResult ? (
            <GradingReport
              type={question.type}
              result={submitResult}
              studentAnswer={simState}
            />
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <h2 className="text-xs font-semibold text-slate-500">
                  题目情境
                </h2>
                <p className="text-sm text-slate-800 leading-relaxed">
                  {question.scenario}
                </p>
                <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">素材说明：</span>
                  {question.materials.description}
                </div>
                {question.materials.assets &&
                  question.materials.assets.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      <div className="text-xs font-medium text-slate-700">
                        附带素材：
                      </div>
                      {question.materials.assets.map((a) => (
                        <div
                          key={a.url}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2"
                        >
                          <span className="font-medium text-slate-800 truncate">
                            {a.name}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate font-mono">
                            {a.url}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    分步操作要求
                  </h2>
                  <span className="text-[11px] text-slate-500">
                    已用提示 {hintsUsed.length}/3 次（每次 -5 分）
                  </span>
                </div>

                <div className="space-y-3">
                  {question.steps.map((step) => {
                    const hintShown = hintTexts[step.index];
                    const alreadyUsed = hintsUsed.includes(step.index);
                    return (
                      <div
                        key={step.index}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-sky-700">
                            第 {step.index} 步
                          </span>
                          <span className="text-xs font-medium text-slate-500 tabular-nums">
                            {step.score} 分
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 leading-relaxed">
                          {step.instruction}
                        </p>
                        {hintShown ? (
                          <div className="p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900">
                            提示：{hintShown}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRequestHint(step.index)}
                            disabled={!alreadyUsed && hintsUsed.length >= 3}
                            className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:underline disabled:opacity-40"
                          >
                            <HelpCircle className="w-3 h-3" />
                            <span>
                              {alreadyUsed ? '查看提示' : '查看操作提示 (-5分)'}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Right: Interactive Simulator */}
        <section className="flex-1 p-3 sm:p-4 overflow-hidden flex flex-col min-h-[420px]">
          <SimulatorRenderer
            type={question.type}
            value={simState}
            onChange={(next) => {
              if (!submitResult) setSimState(next);
            }}
            assets={question.materials.assets}
            readOnly={Boolean(submitResult)}
          />
        </section>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              确认重置作答环境？
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              重置后，当前模拟操作环境将恢复到初始素材状态，已做的修改将被清空。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

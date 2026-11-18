'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Loader2, RotateCcw, Send } from 'lucide-react';
import GradingReport from '@/components/GradingReport';
import SimulatorRenderer from '@/components/simulators/SimulatorRenderer';
import { getPortalToken, portalFetch } from '@/lib/api';
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

export default function MistakeRedoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const questionId = params.id;

  const [question, setQuestion] = useState<ClientQuestion | null>(null);
  const [simState, setSimState] = useState<SimulatorState | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);

  useEffect(() => {
    if (!getPortalToken()) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await portalFetch<{ question: ClientQuestion }>(
          `/api/profile/mistakes/${questionId}`
        );
        if (cancelled) return;
        setQuestion(res.question);
        setSimState(structuredClone(res.question.materials.initialState));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '无法加载错题');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [questionId, router]);

  useEffect(() => {
    if (loading || !question || submitResult) return;
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [loading, question, submitResult]);

  const handleSubmit = async () => {
    if (!question || !simState || submitResult) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await portalFetch<SubmitResponse>(
        `/api/profile/mistakes/${question.id}/redo`,
        {
          method: 'POST',
          body: JSON.stringify({ answer: simState, durationSeconds: elapsed }),
        }
      );
      setSubmitResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '判分提交失败');
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
        <p className="text-sm text-red-600">{error || '错题记录不存在'}</p>
        <button
          type="button"
          onClick={() => router.push('/profile?tab=mistakes')}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm"
        >
          返回错题本
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/profile?tab=mistakes')}
            className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回错题本</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate">
              错题巩固重做 · {question.title}
            </h1>
            <div className="text-[11px] text-slate-500">
              {TYPE_LABELS[question.type]} · 满分 {question.totalScore} 分 · 不计入教师考试成绩
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg tabular-nums">
            <Clock className="w-3.5 h-3.5 text-sky-700" />
            <span>{formatTime(elapsed)}</span>
          </div>

          {!submitResult && (
            <>
              <button
                type="button"
                onClick={() =>
                  setSimState(structuredClone(question.materials.initialState))
                }
                className="h-9 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重置操作</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="h-9 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{submitting ? '判分中...' : '提交自检'}</span>
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

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
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
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  分步操作要求
                </h2>
                {question.steps.map((step) => (
                  <div
                    key={step.index}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <span className="font-semibold text-sky-700">
                        第 {step.index} 步
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        {step.score} 分
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed">
                      {step.instruction}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

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
    </div>
  );
}

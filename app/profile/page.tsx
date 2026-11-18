'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  BookX,
  History,
  Loader2,
  RotateCw,
  X,
} from 'lucide-react';
import GradingReport from '@/components/GradingReport';
import StudentHeader from '@/components/StudentHeader';
import { getStudentToken, studentFetch } from '@/lib/api';
import {
  TYPE_LABELS,
  type CheckpointResult,
  type QuestionType,
  type SimulatorState,
  type StudentProfile,
  type SubmitResponse,
} from '@/lib/types';

interface HistoryItem {
  id: string;
  questionId: string;
  questionTitle: string;
  questionType: QuestionType;
  difficulty: string;
  finalScore: number;
  maxScore: number;
  durationSeconds: number;
  teacherComment: string;
  createdAt: string;
}

interface MistakeItem {
  questionId: string;
  title: string;
  type: QuestionType;
  difficulty: string;
  knowledgePoints: string[];
  bestScore: number;
  maxScore: number;
  attemptCount: number;
  lastAttemptAt: string;
}

interface StatsData {
  totalPractices: number;
  overallAvg: number;
  avgByType: Array<{ type: QuestionType; avgScore: number; count: number }>;
  trend: Array<{ index: number; score: number; type: string; date: string }>;
  weakKnowledgePoints: Array<{
    name: string;
    masteryRate: number;
    attempts: number;
  }>;
}

export default function StudentProfilePage() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [tab, setTab] = useState<'history' | 'mistakes' | 'stats'>('history');

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);

  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [reviewData, setReviewData] = useState<{
    title: string;
    type: QuestionType;
    answer: SimulatorState;
    result: SubmitResponse;
    teacherComment?: string;
  } | null>(null);

  const loadHistory = useCallback(async (p: number) => {
    const res = await studentFetch<{ items: HistoryItem[]; total: number }>(
      `/api/profile/history?page=${p}&pageSize=10`
    );
    setHistory(res.items);
    setHistoryTotal(res.total);
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
        await Promise.all([
          loadHistory(1),
          studentFetch<{ items: MistakeItem[] }>('/api/profile/mistakes').then(
            (r) => setMistakes(r.items)
          ),
          studentFetch<StatsData>('/api/profile/stats').then((r) =>
            setStats(r)
          ),
        ]);
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadHistory]);

  const openReview = async (subId: string) => {
    try {
      const res = await studentFetch<{
        submission: {
          id: string;
          answer: SimulatorState;
          autoScore: number;
          finalScore: number;
          maxScore: number;
          checkpointResults: CheckpointResult[];
          hintsUsedCount: number;
          hintPenalty: number;
          teacherComment: string;
        };
        question: {
          title: string;
          type: QuestionType;
          referenceAnswer: SimulatorState;
          analysis: string[];
          commonMistakes: string[];
        } | null;
      }>(`/api/profile/submissions/${subId}`);

      if (!res.question) return;
      setReviewData({
        title: res.question.title,
        type: res.question.type,
        answer: res.submission.answer,
        teacherComment: res.submission.teacherComment,
        result: {
          submissionId: res.submission.id,
          autoScore: res.submission.autoScore,
          hintPenalty: res.submission.hintPenalty,
          hintsUsedCount: res.submission.hintsUsedCount,
          finalScore: res.submission.finalScore,
          maxScore: res.submission.maxScore,
          checkpointResults: res.submission.checkpointResults,
          gradedByAi: false,
          referenceAnswer: res.question.referenceAnswer,
          analysis: res.question.analysis,
          commonMistakes: res.question.commonMistakes,
        },
      });
    } catch {
      // ignore
    }
  };

  if (loading || !student) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(historyTotal / 10));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader student={student} />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header Summary */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {student.realName} 的个人学习中心
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              账号 {student.username} · {student.grade} {student.className}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            {(
              [
                { v: 'history', l: '练习记录', icon: History },
                { v: 'mistakes', l: `错题本 (${mistakes.length})`, icon: BookX },
                { v: 'stats', l: '学习统计', icon: BarChart3 },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setTab(t.v)}
                  className={`px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    tab === t.v
                      ? 'bg-white text-sky-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.l}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: History */}
        {tab === 'history' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              练习与考试历史记录
            </h2>
            {history.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                暂无提交记录，快去练习中心完成第一道操作题吧！
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3 font-medium">题目名称</th>
                      <th className="py-2.5 px-3 font-medium">题型</th>
                      <th className="py-2.5 px-3 font-medium text-right">
                        得分
                      </th>
                      <th className="py-2.5 px-3 font-medium text-right">
                        用时
                      </th>
                      <th className="py-2.5 px-3 font-medium">提交时间</th>
                      <th className="py-2.5 px-3 font-medium text-right">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-medium text-slate-900">
                          {h.questionTitle}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {TYPE_LABELS[h.questionType]}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold tabular-nums text-sky-700">
                          {h.finalScore} / {h.maxScore}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                          {Math.floor(h.durationSeconds / 60)}分
                          {h.durationSeconds % 60}秒
                        </td>
                        <td className="py-3 px-3 tabular-nums text-slate-500">
                          {new Date(h.createdAt).toLocaleString('zh-CN')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => openReview(h.id)}
                            className="text-sky-700 font-medium hover:underline"
                          >
                            回看解析
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span className="tabular-nums">
                  第 {historyPage} / {totalPages} 页
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={historyPage <= 1}
                    onClick={() => {
                      const p = historyPage - 1;
                      setHistoryPage(p);
                      void loadHistory(p);
                    }}
                    className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={historyPage >= totalPages}
                    onClick={() => {
                      const p = historyPage + 1;
                      setHistoryPage(p);
                      void loadHistory(p);
                    }}
                    className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Mistakes */}
        {tab === 'mistakes' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              错题本（未满分题目自动收录）
            </h2>
            {mistakes.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                当前错题本为空，继续保持！
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {mistakes.map((m) => (
                  <div
                    key={m.questionId}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900">
                        {m.title}
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-2">
                        <span>{TYPE_LABELS[m.type]}</span>
                        <span>·</span>
                        <span>难度 {m.difficulty}</span>
                        <span>·</span>
                        <span className="tabular-nums text-amber-700">
                          最高 {m.bestScore} / {m.maxScore} 分
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">
                          练习 {m.attemptCount} 次
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/practice/${m.questionId}`)}
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap self-start sm:self-center"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>一键重做</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Learning Stats */}
        {tab === 'stats' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500">累计练习题次</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {stats.totalPractices}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500">综合平均得分率</div>
                <div className="text-2xl font-bold text-sky-700 mt-1 tabular-nums">
                  {stats.overallAvg}%
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500">待巩固错题数</div>
                <div className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
                  {mistakes.length}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500">薄弱知识点数</div>
                <div className="text-2xl font-bold text-teal-700 mt-1 tabular-nums">
                  {
                    stats.weakKnowledgePoints.filter((w) => w.masteryRate < 80)
                      .length
                  }
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Avg Score by Type */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  各题型平均得分率
                </h3>
                <div className="space-y-3">
                  {stats.avgByType.map((t) => (
                    <div key={t.type} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-700 font-medium">
                          {TYPE_LABELS[t.type]}（{t.count}次）
                        </span>
                        <span className="tabular-nums font-semibold text-sky-700">
                          {t.avgScore}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-600 rounded-full transition-all"
                          style={{ width: `${Math.min(100, t.avgScore)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend Chart */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  近期正确率趋势图
                </h3>
                {stats.trend.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                    暂无趋势数据
                  </div>
                ) : (
                  <svg viewBox="0 0 420 170" className="w-full h-44">
                    <line
                      x1="35"
                      y1="20"
                      x2="400"
                      y2="20"
                      stroke="#E2E8F0"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1="35"
                      y1="80"
                      x2="400"
                      y2="80"
                      stroke="#E2E8F0"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1="35"
                      y1="140"
                      x2="400"
                      y2="140"
                      stroke="#CBD5E1"
                    />
                    <text x="8" y="24" fontSize="10" fill="#64748B">
                      100
                    </text>
                    <text x="14" y="84" fontSize="10" fill="#64748B">
                      50
                    </text>
                    <text x="20" y="144" fontSize="10" fill="#64748B">
                      0
                    </text>
                    {stats.trend.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#0284C7"
                        strokeWidth="2.5"
                        points={stats.trend
                          .map((pt, idx) => {
                            const x =
                              45 +
                              (idx * 340) /
                                Math.max(1, stats.trend.length - 1);
                            const y = 140 - (pt.score / 100) * 120;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                      />
                    )}
                    {stats.trend.map((pt, idx) => {
                      const x =
                        45 +
                        (idx * 340) / Math.max(1, stats.trend.length - 1);
                      const y = 140 - (pt.score / 100) * 120;
                      return (
                        <g key={idx}>
                          <circle cx={x} cy={y} r="4" fill="#0D9488" />
                          <text
                            x={x}
                            y={y - 7}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#334155"
                          >
                            {pt.score}
                          </text>
                          <text
                            x={x}
                            y={156}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#64748B"
                          >
                            {pt.date}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>

            {/* Weak Knowledge Points */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                知识点掌握情况分析
              </h3>
              {stats.weakKnowledgePoints.length === 0 ? (
                <p className="text-xs text-slate-500">暂无知识点分析数据</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stats.weakKnowledgePoints.map((kp) => (
                    <div
                      key={kp.name}
                      className="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {kp.name}
                        </div>
                        <div className="text-slate-500 mt-0.5 tabular-nums">
                          练习 {kp.attempts} 次
                        </div>
                      </div>
                      <span
                        className={`font-semibold tabular-nums ${
                          kp.masteryRate >= 80
                            ? 'text-teal-700'
                            : 'text-amber-700'
                        }`}
                      >
                        掌握率 {kp.masteryRate}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Submission Review Modal */}
      {reviewData && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-slate-50 rounded-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                作答回看 · {reviewData.title}
              </h3>
              <button
                type="button"
                onClick={() => setReviewData(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {reviewData.teacherComment && (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900">
                  教师评语：{reviewData.teacherComment}
                </div>
              )}
              <GradingReport
                type={reviewData.type}
                result={reviewData.result}
                studentAnswer={reviewData.answer}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

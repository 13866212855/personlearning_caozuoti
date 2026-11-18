'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  BookX,
  CheckCheck,
  History,
  KeyRound,
  Loader2,
  RotateCw,
  UserCheck,
  X,
} from 'lucide-react';
import GradingReport from '@/components/GradingReport';
import StudentHeader from '@/components/StudentHeader';
import { clearPortalToken, getPortalToken, portalFetch } from '@/lib/api';
import {
  TYPE_LABELS,
  type CheckpointResult,
  type NotificationItem,
  type PortalUser,
  type QuestionType,
  type SimulatorState,
  type SubmitResponse,
} from '@/lib/types';

interface HistoryItem {
  id: string;
  kind: 'exam' | 'legacy_practice' | 'redo';
  examId: string;
  questionId?: string;
  title: string;
  sourceLabel: string;
  questionType: string;
  finalScore: number | null;
  maxScore: number;
  scoreVisible: boolean;
  answerVisible: boolean;
  durationSeconds: number;
  teacherComment: string;
  isLate: boolean;
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
  canViewAnswer: boolean;
}

interface StatsData {
  totalPractices: number;
  examCount: number;
  overallAvg: number;
  avgByType: Array<{ type: QuestionType; avgScore: number; count: number }>;
  trend: Array<{ index: number; score: number; type: string; date: string }>;
  weakKnowledgePoints: Array<{
    name: string;
    masteryRate: number;
    attempts: number;
  }>;
  classInfo?: {
    name: string;
    grade: string;
    inviteCode: string;
    teacherName: string;
  };
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');

  const [user, setUser] = useState<PortalUser | null>(null);
  const [tab, setTab] = useState<
    'scores' | 'mistakes' | 'notifications' | 'account'
  >(
    initialTab === 'mistakes' ||
      initialTab === 'notifications' ||
      initialTab === 'account'
      ? initialTab
      : 'scores'
  );

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);

  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Change password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  // Legacy/Redo review modal
  const [reviewData, setReviewData] = useState<{
    title: string;
    type: QuestionType;
    answer: SimulatorState;
    result: SubmitResponse;
    teacherComment?: string;
  } | null>(null);

  const loadHistory = useCallback(async (p: number) => {
    const res = await portalFetch<{ items: HistoryItem[]; total: number }>(
      `/api/profile/history?page=${p}&pageSize=10`
    );
    setHistory(res.items);
    setHistoryTotal(res.total);
  }, []);

  const loadNotifications = useCallback(async () => {
    const res = await portalFetch<{
      items: NotificationItem[];
      unreadCount: number;
    }>('/api/notifications?page=1&pageSize=30');
    setNotifications(res.items);
    setUser((prev) =>
      prev ? { ...prev, unreadNotifications: res.unreadCount } : prev
    );
  }, []);

  useEffect(() => {
    if (!getPortalToken()) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const me = await portalFetch<{ user: PortalUser }>('/api/auth/me');
        if (cancelled) return;
        if (me.user.role === 'teacher') {
          router.replace('/teacher');
          return;
        }
        if (me.user.role !== 'student') {
          clearPortalToken();
          router.replace('/login');
          return;
        }
        setUser(me.user);
        await Promise.all([
          loadHistory(1),
          portalFetch<{ items: MistakeItem[] }>('/api/profile/mistakes').then(
            (r) => {
              if (!cancelled) setMistakes(r.items);
            }
          ),
          portalFetch<StatsData>('/api/profile/stats').then((r) => {
            if (!cancelled) setStats(r);
          }),
          loadNotifications(),
        ]);
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, loadHistory, loadNotifications]);

  const openLegacyReview = async (subId: string) => {
    try {
      const res = await portalFetch<{
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

  const handleMarkRead = async (id: string) => {
    await portalFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    await loadNotifications();
  };

  const handleMarkAllRead = async () => {
    await portalFetch('/api/notifications/read-all', { method: 'POST' });
    await loadNotifications();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdErr('');
    if (newPassword.length < 6) {
      setPwdErr('新密码长度不能少于 6 位');
      return;
    }
    if (newPassword !== confirmPwd) {
      setPwdErr('两次输入的新密码不一致');
      return;
    }
    setSavingPwd(true);
    try {
      await portalFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setPwdMsg('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPwd('');
      setUser((prev) =>
        prev ? { ...prev, mustChangePassword: false } : prev
      );
    } catch (err) {
      setPwdErr(err instanceof Error ? err.message : '修改密码失败');
    } finally {
      setSavingPwd(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(historyTotal / 10));
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader user={user} />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Profile Header + Tabs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {user.realName} 的个人中心
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              账号 {user.username} · {user.grade} {user.className}
              {user.teacherName ? ` · 任课教师：${user.teacherName}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            {(
              [
                { v: 'scores', l: '我的成绩', icon: History },
                { v: 'mistakes', l: `错题本 (${mistakes.length})`, icon: BookX },
                {
                  v: 'notifications',
                  l: `消息通知${unreadCount > 0 ? ` (${unreadCount})` : ''}`,
                  icon: Bell,
                },
                { v: 'account', l: '班级与账号', icon: UserCheck },
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

        {/* Tab 1: My Scores & Stats */}
        {tab === 'scores' && (
          <div className="space-y-6">
            {stats && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">已参加模拟考试</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {stats.examCount} 场
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">综合平均得分率</div>
                    <div className="text-2xl font-bold text-sky-700 mt-1 tabular-nums">
                      {stats.overallAvg}%
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">错题本待巩固</div>
                    <div className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
                      {mistakes.length} 题
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="text-xs text-slate-500">薄弱知识点</div>
                    <div className="text-2xl font-bold text-teal-700 mt-1 tabular-nums">
                      {
                        stats.weakKnowledgePoints.filter(
                          (w) => w.masteryRate < 75
                        ).length
                      }{' '}
                      项
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Avg Score by Type */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      各题型操作题得分率
                    </h2>
                    <div className="space-y-3">
                      {stats.avgByType.map((t) => (
                        <div key={t.type} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-700 font-medium">
                              {TYPE_LABELS[t.type]}（{t.count}题次）
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

                  {/* Score Trend */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                      近期成绩趋势图
                    </h2>
                    {stats.trend.length === 0 ? (
                      <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                        暂无成绩趋势数据
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
                                {pt.score}%
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
                {stats.weakKnowledgePoints.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                    <h2 className="text-sm font-semibold text-slate-900">
                      知识点掌握率分析
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                              涉及 {kp.attempts} 题次
                            </div>
                          </div>
                          <span
                            className={`font-semibold tabular-nums ${
                              kp.masteryRate >= 75
                                ? 'text-teal-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {kp.masteryRate}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* History Table */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-900">
                考试与历史作答记录
              </h2>
              {history.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  暂无提交记录，请前往「模拟考试」参与老师发布的考试。
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2.5 px-3 font-medium">名称</th>
                        <th className="py-2.5 px-3 font-medium">类型标签</th>
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
                            {h.title}
                            {h.isLate && (
                              <span className="ml-2 text-[11px] text-amber-700">
                                (迟交)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {h.sourceLabel}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold tabular-nums text-sky-700">
                            {h.scoreVisible && h.finalScore !== null
                              ? `${h.finalScore} / ${h.maxScore}`
                              : '暂未公布'}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                            {Math.floor(h.durationSeconds / 60)}分
                            {h.durationSeconds % 60}秒
                          </td>
                          <td className="py-3 px-3 tabular-nums text-slate-500">
                            {new Date(h.createdAt).toLocaleString('zh-CN')}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {h.kind === 'exam' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/exam?examId=${h.examId}&mode=result&submissionId=${h.id}`
                                  )
                                }
                                className="text-sky-700 font-medium hover:underline"
                              >
                                查看考卷
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void openLegacyReview(h.id)}
                                className="text-sky-700 font-medium hover:underline"
                              >
                                回看解析
                              </button>
                            )}
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
          </div>
        )}

        {/* Tab 2: Mistakes */}
        {tab === 'mistakes' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  错题本（考试与练习未满分题目自动收录）
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  错题重做仅用于个人巩固练习与查漏补缺，不会更改教师已批改的正式考试成绩。
                </p>
              </div>
            </div>

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
                          历史最高 {m.bestScore} / {m.maxScore} 分
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">
                          作答 {m.attemptCount} 次
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/mistakes/${m.questionId}`)}
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap self-start sm:self-center"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>错题重做</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Notifications */}
        {tab === 'notifications' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                站内消息通知
              </h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>全部标为已读</span>
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                暂无站内通知
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`py-3.5 px-3 rounded-xl flex items-start justify-between gap-4 ${
                      n.isRead ? '' : 'bg-sky-50/60'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-slate-900">
                          {n.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {n.content}
                      </p>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        {new Date(n.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => void handleMarkRead(n.id)}
                          className="text-xs text-sky-700 hover:underline whitespace-nowrap"
                        >
                          标为已读
                        </button>
                      )}
                      {n.link && (
                        <button
                          type="button"
                          onClick={() => router.push(n.link)}
                          className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs text-slate-700 whitespace-nowrap"
                        >
                          前往查看
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Class Info & Password */}
        {tab === 'account' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-900">
                我的班级与任课教师信息
              </h2>
              <dl className="divide-y divide-slate-100 text-sm">
                <div className="py-3 flex justify-between">
                  <dt className="text-slate-500">真实姓名</dt>
                  <dd className="font-medium text-slate-900">{user.realName}</dd>
                </div>
                <div className="py-3 flex justify-between">
                  <dt className="text-slate-500">登录用户名</dt>
                  <dd className="font-mono text-slate-800">{user.username}</dd>
                </div>
                <div className="py-3 flex justify-between">
                  <dt className="text-slate-500">所属年级与班级</dt>
                  <dd className="font-medium text-slate-900">
                    {stats?.classInfo?.grade || user.grade}{' '}
                    {stats?.classInfo?.name || user.className}
                  </dd>
                </div>
                <div className="py-3 flex justify-between">
                  <dt className="text-slate-500">任课教师</dt>
                  <dd className="font-medium text-sky-700">
                    {stats?.classInfo?.teacherName ||
                      user.teacherName ||
                      '待分配'}
                  </dd>
                </div>
                {stats?.classInfo?.inviteCode && (
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">班级邀请码</dt>
                    <dd className="font-mono text-slate-700">
                      {stats.classInfo.inviteCode}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-sky-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  修改登录密码
                </h2>
              </div>

              {pwdMsg && (
                <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800">
                  {pwdMsg}
                </div>
              )}
              {pwdErr && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {pwdErr}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                <label className="block space-y-1">
                  <span className="text-slate-600 font-medium">原密码</span>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="请输入当前登录密码"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-600 font-medium">
                    新密码（至少 6 位）
                  </span>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="请输入新密码"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-600 font-medium">确认新密码</span>
                  <input
                    type="password"
                    required
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="请再次输入新密码"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={savingPwd}
                  className="h-9 px-5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium"
                >
                  {savingPwd ? '保存中...' : '确认修改密码'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Legacy/Redo Submission Review Modal */}
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

export default function StudentProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}

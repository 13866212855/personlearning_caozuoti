'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Award,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Loader2,
  Play,
  RefreshCw,
  RotateCw,
} from 'lucide-react';
import StudentHeader from '@/components/StudentHeader';
import { useAuthConfig } from '@/hooks/useAuthConfig';
import {
  clearPortalToken,
  getCachedPortalUser,
  getPortalToken,
  portalFetch,
  setCachedPortalUser,
} from '@/lib/api';
import { SUBJECT_LABELS } from '@/lib/subjects';
import type { PortalUser, StudentExamCard, SubjectId } from '@/lib/types';

function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const e = new Date(endIso).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${s} ~ ${e}`;
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} 分 ${s} 秒`;
}

export default function StudentExamsHomePage() {
  const router = useRouter();
  const auth = useAuthConfig();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectingToLogin, setRedirectingToLogin] = useState(false);
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [subjectFilter, setSubjectFilter] = useState<'all' | SubjectId>('all');

  const [pending, setPending] = useState<StudentExamCard[]>([]);
  const [inProgress, setInProgress] = useState<StudentExamCard[]>([]);
  const [completed, setCompleted] = useState<StudentExamCard[]>([]);
  const [err, setErr] = useState('');

  const loadDashboard = useCallback(
    async (isCancelled: () => boolean) => {
      await Promise.resolve();
      if (isCancelled()) return;
      const token = getPortalToken();
      if (!token) {
        setRedirectingToLogin(true);
        setLoading(false);
        router.replace('/login');
        return;
      }

      const cached = getCachedPortalUser();
      if (cached?.role === 'student') {
        setUser((prev) => prev ?? cached);
      }

      setErr('');
      setLoading(true);
      try {
        // Fetch current user & assigned exams in parallel to eliminate sequential waterfall
        const mePromise = portalFetch<{ user: PortalUser }>('/api/auth/me');
        const examsPromise = portalFetch<{
          pending: StudentExamCard[];
          inProgress: StudentExamCard[];
          completed: StudentExamCard[];
        }>('/api/exams').catch((examErr: unknown) => ({
          __examError:
            examErr instanceof Error ? examErr.message : '加载考试列表失败',
        }));

        const [me, examsRes] = await Promise.all([mePromise, examsPromise]);
        if (isCancelled()) return;

        if (me.user.role === 'teacher') {
          setCachedPortalUser(me.user);
          router.replace('/teacher');
          return;
        }
        if (me.user.role !== 'student') {
          clearPortalToken();
          setRedirectingToLogin(true);
          router.replace('/login');
          return;
        }

        setCachedPortalUser(me.user);
        setUser(me.user);

        if ('__examError' in examsRes) {
          setErr(examsRes.__examError);
        } else {
          setPending(examsRes.pending);
          setInProgress(examsRes.inProgress);
          setCompleted(examsRes.completed);
        }
      } catch (e) {
        if (isCancelled()) return;
        if (!getPortalToken()) {
          setRedirectingToLogin(true);
          router.replace('/login');
          return;
        }
        setErr(e instanceof Error ? e.message : '加载考试信息失败，请重试');
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    router.prefetch('/login');
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        void loadDashboard(() => cancelled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadDashboard, router]);

  if (redirectingToLogin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-3 text-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
        <p className="text-sm text-slate-600">正在前往登录页面...</p>
        <Link
          href="/login"
          className="text-xs text-sky-700 font-medium hover:underline"
        >
          如未自动跳转，请点击这里登录
        </Link>
      </div>
    );
  }

  // Only show centered loader when no cached user is available AND initial load hasn't errored
  if (!user && loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-3">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
        <p className="text-sm text-slate-600">正在进入模拟考试中心...</p>
      </div>
    );
  }

  // Never trap user in endless spinner if initial auth/network call failed
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <div className="space-y-1">
            <h1 className="text-base font-bold text-slate-900">页面加载失败</h1>
            <p className="text-xs text-slate-600">
              {err || '无法连接服务器获取学习信息，请检查网络后重试。'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void loadDashboard(() => false)}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>重新加载</span>
            </button>
            <button
              type="button"
              onClick={() => {
                clearPortalToken();
                router.replace('/login');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
            >
              返回登录页
            </button>
          </div>
        </div>
      </div>
    );
  }

  const enabledSubjects: SubjectId[] =
    auth?.enabledSubjects && auth.enabledSubjects.length > 0
      ? auth.enabledSubjects.map((s) => s.id)
      : ['it', 'gt'];
  const effectiveSubjectFilter: 'all' | SubjectId =
    enabledSubjects.length === 1
      ? enabledSubjects[0]
      : subjectFilter !== 'all' && !enabledSubjects.includes(subjectFilter)
        ? 'all'
        : subjectFilter;

  const matchesSubject = (exam: StudentExamCard) => {
    const sid = (exam.subjectId || 'it') as SubjectId;
    if (!enabledSubjects.includes(sid)) return false;
    if (effectiveSubjectFilter === 'all') return true;
    return sid === effectiveSubjectFilter;
  };

  const activeCards = [...inProgress, ...pending].filter(matchesSubject);
  const completedCards = completed.filter(matchesSubject);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader user={user} />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero / Class Status */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              模拟考试中心
            </h1>
            <p className="text-sm text-slate-600">
              所在班级：{user.grade} {user.className}
              {user.teacherName ? ` · 任课教师：${user.teacherName}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs tabular-nums">
            <div>
              <div className="text-slate-500">进行中 / 待完成</div>
              <div className="text-2xl font-bold text-sky-700 mt-0.5">
                {loading ? '—' : activeCards.length}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-slate-500">已完成考试</div>
              <div className="text-2xl font-bold text-teal-700 mt-0.5">
                {loading ? '—' : completedCards.length}
              </div>
            </div>
          </div>
        </section>

        {err && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-3">
            <span>{err}</span>
            <button
              type="button"
              onClick={() => void loadDashboard(() => false)}
              className="px-3 py-1 bg-white border border-red-200 hover:bg-red-100 rounded-lg font-medium shrink-0"
            >
              重新加载
            </button>
          </div>
        )}

        {/* Section Tabs & Subject Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === 'active'
                  ? 'bg-sky-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              待完成与进行中（{loading ? '…' : activeCards.length}）
            </button>
            <button
              type="button"
              onClick={() => setTab('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === 'completed'
                  ? 'bg-sky-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              已完成考试（{loading ? '…' : completedCards.length}）
            </button>
          </div>

          {enabledSubjects.length >= 2 && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setSubjectFilter('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                  effectiveSubjectFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                全部学科
              </button>
              {enabledSubjects.map((sid) => (
                <button
                  key={sid}
                  type="button"
                  onClick={() => setSubjectFilter(sid)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                    effectiveSubjectFilter === sid
                      ? sid === 'gt'
                        ? 'bg-white text-teal-700 shadow-xs'
                        : 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {SUBJECT_LABELS[sid]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading Skeleton while exam list fetches */}
        {loading && activeCards.length === 0 && completedCards.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
              >
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="h-5 w-3/4 bg-slate-200 rounded" />
                <div className="h-10 w-full bg-slate-100 rounded" />
                <div className="h-10 w-full bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Active & Pending Exams */}
            {tab === 'active' && (
              <section className="space-y-4">
                {activeCards.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center space-y-2">
                    <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-sm font-medium text-slate-700">
                      暂无待参加的模拟考试
                    </p>
                    <p className="text-xs text-slate-500">
                      任课教师发布新考试或专项补练后，将自动出现在此处并发送通知。
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeCards.map((exam) => (
                      <article
                        key={exam.id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-sky-300 transition-colors"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span
                              className={`font-semibold ${
                                exam.hasInProgress
                                  ? 'text-amber-700'
                                  : exam.canEnter
                                    ? 'text-sky-700'
                                    : 'text-slate-500'
                              }`}
                            >
                              {exam.hasInProgress
                                ? '作答进行中'
                                : exam.canEnter
                                  ? '可进入作答'
                                  : exam.statusReason || '暂不可进入'}
                            </span>
                            <span className="text-slate-500">
                              {SUBJECT_LABELS[(exam.subjectId || 'it') as SubjectId]} ·{' '}
                              {exam.teacherName}
                            </span>
                          </div>

                          <div>
                            <h2 className="text-base font-bold text-slate-900">
                              {exam.title}
                            </h2>
                            {exam.description && (
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                {exam.description}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100 tabular-nums">
                            <div className="flex items-center gap-1.5">
                              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {exam.questionCount} 题 · 满分 {exam.totalScore}{' '}
                                分
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>限时 {exam.duration} 分钟</span>
                            </div>
                            <div className="col-span-2 flex items-center gap-1.5 text-slate-500">
                              <CalendarClock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>
                                {formatTimeRange(exam.startTime, exam.endTime)}
                              </span>
                            </div>
                            {exam.hasInProgress &&
                              exam.remainingSeconds !== null && (
                                <div className="col-span-2 text-amber-700 font-medium">
                                  已保存草稿 · 剩余时间约{' '}
                                  {formatSec(exam.remainingSeconds)}
                                </div>
                              )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!exam.canEnter && !exam.hasInProgress}
                          onClick={() =>
                            router.push(`/exam?examId=${exam.id}`)
                          }
                          className={`w-full h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                            exam.hasInProgress
                              ? 'bg-amber-600 hover:bg-amber-700 text-white'
                              : exam.canEnter
                                ? 'bg-sky-600 hover:bg-sky-700 text-white'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {exam.hasInProgress ? (
                            <>
                              <RotateCw className="w-4 h-4" />
                              <span>继续作答</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              <span>进入考试</span>
                            </>
                          )}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Completed Exams */}
            {tab === 'completed' && (
              <section className="space-y-4">
                {completedCards.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center text-sm text-slate-500">
                    暂无已完成的考试记录
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completedCards.map((exam) => (
                      <article
                        key={exam.id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-1 text-teal-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              已完成（{exam.attemptsUsed}/{exam.maxAttempts} 次）
                            </span>
                            <span className="text-slate-500">
                              {SUBJECT_LABELS[(exam.subjectId || 'it') as SubjectId]} ·{' '}
                              {exam.teacherName}
                            </span>
                          </div>

                          <h2 className="text-base font-bold text-slate-900">
                            {exam.title}
                          </h2>

                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                            <span className="text-slate-600 flex items-center gap-1.5">
                              <Award className="w-4 h-4 text-sky-600" />
                              <span>
                                {exam.scorePolicy === 'latest'
                                  ? '最近提交成绩'
                                  : '历史最高成绩'}
                              </span>
                            </span>
                            <span className="text-base font-bold text-sky-700 tabular-nums">
                              {exam.displayScore !== null
                                ? `${exam.displayScore} / ${exam.totalScore}`
                                : '暂未公布'}
                            </span>
                          </div>

                          {exam.lastSubmittedAt && (
                            <div className="text-xs text-slate-500 tabular-nums">
                              最近交卷：
                              {new Date(exam.lastSubmittedAt).toLocaleString(
                                'zh-CN'
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/exam?examId=${exam.id}&mode=result`)
                            }
                            className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <span>查看详情</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {exam.canEnter &&
                            exam.attemptsUsed < exam.maxAttempts && (
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(`/exam?examId=${exam.id}`)
                                }
                                className="h-9 px-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-medium whitespace-nowrap"
                              >
                                再次作答
                              </button>
                            )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

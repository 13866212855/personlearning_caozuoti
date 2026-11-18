'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import SimulatorRenderer from '@/components/simulators/SimulatorRenderer';
import { getPortalToken, portalFetch } from '@/lib/api';
import {
  TYPE_LABELS,
  type ClassItem,
  type ExamQuestionResult,
  type QuestionType,
  type SimulatorState,
  type TeacherExamSummary,
} from '@/lib/types';

interface ResultRow {
  id: string;
  studentId: string;
  studentName: string;
  username: string;
  studentNo: string;
  className: string;
  classId: string;
  attemptNo: number;
  autoScore: number;
  finalScore: number;
  maxScore: number;
  durationSeconds: number;
  switchCount: number;
  isLate: boolean;
  teacherComment: string;
  submittedAt: string;
}

interface AnalyticsData {
  assignedCount: number;
  submittedCount: number;
  unsubmittedStudents: Array<{
    id: string;
    username: string;
    realName: string;
    className: string;
    studentNo: string;
  }>;
  lowScoreStudents: Array<{
    id: string;
    realName: string;
    username: string;
    className: string;
    score: number;
    maxScore: number;
  }>;
  questionAnalysis: Array<{
    questionId: string;
    title: string;
    type: QuestionType;
    avgScoreRate: number;
    topMissedCheckpoints: Array<{ description: string; failCount: number }>;
  }>;
  knowledgeMastery: Array<{
    name: string;
    masteryRate: number;
    sampleCount: number;
    isWeak: boolean;
  }>;
}

interface SubmissionDetail {
  id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  username: string;
  className: string;
  studentNo: string;
  autoScore: number;
  finalScore: number;
  maxScore: number;
  durationSeconds: number;
  switchCount: number;
  isLate: boolean;
  teacherComment: string;
  submittedAt: string;
  answers: Record<string, SimulatorState>;
  questionResults: ExamQuestionResult[];
}

interface StudentAnalytics {
  student: {
    id: string;
    username: string;
    realName: string;
    grade: string;
    className: string;
    studentNo: string;
  };
  trend: Array<{
    examId: string;
    examTitle: string;
    score: number;
    maxScore: number;
    pct: number;
    submittedAt: string;
  }>;
  weakKnowledgePoints: Array<{
    name: string;
    masteryRate: number;
    count: number;
  }>;
}

interface TeacherAnalyticsTabProps {
  initialExamId?: string;
}

export default function TeacherAnalyticsTab({
  initialExamId,
}: TeacherAnalyticsTabProps) {
  const [exams, setExams] = useState<TeacherExamSummary[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState(initialExamId || '');
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingExam, setLoadingExam] = useState(false);

  const [results, setResults] = useState<ResultRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Filters
  const [classFilter, setClassFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [lateOnly, setLateOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'time'>('time');

  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Submission Inspection & Manual Adjust Modal
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [adjScore, setAdjScore] = useState(0);
  const [adjComment, setAdjComment] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [regrading, setRegrading] = useState(false);

  // Student Analytics Modal
  const [stuAnalytics, setStuAnalytics] = useState<StudentAnalytics | null>(null);

  // Remedial Practice Modal
  const [remedialOpen, setRemedialOpen] = useState(false);
  const [remKp, setRemKp] = useState('');
  const [remType, setRemType] = useState<QuestionType>('excel');
  const [remStudentIds, setRemStudentIds] = useState<string[]>([]);
  const [remSending, setRemSending] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      portalFetch<{ items: TeacherExamSummary[] }>('/api/teacher/exams?pageSize=50'),
      portalFetch<{ items: ClassItem[] }>('/api/teacher/classes'),
    ])
      .then(([exRes, clsRes]) => {
        if (!active) return;
        setExams(exRes.items);
        setClasses(clsRes.items);
        if (!initialExamId && exRes.items.length > 0) {
          setSelectedExamId(exRes.items[0].id);
        }
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : '加载考试列表失败');
      })
      .finally(() => {
        if (active) setLoadingInit(false);
      });
    return () => {
      active = false;
    };
  }, [initialExamId]);

  const loadExamData = useCallback(
    async (examId: string) => {
      if (!examId) return;
      setLoadingExam(true);
      setErr('');
      try {
        const qs = new URLSearchParams();
        if (classFilter) qs.set('classId', classFilter);
        if (keyword.trim()) qs.set('keyword', keyword.trim());
        if (lateOnly) qs.set('lateOnly', 'true');

        const [resList, anaRes] = await Promise.all([
          portalFetch<{ items: ResultRow[] }>(
            `/api/teacher/exams/${examId}/results?${qs.toString()}`
          ),
          portalFetch<AnalyticsData>(`/api/teacher/exams/${examId}/analytics`),
        ]);
        setResults(resList.items);
        setAnalytics(anaRes);
      } catch (e) {
        setErr(e instanceof Error ? e.message : '加载学情数据失败');
      } finally {
        setLoadingExam(false);
      }
    },
    [classFilter, keyword, lateOnly]
  );

  useEffect(() => {
    if (!selectedExamId) return;
    let active = true;
    const qs = new URLSearchParams();
    if (classFilter) qs.set('classId', classFilter);
    if (lateOnly) qs.set('lateOnly', 'true');

    Promise.all([
      portalFetch<{ items: ResultRow[] }>(
        `/api/teacher/exams/${selectedExamId}/results?${qs.toString()}`
      ),
      portalFetch<AnalyticsData>(`/api/teacher/exams/${selectedExamId}/analytics`),
    ])
      .then(([resList, anaRes]) => {
        if (!active) return;
        setResults(resList.items);
        setAnalytics(anaRes);
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : '加载学情数据失败');
      });

    return () => {
      active = false;
    };
  }, [selectedExamId, classFilter, lateOnly]);

  const sortedResults = useMemo(() => {
    const arr = [...results];
    if (sortOrder === 'desc') return arr.sort((a, b) => b.finalScore - a.finalScore);
    if (sortOrder === 'asc') return arr.sort((a, b) => a.finalScore - b.finalScore);
    return arr;
  }, [results, sortOrder]);

  const handleExportCsv = async () => {
    if (!selectedExamId) return;
    const token = getPortalToken();
    const resp = await fetch(`/api/teacher/exams/${selectedExamId}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) {
      setErr('导出成绩单失败');
      return;
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam_${selectedExamId}_scores.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRemindUnsubmitted = async () => {
    if (!selectedExamId) return;
    setErr('');
    try {
      const res = await portalFetch<{ notifiedCount: number }>(
        `/api/teacher/exams/${selectedExamId}/remind-unsubmitted`,
        { method: 'POST' }
      );
      setMsg(
        res.notifiedCount > 0
          ? `已向 ${res.notifiedCount} 名未交卷学生发送催交提醒通知`
          : '全部指派学生均已交卷，无需提醒'
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : '发送提醒失败');
    }
  };

  const openDetailModal = async (subId: string) => {
    setErr('');
    try {
      const res = await portalFetch<{ submission: SubmissionDetail }>(
        `/api/teacher/exam-submissions/${subId}`
      );
      setDetail(res.submission);
      setAdjScore(res.submission.finalScore);
      setAdjComment(res.submission.teacherComment || '');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载答卷详情失败');
    }
  };

  const handleAdjustScore = async () => {
    if (!detail) return;
    setAdjusting(true);
    setErr('');
    try {
      const res = await portalFetch<{ finalScore: number }>(
        `/api/teacher/exam-submissions/${detail.id}/adjust`,
        {
          method: 'PUT',
          body: JSON.stringify({
            finalScore: Number(adjScore),
            teacherComment: adjComment.trim(),
          }),
        }
      );
      setMsg(`已更新 ${detail.studentName} 的最终成绩为 ${res.finalScore} 分并通知学生`);
      setDetail(null);
      void loadExamData(selectedExamId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '调分失败');
    } finally {
      setAdjusting(false);
    }
  };

  const handleRegrade = async () => {
    if (!detail) return;
    setRegrading(true);
    try {
      const res = await portalFetch<{
        autoScore: number;
        maxScore: number;
        questionResults: ExamQuestionResult[];
      }>(`/api/teacher/exam-submissions/${detail.id}/regrade`, {
        method: 'POST',
      });
      setDetail({
        ...detail,
        autoScore: res.autoScore,
        finalScore: res.autoScore,
        maxScore: res.maxScore,
        questionResults: res.questionResults,
      });
      setAdjScore(res.autoScore);
      setMsg('已按当前题目评分点重新自动判分');
      void loadExamData(selectedExamId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '重判失败');
    } finally {
      setRegrading(false);
    }
  };

  const openStudentModal = async (studentId: string) => {
    try {
      const res = await portalFetch<StudentAnalytics>(
        `/api/teacher/students/${studentId}/analytics`
      );
      setStuAnalytics(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载学生个人学情失败');
    }
  };

  const openRemedialModal = (kpName: string, defaultType: QuestionType = 'excel') => {
    setRemKp(kpName);
    setRemType(defaultType);
    const lowIds = (analytics?.lowScoreStudents || []).map((s) => s.id);
    const fallbackIds = results.map((r) => r.studentId);
    setRemStudentIds(lowIds.length > 0 ? lowIds : fallbackIds.slice(0, 10));
    setRemedialOpen(true);
  };

  const handleSendRemedial = async () => {
    if (!selectedExamId || !remKp.trim() || remStudentIds.length === 0) {
      setErr('请至少选择 1 名目标学生');
      return;
    }
    setRemSending(true);
    setErr('');
    try {
      const res = await portalFetch<{
        examId: string;
        questionTitle: string;
        assignedCount: number;
      }>(`/api/teacher/exams/${selectedExamId}/remedial-practice`, {
        method: 'POST',
        body: JSON.stringify({
          knowledgePoint: remKp.trim(),
          type: remType,
          targetStudentIds: remStudentIds,
        }),
      });
      setRemedialOpen(false);
      setMsg(
        `已为 ${res.assignedCount} 名学生推送专项补练「${res.questionTitle}」，学生可在「模拟考试」中作答`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : '推送补练失败');
    } finally {
      setRemSending(false);
    }
  };

  if (loadingInit) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-500">
        暂无考试数据，请先前往「考试管理」创建并发布考试。
      </div>
    );
  }

  // Unique students for remedial student picker
  const selectableStudentsMap = new Map<string, { id: string; realName: string; className: string; tag?: string }>();
  for (const l of analytics?.lowScoreStudents || []) {
    selectableStudentsMap.set(l.id, {
      id: l.id,
      realName: l.realName,
      className: l.className,
      tag: `${l.score}/${l.maxScore}`,
    });
  }
  for (const r of results) {
    if (!selectableStudentsMap.has(r.studentId)) {
      selectableStudentsMap.set(r.studentId, {
        id: r.studentId,
        realName: r.studentName,
        className: r.className,
        tag: `${r.finalScore}/${r.maxScore}`,
      });
    }
  }
  for (const u of analytics?.unsubmittedStudents || []) {
    if (!selectableStudentsMap.has(u.id)) {
      selectableStudentsMap.set(u.id, {
        id: u.id,
        realName: u.realName,
        className: u.className,
        tag: '未交卷',
      });
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Exam Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">成绩批阅与学情诊断</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            查看学生成绩、回看操作快照与人工调分，识别高频失分点并一键推送薄弱知识点 AI 补练
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="h-9 px-3 border border-slate-300 rounded-lg bg-white font-medium min-w-[220px]"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.submittedCount}/{ex.assignedCount}人)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void handleRemindUnsubmitted()}
            className="h-9 px-3.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 rounded-lg font-medium inline-flex items-center gap-1.5"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>提醒未交学生</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExportCsv()}
            className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg font-medium inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出成绩 CSV</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800">
          {msg}
        </div>
      )}
      {err && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {err}
        </div>
      )}

      {loadingExam ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary KPI Row */}
          {analytics && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">应考与交卷人数</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {analytics.submittedCount}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / {analytics.assignedCount} 人已交
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">未交卷学生</div>
                <div className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
                  {analytics.unsubmittedStudents.length} 人
                </div>
                {analytics.unsubmittedStudents.length > 0 && (
                  <div className="text-[11px] text-slate-500 mt-1 truncate">
                    {analytics.unsubmittedStudents
                      .slice(0, 5)
                      .map((u) => u.realName)
                      .join('、')}
                    {analytics.unsubmittedStudents.length > 5 ? ' 等' : ''}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">低分预警（&lt;60%）</div>
                <div className="text-2xl font-bold text-red-600 mt-1 tabular-nums">
                  {analytics.lowScoreStudents.length} 人
                </div>
                {analytics.lowScoreStudents.length > 0 && (
                  <div className="text-[11px] text-slate-500 mt-1 truncate">
                    {analytics.lowScoreStudents
                      .slice(0, 5)
                      .map((u) => u.realName)
                      .join('、')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Knowledge Point Mastery + Per-Question Analysis */}
          {analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    班级知识点掌握热力分析
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    低于 70% 标为薄弱知识点
                  </span>
                </div>

                {analytics.knowledgeMastery.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    暂无已提交答卷的知识点统计
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    {analytics.knowledgeMastery.map((kp) => (
                      <div key={kp.name} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">
                              {kp.name}
                            </span>
                            {kp.isWeak && (
                              <span className="text-[11px] font-semibold text-red-600 inline-flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                薄弱
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="tabular-nums font-semibold text-slate-700">
                              {kp.masteryRate}%
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                openRemedialModal(
                                  kp.name,
                                  analytics.questionAnalysis[0]?.type || 'excel'
                                )
                              }
                              className="text-sky-700 hover:underline font-medium inline-flex items-center gap-0.5"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>生成针对性补练</span>
                            </button>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              kp.isWeak ? 'bg-red-500' : 'bg-teal-600'
                            }`}
                            style={{ width: `${Math.max(4, kp.masteryRate)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  逐题得分率与高频失分点
                </h3>

                {analytics.questionAnalysis.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    暂无题目分析数据
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    {analytics.questionAnalysis.map((qa, idx) => (
                      <div
                        key={qa.questionId}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 truncate">
                            第 {idx + 1} 题 · {qa.title}
                          </span>
                          <span className="font-bold text-sky-700 tabular-nums shrink-0">
                            平均得分率 {qa.avgScoreRate}%
                          </span>
                        </div>
                        {qa.topMissedCheckpoints.length > 0 ? (
                          <div className="space-y-1 text-[11px] text-slate-600">
                            {qa.topMissedCheckpoints.map((cp, cIdx) => (
                              <div
                                key={cIdx}
                                className="flex items-center justify-between"
                              >
                                <span className="truncate">• {cp.description}</span>
                                <span className="text-red-600 shrink-0 ml-2 tabular-nums">
                                  {cp.failCount} 人失分
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-teal-700">
                            暂无高频失分检查点
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Student Score Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">
                学生成绩与答卷列表（{sortedResults.length} 份）
              </h3>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">全部班级</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value as 'desc' | 'asc' | 'time')
                  }
                  className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="time">按交卷时间</option>
                  <option value="desc">成绩从高到低</option>
                  <option value="asc">成绩从低到高</option>
                </select>
                <label className="flex items-center gap-1.5 px-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lateOnly}
                    onChange={(e) => setLateOnly(e.target.checked)}
                  />
                  <span>仅看迟交</span>
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索学生姓名/学号"
                  className="h-8 px-2.5 border border-slate-200 rounded-lg w-36"
                />
                <button
                  type="button"
                  onClick={() => void loadExamData(selectedExamId)}
                  className="h-8 px-3 bg-slate-900 text-white rounded-lg inline-flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>筛选</span>
                </button>
              </div>
            </div>

            {sortedResults.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                暂无符合条件的学生交卷记录
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3 font-medium">学生（点击看档案）</th>
                      <th className="py-2.5 px-3 font-medium">班级 / 学号</th>
                      <th className="py-2.5 px-3 font-medium text-right">得分</th>
                      <th className="py-2.5 px-3 font-medium text-right">用时 / 切屏</th>
                      <th className="py-2.5 px-3 font-medium">状态</th>
                      <th className="py-2.5 px-3 font-medium">提交时间</th>
                      <th className="py-2.5 px-3 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedResults.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => void openStudentModal(r.studentId)}
                            className="font-semibold text-sky-700 hover:underline inline-flex items-center gap-1"
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span>{r.studentName}</span>
                          </button>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {r.className} · {r.studentNo}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          <span className="font-bold text-slate-900">
                            {r.finalScore}
                          </span>
                          <span className="text-slate-400"> / {r.maxScore}</span>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                          {Math.floor(r.durationSeconds / 60)}分
                          {r.durationSeconds % 60}秒 ·{' '}
                          <span
                            className={
                              r.switchCount > 0 ? 'text-amber-700 font-semibold' : ''
                            }
                          >
                            切屏 {r.switchCount} 次
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {r.isLate ? (
                            <span className="text-amber-700 font-medium">迟交</span>
                          ) : (
                            <span className="text-teal-700 font-medium">正常</span>
                          )}
                        </td>
                        <td className="py-3 px-3 tabular-nums text-slate-500">
                          {new Date(r.submittedAt).toLocaleString('zh-CN')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => void openDetailModal(r.id)}
                            className="text-sky-700 font-medium hover:underline inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>查看答卷/调分</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== Submission Detail & Adjust Modal ==================== */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-xs">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {detail.studentName}（{detail.className}）— {detail.examTitle}
                </h3>
                <p className="text-slate-500 mt-0.5 tabular-nums">
                  系统自动判分：{detail.autoScore} / {detail.maxScore} · 当前最终得分：
                  {detail.finalScore} · 切屏 {detail.switchCount} 次
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {detail.questionResults.map((qr, qIdx) => {
                const ans = detail.answers[qr.questionId];
                return (
                  <div
                    key={qr.questionId}
                    className="border border-slate-200 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-sm">
                        第 {qIdx + 1} 题 · {qr.title}（{TYPE_LABELS[qr.type]}）
                      </div>
                      <div className="font-bold text-sky-700 tabular-nums">
                        得分：{qr.finalScore} / {qr.maxScore}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {qr.checkpointResults.map((cp) => (
                        <div
                          key={cp.checkpointId}
                          className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-1.5"
                        >
                          {cp.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="text-slate-800">{cp.description}</div>
                            <div className="text-[11px] text-slate-500">
                              {cp.earnedScore}/{cp.maxScore} 分 · {cp.feedback}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {ans && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2 max-h-[380px] overflow-y-auto">
                        <SimulatorRenderer type={qr.type} value={ans} readOnly />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Manual Adjust Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="font-bold text-slate-900">教师人工复核调分与评语</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block space-y-1">
                    <span className="text-slate-600">
                      调整最终分数（0 ~ {detail.maxScore}）
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={detail.maxScore}
                      step={0.5}
                      value={adjScore}
                      onChange={(e) => setAdjScore(Number(e.target.value))}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white tabular-nums"
                    />
                  </label>
                  <label className="sm:col-span-2 block space-y-1">
                    <span className="text-slate-600">教师评语（保存后将通知学生）</span>
                    <input
                      type="text"
                      value={adjComment}
                      onChange={(e) => setAdjComment(e.target.value)}
                      placeholder="例如：公式思路正确，个别格式微调不扣分"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap justify-between gap-2 pt-1">
                  <button
                    type="button"
                    disabled={regrading}
                    onClick={() => void handleRegrade()}
                    className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg font-medium inline-flex items-center gap-1.5"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${regrading ? 'animate-spin' : ''}`}
                    />
                    <span>重新自动判分</span>
                  </button>

                  <button
                    type="button"
                    disabled={adjusting}
                    onClick={() => void handleAdjustScore()}
                    className="h-9 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg font-medium"
                  >
                    {adjusting ? '保存中...' : '保存最终分数并通知学生'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Individual Student Analytics Modal ==================== */}
      {stuAnalytics && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 w-full max-w-xl max-h-[88vh] overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {stuAnalytics.student.realName} — 个人学情档案
                </h3>
                <p className="text-slate-500">
                  {stuAnalytics.student.grade} {stuAnalytics.student.className} · 账号{' '}
                  {stuAnalytics.student.username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStuAnalytics(null)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-slate-800">历次考试成绩轨迹</div>
              {stuAnalytics.trend.length === 0 ? (
                <div className="text-slate-400 py-4 text-center">暂无考试记录</div>
              ) : (
                <div className="space-y-2">
                  {stuAnalytics.trend.map((t, i) => (
                    <div
                      key={`${t.examId}-${i}`}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg"
                    >
                      <span className="font-medium text-slate-800 truncate pr-2">
                        {t.examTitle}
                      </span>
                      <span className="tabular-nums font-bold text-sky-700 shrink-0">
                        {t.score}/{t.maxScore} ({t.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-slate-800">个人知识点掌握度</div>
              {stuAnalytics.weakKnowledgePoints.length === 0 ? (
                <div className="text-slate-400 py-4 text-center">暂无统计数据</div>
              ) : (
                <div className="space-y-2">
                  {stuAnalytics.weakKnowledgePoints.map((kp) => (
                    <div key={kp.name} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-800">{kp.name}</span>
                        <span
                          className={`font-semibold tabular-nums ${
                            kp.masteryRate < 70 ? 'text-red-600' : 'text-teal-700'
                          }`}
                        >
                          {kp.masteryRate}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            kp.masteryRate < 70 ? 'bg-red-500' : 'bg-teal-600'
                          }`}
                          style={{ width: `${Math.max(4, kp.masteryRate)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== Remedial Practice Modal ==================== */}
      {remedialOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 w-full max-w-md space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                推送薄弱知识点 AI 补练
              </h3>
              <button
                type="button"
                onClick={() => setRemedialOpen(false)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block space-y-1">
              <span className="font-medium text-slate-700">目标薄弱知识点</span>
              <input
                type="text"
                value={remKp}
                onChange={(e) => setRemKp(e.target.value)}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-medium text-slate-700">补练题型</span>
              <select
                value={remType}
                onChange={(e) => setRemType(e.target.value as QuestionType)}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white"
              >
                <option value="word">Word 文字处理</option>
                <option value="excel">Excel 电子表格</option>
                <option value="web">网页制作</option>
                <option value="file">文件与文件夹管理</option>
              </select>
            </label>

            <div className="space-y-1.5">
              <div className="font-medium text-slate-700">
                推送学生名单（已选 {remStudentIds.length} 人）
              </div>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                {Array.from(selectableStudentsMap.values()).map((s) => {
                  const checked = remStudentIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setRemStudentIds((prev) =>
                              prev.includes(s.id)
                                ? prev.filter((id) => id !== s.id)
                                : [...prev, s.id]
                            )
                          }
                        />
                        <span className="font-medium text-slate-800">{s.realName}</span>
                        <span className="text-slate-400">{s.className}</span>
                      </div>
                      <span className="text-slate-500 tabular-nums">{s.tag}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRemedialOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                disabled={remSending}
                onClick={() => void handleSendRemedial()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-medium inline-flex items-center gap-1.5"
              >
                {remSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{remSending ? 'AI 出题并推送中...' : '生成并推送补练'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

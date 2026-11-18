'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  Copy,
  Edit3,
  Loader2,
  Plus,
  Search,
  Send,
  Shuffle,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { portalFetch } from '@/lib/api';
import {
  TYPE_LABELS,
  type ClassItem,
  type DifficultyLevel,
  type FullQuestion,
  type QuestionType,
  type TeacherExamSummary,
} from '@/lib/types';

interface SelectedExamQuestion {
  questionId: string;
  title: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  score: number;
}

interface TeacherStudentItem {
  id: string;
  username: string;
  realName: string;
  className: string;
  classId: string;
}

interface TeacherExamsTabProps {
  onOpenAnalytics: (examId: string) => void;
}

function toLocalDatetimeInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TeacherExamsTab({
  onOpenAnalytics,
}: TeacherExamsTabProps) {
  const [exams, setExams] = useState<TeacherExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Wizard State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [savingWizard, setSavingWizard] = useState(false);

  // Step 1
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(40);
  const [startTime, setStartTime] = useState(() => toLocalDatetimeInput());
  const [endTime, setEndTime] = useState(() =>
    toLocalDatetimeInput(new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString())
  );

  // Step 2: Assemble questions
  const [selectedQs, setSelectedQs] = useState<SelectedExamQuestion[]>([]);
  const [bankPool, setBankPool] = useState<FullQuestion[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [autoType, setAutoType] = useState<QuestionType | ''>('');
  const [autoDiff, setAutoDiff] = useState<DifficultyLevel | ''>('');
  const [autoCount, setAutoCount] = useState(2);
  const [quickAiType, setQuickAiType] = useState<QuestionType>('excel');
  const [quickAiPrompt, setQuickAiPrompt] = useState('');
  const [quickAiBusy, setQuickAiBusy] = useState(false);

  // Step 3: Assignments
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<TeacherStudentItem[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Step 4: Publish policies
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [scorePolicy, setScorePolicy] = useState<'highest' | 'latest'>('highest');
  const [showScoreImmediately, setShowScoreImmediately] = useState(true);
  const [showAnswerPolicy, setShowAnswerPolicy] = useState<
    'immediate' | 'after_end' | 'never'
  >('after_end');
  const [shuffle, setShuffle] = useState(false);
  const [antiCheatSwitch, setAntiCheatSwitch] = useState(true);
  const [allowLate, setAllowLate] = useState(false);

  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: '1', pageSize: '30' });
      if (statusFilter) qs.set('status', statusFilter);
      if (keyword.trim()) qs.set('keyword', keyword.trim());
      const res = await portalFetch<{ items: TeacherExamSummary[] }>(
        `/api/teacher/exams?${qs.toString()}`
      );
      setExams(res.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载考试列表失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, keyword]);

  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams({ page: '1', pageSize: '30' });
    if (statusFilter) qs.set('status', statusFilter);
    portalFetch<{ items: TeacherExamSummary[] }>(
      `/api/teacher/exams?${qs.toString()}`
    )
      .then((res) => {
        if (active) setExams(res.items);
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : '加载考试列表失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [statusFilter]);

  const loadWizardResources = async () => {
    const [qRes, cRes, sRes] = await Promise.all([
      portalFetch<{ items: FullQuestion[] }>('/api/teacher/questions?pageSize=50'),
      portalFetch<{ items: ClassItem[] }>('/api/teacher/classes'),
      portalFetch<{ items: TeacherStudentItem[] }>('/api/teacher/students'),
    ]);
    setBankPool(qRes.items);
    setClasses(cRes.items);
    setStudents(sRes.items);
  };

  const openCreateWizard = async () => {
    setErr('');
    setEditingExamId(null);
    setWizardStep(1);
    setTitle('');
    setDescription('');
    setDuration(40);
    setStartTime(toLocalDatetimeInput());
    setEndTime(
      toLocalDatetimeInput(
        new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      )
    );
    setSelectedQs([]);
    setSelectedClassIds([]);
    setSelectedStudentIds([]);
    setMaxAttempts(1);
    setScorePolicy('highest');
    setShowScoreImmediately(true);
    setShowAnswerPolicy('after_end');
    setShuffle(false);
    setAntiCheatSwitch(true);
    setAllowLate(false);
    setWizardOpen(true);
    try {
      await loadWizardResources();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载组卷数据失败');
    }
  };

  const openEditWizard = async (examId: string) => {
    setErr('');
    setWizardOpen(true);
    setWizardStep(1);
    setEditingExamId(examId);
    try {
      await loadWizardResources();
      const detail = await portalFetch<{
        exam: {
          id: string;
          title: string;
          description: string;
          duration: number;
          startTime: string;
          endTime: string;
          maxAttempts: number;
          scorePolicy: 'highest' | 'latest';
          showScoreImmediately: boolean;
          showAnswerPolicy: 'immediate' | 'after_end' | 'never';
          shuffle: boolean;
          antiCheatSwitch: boolean;
          allowLate: boolean;
        };
        questions: Array<FullQuestion & { examScore: number }>;
        assignments: Array<{ targetType: 'class' | 'student'; targetId: string }>;
      }>(`/api/teacher/exams/${examId}`);

      setTitle(detail.exam.title);
      setDescription(detail.exam.description);
      setDuration(detail.exam.duration);
      setStartTime(toLocalDatetimeInput(detail.exam.startTime));
      setEndTime(toLocalDatetimeInput(detail.exam.endTime));
      setMaxAttempts(detail.exam.maxAttempts);
      setScorePolicy(detail.exam.scorePolicy);
      setShowScoreImmediately(detail.exam.showScoreImmediately);
      setShowAnswerPolicy(detail.exam.showAnswerPolicy);
      setShuffle(detail.exam.shuffle);
      setAntiCheatSwitch(detail.exam.antiCheatSwitch);
      setAllowLate(detail.exam.allowLate);
      setSelectedQs(
        detail.questions.map((q) => ({
          questionId: q.id,
          title: q.title,
          type: q.type,
          difficulty: q.difficulty,
          score: q.examScore || q.totalScore || 100,
        }))
      );
      setSelectedClassIds(
        detail.assignments
          .filter((a) => a.targetType === 'class')
          .map((a) => a.targetId)
      );
      setSelectedStudentIds(
        detail.assignments
          .filter((a) => a.targetType === 'student')
          .map((a) => a.targetId)
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载草稿失败');
    }
  };

  const handleAddFromBank = (q: FullQuestion) => {
    if (selectedQs.some((s) => s.questionId === q.id)) return;
    setSelectedQs((prev) => [
      ...prev,
      {
        questionId: q.id,
        title: q.title,
        type: q.type,
        difficulty: q.difficulty,
        score: q.totalScore || 100,
      },
    ]);
  };

  const handleAutoPick = async () => {
    setErr('');
    try {
      const res = await portalFetch<{ questions: FullQuestion[] }>(
        '/api/teacher/exams/auto-pick',
        {
          method: 'POST',
          body: JSON.stringify({
            type: autoType,
            difficulty: autoDiff,
            count: autoCount,
            excludeIds: selectedQs.map((q) => q.questionId),
          }),
        }
      );
      if (res.questions.length === 0) {
        setErr('题库中没有更多符合条件的未选题目');
        return;
      }
      setSelectedQs((prev) => [
        ...prev,
        ...res.questions.map((q) => ({
          questionId: q.id,
          title: q.title,
          type: q.type,
          difficulty: q.difficulty,
          score: q.totalScore || 100,
        })),
      ]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '随机抽题失败');
    }
  };

  const handleQuickAiAdd = async () => {
    setQuickAiBusy(true);
    setErr('');
    try {
      const genRes = await portalFetch<{ questions: FullQuestion[] }>(
        '/api/teacher/questions/ai-generate',
        {
          method: 'POST',
          body: JSON.stringify({
            type: quickAiType,
            difficulty: '中等',
            count: 1,
            stepCount: 4,
            totalScore: 100,
            customPrompt: quickAiPrompt.trim() || undefined,
          }),
        }
      );
      const q = genRes.questions[0];
      if (!q) throw new Error('AI 未返回题目');
      const saveRes = await portalFetch<{ id: string }>('/api/teacher/questions', {
        method: 'POST',
        body: JSON.stringify({
          title: q.title,
          type: q.type,
          difficulty: q.difficulty,
          knowledgePoints: q.knowledgePoints,
          knowledgePointIds: q.knowledgePointIds || [],
          scenario: q.scenario,
          totalScore: q.totalScore,
          materials: q.materials,
          steps: q.steps,
          checkpoints: q.checkpoints,
          referenceAnswer: q.referenceAnswer,
          analysis: q.analysis,
          commonMistakes: q.commonMistakes,
          visibility: 'private',
          source: 'ai',
        }),
      });
      const savedFull: FullQuestion = { ...q, id: saveRes.id };
      setBankPool((prev) => [savedFull, ...prev]);
      setSelectedQs((prev) => [
        ...prev,
        {
          questionId: saveRes.id,
          title: q.title,
          type: q.type,
          difficulty: q.difficulty,
          score: q.totalScore || 100,
        },
      ]);
      setQuickAiPrompt('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'AI 现场出题失败');
    } finally {
      setQuickAiBusy(false);
    }
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= selectedQs.length) return;
    const copy = [...selectedQs];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
    setSelectedQs(copy);
  };

  const handleSubmitWizard = async (publishNow: boolean) => {
    setErr('');
    if (!title.trim() || title.trim().length < 2) {
      setErr('请填写至少 2 个字的考试名称');
      setWizardStep(1);
      return;
    }
    if (selectedQs.length === 0) {
      setErr('请至少选择 1 道题目');
      setWizardStep(2);
      return;
    }
    const assignments = [
      ...selectedClassIds.map((id) => ({ targetType: 'class' as const, targetId: id })),
      ...selectedStudentIds.map((id) => ({
        targetType: 'student' as const,
        targetId: id,
      })),
    ];
    if (assignments.length === 0) {
      setErr('请至少指派 1 个班级或学生');
      setWizardStep(3);
      return;
    }

    setSavingWizard(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        duration: Number(duration),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        maxAttempts: Number(maxAttempts),
        scorePolicy,
        showScoreImmediately,
        showAnswerPolicy,
        shuffle,
        antiCheatSwitch,
        allowLate,
        publishNow,
        questions: selectedQs.map((q) => ({
          questionId: q.questionId,
          score: Number(q.score) || 100,
        })),
        assignments,
      };

      if (editingExamId) {
        await portalFetch(`/api/teacher/exams/${editingExamId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await portalFetch('/api/teacher/exams', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setWizardOpen(false);
      setMsg(publishNow ? `考试「${title.trim()}」已成功发布并通知学生` : '考试草稿已保存');
      void loadExams();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存考试失败');
    } finally {
      setSavingWizard(false);
    }
  };

  const handleExamAction = async (
    action: 'publish' | 'end' | 'copy' | 'delete',
    exam: TeacherExamSummary
  ) => {
    setErr('');
    try {
      if (action === 'delete') {
        await portalFetch(`/api/teacher/exams/${exam.id}`, { method: 'DELETE' });
        setMsg(`已删除草稿「${exam.title}」`);
      } else {
        await portalFetch(`/api/teacher/exams/${exam.id}/${action}`, {
          method: 'POST',
        });
        setMsg(
          action === 'publish'
            ? `已发布考试「${exam.title}」`
            : action === 'end'
              ? `已手动结束考试「${exam.title}」`
              : `已复制为新草稿，可在列表中编辑后重新发布`
        );
      }
      void loadExams();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '操作失败');
    }
  };

  const filteredPool = bankPool.filter((q) => {
    if (!bankSearch.trim()) return true;
    const kw = bankSearch.trim().toLowerCase();
    return (
      q.title.toLowerCase().includes(kw) ||
      q.knowledgePoints.join(',').toLowerCase().includes(kw)
    );
  });

  const totalWizardScore = selectedQs.reduce((s, q) => s + (Number(q.score) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">考试与作业管理</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            创建、组卷、指派班级/学生并控制分数与解析公布策略，已发布考试仅支持查看或复制
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openCreateWizard()}
          className="h-9 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建考试</span>
        </button>
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

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-lg bg-white"
        >
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="ended">已结束</option>
        </select>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索考试名称..."
          className="h-9 px-3 border border-slate-200 rounded-lg bg-white w-48"
        />
        <button
          type="button"
          onClick={() => void loadExams()}
          className="h-9 px-3.5 bg-slate-900 text-white rounded-lg inline-flex items-center gap-1"
        >
          <Search className="w-3.5 h-3.5" />
          <span>查询</span>
        </button>
      </div>

      {/* Exams Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
          </div>
        ) : exams.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-500">
            暂无考试记录，点击右上角「新建考试」开始创建。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4 font-medium">考试名称</th>
                  <th className="py-3 px-4 font-medium">指派对象</th>
                  <th className="py-3 px-4 font-medium">题量 / 总分 / 时长</th>
                  <th className="py-3 px-4 font-medium">状态</th>
                  <th className="py-3 px-4 font-medium text-right">交卷 / 均分</th>
                  <th className="py-3 px-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{ex.title}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                        {new Date(ex.startTime).toLocaleDateString('zh-CN')} ~{' '}
                        {new Date(ex.endTime).toLocaleString('zh-CN')}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-[160px] truncate">
                      {ex.targetSummary}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-700 whitespace-nowrap">
                      {ex.questionCount} 题 · {ex.totalScore} 分 · {ex.duration} 分钟
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          ex.runtimeStatus === 'in_progress'
                            ? 'text-teal-700'
                            : ex.status === 'draft'
                              ? 'text-amber-700'
                              : ex.runtimeStatus === 'ended' || ex.status === 'ended'
                                ? 'text-slate-500'
                                : 'text-sky-700'
                        }`}
                      >
                        {ex.status === 'draft'
                          ? '草稿'
                          : ex.runtimeStatus === 'in_progress'
                            ? '进行中'
                            : ex.runtimeStatus === 'ended' || ex.status === 'ended'
                              ? '已结束'
                              : '未开始'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                      <div>
                        {ex.submittedCount} / {ex.assignedCount} 人
                      </div>
                      <div className="text-[11px] text-sky-700 font-semibold">
                        {ex.avgScore !== null ? `均分 ${ex.avgScore}` : '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2.5">
                      {ex.status === 'draft' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void openEditWizard(ex.id)}
                            className="text-sky-700 hover:underline inline-flex items-center gap-0.5"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>编辑</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleExamAction('publish', ex)}
                            className="text-teal-700 hover:underline inline-flex items-center gap-0.5"
                          >
                            <Send className="w-3 h-3" />
                            <span>发布</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleExamAction('delete', ex)}
                            className="text-red-600 hover:underline inline-flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>删除</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenAnalytics(ex.id)}
                            className="text-sky-700 hover:underline inline-flex items-center gap-0.5 font-medium"
                          >
                            <BarChart3 className="w-3 h-3" />
                            <span>成绩与学情</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleExamAction('copy', ex)}
                            className="text-slate-700 hover:underline inline-flex items-center gap-0.5"
                          >
                            <Copy className="w-3 h-3" />
                            <span>复制</span>
                          </button>
                          {ex.status === 'published' && (
                            <button
                              type="button"
                              onClick={() => void handleExamAction('end', ex)}
                              className="text-amber-700 hover:underline inline-flex items-center gap-0.5"
                            >
                              <Square className="w-3 h-3" />
                              <span>结束</span>
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== 4-Step Exam Creation/Edit Wizard ==================== */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-xs">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingExamId ? '编辑考试草稿' : '新建模拟考试'}
                </h3>
                <div className="flex items-center gap-3 mt-1.5">
                  {(
                    [
                      [1, '1. 基本信息'],
                      [2, '2. 组卷选题'],
                      [3, '3. 指派对象'],
                      [4, '4. 发布设置'],
                    ] as const
                  ).map(([num, label]) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setWizardStep(num)}
                      className={`px-2.5 py-1 rounded-lg font-medium ${
                        wizardStep === num
                          ? 'bg-sky-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setWizardOpen(false)}
                className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {err && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
                  {err}
                </div>
              )}

              {wizardStep === 1 && (
                <div className="max-w-xl space-y-4">
                  <label className="block space-y-1">
                    <span className="font-medium text-slate-700">考试名称 *</span>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="例如：高一信息技术期中综合测试"
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-medium text-slate-700">考试说明（可选）</span>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="作答注意事项与考查范围"
                      className="w-full p-2.5 border border-slate-300 rounded-lg"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block space-y-1">
                      <span className="font-medium text-slate-700">限时（分钟）</span>
                      <input
                        type="number"
                        min={5}
                        max={300}
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full h-9 px-3 border border-slate-300 rounded-lg tabular-nums"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-medium text-slate-700">开始时间</span>
                      <input
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full h-9 px-2.5 border border-slate-300 rounded-lg"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-medium text-slate-700">截止时间</span>
                      <input
                        type="datetime-local"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full h-9 px-2.5 border border-slate-300 rounded-lg"
                      />
                    </label>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left: Pick / Auto / AI */}
                  <div className="lg:col-span-6 space-y-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <Shuffle className="w-3.5 h-3.5 text-sky-600" />
                        <span>按条件随机抽题</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={autoType}
                          onChange={(e) =>
                            setAutoType(e.target.value as QuestionType | '')
                          }
                          className="h-8 px-2 border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="">不限题型</option>
                          <option value="word">Word</option>
                          <option value="excel">Excel</option>
                          <option value="web">网页制作</option>
                          <option value="file">文件管理</option>
                        </select>
                        <select
                          value={autoDiff}
                          onChange={(e) =>
                            setAutoDiff(e.target.value as DifficultyLevel | '')
                          }
                          className="h-8 px-2 border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="">不限难度</option>
                          <option value="基础">基础</option>
                          <option value="中等">中等</option>
                          <option value="提高">提高</option>
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={autoCount}
                          onChange={(e) => setAutoCount(Number(e.target.value))}
                          className="w-14 h-8 px-2 border border-slate-300 rounded-lg bg-white tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => void handleAutoPick()}
                          className="h-8 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium"
                        >
                          抽取加入
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-sky-50/50 border border-sky-200 rounded-xl space-y-2">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        <span>AI 现场出 1 道新题并入卷</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={quickAiType}
                          onChange={(e) =>
                            setQuickAiType(e.target.value as QuestionType)
                          }
                          className="h-8 px-2 border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="word">Word</option>
                          <option value="excel">Excel</option>
                          <option value="web">网页制作</option>
                          <option value="file">文件管理</option>
                        </select>
                        <input
                          type="text"
                          value={quickAiPrompt}
                          onChange={(e) => setQuickAiPrompt(e.target.value)}
                          placeholder="输入考查要求（可选）"
                          className="flex-1 h-8 px-2.5 border border-slate-300 rounded-lg bg-white"
                        />
                        <button
                          type="button"
                          disabled={quickAiBusy}
                          onClick={() => void handleQuickAiAdd()}
                          className="h-8 px-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-medium inline-flex items-center gap-1"
                        >
                          {quickAiBusy && (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                          <span>出题</span>
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">从题库挑选</span>
                        <input
                          type="text"
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                          placeholder="筛选题名/知识点"
                          className="h-7 px-2 border border-slate-200 rounded-lg w-44"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                        {filteredPool.map((q) => {
                          const added = selectedQs.some((s) => s.questionId === q.id);
                          return (
                            <div
                              key={q.id}
                              className="py-2 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-slate-800 truncate">
                                  {q.title}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {TYPE_LABELS[q.type]} · {q.difficulty}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={added}
                                onClick={() => handleAddFromBank(q)}
                                className={`px-2.5 py-1 rounded-lg shrink-0 ${
                                  added
                                    ? 'bg-slate-100 text-slate-400'
                                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium'
                                }`}
                              >
                                {added ? '已加入' : '添加'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right: Selected Questions */}
                  <div className="lg:col-span-6 border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/40">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        已选试卷题目（{selectedQs.length} 题）
                      </span>
                      <span className="font-bold text-sky-700 tabular-nums">
                        试卷总分：{totalWizardScore} 分
                      </span>
                    </div>

                    {selectedQs.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        请从左侧挑选或生成题目加入试卷
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {selectedQs.map((q, idx) => (
                          <div
                            key={q.questionId}
                            className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-900 truncate">
                                {idx + 1}. {q.title}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {TYPE_LABELS[q.type]} · {q.difficulty}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-slate-500">分值</span>
                              <input
                                type="number"
                                min={1}
                                max={500}
                                value={q.score}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setSelectedQs((prev) =>
                                    prev.map((item) =>
                                      item.questionId === q.questionId
                                        ? { ...item, score: val }
                                        : item
                                    )
                                  );
                                }}
                                className="w-16 h-7 px-2 border border-slate-300 rounded-lg text-right tabular-nums"
                              />
                              <button
                                type="button"
                                onClick={() => moveQuestion(idx, -1)}
                                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestion(idx, 1)}
                                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedQs((prev) =>
                                    prev.filter((item) => item.questionId !== q.questionId)
                                  )
                                }
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="font-bold text-slate-900">
                      按班级指派（推荐，共 {selectedClassIds.length} 个班级）
                    </div>
                    <div className="space-y-2">
                      {classes.map((c) => {
                        const checked = selectedClassIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                              checked
                                ? 'border-sky-500 bg-sky-50/70'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSelectedClassIds((prev) =>
                                    prev.includes(c.id)
                                      ? prev.filter((id) => id !== c.id)
                                      : [...prev, c.id]
                                  )
                                }
                              />
                              <span className="font-medium text-slate-900">
                                {c.grade} {c.name}
                              </span>
                            </div>
                            <span className="text-slate-500 tabular-nums">
                              {c.studentCount} 人
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="font-bold text-slate-900">
                      额外指定个别学生（已选 {selectedStudentIds.length} 人）
                    </div>
                    <div className="max-h-72 overflow-y-auto space-y-1.5">
                      {students.map((s) => {
                        const checked = selectedStudentIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSelectedStudentIds((prev) =>
                                    prev.includes(s.id)
                                      ? prev.filter((id) => id !== s.id)
                                      : [...prev, s.id]
                                  )
                                }
                              />
                              <span className="font-medium text-slate-800">
                                {s.realName}
                              </span>
                              <span className="text-slate-400 font-mono">
                                ({s.username})
                              </span>
                            </div>
                            <span className="text-slate-500">{s.className}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="max-w-xl space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block space-y-1">
                      <span className="font-medium text-slate-700">允许作答次数</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={maxAttempts}
                        onChange={(e) => setMaxAttempts(Number(e.target.value))}
                        className="w-full h-9 px-3 border border-slate-300 rounded-lg tabular-nums"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-medium text-slate-700">多次作答计分策略</span>
                      <select
                        value={scorePolicy}
                        onChange={(e) =>
                          setScorePolicy(e.target.value as 'highest' | 'latest')
                        }
                        className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="highest">取最高分</option>
                        <option value="latest">取最后一次提交</option>
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="font-medium text-slate-700">
                      参考答案与解析公布策略
                    </span>
                    <select
                      value={showAnswerPolicy}
                      onChange={(e) =>
                        setShowAnswerPolicy(
                          e.target.value as 'immediate' | 'after_end' | 'never'
                        )
                      }
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="immediate">交卷后立即公布参考答案与解析</option>
                      <option value="after_end">考试截止时间结束后公布</option>
                      <option value="never">暂不向学生公开参考答案</option>
                    </select>
                  </label>

                  <div className="space-y-2.5 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showScoreImmediately}
                        onChange={(e) => setShowScoreImmediately(e.target.checked)}
                      />
                      <span>交卷后立即向学生显示分数</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={antiCheatSwitch}
                        onChange={(e) => setAntiCheatSwitch(e.target.checked)}
                      />
                      <span>开启防切屏提醒（记录学生切出标签页次数）</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shuffle}
                        onChange={(e) => setShuffle(e.target.checked)}
                      />
                      <span>随机打乱试题顺序</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowLate}
                        onChange={(e) => setAllowLate(e.target.checked)}
                      />
                      <span>允许超过截止时间后补交（标记为迟交）</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex gap-2">
                {wizardStep > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setWizardStep((wizardStep - 1) as 1 | 2 | 3 | 4)
                    }
                    className="px-4 py-2 border border-slate-300 bg-white rounded-lg text-slate-700 font-medium"
                  >
                    上一步
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setWizardStep((wizardStep + 1) as 1 | 2 | 3 | 4)
                    }
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium"
                  >
                    下一步
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={savingWizard}
                      onClick={() => void handleSubmitWizard(false)}
                      className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-lg font-medium"
                    >
                      存为草稿
                    </button>
                    <button
                      type="button"
                      disabled={savingWizard}
                      onClick={() => void handleSubmitWizard(true)}
                      className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-medium inline-flex items-center gap-1.5"
                    >
                      {savingWizard ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>立即发布考试</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Edit,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { adminFetch } from '@/lib/api';
import {
  TYPE_LABELS,
  type DifficultyLevel,
  type QuestionType,
} from '@/lib/types';

interface AdminQuestion {
  id: string;
  title: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  knowledgePoints: string[];
  scenario: string;
  totalScore: number;
  materials: Record<string, unknown>;
  steps: Array<{ index: number; instruction: string; score: number; hint?: string }>;
  checkpoints: Array<Record<string, unknown>>;
  referenceAnswer: Record<string, unknown>;
  analysis: string[];
  commonMistakes: string[];
  status: 'draft' | 'published';
  source: 'seed' | 'ai';
  updatedAt: string;
}

export default function AdminQuestionsTab() {
  const [items, setItems] = useState<AdminQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Batch Generation Modal
  const [showGenModal, setShowGenModal] = useState(false);
  const [genType, setGenType] = useState<QuestionType>('word');
  const [genDiff, setGenDiff] = useState<DifficultyLevel>('基础');
  const [genCount, setGenCount] = useState(1);
  const [genKp, setGenKp] = useState('');
  const [genAutoPublish, setGenAutoPublish] = useState(false);
  const [jobState, setJobState] = useState<{
    id: string;
    status: string;
    completedCount: number;
    failedCount: number;
    count: number;
    errors: string[];
  } | null>(null);

  // Edit Modal (Visual + JSON)
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual');
  const [jsonText, setJsonText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadQuestions = useCallback(
    async (p = page) => {
      try {
        const qs = new URLSearchParams({ page: String(p), pageSize: '10' });
        if (keyword.trim()) qs.set('keyword', keyword.trim());
        if (typeFilter) qs.set('type', typeFilter);
        if (diffFilter) qs.set('difficulty', diffFilter);
        if (statusFilter) qs.set('status', statusFilter);
        const res = await adminFetch<{
          items: AdminQuestion[];
          total: number;
        }>(`/api/admin/questions?${qs.toString()}`);
        setItems(res.items);
        setTotal(res.total);
      } catch (e) {
        setErr(e instanceof Error ? e.message : '加载题库失败');
      } finally {
        setLoading(false);
      }
    },
    [page, keyword, typeFilter, diffFilter, statusFilter]
  );

  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams({ page: '1', pageSize: '10' });
    if (keyword.trim()) qs.set('keyword', keyword.trim());
    if (typeFilter) qs.set('type', typeFilter);
    if (diffFilter) qs.set('difficulty', diffFilter);
    if (statusFilter) qs.set('status', statusFilter);
    adminFetch<{ items: AdminQuestion[]; total: number }>(
      `/api/admin/questions?${qs.toString()}`
    )
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : '加载题库失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [typeFilter, diffFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStatus = async (q: AdminQuestion) => {
    const nextStatus = q.status === 'published' ? 'draft' : 'published';
    try {
      await adminFetch(`/api/admin/questions/${q.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setMsg(`题目“${q.title}”已${nextStatus === 'published' ? '发布' : '设为草稿'}`);
      await loadQuestions(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '修改状态失败');
    }
  };

  const handleDelete = async (q: AdminQuestion) => {
    try {
      await adminFetch(`/api/admin/questions/${q.id}`, { method: 'DELETE' });
      setMsg(`已删除题目“${q.title}”`);
      await loadQuestions(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleRegenerateAnswer = async (q: AdminQuestion) => {
    setMsg('正在调用 AI 重新生成参考答案与解析...');
    setErr('');
    try {
      await adminFetch(`/api/admin/questions/${q.id}/regenerate-answer`, {
        method: 'POST',
      });
      setMsg(`题目“${q.title}”参考答案与解析已更新并通过自检`);
      await loadQuestions(page);
    } catch (e) {
      setMsg('');
      setErr(e instanceof Error ? e.message : '重新生成失败');
    }
  };

  const startBatchGenerate = async () => {
    setErr('');
    try {
      const res = await adminFetch<{ jobId: string }>(
        '/api/admin/questions/batch-generate',
        {
          method: 'POST',
          body: JSON.stringify({
            type: genType,
            difficulty: genDiff,
            count: genCount,
            knowledgePoint: genKp.trim() || undefined,
            autoPublish: genAutoPublish,
          }),
        }
      );

      setJobState({
        id: res.jobId,
        status: 'running',
        completedCount: 0,
        failedCount: 0,
        count: genCount,
        errors: [],
      });

      const poll = setInterval(async () => {
        try {
          const j = await adminFetch<{
            id: string;
            status: string;
            completedCount: number;
            failedCount: number;
            count: number;
            errors: string[];
          }>(`/api/admin/generation-jobs/${res.jobId}`);
          setJobState(j);
          if (j.status !== 'running') {
            clearInterval(poll);
            void loadQuestions(1);
          }
        } catch {
          clearInterval(poll);
        }
      }, 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '发起批量生成失败');
    }
  };

  const openEditor = (q: AdminQuestion) => {
    setEditing(structuredClone(q));
    setEditMode('visual');
    setJsonText(JSON.stringify(q, null, 2));
  };

  const saveEditor = async () => {
    if (!editing) return;
    setSavingEdit(true);
    setErr('');
    try {
      const payload = editMode === 'json' ? JSON.parse(jsonText) : editing;
      await adminFetch(`/api/admin/questions/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setEditing(null);
      setMsg('题目修改已保存');
      await loadQuestions(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存失败，请检查 JSON 语法');
    } finally {
      setSavingEdit(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">题库与 AI 出题管理</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            支持人工编辑、发布/下架及大模型批量自动命题与自检
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setJobState(null);
            setShowGenModal(true);
          }}
          className="h-9 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 self-start whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>批量 AI 出题</span>
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

      {/* Search & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索标题、情境或知识点..."
            className="flex-1 h-8 px-3 border border-slate-200 rounded-lg"
          />
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void loadQuestions(1);
            }}
            className="h-8 px-3 bg-sky-600 text-white rounded-lg flex items-center gap-1"
          >
            <Search className="w-3.5 h-3.5" />
            <span>搜索</span>
          </button>
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white"
        >
          <option value="">全部题型</option>
          <option value="word">Word 文字处理</option>
          <option value="excel">Excel 电子表格</option>
          <option value="web">网页制作</option>
          <option value="file">文件管理</option>
        </select>
        <select
          value={diffFilter}
          onChange={(e) => setDiffFilter(e.target.value)}
          className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white"
        >
          <option value="">全部难度</option>
          <option value="基础">基础</option>
          <option value="中等">中等</option>
          <option value="提高">提高</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white"
        >
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3 font-medium">题目名称</th>
                  <th className="py-2.5 px-3 font-medium">题型</th>
                  <th className="py-2.5 px-3 font-medium">难度</th>
                  <th className="py-2.5 px-3 font-medium">来源</th>
                  <th className="py-2.5 px-3 font-medium">状态</th>
                  <th className="py-2.5 px-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-medium text-slate-900 max-w-xs truncate">
                      {q.title}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {TYPE_LABELS[q.type]}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{q.difficulty}</td>
                    <td className="py-3 px-3 text-slate-500">
                      {q.source === 'ai' ? 'AI 生成' : '内置种子'}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-medium ${
                          q.status === 'published'
                            ? 'text-teal-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {q.status === 'published' ? '已发布' : '草稿'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditor(q)}
                        className="text-sky-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        <Edit className="w-3 h-3" />
                        <span>编辑</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(q)}
                        className="text-teal-700 hover:underline"
                      >
                        {q.status === 'published' ? '下架' : '发布'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegenerateAnswer(q)}
                        className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-0.5"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>重生成答案</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(q)}
                        className="text-red-600 hover:underline inline-flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>删除</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="tabular-nums">
              第 {page} / {totalPages} 页（共 {total} 题）
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  void loadQuestions(p);
                }}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  const p = page + 1;
                  setPage(p);
                  void loadQuestions(p);
                }}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Batch Generation Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                批量 AI 智能出题
              </h3>
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-600 font-medium">题型</span>
                  <select
                    value={genType}
                    onChange={(e) => setGenType(e.target.value as QuestionType)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="word">Word 文字处理</option>
                    <option value="excel">Excel 电子表格</option>
                    <option value="web">网页制作</option>
                    <option value="file">文件管理</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600 font-medium">难度</span>
                  <select
                    value={genDiff}
                    onChange={(e) =>
                      setGenDiff(e.target.value as DifficultyLevel)
                    }
                    className="w-full h-9 px-2.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="基础">基础</option>
                    <option value="中等">中等</option>
                    <option value="提高">提高</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-600 font-medium">生成数量 (1~10)</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={genCount}
                    onChange={(e) => setGenCount(Number(e.target.value))}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600 font-medium">指定知识点（可选）</span>
                  <input
                    type="text"
                    value={genKp}
                    onChange={(e) => setGenKp(e.target.value)}
                    placeholder="如 SUM函数"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={genAutoPublish}
                  onChange={(e) => setGenAutoPublish(e.target.checked)}
                />
                <span className="text-slate-700">
                  生成并通过自检后直接发布（不勾选则存为草稿待审核）
                </span>
              </label>
            </div>

            {jobState && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-medium">
                  <span>
                    状态：
                    {jobState.status === 'running'
                      ? '正在生成与自检...'
                      : jobState.status === 'completed'
                        ? '生成任务结束'
                        : '生成失败'}
                  </span>
                  <span className="tabular-nums">
                    成功 {jobState.completedCount} / 失败 {jobState.failedCount} / 总计 {jobState.count}
                  </span>
                </div>
                {jobState.errors.length > 0 && (
                  <div className="text-red-600 space-y-1 max-h-24 overflow-y-auto">
                    {jobState.errors.map((er, i) => (
                      <div key={i}>{er}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                关闭
              </button>
              <button
                type="button"
                disabled={jobState?.status === 'running'}
                onClick={startBatchGenerate}
                className="px-4 py-2 text-xs bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg font-medium flex items-center gap-1.5"
              >
                {jobState?.status === 'running' && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>开始生成</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual + JSON Question Editor Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-slate-900">
                  编辑题目
                </h3>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setEditMode('visual')}
                    className={`px-3 py-1 rounded-md font-medium ${
                      editMode === 'visual'
                        ? 'bg-white text-sky-700 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    可视化表单
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setJsonText(JSON.stringify(editing, null, 2));
                      setEditMode('json');
                    }}
                    className={`px-3 py-1 rounded-md font-medium ${
                      editMode === 'json'
                        ? 'bg-white text-sky-700 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    JSON 源码
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4">
              {editMode === 'visual' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="sm:col-span-2 space-y-1">
                      <span className="text-slate-600 font-medium">题目标题</span>
                      <input
                        type="text"
                        value={editing.title}
                        onChange={(e) =>
                          setEditing({ ...editing, title: e.target.value })
                        }
                        className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-600 font-medium">难度</span>
                      <select
                        value={editing.difficulty}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            difficulty: e.target.value as DifficultyLevel,
                          })
                        }
                        className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="基础">基础</option>
                        <option value="中等">中等</option>
                        <option value="提高">提高</option>
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-slate-600 font-medium">题目情境</span>
                    <textarea
                      rows={3}
                      value={editing.scenario}
                      onChange={(e) =>
                        setEditing({ ...editing, scenario: e.target.value })
                      }
                      className="w-full p-2.5 border border-slate-300 rounded-lg"
                    />
                  </label>

                  <div className="space-y-2">
                    <span className="text-slate-600 font-medium block">
                      分步任务要求
                    </span>
                    {editing.steps.map((st, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2 items-start bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                      >
                        <span className="font-semibold text-sky-700 pt-1 shrink-0">
                          步骤 {st.index}
                        </span>
                        <input
                          type="text"
                          value={st.instruction}
                          onChange={(e) => {
                            const nextSteps = [...editing.steps];
                            nextSteps[idx] = {
                              ...st,
                              instruction: e.target.value,
                            };
                            setEditing({ ...editing, steps: nextSteps });
                          }}
                          className="flex-1 h-8 px-2.5 border border-slate-300 rounded bg-white"
                        />
                        <input
                          type="number"
                          value={st.score}
                          onChange={(e) => {
                            const nextSteps = [...editing.steps];
                            nextSteps[idx] = {
                              ...st,
                              score: Number(e.target.value),
                            };
                            setEditing({ ...editing, steps: nextSteps });
                          }}
                          className="w-16 h-8 px-2 border border-slate-300 rounded bg-white text-right tabular-nums"
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <textarea
                  rows={22}
                  spellCheck={false}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl font-mono text-xs bg-slate-950 text-slate-100"
                />
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={saveEditor}
                className="px-4 py-2 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium"
              >
                {savingEdit ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

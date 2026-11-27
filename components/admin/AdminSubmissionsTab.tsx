'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import SimulatorRenderer from '@/components/simulators/SimulatorRenderer';
import { adminFetch, getAdminToken } from '@/lib/api';
import {
  TYPE_LABELS,
  type CheckpointResult,
  type QuestionType,
  type SimulatorState,
} from '@/lib/types';

interface AdminSubmissionItem {
  id: string;
  studentName: string;
  username: string;
  grade: string;
  className: string;
  studentNo: string;
  questionId: string;
  questionTitle: string;
  questionType: QuestionType;
  autoScore: number;
  finalScore: number;
  maxScore: number;
  durationSeconds: number;
  teacherComment: string;
  createdAt: string;
}

interface SubmissionDetail extends AdminSubmissionItem {
  answer: SimulatorState;
  checkpointResults: CheckpointResult[];
}

export default function AdminSubmissionsTab() {
  const [items, setItems] = useState<AdminSubmissionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [studentKeyword, setStudentKeyword] = useState('');
  const [className, setClassName] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [adjustScore, setAdjustScore] = useState(0);
  const [teacherComment, setTeacherComment] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  const loadList = useCallback(
    async (p = page) => {
      try {
        const qs = new URLSearchParams({ page: String(p), pageSize: '12' });
        if (studentKeyword.trim()) qs.set('studentKeyword', studentKeyword.trim());
        if (className.trim()) qs.set('className', className.trim());
        if (typeFilter) qs.set('type', typeFilter);
        if (startDate) qs.set('startDate', startDate);
        if (endDate) qs.set('endDate', endDate);
        const res = await adminFetch<{
          items: AdminSubmissionItem[];
          total: number;
        }>(`/api/admin/submissions?${qs.toString()}`);
        setItems(res.items);
        setTotal(res.total);
      } catch (e) {
        setErr(e instanceof Error ? e.message : '加载提交记录失败');
      } finally {
        setLoading(false);
      }
    },
    [page, studentKeyword, className, typeFilter, startDate, endDate]
  );

  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams({ page: '1', pageSize: '12' });
    if (studentKeyword.trim()) qs.set('studentKeyword', studentKeyword.trim());
    if (className.trim()) qs.set('className', className.trim());
    if (typeFilter) qs.set('type', typeFilter);
    if (startDate) qs.set('startDate', startDate);
    if (endDate) qs.set('endDate', endDate);
    adminFetch<{ items: AdminSubmissionItem[]; total: number }>(
      `/api/admin/submissions?${qs.toString()}`
    )
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : '加载提交记录失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (id: string) => {
    try {
      const res = await adminFetch<{ submission: SubmissionDetail }>(
        `/api/admin/submissions/${id}`
      );
      setDetail(res.submission);
      setAdjustScore(res.submission.finalScore);
      setTeacherComment(res.submission.teacherComment || '');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载详情失败');
    }
  };

  const handleSaveAdjust = async () => {
    if (!detail) return;
    setSavingAdjust(true);
    try {
      await adminFetch(`/api/admin/submissions/${detail.id}/adjust-score`, {
        method: 'PUT',
        body: JSON.stringify({
          finalScore: Number(adjustScore),
          teacherComment,
        }),
      });
      setMsg('已更新评分与评语');
      setDetail(null);
      await loadList(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '调分失败');
    } finally {
      setSavingAdjust(false);
    }
  };

  const handleRegrade = async (id: string) => {
    try {
      await adminFetch(`/api/admin/submissions/${id}/regrade`, {
        method: 'POST',
      });
      setMsg('已完成重新自动判分');
      if (detail?.id === id) {
        await openDetail(id);
      }
      await loadList(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '重判失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminFetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
      setMsg('已删除提交记录');
      await loadList(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleExportCsv = async () => {
    try {
      const token = getAdminToken();
      const resp = await fetch('/api/admin/submissions/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error('导出失败');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `student_submissions_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '导出 CSV 失败');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">学生提交记录管理</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            查看学生作答明细、人工调分写评语、重新自动判分或导出成绩单
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1.5 self-start whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>导出 CSV 表格</span>
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

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs">
        <input
          type="text"
          value={studentKeyword}
          onChange={(e) => setStudentKeyword(e.target.value)}
          placeholder="学生姓名/账号"
          className="h-8 px-3 border border-slate-200 rounded-lg w-36"
        />
        <input
          type="text"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder="班级"
          className="h-8 px-3 border border-slate-200 rounded-lg w-28"
        />
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
          <option value="python">Python 程序设计</option>
          <option value="database">数据库与 SQL 查询</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-8 px-2 border border-slate-200 rounded-lg"
        />
        <span className="text-slate-400">至</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-8 px-2 border border-slate-200 rounded-lg"
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            void loadList(1);
          }}
          className="h-8 px-3 bg-sky-600 text-white rounded-lg flex items-center gap-1"
        >
          <Search className="w-3.5 h-3.5" />
          <span>查询</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            暂无提交记录
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3 font-medium">学生</th>
                  <th className="py-2.5 px-3 font-medium">班级</th>
                  <th className="py-2.5 px-3 font-medium">题目</th>
                  <th className="py-2.5 px-3 font-medium">题型</th>
                  <th className="py-2.5 px-3 font-medium text-right">得分</th>
                  <th className="py-2.5 px-3 font-medium">提交时间</th>
                  <th className="py-2.5 px-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {s.studentName} ({s.username})
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {s.grade} {s.className}
                    </td>
                    <td className="py-3 px-3 text-slate-800 max-w-[200px] truncate">
                      {s.questionTitle}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {TYPE_LABELS[s.questionType]}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold tabular-nums text-sky-700">
                      {s.finalScore} / {s.maxScore}
                    </td>
                    <td className="py-3 px-3 tabular-nums text-slate-500">
                      {new Date(s.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-3 px-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openDetail(s.id)}
                        className="text-sky-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        <Eye className="w-3 h-3" />
                        <span>详情/调分</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegrade(s.id)}
                        className="text-teal-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>重判</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
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
              第 {page} / {totalPages} 页（共 {total} 条）
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  void loadList(p);
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
                  void loadList(p);
                }}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Submission Detail & Score Adjustment Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {detail.studentName} · {detail.questionTitle}
                </h3>
                <p className="text-xs text-slate-500">
                  {detail.grade} {detail.className} · 系统自动判分{' '}
                  {detail.autoScore}/{detail.maxScore}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 space-y-4">
                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-900">
                    得分点判定明细
                  </h4>
                  <div className="divide-y divide-slate-100 text-xs">
                    {detail.checkpointResults.map((cp) => (
                      <div
                        key={cp.checkpointId}
                        className="py-2 flex items-start justify-between gap-2"
                      >
                        <div className="flex items-start gap-1.5">
                          {cp.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-medium text-slate-900">
                              {cp.description}
                            </div>
                            <div className="text-slate-500">{cp.feedback}</div>
                          </div>
                        </div>
                        <span className="font-semibold tabular-nums shrink-0">
                          {cp.earnedScore}/{cp.maxScore}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                  <h4 className="font-semibold text-slate-900">
                    人工复核调分与评语
                  </h4>
                  <label className="block space-y-1">
                    <span className="text-slate-600">
                      最终分数（0 ~ {detail.maxScore}）
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={detail.maxScore}
                      value={adjustScore}
                      onChange={(e) => setAdjustScore(Number(e.target.value))}
                      className="w-full h-9 px-3 border border-slate-300 rounded-lg tabular-nums"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-slate-600">教师评语</span>
                    <textarea
                      rows={3}
                      value={teacherComment}
                      onChange={(e) => setTeacherComment(e.target.value)}
                      placeholder="填写操作改进建议..."
                      className="w-full p-2.5 border border-slate-300 rounded-lg"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingAdjust}
                    onClick={handleSaveAdjust}
                    className="w-full h-9 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium"
                  >
                    {savingAdjust ? '保存中...' : '保存调分结果'}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 h-[460px] border border-slate-200 rounded-xl overflow-hidden">
                <SimulatorRenderer
                  type={detail.questionType}
                  value={detail.answer}
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

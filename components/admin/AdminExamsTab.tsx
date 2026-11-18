'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Loader2, Search, X } from 'lucide-react';
import { adminFetch } from '@/lib/api';

interface AdminExamItem {
  id: string;
  title: string;
  teacherName: string;
  status: string;
  duration: number;
  startTime: string;
  endTime: string;
  questionCount: number;
  totalScore: number;
  submissionCount: number;
  avgScore: number | null;
  createdAt: string;
}

interface AdminExamResultItem {
  id: string;
  studentName: string;
  username: string;
  className: string;
  studentNo: string;
  attemptNo: number;
  finalScore: number;
  maxScore: number;
  switchCount: number;
  isLate: boolean;
  submittedAt: string;
}

export default function AdminExamsTab() {
  const [items, setItems] = useState<AdminExamItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [detail, setDetail] = useState<{
    exam: { id: string; title: string; teacherName: string };
    items: AdminExamResultItem[];
  } | null>(null);

  const load = useCallback(
    async (p = page) => {
      setLoading(true);
      setErr('');
      try {
        const qs = new URLSearchParams({
          page: String(p),
          pageSize: '12',
        });
        if (keyword.trim()) qs.set('keyword', keyword.trim());
        const res = await adminFetch<{
          items: AdminExamItem[];
          total: number;
          page: number;
        }>(`/api/admin/exams?${qs.toString()}`);
        setItems(res.items);
        setTotal(res.total);
        setPage(res.page);
      } catch (e) {
        setErr(e instanceof Error ? e.message : '加载全校考试监控失败');
      } finally {
        setLoading(false);
      }
    },
    [keyword, page]
  );

  useEffect(() => {
    let active = true;
    adminFetch<{ items: AdminExamItem[]; total: number; page: number }>(
      '/api/admin/exams?page=1&pageSize=12'
    )
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
        setPage(res.page);
      })
      .catch((e) => {
        if (active) {
          setErr(e instanceof Error ? e.message : '加载全校考试监控失败');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openResults = async (examId: string) => {
    setErr('');
    try {
      const res = await adminFetch<{
        exam: { id: string; title: string; teacherName: string };
        items: AdminExamResultItem[];
      }>(`/api/admin/exams/${examId}/results`);
      setDetail(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载考试交卷详情失败');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">全局考试监控</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          统一督查全站各教师发布的模拟考试进度、交卷情况与平均成绩
        </p>
      </div>

      {err && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {err}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索考试名称或教师姓名..."
          className="h-9 px-3 border border-slate-200 rounded-lg w-64 bg-white"
        />
        <button
          type="button"
          onClick={() => void load(1)}
          className="h-9 px-4 bg-slate-900 text-white rounded-lg inline-flex items-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          <span>查询</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            暂无符合条件的考试记录
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4 font-medium">考试名称</th>
                  <th className="py-3 px-4 font-medium">命题教师</th>
                  <th className="py-3 px-4 font-medium">题量 / 总分</th>
                  <th className="py-3 px-4 font-medium">状态</th>
                  <th className="py-3 px-4 font-medium text-right">交卷 / 均分</th>
                  <th className="py-3 px-4 font-medium">截止时间</th>
                  <th className="py-3 px-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {ex.title}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{ex.teacherName}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      {ex.questionCount} 题 / {ex.totalScore} 分
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-medium ${
                          ex.status === 'published'
                            ? 'text-teal-700'
                            : ex.status === 'ended'
                              ? 'text-slate-500'
                              : 'text-amber-700'
                        }`}
                      >
                        {ex.status === 'published'
                          ? '已发布'
                          : ex.status === 'ended'
                            ? '已结束'
                            : '草稿'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span className="text-slate-800">{ex.submissionCount} 份</span>
                      {ex.avgScore !== null && (
                        <span className="text-sky-700 font-semibold ml-1.5">
                          (均分 {ex.avgScore})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-500">
                      {new Date(ex.endTime).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => void openResults(ex.id)}
                        className="text-sky-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>查看交卷</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              共 {total} 场考试 · 第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => void load(page - 1)}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => void load(page + 1)}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden text-xs">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {detail.exam.title} — 交卷记录（{detail.items.length} 份）
                </h3>
                <p className="text-slate-500">命题教师：{detail.exam.teacherName}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-1 text-slate-500 hover:bg-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detail.items.length === 0 ? (
                <div className="py-10 text-center text-slate-400">暂无学生交卷</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-3">姓名</th>
                      <th className="py-2 px-3">班级</th>
                      <th className="py-2 px-3 text-right">得分</th>
                      <th className="py-2 px-3 text-right">切屏</th>
                      <th className="py-2 px-3">状态</th>
                      <th className="py-2 px-3">提交时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.items.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {r.studentName} ({r.username})
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{r.className}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-sky-700">
                          {r.finalScore} / {r.maxScore}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {r.switchCount}
                        </td>
                        <td className="py-2.5 px-3">
                          {r.isLate ? '迟交' : '正常'}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-500">
                          {new Date(r.submittedAt).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

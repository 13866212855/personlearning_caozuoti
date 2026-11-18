'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart2, KeyRound, Loader2, Search, X } from 'lucide-react';
import { adminFetch } from '@/lib/api';
import { TYPE_LABELS, type QuestionType } from '@/lib/types';

interface AdminStudentItem {
  id: string;
  username: string;
  realName: string;
  grade: string;
  className: string;
  isDisabled: boolean;
  practiceCount: number;
  avgScore: number;
  createdAt: string;
}

export default function AdminStudentsTab() {
  const [items, setItems] = useState<AdminStudentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [resetTarget, setResetTarget] = useState<AdminStudentItem | null>(null);
  const [newPwd, setNewPwd] = useState('');

  const [statsTarget, setStatsTarget] = useState<{
    student: { realName: string; username: string; grade: string; className: string };
    recentSubmissions: Array<{
      id: string;
      title: string;
      type: QuestionType;
      finalScore: number;
      maxScore: number;
      createdAt: string;
    }>;
  } | null>(null);

  const loadStudents = useCallback(
    async (p = page) => {
      try {
        const qs = new URLSearchParams({ page: String(p), pageSize: '12' });
        if (keyword.trim()) qs.set('keyword', keyword.trim());
        const res = await adminFetch<{
          items: AdminStudentItem[];
          total: number;
        }>(`/api/admin/students?${qs.toString()}`);
        setItems(res.items);
        setTotal(res.total);
      } catch (e) {
        setErr(e instanceof Error ? e.message : '加载学生列表失败');
      } finally {
        setLoading(false);
      }
    },
    [page, keyword]
  );

  useEffect(() => {
    let active = true;
    adminFetch<{ items: AdminStudentItem[]; total: number }>(
      '/api/admin/students?page=1&pageSize=12'
    )
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : '加载学生列表失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleDisable = async (st: AdminStudentItem) => {
    try {
      await adminFetch(`/api/admin/students/${st.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isDisabled: !st.isDisabled }),
      });
      setMsg(
        `已${!st.isDisabled ? '禁用' : '启用'}学生账号“${st.realName}”`
      );
      await loadStudents(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleResetPwd = async () => {
    if (!resetTarget || newPwd.length < 6) {
      setErr('新密码不能少于 6 位');
      return;
    }
    try {
      await adminFetch(`/api/admin/students/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: newPwd }),
      });
      setMsg(`已重置学生“${resetTarget.realName}”的登录密码`);
      setResetTarget(null);
      setNewPwd('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '重置失败');
    }
  };

  const openStats = async (id: string) => {
    try {
      const res = await adminFetch<{
        student: { realName: string; username: string; grade: string; className: string };
        recentSubmissions: Array<{
          id: string;
          title: string;
          type: QuestionType;
          finalScore: number;
          maxScore: number;
          createdAt: string;
        }>;
      }>(`/api/admin/students/${id}/stats`);
      setStatsTarget(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '读取统计失败');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">学生账号管理</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          管理注册学生账号、密码重置、启用/禁用状态及练习统计
        </p>
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

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2 text-xs">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索学生姓名、用户名或班级..."
          className="flex-1 max-w-sm h-8 px-3 border border-slate-200 rounded-lg"
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            void loadStudents(1);
          }}
          className="h-8 px-3 bg-sky-600 text-white rounded-lg flex items-center gap-1"
        >
          <Search className="w-3.5 h-3.5" />
          <span>搜索</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            暂无学生账号
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3 font-medium">姓名</th>
                  <th className="py-2.5 px-3 font-medium">用户名</th>
                  <th className="py-2.5 px-3 font-medium">年级班级</th>
                  <th className="py-2.5 px-3 font-medium text-right">练习次数</th>
                  <th className="py-2.5 px-3 font-medium text-right">平均得分率</th>
                  <th className="py-2.5 px-3 font-medium">状态</th>
                  <th className="py-2.5 px-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {st.realName}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {st.username}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {st.grade} {st.className}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {st.practiceCount}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-sky-700 font-semibold">
                      {st.avgScore}%
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={
                          st.isDisabled
                            ? 'text-red-600 font-medium'
                            : 'text-teal-700 font-medium'
                        }
                      >
                        {st.isDisabled ? '已禁用' : '正常'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openStats(st.id)}
                        className="text-sky-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        <BarChart2 className="w-3 h-3" />
                        <span>练习统计</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetTarget(st);
                          setNewPwd('');
                        }}
                        className="text-slate-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>重置密码</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDisable(st)}
                        className={
                          st.isDisabled
                            ? 'text-teal-700 hover:underline'
                            : 'text-red-600 hover:underline'
                        }
                      >
                        {st.isDisabled ? '启用' : '禁用'}
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
              第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  void loadStudents(p);
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
                  void loadStudents(p);
                }}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              重置密码 - {resetTarget.realName}
            </h3>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="输入新密码（至少 6 位）"
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleResetPwd}
                className="px-4 py-2 text-xs bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Stats Modal */}
      {statsTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {statsTarget.student.realName} 的近期练习记录
                </h3>
                <p className="text-xs text-slate-500">
                  {statsTarget.student.grade} {statsTarget.student.className} ·{' '}
                  {statsTarget.student.username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatsTarget(null)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-xs">
              {statsTarget.recentSubmissions.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  暂无提交记录
                </div>
              ) : (
                statsTarget.recentSubmissions.map((s) => (
                  <div
                    key={s.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{s.title}</div>
                      <div className="text-slate-500">
                        {TYPE_LABELS[s.type]} ·{' '}
                        {new Date(s.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <span className="font-semibold text-sky-700 tabular-nums">
                      {s.finalScore} / {s.maxScore}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

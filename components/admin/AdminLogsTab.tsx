'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminFetch } from '@/lib/api';

interface LogItem {
  id: string;
  adminUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export default function AdminLogsTab() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async (p: number) => {
    try {
      const res = await adminFetch<{ items: LogItem[]; total: number }>(
        `/api/admin/logs?page=${p}&pageSize=15`
      );
      setItems(res.items);
      setTotal(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    adminFetch<{ items: LogItem[]; total: number }>(
      '/api/admin/logs?page=1&pageSize=15'
    )
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">后台操作审计日志</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          记录管理员对模型配置、题库、学生成绩及账号的关键操作
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            暂无操作日志
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3 font-medium">时间</th>
                  <th className="py-2.5 px-3 font-medium">操作人</th>
                  <th className="py-2.5 px-3 font-medium">动作</th>
                  <th className="py-2.5 px-3 font-medium">目标对象</th>
                  <th className="py-2.5 px-3 font-medium">详情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 tabular-nums text-slate-500 whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {l.adminUsername}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-sky-700">
                      {l.action}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {l.targetType}:{l.targetId}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{l.details}</td>
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
                  void loadLogs(p);
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
                  void loadLogs(p);
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
  );
}

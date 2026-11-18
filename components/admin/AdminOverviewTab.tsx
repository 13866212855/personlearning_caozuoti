'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminFetch } from '@/lib/api';
import { TYPE_LABELS, type QuestionType } from '@/lib/types';

interface OverviewData {
  studentCount: number;
  questionTotal: number;
  publishedCount: number;
  submissionTotal: number;
  avgScore: number;
  submissionsByType: Array<{
    type: QuestionType;
    count: number;
    avgScore: number;
  }>;
}

export default function AdminOverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch<OverviewData>('/api/admin/overview')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-sm text-red-600">加载数据概览失败</div>
    );
  }

  const maxCount = Math.max(
    1,
    ...data.submissionsByType.map((s) => s.count)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">系统数据概览</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          实时统计学生规模、题库建设及操作题作答情况
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">注册学生总数</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {data.studentCount}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">题库总数（已发布）</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {data.questionTotal}{' '}
            <span className="text-sm font-normal text-teal-700">
              ({data.publishedCount})
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">累计提交次数</div>
          <div className="text-2xl font-bold text-sky-700 mt-1 tabular-nums">
            {data.submissionTotal}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">全站平均得分率</div>
          <div className="text-2xl font-bold text-teal-700 mt-1 tabular-nums">
            {data.avgScore}%
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">
          各题型提交量与平均得分率
        </h3>
        <div className="space-y-4">
          {data.submissionsByType.map((item) => (
            <div key={item.type} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-800">
                  {TYPE_LABELS[item.type]}
                </span>
                <span className="text-slate-600 tabular-nums">
                  {item.count} 次提交 · 平均 {item.avgScore}%
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-600 rounded-full transition-all"
                  style={{
                    width: `${Math.max(item.count > 0 ? 4 : 0, (item.count / maxCount) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

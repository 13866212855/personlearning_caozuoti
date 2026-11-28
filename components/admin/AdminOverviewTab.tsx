'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminFetch } from '@/lib/api';
import { SUBJECT_LABELS, getSubjectForType } from '@/lib/subjects';
import { TYPE_LABELS, type QuestionType, type SubjectId } from '@/lib/types';

interface OverviewData {
  studentCount: number;
  teacherCount?: number;
  classCount?: number;
  examTotal?: number;
  questionTotal: number;
  publishedCount: number;
  submissionTotal: number;
  avgScore: number;
  submissionsByType: Array<{
    type: QuestionType;
    subjectId?: SubjectId;
    count: number;
    avgScore: number;
  }>;
}

export default function AdminOverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<'all' | SubjectId>('all');

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

  const visibleTypes = data.submissionsByType.filter((item) => {
    if (subjectFilter === 'all') return true;
    const sub = item.subjectId || getSubjectForType(item.type);
    return sub === subjectFilter;
  });

  const maxCount = Math.max(1, ...visibleTypes.map((s) => s.count));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">系统数据概览</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          实时统计学生规模、多学科题库建设及操作题作答情况
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">教师 / 班级 / 学生规模</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {data.studentCount}{' '}
            <span className="text-xs font-normal text-slate-500">
              生 · {data.teacherCount ?? 0} 师 / {data.classCount ?? 0} 班
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">题库总数（已发布）/ 考试场次</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {data.questionTotal}{' '}
            <span className="text-xs font-normal text-teal-700">
              ({data.publishedCount}) · {data.examTotal ?? 0} 场考
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">累计交卷与练习次数</div>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            各题型提交量与平均得分率
          </h3>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            {(
              [
                { id: 'all', label: '全部题型' },
                { id: 'it', label: '高中信息技术' },
                { id: 'gt', label: '高中通用技术' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubjectFilter(t.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  subjectFilter === t.id
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {visibleTypes.map((item) => {
            const sub = item.subjectId || getSubjectForType(item.type);
            return (
              <div key={item.type} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">
                    {TYPE_LABELS[item.type] || item.type}
                    <span className="text-[11px] font-normal text-slate-400 ml-1.5">
                      · {SUBJECT_LABELS[sub]}
                    </span>
                  </span>
                  <span className="text-slate-600 tabular-nums">
                    {item.count} 次提交 · 平均 {item.avgScore}%
                  </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      sub === 'gt' ? 'bg-teal-600' : 'bg-sky-600'
                    }`}
                    style={{
                      width: `${Math.max(item.count > 0 ? 4 : 0, (item.count / maxCount) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookPlus,
  ClipboardPlus,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { portalFetch } from '@/lib/api';

interface OverviewResponse {
  classCount: number;
  studentCount: number;
  activeExamCount: number;
  totalExamCount: number;
  recentAvgScoreRate: number;
  aiQuota: { used: number; limit: number; remaining: number };
  classes: Array<{ id: string; name: string; grade: string; invite_code: string }>;
  recentExams: Array<{
    id: string;
    title: string;
    status: string;
    startTime: string;
    endTime: string;
    assignedCount: number;
    submittedCount: number;
    avgPct: number | null;
  }>;
}

interface TeacherOverviewTabProps {
  onNavigateTab: (
    tab: 'overview' | 'classes' | 'studio' | 'exams' | 'analytics' | 'settings',
    examId?: string
  ) => void;
}

export default function TeacherOverviewTab({
  onNavigateTab,
}: TeacherOverviewTabProps) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let active = true;
    portalFetch<OverviewResponse>('/api/teacher/overview')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : '加载工作台失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
        {err || '无法加载教师工作台数据'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">教学工作台概览</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            管理名下班级学生、按知识点智能出题、组织模拟考试并追踪薄弱环节
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateTab('studio')}
            className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
          >
            <BookPlus className="w-3.5 h-3.5 text-sky-600" />
            <span>出题 / 分配试题</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('exams')}
            className="h-9 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
          >
            <ClipboardPlus className="w-3.5 h-3.5" />
            <span>新建考试</span>
          </button>
        </div>
      </div>

      {data.totalExamCount === 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div>
            <div className="font-bold">提示：您当前尚未向名下班级分配或发布任何试题</div>
            <p className="text-amber-800 mt-0.5">
              归属于您名下班级的学生登录后，只会看到您已发布并分配给对应班级的试题或考试。您可以直接前往题库勾选试题分配给学生。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('studio')}
            className="h-8 px-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium whitespace-nowrap self-start sm:self-center"
          >
            去题库分配试题
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">进行中 / 待截止考试</div>
          <div className="text-2xl font-bold text-sky-700 mt-1 tabular-nums">
            {data.activeExamCount}{' '}
            <span className="text-xs font-normal text-slate-500">
              / 共 {data.totalExamCount} 场
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">近期考试平均得分率</div>
          <div className="text-2xl font-bold text-teal-700 mt-1 tabular-nums">
            {data.recentAvgScoreRate}%
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">名下班级与学生</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {data.studentCount}{' '}
            <span className="text-xs font-normal text-slate-500">
              名学生（{data.classCount} 个班级）
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>今日 AI 出题可用额度</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {data.aiQuota.remaining}{' '}
            <span className="text-xs font-normal text-slate-500">
              / {data.aiQuota.limit} 题
            </span>
          </div>
        </div>
      </div>

      {/* Recent Exams */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">近期考试动态</h3>
          <button
            type="button"
            onClick={() => onNavigateTab('exams')}
            className="text-xs text-sky-700 hover:underline inline-flex items-center gap-1"
          >
            <span>查看全部考试</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {data.recentExams.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            暂未创建模拟考试，点击右上角「新建考试」开始组卷发布。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3 font-medium">考试名称</th>
                  <th className="py-2.5 px-3 font-medium">状态</th>
                  <th className="py-2.5 px-3 font-medium text-right">
                    提交进度
                  </th>
                  <th className="py-2.5 px-3 font-medium text-right">
                    平均得分率
                  </th>
                  <th className="py-2.5 px-3 font-medium">截止时间</th>
                  <th className="py-2.5 px-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentExams.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {e.title}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-medium ${
                          e.status === 'published'
                            ? 'text-teal-700'
                            : e.status === 'ended'
                              ? 'text-slate-500'
                              : 'text-amber-700'
                        }`}
                      >
                        {e.status === 'published'
                          ? '已发布'
                          : e.status === 'ended'
                            ? '已结束'
                            : '草稿'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700">
                      {e.submittedCount} / {e.assignedCount} 人
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-sky-700">
                      {e.avgPct !== null ? `${e.avgPct}%` : '-'}
                    </td>
                    <td className="py-3 px-3 tabular-nums text-slate-500">
                      {new Date(e.endTime).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onNavigateTab('analytics', e.id)}
                        className="text-sky-700 font-medium hover:underline"
                      >
                        成绩与学情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

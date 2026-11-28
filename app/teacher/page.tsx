'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import TeacherAnalyticsTab from '@/components/teacher/TeacherAnalyticsTab';
import TeacherClassesTab from '@/components/teacher/TeacherClassesTab';
import TeacherExamsTab from '@/components/teacher/TeacherExamsTab';
import TeacherOverviewTab from '@/components/teacher/TeacherOverviewTab';
import TeacherQuestionStudioTab from '@/components/teacher/TeacherQuestionStudioTab';
import TeacherSettingsTab from '@/components/teacher/TeacherSettingsTab';
import { useAuthConfig } from '@/hooks/useAuthConfig';
import {
  clearPortalToken,
  getCachedPortalUser,
  getPortalToken,
  portalFetch,
  setCachedPortalUser,
} from '@/lib/api';
import { SUBJECT_LABELS } from '@/lib/subjects';
import type { PortalUser } from '@/lib/types';

type TeacherTab =
  | 'overview'
  | 'classes'
  | 'studio'
  | 'exams'
  | 'analytics'
  | 'settings';

export default function TeacherWorkbenchPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<PortalUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<TeacherTab>('overview');
  const [analyticsExamId, setAnalyticsExamId] = useState<string | undefined>(
    undefined
  );
  const [dismissPwdBanner, setDismissPwdBanner] = useState(false);
  const auth = useAuthConfig();

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;

      const token = getPortalToken();
      if (!token) {
        setChecking(false);
        router.replace('/login');
        return;
      }

      const cached = getCachedPortalUser();
      if (cached?.role === 'teacher') {
        setTeacher((prev) => prev ?? cached);
      }

      try {
        const res = await portalFetch<{ user: PortalUser }>('/api/auth/me');
        if (!active) return;
        setCachedPortalUser(res.user);
        if (res.user.role === 'student') {
          router.replace('/');
          return;
        }
        if (res.user.role !== 'teacher') {
          clearPortalToken();
          router.replace('/login');
          return;
        }
        setTeacher(res.user);
      } catch {
        if (active) {
          clearPortalToken();
          router.replace('/login');
        }
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  const handleLogout = () => {
    clearPortalToken();
    router.push('/login');
  };

  if (!teacher) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-3">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
        <p className="text-sm text-slate-600">
          {checking ? '正在进入教师教学工作台...' : '正在前往登录页面...'}
        </p>
      </div>
    );
  }

  const menuItems: Array<{
    id: TeacherTab;
    label: string;
    icon: typeof LayoutDashboard;
  }> = [
    { id: 'overview', label: '工作台首页', icon: LayoutDashboard },
    { id: 'classes', label: '班级与学生', icon: Users },
    { id: 'studio', label: '出题中心', icon: Sparkles },
    { id: 'exams', label: '考试管理', icon: ClipboardList },
    { id: 'analytics', label: '成绩与学情', icon: BarChart3 },
    { id: 'settings', label: '个人设置', icon: Settings },
  ];

  const handleNavigate = (tab: TeacherTab, examId?: string) => {
    if (examId) setAnalyticsExamId(examId);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header (Strictly NO admin links or default password hints) */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 text-base font-bold text-slate-900">
          <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span>{auth?.siteTitle || '高中会考实操练习与测评系统'} · 教师工作台</span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-600 hidden sm:inline">
            <BookOpen className="w-3.5 h-3.5 inline mr-1 text-sky-600" />
            {teacher.realName} 老师（{teacher.username}） ·{' '}
            {teacher.subjectId ? SUBJECT_LABELS[teacher.subjectId] : '全学科'}
          </span>
          {auth?.mode === 'platform' && auth.platformWebUrl && (
            <a
              href={auth.platformWebUrl}
              className="text-slate-600 hover:text-sky-700"
            >
              返回平台
            </a>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>退出登录</span>
          </button>
        </div>
      </header>

      {/* Gentle Default Password Reminder */}
      {teacher.mustChangePassword && !dismissPwdBanner && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between gap-4 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              系统检测到您当前仍在使用初始密码，为了保障班级与学生数据安全，建议尽快前往「个人设置」修改登录密码。
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="font-semibold text-amber-950 underline"
            >
              立即修改
            </button>
            <button
              type="button"
              onClick={() => setDismissPwdBanner(true)}
              className="text-amber-700 hover:text-amber-900"
            >
              稍后提醒
            </button>
          </div>
        </div>
      )}

      {/* Left Sidebar + Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row max-w-[1440px] w-full mx-auto">
        <aside className="w-full md:w-56 bg-white md:bg-transparent border-b md:border-b-0 md:border-r border-slate-200 p-3 flex md:flex-col gap-1 overflow-x-auto shrink-0">
          {menuItems.map((m) => {
            const Icon = m.icon;
            const active = activeTab === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveTab(m.id)}
                className={`px-3 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </aside>

        <main className="flex-1 p-5 sm:p-7 min-w-0">
          {activeTab === 'overview' && (
            <TeacherOverviewTab onNavigateTab={handleNavigate} />
          )}
          {activeTab === 'classes' && <TeacherClassesTab />}
          {activeTab === 'studio' && <TeacherQuestionStudioTab />}
          {activeTab === 'exams' && (
            <TeacherExamsTab
              onOpenAnalytics={(examId) => handleNavigate('analytics', examId)}
            />
          )}
          {activeTab === 'analytics' && (
            <TeacherAnalyticsTab
              key={analyticsExamId || 'default'}
              initialExamId={analyticsExamId}
            />
          )}
          {activeTab === 'settings' && (
            <TeacherSettingsTab
              teacher={teacher}
              onUpdated={(patch) =>
                setTeacher((prev) => (prev ? { ...prev, ...patch } : prev))
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}

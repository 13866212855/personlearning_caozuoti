'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  ClipboardList,
  Database,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Shield,
  Users,
} from 'lucide-react';
import AdminExamsTab from '@/components/admin/AdminExamsTab';
import AdminLlmConfigTab from '@/components/admin/AdminLlmConfigTab';
import AdminLogsTab from '@/components/admin/AdminLogsTab';
import AdminOverviewTab from '@/components/admin/AdminOverviewTab';
import AdminPasswordTab from '@/components/admin/AdminPasswordTab';
import AdminQuestionsTab from '@/components/admin/AdminQuestionsTab';
import AdminSubmissionsTab from '@/components/admin/AdminSubmissionsTab';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import {
  adminFetch,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from '@/lib/api';

type AdminTab =
  | 'overview'
  | 'users'
  | 'exams'
  | 'llm'
  | 'questions'
  | 'submissions'
  | 'logs'
  | 'password';

export default function AdminPortalPage() {
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState<{
    id: string;
    username: string;
    mustChangePassword: boolean;
  } | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [dismissPwdBanner, setDismissPwdBanner] = useState(false);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      Promise.resolve().then(() => setChecking(false));
      return;
    }
    adminFetch<{
      admin: { id: string; username: string; mustChangePassword: boolean };
    }>('/api/admin/auth/me')
      .then((res) => setAdmin(res.admin))
      .catch(() => clearAdminToken())
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await adminFetch<{
        token: string;
        admin: { id: string; username: string; mustChangePassword: boolean };
      }>('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      setAdminToken(res.token);
      setAdmin(res.admin);
      setPassword('');
    } catch {
      setLoginError('账号或密码错误');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setAdmin(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  // Admin Login View (strictly no default credentials anywhere!)
  if (!admin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">超级管理后台登录</h1>
            <p className="text-xs text-slate-500">
              仅限系统超级管理员登录使用
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                管理员账号
              </label>
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入管理员用户名"
                className="w-full h-10 px-3.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                登录密码
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入登录密码"
                className="w-full h-10 px-3.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full h-10 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {loggingIn && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loggingIn ? '验证中...' : '登录后台'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const menuItems: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> =
    [
      { id: 'overview', label: '数据概览', icon: LayoutDashboard },
      { id: 'users', label: '用户与角色', icon: Users },
      { id: 'exams', label: '全局考试监控', icon: ClipboardList },
      { id: 'llm', label: '大模型配置', icon: Bot },
      { id: 'questions', label: '全局题库', icon: Database },
      { id: 'submissions', label: '历史练习记录', icon: FileCheck2 },
      { id: 'logs', label: '操作日志', icon: Activity },
      { id: 'password', label: '修改密码', icon: KeyRound },
    ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 text-base font-bold text-slate-900">
          <Shield className="w-5 h-5 text-sky-700" />
          <span>会考操作题系统 · 管理控制台</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-600">当前管理员：{admin.username}</span>
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
      {admin.mustChangePassword && !dismissPwdBanner && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between gap-4 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              检测到当前仍在使用初始默认密码，为了系统安全，建议您尽快前往「修改密码」页面更新登录密码。
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('password')}
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

      {/* Workspace Body */}
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
          {activeTab === 'overview' && <AdminOverviewTab />}
          {activeTab === 'users' && <AdminUsersTab />}
          {activeTab === 'exams' && <AdminExamsTab />}
          {activeTab === 'llm' && <AdminLlmConfigTab />}
          {activeTab === 'questions' && <AdminQuestionsTab />}
          {activeTab === 'submissions' && <AdminSubmissionsTab />}
          {activeTab === 'logs' && <AdminLogsTab />}
          {activeTab === 'password' && (
            <AdminPasswordTab
              onPasswordChanged={() =>
                setAdmin((prev) =>
                  prev ? { ...prev, mustChangePassword: false } : prev
                )
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}

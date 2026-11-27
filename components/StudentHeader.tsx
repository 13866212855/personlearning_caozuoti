'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, Bell, BookOpen, LogOut } from 'lucide-react';
import { clearPortalToken, portalFetch } from '@/lib/api';
import { useAuthConfig } from '@/hooks/useAuthConfig';
import type { PortalUser } from '@/lib/types';

interface StudentHeaderProps {
  user: PortalUser;
}

export default function StudentHeader({ user }: StudentHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [dismissPwdBanner, setDismissPwdBanner] = useState(false);
  const auth = useAuthConfig();
  const platformMode = auth?.mode === 'platform';

  const handleLogout = async () => {
    try {
      await portalFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    clearPortalToken();
    router.replace('/login');
  };

  // Strictly ONLY 2 main nav links: 模拟考试 & 个人中心 (no 练习中心, no 管理后台!)
  const navItems = [
    { href: '/', label: '模拟考试' },
    { href: '/profile', label: '个人中心' },
  ];

  const unread = user.unreadNotifications || 0;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            <span className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </span>
            <span>高中信息技术会考·操作题系统</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/' || pathname.startsWith('/exam')
                  : pathname.startsWith(item.href) ||
                    pathname.startsWith('/mistakes');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    active
                      ? 'text-sky-700 border-sky-600 font-semibold'
                      : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/profile?tab=notifications"
              title="站内通知"
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>

            <span className="hidden sm:inline text-sm text-slate-600 whitespace-nowrap">
              {user.realName} · {user.grade} {user.className}
            </span>

            {platformMode && auth.platformWebUrl && (
              <a
                href={auth.platformWebUrl}
                className="hidden sm:inline text-sm text-slate-600 hover:text-sky-700 whitespace-nowrap shrink-0"
              >
                返回平台
              </a>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>退出</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden flex items-center gap-4 px-4 pb-2.5 border-t border-slate-100 pt-2 overflow-x-auto">
          {navItems.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/' || pathname.startsWith('/exam')
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-xs font-medium whitespace-nowrap shrink-0 px-2.5 py-1 rounded-md ${
                  active
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {user.mustChangePassword && !dismissPwdBanner && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 text-xs text-amber-900">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                您当前仍在使用初始默认密码，为了个人学习数据安全，建议尽快前往个人中心修改密码。
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/profile?tab=account"
                className="font-semibold underline text-amber-950"
              >
                立即修改
              </Link>
              <button
                type="button"
                onClick={() => setDismissPwdBanner(true)}
                className="text-amber-700 hover:text-amber-900"
              >
                稍后提醒
              </button>
            </div>
          </div>
        </div>
      )}

      {!user.classId && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 text-xs text-amber-900">
          <div className="max-w-[1440px] mx-auto">
            {platformMode
              ? '你还没有加入班级，暂时看不到面向班级的考试。请联系老师在个性化学习平台中把你加入班级。'
              : '你还没有加入班级，暂时看不到面向班级的考试，请联系任课教师。'}
          </div>
        </div>
      )}
    </>
  );
}

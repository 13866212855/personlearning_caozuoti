'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, BookOpen } from 'lucide-react';
import { clearStudentToken, studentFetch } from '@/lib/api';
import type { StudentProfile } from '@/lib/types';

interface StudentHeaderProps {
  student: StudentProfile;
}

export default function StudentHeader({ student }: StudentHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await studentFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    clearStudentToken();
    router.replace('/login');
  };

  const navItems = [
    { href: '/', label: '练习中心' },
    { href: '/exam', label: '模拟考试' },
    { href: '/profile', label: '个人中心' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          <span className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </span>
          <span>高中信息技术会考·操作题练习系统</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {navItems.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
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

        <div className="flex items-center gap-4 shrink-0">
          <span className="hidden sm:inline text-sm text-slate-600 whitespace-nowrap">
            {student.realName} · {student.grade} {student.className}
          </span>
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
              ? pathname === '/'
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
  );
}

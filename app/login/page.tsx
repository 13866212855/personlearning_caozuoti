'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { useAuthConfig } from '@/hooks/useAuthConfig';
import {
  clearPortalToken,
  getCachedPortalUser,
  getPortalToken,
  portalFetch,
  setCachedPortalUser,
  setPortalToken,
} from '@/lib/api';
import type { PortalUser } from '@/lib/types';

export default function PortalLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'redirecting'>(
    'idle'
  );
  const [resumingSession, setResumingSession] = useState(false);
  const auth = useAuthConfig();
  const platformMode = auth?.mode === 'platform';

  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/register');
    router.prefetch('/teacher');

    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      const token = getPortalToken();
      if (!token) return;

      const cached = getCachedPortalUser();
      if (cached) {
        if (cached.role === 'teacher') {
          setResumingSession(true);
          router.replace('/teacher');
          return;
        }
        if (cached.role === 'student') {
          setResumingSession(true);
          router.replace('/');
          return;
        }
      }

      setResumingSession(true);
      try {
        const res = await portalFetch<{ user: PortalUser }>('/api/auth/me');
        if (cancelled) return;
        setCachedPortalUser(res.user);
        if (res.user.role === 'teacher') {
          router.replace('/teacher');
        } else if (res.user.role === 'student') {
          router.replace('/');
        } else {
          clearPortalToken();
          setResumingSession(false);
        }
      } catch {
        if (!cancelled) {
          clearPortalToken();
          setResumingSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const busy = status !== 'idle';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setStatus('submitting');
    try {
      const res = await portalFetch<{ token: string; user: PortalUser }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ username: username.trim(), password }),
        }
      );
      setPortalToken(res.token);
      if (res.user) {
        setCachedPortalUser(res.user);
      }
      setStatus('redirecting');
      if (res.user.role === 'teacher') {
        router.replace('/teacher');
      } else {
        router.replace('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '账号或密码错误');
      setStatus('idle');
    }
  };

  if (resumingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-3">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
        <p className="text-sm text-slate-600">正在恢复登录状态，请稍候...</p>
        <button
          type="button"
          onClick={() => {
            clearPortalToken();
            setResumingSession(false);
          }}
          className="text-xs text-sky-700 hover:underline mt-1"
        >
          切换其他账号登录
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center mx-auto">
            <BookOpen className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            高中信息技术会考·操作题系统
          </h1>
          <p className="text-sm text-slate-500">
            {platformMode
              ? '请使用个性化学习平台账号登录'
              : '教师与学生统一登录入口，请使用个人账号登录'}
          </p>
        </div>

        {auth?.ssoEnabled && auth.ssoEntryUrl && (
          <>
            <a
              href={auth.ssoEntryUrl}
              className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>从个性化学习平台进入</span>
            </a>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex-1 h-px bg-slate-200" />
              <span>或在下方用平台账号密码登录</span>
              <span className="flex-1 h-px bg-slate-200" />
            </div>
          </>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-slate-700"
            >
              用户名
            </label>
            <input
              id="username"
              type="text"
              autoFocus
              autoComplete="username"
              disabled={busy}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入个人用户名"
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600 disabled:bg-slate-50"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              密码
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入登录密码"
                className="w-full h-10 px-3.5 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600 disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full h-10 bg-sky-600 hover:bg-sky-700 disabled:opacity-70 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {status === 'redirecting'
                ? '登录成功，正在进入系统...'
                : status === 'submitting'
                  ? '正在登录...'
                  : '登录'}
            </span>
          </button>
        </form>

        {platformMode && auth?.studentDirectLogin === 'warn' && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
            学生注意：在这里直接登录，会退出你在个性化学习平台上的登录。平时请从平台入口进入。
          </div>
        )}
        {platformMode && auth?.studentDirectLogin === 'deny' && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
            学生请从个性化学习平台进入本系统；在这里登录仅供教师使用。
          </div>
        )}

        {auth?.registrationEnabled && (
          <div className="text-center text-sm text-slate-600 pt-2 border-t border-slate-100">
            还没有学生账号？{' '}
            <Link
              href="/register"
              className="text-sky-700 font-medium hover:underline"
            >
              学生自助注册
            </Link>
          </div>
        )}
        {platformMode && auth.platformRegisterUrl && (
          <div className="text-center text-sm text-slate-600 pt-2 border-t border-slate-100">
            还没有平台账号？{' '}
            <a
              href={auth.platformRegisterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-700 font-medium hover:underline"
            >
              到个性化学习平台注册
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

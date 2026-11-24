'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  portalFetch,
  setCachedPortalUser,
  setPortalToken,
} from '@/lib/api';
import type { PortalUser } from '@/lib/types';

export default function StudentRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: '',
    password: '',
    realName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'redirecting'>(
    'idle'
  );

  // Preload home page route chunk so post-registration navigation is instantaneous
  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/login');
  }, [router]);

  const trimmedUsername = form.username.trim();
  const usernameValid =
    trimmedUsername.length >= 3 && /^[a-zA-Z0-9_]+$/.test(trimmedUsername);
  const passwordValid = form.password.length >= 6;
  const busy = status !== 'idle';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');

    const username = form.username.trim();
    const realName = form.realName.trim();

    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('用户名至少需要 3 个字符，且仅支持字母、数字和下划线');
      return;
    }
    if (!realName) {
      setError('请填写真实姓名');
      return;
    }
    if (form.password.length < 6) {
      setError('密码长度不能少于 6 位');
      return;
    }

    setStatus('submitting');
    try {
      const res = await portalFetch<{ token: string; user: PortalUser }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            username,
            password: form.password,
            realName,
          }),
        }
      );
      setPortalToken(res.token);
      if (res.user) {
        setCachedPortalUser(res.user);
      }
      setStatus('redirecting');
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请重试');
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
        <div className="space-y-1.5 text-center">
          <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center mx-auto">
            <BookOpen className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">学生账号注册</h1>
          <p className="text-sm text-slate-500">
            填写以下基本信息即可快速完成注册并进入练习
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="reg-username"
                className="block text-xs font-medium text-slate-700"
              >
                用户名（字母、数字或下划线，至少 3 位）
              </label>
              {trimmedUsername.length > 0 && usernameValid && (
                <span className="inline-flex items-center gap-1 text-[11px] text-teal-700">
                  <CheckCircle2 className="w-3 h-3" />
                  格式可用
                </span>
              )}
            </div>
            <input
              id="reg-username"
              type="text"
              autoFocus
              autoComplete="username"
              disabled={busy}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="例如：gaoer 或 stu202601"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 disabled:bg-slate-50"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="reg-realname"
              className="block text-xs font-medium text-slate-700"
            >
              真实姓名
            </label>
            <input
              id="reg-realname"
              type="text"
              disabled={busy}
              value={form.realName}
              onChange={(e) => setForm({ ...form, realName: e.target.value })}
              placeholder="请输入真实姓名"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 disabled:bg-slate-50"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="reg-password"
                className="block text-xs font-medium text-slate-700"
              >
                登录密码（至少 6 位）
              </label>
              {form.password.length > 0 && (
                <span
                  className={`text-[11px] tabular-nums ${
                    passwordValid ? 'text-teal-700' : 'text-amber-700'
                  }`}
                >
                  {passwordValid
                    ? '密码长度符合要求'
                    : `还差 ${6 - form.password.length} 位`}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={busy}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="请设置不少于 6 位的密码"
                className="w-full h-10 px-3 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 disabled:bg-slate-50"
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
            className="w-full h-10 mt-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-70 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {status === 'redirecting'
                ? '注册成功，正在进入模拟考试...'
                : status === 'submitting'
                  ? '正在创建账号...'
                  : '立即注册并进入练习'}
            </span>
          </button>
        </form>

        <div className="text-center text-sm text-slate-600 pt-2 border-t border-slate-100">
          已有账号？{' '}
          <Link href="/login" className="text-sky-700 font-medium hover:underline">
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}

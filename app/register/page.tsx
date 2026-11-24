'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Eye, EyeOff, Loader2 } from 'lucide-react';
import { portalFetch, setPortalToken } from '@/lib/api';

export default function StudentRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: '',
    password: '',
    realName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setLoading(true);
    try {
      const res = await portalFetch<{ token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password: form.password,
          realName,
        }),
      });
      setPortalToken(res.token);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
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
            <label
              htmlFor="reg-username"
              className="block text-xs font-medium text-slate-700"
            >
              用户名（字母、数字或下划线，至少 3 位）
            </label>
            <input
              id="reg-username"
              type="text"
              autoFocus
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="例如：stu202601"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
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
              value={form.realName}
              onChange={(e) => setForm({ ...form, realName: e.target.value })}
              placeholder="请输入真实姓名"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="reg-password"
              className="block text-xs font-medium text-slate-700"
            >
              登录密码（至少 6 位）
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="请设置不少于 6 位的密码"
                className="w-full h-10 px-3 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
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
            disabled={loading}
            className="w-full h-10 mt-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{loading ? '正在注册...' : '立即注册并进入练习'}</span>
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

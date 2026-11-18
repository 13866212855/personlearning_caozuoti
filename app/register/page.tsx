'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  XCircle,
} from 'lucide-react';
import { portalFetch, setPortalToken } from '@/lib/api';

type LookupState = 'idle' | 'checking' | 'found' | 'invalid';

interface ClassInfo {
  name: string;
  grade: string;
}

export default function StudentRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: '',
    password: '',
    realName: '',
    inviteCode: '',
  });
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [lookup, setLookup] = useState<LookupState>('idle');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const lookupEpoch = useRef(0);

  // Invite-code live verification: debounced lookup as the student types.
  // The class name/grade come back from the server and are displayed
  // read-only, so students never hand-type them (and cannot mistype them).
  useEffect(() => {
    const code = form.inviteCode.trim().toUpperCase();
    if (code.length < 4) {
      setLookup('idle');
      setClassInfo(null);
      return;
    }

    setLookup('checking');
    const epoch = ++lookupEpoch.current;
    const timer = setTimeout(async () => {
      try {
        const res = await portalFetch<ClassInfo>(
          `/api/auth/invite-lookup?code=${encodeURIComponent(code)}`
        );
        if (lookupEpoch.current !== epoch) return;
        setClassInfo(res);
        setLookup('found');
      } catch {
        if (lookupEpoch.current !== epoch) return;
        setClassInfo(null);
        setLookup('invalid');
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [form.inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (lookup !== 'found' || !classInfo) {
      setError('请先填写有效的班级邀请码，并等待班级信息确认');
      return;
    }
    if (form.username.trim().length < 3) {
      setError('用户名至少需要 3 个字符（仅支持字母、数字、下划线）');
      return;
    }
    if (form.password.length < 6) {
      setError('密码长度不能少于 6 位');
      return;
    }
    if (!form.realName.trim()) {
      setError('请填写真实姓名');
      return;
    }

    setLoading(true);
    try {
      const res = await portalFetch<{ token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          confirmPassword: form.password,
          realName: form.realName.trim(),
          grade: classInfo.grade,
          className: classInfo.name,
          inviteCode: form.inviteCode.trim(),
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
            输入任课教师提供的班级邀请码即可加入班级
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              班级邀请码（请向任课教师获取）
            </label>
            <input
              type="text"
              autoFocus
              value={form.inviteCode}
              onChange={(e) =>
                setForm({ ...form, inviteCode: e.target.value.toUpperCase() })
              }
              placeholder="例如：A3K7MP"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono uppercase tracking-widest focus:outline-none focus:border-sky-600"
            />
            {lookup === 'checking' && (
              <p className="flex items-center gap-1.5 text-xs text-slate-400 pt-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                正在验证邀请码…
              </p>
            )}
            {lookup === 'found' && classInfo && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  已找到班级：
                  <span className="font-bold">
                    {classInfo.name}（{classInfo.grade}）
                  </span>
                  ，请继续填写下方信息
                </span>
              </div>
            )}
            {lookup === 'invalid' && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>邀请码无效，请核对后重新输入，或向任课教师确认</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              用户名（唯一标识，字母/数字/下划线）
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="例如：stu202601"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              真实姓名
            </label>
            <input
              type="text"
              value={form.realName}
              onChange={(e) => setForm({ ...form, realName: e.target.value })}
              placeholder="请输入真实姓名"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              密码（至少 6 位）
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="至少 6 位字符"
                className="w-full h-9 px-3 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
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
            <span>{loading ? '正在注册...' : '注册并加入班级'}</span>
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

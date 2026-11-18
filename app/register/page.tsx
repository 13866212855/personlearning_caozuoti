'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Loader2 } from 'lucide-react';
import { portalFetch, setPortalToken } from '@/lib/api';

export default function StudentRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    realName: '',
    grade: '高一',
    className: '',
    inviteCode: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.username.trim().length < 3) {
      setError('用户名至少需要 3 个字符（仅支持字母、数字、下划线）');
      return;
    }
    if (form.password.length < 6) {
      setError('密码长度不能少于 6 位');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (!form.realName.trim() || !form.className.trim()) {
      setError('请完整填写真实姓名和班级');
      return;
    }
    if (!form.inviteCode.trim()) {
      setError('请填写任课教师提供的班级邀请码');
      return;
    }

    setLoading(true);
    try {
      const res = await portalFetch<{ token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          confirmPassword: form.confirmPassword,
          realName: form.realName.trim(),
          grade: form.grade,
          className: form.className.trim(),
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
            填写任课教师提供的班级邀请码加入班级参与模拟考试
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
              value={form.inviteCode}
              onChange={(e) =>
                setForm({ ...form, inviteCode: e.target.value.toUpperCase() })
              }
              placeholder="请输入教师提供的班级邀请码"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono uppercase focus:outline-none focus:border-sky-600"
            />
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

          <div className="grid grid-cols-2 gap-3">
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
                年级
              </label>
              <select
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:border-sky-600"
              >
                <option value="高一">高一</option>
                <option value="高二">高二</option>
                <option value="高三">高三</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              班级名称
            </label>
            <input
              type="text"
              value={form.className}
              onChange={(e) => setForm({ ...form, className: e.target.value })}
              placeholder="例如：高一(1)班"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              密码（至少 6 位）
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="至少 6 位字符"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              确认密码
            </label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
              placeholder="请再次输入密码"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-sky-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 mt-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{loading ? '正在注册...' : '验证邀请码并注册'}</span>
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

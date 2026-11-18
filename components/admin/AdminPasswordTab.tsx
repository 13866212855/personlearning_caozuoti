'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { adminFetch } from '@/lib/api';

interface AdminPasswordTabProps {
  onPasswordChanged: () => void;
}

export default function AdminPasswordTab({
  onPasswordChanged,
}: AdminPasswordTabProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErr('');

    if (newPassword.length < 6) {
      setErr('新密码长度至少为 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      await adminFetch('/api/admin/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setMsg('管理员密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onPasswordChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '修改密码失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-lg font-bold text-slate-900">修改管理员密码</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          定期更新高强度密码有助于保护题库与学生成绩数据安全
        </p>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800">
          {msg}
        </div>
      )}
      {err && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {err}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm"
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            当前密码
          </label>
          <input
            type="password"
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full h-9 px-3 border border-slate-300 rounded-lg"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            新密码（至少 6 位）
          </label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full h-9 px-3 border border-slate-300 rounded-lg"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            确认新密码
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full h-9 px-3 border border-slate-300 rounded-lg"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="h-9 px-5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          <span>更新密码</span>
        </button>
      </form>
    </div>
  );
}

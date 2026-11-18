'use client';

import { useState } from 'react';
import { KeyRound, Save, User } from 'lucide-react';
import { portalFetch } from '@/lib/api';
import type { PortalUser } from '@/lib/types';

interface TeacherSettingsTabProps {
  teacher: PortalUser;
  onUpdated: (patch: Partial<PortalUser>) => void;
}

export default function TeacherSettingsTab({
  teacher,
  onUpdated,
}: TeacherSettingsTabProps) {
  const [realName, setRealName] = useState(teacher.realName);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    try {
      await portalFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ realName: realName.trim() }),
      });
      onUpdated({ realName: realName.trim() });
      setProfileMsg('教师个人资料已保存');
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : '保存失败');
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdErr('');
    if (newPassword.length < 6) {
      setPwdErr('新密码不能少于 6 位');
      return;
    }
    if (newPassword !== confirmPwd) {
      setPwdErr('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    try {
      await portalFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setPwdMsg('登录密码已更新');
      setOldPassword('');
      setNewPassword('');
      setConfirmPwd('');
      onUpdated({ mustChangePassword: false });
    } catch (err) {
      setPwdErr(err instanceof Error ? err.message : '密码修改失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs"
      >
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-sky-700" />
          <h3 className="text-base font-bold text-slate-900">个人基本资料</h3>
        </div>

        {profileMsg && (
          <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-800">
            {profileMsg}
          </div>
        )}
        {profileErr && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
            {profileErr}
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-slate-600 font-medium">登录用户名</span>
          <input
            type="text"
            disabled
            value={teacher.username}
            className="w-full h-9 px-3 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono text-slate-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-slate-600 font-medium">教师姓名</span>
          <input
            type="text"
            required
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
          />
        </label>

        <button
          type="submit"
          className="h-9 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium inline-flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          <span>保存资料</span>
        </button>
      </form>

      <form
        onSubmit={handleSavePassword}
        className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-sky-700" />
          <h3 className="text-base font-bold text-slate-900">修改登录密码</h3>
        </div>

        {pwdMsg && (
          <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-800">
            {pwdMsg}
          </div>
        )}
        {pwdErr && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
            {pwdErr}
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-slate-600 font-medium">原密码</span>
          <input
            type="password"
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-slate-600 font-medium">新密码（至少 6 位）</span>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-slate-600 font-medium">确认新密码</span>
          <input
            type="password"
            required
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="h-9 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg font-medium"
        >
          {saving ? '更新中...' : '确认修改密码'}
        </button>
      </form>
    </div>
  );
}

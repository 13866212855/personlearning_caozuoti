'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Save, User, UserCheck } from 'lucide-react';
import { portalFetch } from '@/lib/api';
import { useAuthConfig } from '@/hooks/useAuthConfig';
import type { PortalUser } from '@/lib/types';

interface TeacherSettingsTabProps {
  teacher: PortalUser;
  onUpdated: (patch: Partial<PortalUser>) => void;
}

interface TeacherClassOption {
  id: string;
  name: string;
  grade: string;
}

export default function TeacherSettingsTab({
  teacher,
  onUpdated,
}: TeacherSettingsTabProps) {
  const [realName, setRealName] = useState(teacher.realName);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const auth = useAuthConfig();
  // 平台对接模式下：默认归属设置与姓名修改由平台管理，仅保留密码修改（同步到平台）
  const managed = auth ? !auth.memberManagement : true;

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Default registration student assignment setting
  const [regLoading, setRegLoading] = useState(true);
  const [isDefaultTeacher, setIsDefaultTeacher] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [teacherClasses, setTeacherClasses] = useState<TeacherClassOption[]>([]);
  const [regSaving, setRegSaving] = useState(false);
  const [regMsg, setRegMsg] = useState('');
  const [regErr, setRegErr] = useState('');

  useEffect(() => {
    let active = true;
    portalFetch<{
      isDefaultTeacher: boolean;
      defaultClassId: string;
      classes: TeacherClassOption[];
    }>('/api/teacher/settings/default-registration')
      .then((res) => {
        if (!active) return;
        setIsDefaultTeacher(res.isDefaultTeacher);
        setTeacherClasses(res.classes);
        setSelectedClassId(
          res.defaultClassId || res.classes[0]?.id || ''
        );
      })
      .catch(() => {
        // Ignore silent fetch errors
      })
      .finally(() => {
        if (active) setRegLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const handleSaveDefaultReg = async (enabled: boolean) => {
    setRegSaving(true);
    setRegMsg('');
    setRegErr('');
    try {
      const res = await portalFetch<{
        isDefaultTeacher: boolean;
        defaultClassId: string;
        defaultClassName: string;
      }>('/api/teacher/settings/default-registration', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          classId: enabled ? selectedClassId || undefined : undefined,
        }),
      });
      setIsDefaultTeacher(res.isDefaultTeacher);
      if (res.defaultClassId) {
        setSelectedClassId(res.defaultClassId);
      }
      setRegMsg(
        res.isDefaultTeacher
          ? `设置已生效：新注册的学生将自动归属到您的「${res.defaultClassName}」`
          : '已取消新注册学生默认归属设置'
      );
    } catch (err) {
      setRegErr(err instanceof Error ? err.message : '保存设置失败');
    } finally {
      setRegSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Default Registration Teacher Setting Card (local mode only) */}
      {!managed && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-teal-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                新注册学生默认归属设置
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                开启后，学生在注册页面无需填写邀请码，注册完成后将自动归属到您名下的指定班级
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-lg font-semibold self-start sm:self-center ${
              isDefaultTeacher
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isDefaultTeacher ? '当前：默认接收新注册学生' : '当前：未设为默认归属'}
          </span>
        </div>

        {regMsg && (
          <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-800">
            {regMsg}
          </div>
        )}
        {regErr && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
            {regErr}
          </div>
        )}

        {regLoading ? (
          <div className="py-4 flex items-center gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>正在加载设置...</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1">
            <label className="block space-y-1 flex-1 max-w-sm">
              <span className="text-slate-600 font-medium">
                默认接收新注册学生的班级
              </span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={teacherClasses.length === 0}
                className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white text-sm"
              >
                {teacherClasses.length === 0 ? (
                  <option value="">将自动创建默认班级「高一(1)班」</option>
                ) : (
                  teacherClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.grade} · {c.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={regSaving}
                onClick={() => void handleSaveDefaultReg(true)}
                className="h-9 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg font-medium inline-flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>
                  {isDefaultTeacher ? '更新默认接收班级' : '设为新学生默认归属教师'}
                </span>
              </button>

              {isDefaultTeacher && (
                <button
                  type="button"
                  disabled={regSaving}
                  onClick={() => void handleSaveDefaultReg(false)}
                  className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  取消默认
                </button>
              )}
            </div>
          </div>
        )}
        </div>
      )}

      <div className={managed ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
        {managed ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-sky-700" />
              <h3 className="text-base font-bold text-slate-900">个人基本资料</h3>
            </div>
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
                disabled
                value={teacher.realName}
                className="w-full h-9 px-3 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-500"
              />
            </label>
            <p className="text-slate-500 leading-relaxed">
              平台对接模式下，姓名等资料由个性化学习平台统一维护，请到平台修改。
            </p>
          </div>
        ) : (
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
        )}

        <form
          onSubmit={handleSavePassword}
          className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-sky-700" />
            <h3 className="text-base font-bold text-slate-900">修改登录密码</h3>
          </div>

          {managed && (
            <p className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 leading-relaxed">
              平台对接模式：在此修改密码会同步更新你在个性化学习平台上的登录密码。
            </p>
          )}

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
    </div>
  );
}

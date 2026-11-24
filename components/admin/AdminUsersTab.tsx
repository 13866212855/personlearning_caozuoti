'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  Ban,
  CheckCircle,
  KeyRound,
  Loader2,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { adminFetch } from '@/lib/api';
import type { UserRole } from '@/lib/types';

interface TeacherClassBrief {
  id: string;
  name: string;
  grade: string;
}

interface AdminUserRow {
  id: string;
  username: string;
  role: UserRole;
  realName: string;
  grade: string;
  className: string;
  studentNo: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  isDisabled: boolean;
  mustChangePassword: boolean;
  isDefaultRegistrationTeacher?: boolean;
  defaultRegistrationClassId?: string;
  defaultRegistrationClassName?: string;
  teacherClasses?: TeacherClassBrief[];
  createdAt: string;
}

interface AdminClassRow {
  id: string;
  name: string;
  grade: string;
  teacherId: string;
  teacherName: string;
  inviteCode: string;
}

interface DefaultRegistrationInfo {
  teacherId: string;
  teacherName: string;
  teacherUsername: string;
  classId: string;
  className: string;
  grade: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '超级管理员',
  teacher: '教师',
  student: '学生',
};

export default function AdminUsersTab() {
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [defaultReg, setDefaultReg] = useState<DefaultRegistrationInfo | null>(
    null
  );
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Create Teacher Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [tForm, setTForm] = useState({
    username: '',
    realName: '',
    password: '',
    defaultGrade: '高一',
    defaultClassName: '高一(1)班',
    setAsDefaultRegistration: false,
  });
  const [creating, setCreating] = useState(false);

  // Set Default Registration Teacher Modal
  const [defaultTargetTeacher, setDefaultTargetTeacher] =
    useState<AdminUserRow | null>(null);
  const [defaultTargetClassId, setDefaultTargetClassId] = useState('');
  const [savingDefault, setSavingDefault] = useState(false);

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<AdminUserRow | null>(null);
  const [newPwd, setNewPwd] = useState('');

  // Change Role Modal
  const [roleTarget, setRoleTarget] = useState<AdminUserRow | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('student');

  // Reassign Student Class Modal
  const [assignTarget, setAssignTarget] = useState<AdminUserRow | null>(null);
  const [classes, setClasses] = useState<AdminClassRow[]>([]);
  const [targetClassId, setTargetClassId] = useState('');

  const load = useCallback(
    async (p = page) => {
      setLoading(true);
      setErr('');
      try {
        const qs = new URLSearchParams({
          page: String(p),
          pageSize: '15',
        });
        if (roleFilter) qs.set('role', roleFilter);
        if (keyword.trim()) qs.set('keyword', keyword.trim());
        const res = await adminFetch<{
          items: AdminUserRow[];
          defaultRegistration: DefaultRegistrationInfo | null;
          total: number;
          page: number;
        }>(`/api/admin/users?${qs.toString()}`);
        setItems(res.items);
        setDefaultReg(res.defaultRegistration ?? null);
        setTotal(res.total);
        setPage(res.page);
      } catch (e) {
        setErr(e instanceof Error ? e.message : '加载用户列表失败');
      } finally {
        setLoading(false);
      }
    },
    [roleFilter, keyword, page]
  );

  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams({ page: '1', pageSize: '15' });
    if (roleFilter) qs.set('role', roleFilter);
    adminFetch<{
      items: AdminUserRow[];
      defaultRegistration: DefaultRegistrationInfo | null;
      total: number;
      page: number;
    }>(`/api/admin/users?${qs.toString()}`)
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setDefaultReg(res.defaultRegistration ?? null);
        setTotal(res.total);
        setPage(res.page);
      })
      .catch((e) => {
        if (active) {
          setErr(e instanceof Error ? e.message : '加载用户列表失败');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roleFilter]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setErr('');
    try {
      await adminFetch<{ id: string; classId: string }>(
        '/api/admin/users/teacher',
        {
          method: 'POST',
          body: JSON.stringify(tForm),
        }
      );
      setCreateOpen(false);
      const classLabel = tForm.defaultClassName || '高一(1)班';
      const wasDefault = tForm.setAsDefaultRegistration;
      setTForm({
        username: '',
        realName: '',
        password: '',
        defaultGrade: '高一',
        defaultClassName: '高一(1)班',
        setAsDefaultRegistration: false,
      });
      setMsg(
        `教师账号创建成功，并已为其初始化默认班级「${classLabel}」${
          wasDefault ? '，同时设为新注册学生默认归属教师' : ''
        }`
      );
      void load(1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '创建教师账号失败');
    } finally {
      setCreating(false);
    }
  };

  const openDefaultTeacherModal = (u: AdminUserRow) => {
    setDefaultTargetTeacher(u);
    setDefaultTargetClassId(
      u.defaultRegistrationClassId || u.teacherClasses?.[0]?.id || ''
    );
  };

  const handleSaveDefaultTeacher = async () => {
    if (!defaultTargetTeacher) return;
    setSavingDefault(true);
    setErr('');
    try {
      const res = await adminFetch<{
        ok: boolean;
        defaultRegistration: DefaultRegistrationInfo | null;
      }>('/api/admin/settings/default-registration', {
        method: 'PUT',
        body: JSON.stringify({
          teacherId: defaultTargetTeacher.id,
          classId: defaultTargetClassId || undefined,
        }),
      });
      setDefaultReg(res.defaultRegistration);
      setMsg(
        `已设置新注册学生默认归属教师为「${defaultTargetTeacher.realName}（${
          res.defaultRegistration?.className || '默认班级'
        }）」`
      );
      setDefaultTargetTeacher(null);
      void load(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '设置默认归属教师失败');
    } finally {
      setSavingDefault(false);
    }
  };

  const handleToggleStatus = async (u: AdminUserRow) => {
    setErr('');
    try {
      await adminFetch(`/api/admin/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isDisabled: !u.isDisabled }),
      });
      setMsg(`${u.isDisabled ? '已启用' : '已禁用'}账号「${u.username}」`);
      void load(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '状态修改失败');
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || newPwd.length < 6) {
      setErr('新密码长度至少 6 位');
      return;
    }
    setErr('');
    try {
      await adminFetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: newPwd }),
      });
      setMsg(`已重置「${resetTarget.realName || resetTarget.username}」的密码`);
      setResetTarget(null);
      setNewPwd('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '重置密码失败');
    }
  };

  const handleChangeRole = async () => {
    if (!roleTarget) return;
    setErr('');
    try {
      await adminFetch(`/api/admin/users/${roleTarget.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: targetRole }),
      });
      setMsg(
        `已将「${roleTarget.username}」角色变更为 ${ROLE_LABELS[targetRole]}`
      );
      setRoleTarget(null);
      void load(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '更改角色失败');
    }
  };

  const openAssignModal = async (u: AdminUserRow) => {
    setAssignTarget(u);
    setTargetClassId(u.classId || '');
    try {
      const res = await adminFetch<{ items: AdminClassRow[] }>('/api/admin/classes');
      setClasses(res.items);
      if (!u.classId && res.items[0]) {
        setTargetClassId(res.items[0].id);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载班级列表失败');
    }
  };

  const handleAssignClass = async () => {
    if (!assignTarget || !targetClassId) return;
    setErr('');
    try {
      await adminFetch(`/api/admin/users/${assignTarget.id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ classId: targetClassId }),
      });
      setMsg(`已调整学生「${assignTarget.realName}」的所属班级与教师`);
      setAssignTarget(null);
      void load(page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '调整班级失败');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">用户与角色管理</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            管理全站超级管理员、教师与学生账号；可指定任意教师默认接收新自助注册的学生
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="h-9 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 self-start"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>创建教师账号</span>
        </button>
      </div>

      {/* Default Student Registration Teacher Banner */}
      <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-teal-900">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-teal-600 shrink-0" />
          {defaultReg ? (
            <span>
              <span className="font-semibold">新注册学生默认归属：</span>
              <span className="font-bold">{defaultReg.teacherName}</span>（
              {defaultReg.teacherUsername}）· {defaultReg.grade}{' '}
              {defaultReg.className}
            </span>
          ) : (
            <span>
              <span className="font-semibold">新注册学生默认归属：</span>
              暂未指定默认教师（可在下方教师行点击「设为默认归属」进行指定）
            </span>
          )}
        </div>
        <span className="text-[11px] text-teal-700">
          学生注册无需输入邀请码，注册后自动加入该教师对应班级
        </span>
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

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-lg bg-white"
        >
          <option value="">全部角色</option>
          <option value="super_admin">超级管理员</option>
          <option value="teacher">教师</option>
          <option value="student">学生</option>
        </select>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索用户名 / 姓名 / 班级..."
          className="h-9 px-3 border border-slate-200 rounded-lg w-56 bg-white"
        />
        <button
          type="button"
          onClick={() => void load(1)}
          className="h-9 px-4 bg-slate-900 text-white rounded-lg inline-flex items-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          <span>查询</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            暂无匹配的用户记录
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4 font-medium">用户名 / 姓名</th>
                  <th className="py-3 px-4 font-medium">角色</th>
                  <th className="py-3 px-4 font-medium">班级 / 归属教师</th>
                  <th className="py-3 px-4 font-medium">状态</th>
                  <th className="py-3 px-4 font-medium">创建时间</th>
                  <th className="py-3 px-4 font-medium text-right">管理操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-slate-900">
                        {u.username}
                      </div>
                      <div className="text-[11px] text-slate-500">{u.realName}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          u.role === 'super_admin'
                            ? 'text-slate-900'
                            : u.role === 'teacher'
                              ? 'text-sky-700'
                              : 'text-teal-700'
                        }`}
                      >
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {u.role === 'student' ? (
                        <div>
                          <span>
                            {u.grade} {u.className || '未分配'}
                          </span>
                          {u.teacherName && (
                            <span className="text-slate-400 ml-1">
                              ({u.teacherName})
                            </span>
                          )}
                        </div>
                      ) : u.role === 'teacher' ? (
                        <div className="space-y-1">
                          <div>
                            {u.teacherClasses && u.teacherClasses.length > 0
                              ? `${u.teacherClasses.length} 个班级（${u.teacherClasses
                                  .slice(0, 2)
                                  .map((c) => c.name)
                                  .join('、')}${
                                  u.teacherClasses.length > 2 ? '…' : ''
                                }）`
                              : '暂无班级'}
                          </div>
                          {u.isDefaultRegistrationTeacher && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-[11px] font-semibold text-teal-700">
                              <UserCheck className="w-3 h-3" />
                              <span>
                                默认接收新生（{u.defaultRegistrationClassName}）
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={
                          u.isDisabled
                            ? 'text-red-600 font-medium'
                            : 'text-teal-700 font-medium'
                        }
                      >
                        {u.isDisabled ? '已禁用' : '正常'}
                      </span>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2.5 whitespace-nowrap">
                      {u.role === 'teacher' && !u.isDisabled && (
                        <button
                          type="button"
                          onClick={() => openDefaultTeacherModal(u)}
                          className="text-teal-700 hover:underline inline-flex items-center gap-0.5 font-medium"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>
                            {u.isDefaultRegistrationTeacher
                              ? '调整默认班级'
                              : '设为默认归属'}
                          </span>
                        </button>
                      )}
                      {u.role === 'student' && (
                        <button
                          type="button"
                          onClick={() => void openAssignModal(u)}
                          className="text-sky-700 hover:underline inline-flex items-center gap-0.5"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>调班</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setRoleTarget(u);
                          setTargetRole(u.role);
                        }}
                        className="text-slate-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        <Shield className="w-3 h-3" />
                        <span>角色</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetTarget(u);
                          setNewPwd('');
                        }}
                        className="text-sky-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>改密</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(u)}
                        className={`hover:underline inline-flex items-center gap-0.5 ${
                          u.isDisabled ? 'text-teal-700' : 'text-red-600'
                        }`}
                      >
                        {u.isDisabled ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <Ban className="w-3 h-3" />
                        )}
                        <span>{u.isDisabled ? '启用' : '禁用'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              共 {total} 个账号 · 第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => void load(page - 1)}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => void load(page + 1)}
                className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Teacher Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTeacher}
            className="bg-white rounded-2xl border border-slate-200 p-5 w-full max-w-sm space-y-3.5 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">创建教师账号</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block space-y-1">
              <span className="font-medium text-slate-700">教师登录用户名</span>
              <input
                type="text"
                required
                value={tForm.username}
                onChange={(e) => setTForm({ ...tForm, username: e.target.value })}
                placeholder="字母、数字或下划线"
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">教师姓名</span>
              <input
                type="text"
                required
                value={tForm.realName}
                onChange={(e) => setTForm({ ...tForm, realName: e.target.value })}
                placeholder="例如：张敏"
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-medium text-slate-700">初始密码（至少 6 位）</span>
              <input
                type="password"
                required
                minLength={6}
                value={tForm.password}
                onChange={(e) => setTForm({ ...tForm, password: e.target.value })}
                placeholder="输入初始登录密码"
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">默认年级</span>
                <input
                  type="text"
                  value={tForm.defaultGrade}
                  onChange={(e) =>
                    setTForm({ ...tForm, defaultGrade: e.target.value })
                  }
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">初始班级名</span>
                <input
                  type="text"
                  value={tForm.defaultClassName}
                  onChange={(e) =>
                    setTForm({ ...tForm, defaultClassName: e.target.value })
                  }
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tForm.setAsDefaultRegistration}
                onChange={(e) =>
                  setTForm({
                    ...tForm,
                    setAsDefaultRegistration: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-slate-700 font-medium">
                同时设为新注册学生的默认归属教师
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium"
              >
                {creating ? '创建中...' : '确认创建'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Set Default Registration Teacher Modal */}
      {defaultTargetTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              设置新学生默认归属教师
            </h3>
            <p className="text-slate-600 leading-relaxed">
              新自助注册的学生将自动归属至教师{' '}
              <span className="font-semibold text-slate-900">
                {defaultTargetTeacher.realName}（{defaultTargetTeacher.username}）
              </span>
              ，请选择默认接收新生的班级：
            </p>
            <select
              value={defaultTargetClassId}
              onChange={(e) => setDefaultTargetClassId(e.target.value)}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white text-sm"
            >
              {defaultTargetTeacher.teacherClasses &&
              defaultTargetTeacher.teacherClasses.length > 0 ? (
                defaultTargetTeacher.teacherClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.grade} · {c.name}
                  </option>
                ))
              ) : (
                <option value="">自动创建默认班级「高一(1)班」</option>
              )}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDefaultTargetTeacher(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                disabled={savingDefault}
                onClick={() => void handleSaveDefaultTeacher()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg font-medium"
              >
                {savingDefault ? '保存中...' : '确认设为默认归属'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              重置密码 - {resetTarget.realName}（{resetTarget.username}）
            </h3>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="输入新密码（至少 6 位）"
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleResetPassword()}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {roleTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              更改账号角色 - {roleTarget.username}
            </h3>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as UserRole)}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white text-sm"
            >
              <option value="student">学生 (student)</option>
              <option value="teacher">教师 (teacher)</option>
              <option value="super_admin">超级管理员 (super_admin)</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleChangeRole()}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium"
              >
                保存角色
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Student Class Modal */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              调整班级与归属教师 - {assignTarget.realName}
            </h3>
            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white text-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade} {c.name}（教师：{c.teacherName}）
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleAssignClass()}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg font-medium"
              >
                确认调整
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

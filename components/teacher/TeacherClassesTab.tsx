'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { portalFetch } from '@/lib/api';
import type { ClassItem } from '@/lib/types';

interface ClassStudent {
  id: string;
  username: string;
  realName: string;
  grade: string;
  className: string;
  studentNo: string;
  isDisabled: boolean;
  createdAt: string;
}

export default function TeacherClassesTab() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [studentTotal, setStudentTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  // Create/Edit Class Modal
  const [classModal, setClassModal] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    name: string;
    grade: string;
  } | null>(null);

  // Add Student Modal
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [stuForm, setStuForm] = useState({
    username: '',
    realName: '',
    studentNo: '',
    password: '',
  });

  // Bulk CSV Import Modal
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState(
    '用户名,真实姓名,学号,初始密码\nstu_demo_01,王小明,20260101,Stu#202601'
  );

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<ClassStudent | null>(null);
  const [newPwd, setNewPwd] = useState('');

  const loadClasses = useCallback(async () => {
    const res = await portalFetch<{ items: ClassItem[] }>('/api/teacher/classes');
    setClasses(res.items);
    if (res.items.length > 0 && !selectedClassId) {
      setSelectedClassId(res.items[0].id);
    }
    return res.items;
  }, [selectedClassId]);

  const loadStudents = useCallback(
    async (clsId: string, kw = keyword) => {
      if (!clsId) {
        setStudents([]);
        setStudentTotal(0);
        return;
      }
      const qs = new URLSearchParams({ page: '1', pageSize: '50' });
      if (kw.trim()) qs.set('keyword', kw.trim());
      const res = await portalFetch<{ items: ClassStudent[]; total: number }>(
        `/api/teacher/classes/${clsId}/students?${qs.toString()}`
      );
      setStudents(res.items);
      setStudentTotal(res.total);
    },
    [keyword]
  );

  useEffect(() => {
    let active = true;
    portalFetch<{ items: ClassItem[] }>('/api/teacher/classes')
      .then(async (res) => {
        if (!active) return;
        setClasses(res.items);
        if (res.items.length > 0) {
          const firstId = res.items[0].id;
          setSelectedClassId(firstId);
          const stuRes = await portalFetch<{
            items: ClassStudent[];
            total: number;
          }>(`/api/teacher/classes/${firstId}/students?page=1&pageSize=50`);
          if (active) {
            setStudents(stuRes.items);
            setStudentTotal(stuRes.total);
          }
        }
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : '加载班级失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSelectClass = async (id: string) => {
    setSelectedClassId(id);
    setErr('');
    try {
      await loadStudents(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载学生列表失败');
    }
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classModal) return;
    setErr('');
    try {
      if (classModal.mode === 'create') {
        const res = await portalFetch<{ item: ClassItem }>(
          '/api/teacher/classes',
          {
            method: 'POST',
            body: JSON.stringify({
              name: classModal.name,
              grade: classModal.grade,
            }),
          }
        );
        setMsg(
          `已创建班级「${res.item.name}」，邀请码：${res.item.inviteCode}`
        );
        await loadClasses();
        setSelectedClassId(res.item.id);
        await loadStudents(res.item.id);
      } else if (classModal.id) {
        await portalFetch(`/api/teacher/classes/${classModal.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: classModal.name,
            grade: classModal.grade,
          }),
        });
        setMsg('班级信息已更新');
        await loadClasses();
        await loadStudents(classModal.id);
      }
      setClassModal(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存班级失败');
    }
  };

  const handleResetInvite = async (clsId: string) => {
    try {
      const res = await portalFetch<{ inviteCode: string }>(
        `/api/teacher/classes/${clsId}/reset-invite`,
        { method: 'POST' }
      );
      setMsg(`班级邀请码已更新为：${res.inviteCode}`);
      await loadClasses();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '重置邀请码失败');
    }
  };

  const handleCopyInvite = (code: string) => {
    void navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 1800);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) return;
    setErr('');
    try {
      await portalFetch(`/api/teacher/classes/${selectedClassId}/students`, {
        method: 'POST',
        body: JSON.stringify({
          username: stuForm.username.trim(),
          realName: stuForm.realName.trim(),
          studentNo: stuForm.studentNo.trim(),
          password: stuForm.password.trim() || undefined,
        }),
      });
      setAddStudentOpen(false);
      setStuForm({ username: '', realName: '', studentNo: '', password: '' });
      setMsg('已添加学生到当前班级');
      await loadClasses();
      await loadStudents(selectedClassId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '添加学生失败');
    }
  };

  const handleCsvImport = async () => {
    if (!selectedClassId) return;
    setErr('');
    try {
      const res = await portalFetch<{
        createdCount: number;
        skipped: string[];
      }>(`/api/teacher/classes/${selectedClassId}/import-csv`, {
        method: 'POST',
        body: JSON.stringify({ csvText }),
      });
      setCsvModalOpen(false);
      setMsg(
        `批量导入完成：成功创建 ${res.createdCount} 名学生${
          res.skipped.length > 0 ? `，跳过 ${res.skipped.length} 条（${res.skipped.slice(0, 3).join('；')}）` : ''
        }`
      );
      await loadClasses();
      await loadStudents(selectedClassId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '批量导入失败');
    }
  };

  const handleRemoveStudent = async (stu: ClassStudent) => {
    if (!selectedClassId) return;
    try {
      await portalFetch(
        `/api/teacher/classes/${selectedClassId}/students/${stu.id}`,
        { method: 'DELETE' }
      );
      setMsg(`已将「${stu.realName}」移出当前班级`);
      await loadClasses();
      await loadStudents(selectedClassId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '移除学生失败');
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || newPwd.length < 6) {
      setErr('新密码长度不能少于 6 位');
      return;
    }
    try {
      await portalFetch(
        `/api/teacher/students/${resetTarget.id}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify({ newPassword: newPwd }),
        }
      );
      setMsg(`已重置学生「${resetTarget.realName}」的登录密码`);
      setResetTarget(null);
      setNewPwd('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '重置密码失败');
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  const activeClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">班级与学生管理</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            创建班级并生成邀请码供学生注册加入，支持单个添加与 CSV 批量导入学生账号
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setClassModal({ mode: 'create', name: '', grade: '高一' })
          }
          className="h-9 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建班级</span>
        </button>
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

      {/* Class Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {classes.map((cls) => {
          const active = cls.id === selectedClassId;
          return (
            <div
              key={cls.id}
              onClick={() => void handleSelectClass(cls.id)}
              className={`cursor-pointer rounded-xl border p-4 transition-colors space-y-2.5 ${
                active
                  ? 'bg-sky-50/70 border-sky-500'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {cls.grade} · {cls.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    学生人数：{cls.studentCount} 人
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setClassModal({
                      mode: 'edit',
                      id: cls.id,
                      name: cls.name,
                      grade: cls.grade,
                    });
                  }}
                  className="text-xs text-sky-700 hover:underline"
                >
                  编辑
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">邀请码：</span>
                  <span className="font-mono font-bold text-slate-900">
                    {cls.inviteCode}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyInvite(cls.inviteCode);
                    }}
                    className="text-sky-700 hover:underline inline-flex items-center gap-0.5"
                  >
                    {copiedCode === cls.inviteCode ? (
                      <Check className="w-3 h-3 text-teal-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedCode === cls.inviteCode ? '已复制' : '复制'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleResetInvite(cls.id);
                    }}
                    className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-0.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>重置</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Class Students */}
      {activeClass && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {activeClass.grade} {activeClass.name} — 学生名单（{studentTotal}{' '}
                人）
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索姓名/账号/学号"
                  className="h-8 px-2.5 border border-slate-200 rounded-lg w-40"
                />
                <button
                  type="button"
                  onClick={() => void loadStudents(activeClass.id, keyword)}
                  className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg inline-flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>查找</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setAddStudentOpen(true)}
                className="h-8 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium inline-flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>添加学生</span>
              </button>

              <button
                type="button"
                onClick={() => setCsvModalOpen(true)}
                className="h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg font-medium inline-flex items-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>CSV 批量导入</span>
              </button>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              当前班级暂无学生，可将邀请码「{activeClass.inviteCode}
              」发给学生注册，或点击上方按钮直接添加/导入。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 px-3 font-medium">真实姓名</th>
                    <th className="py-2.5 px-3 font-medium">用户名</th>
                    <th className="py-2.5 px-3 font-medium">学号</th>
                    <th className="py-2.5 px-3 font-medium">状态</th>
                    <th className="py-2.5 px-3 font-medium">加入时间</th>
                    <th className="py-2.5 px-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-medium text-slate-900">
                        {st.realName}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {st.username}
                      </td>
                      <td className="py-3 px-3 tabular-nums text-slate-600">
                        {st.studentNo || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={
                            st.isDisabled
                              ? 'text-red-600 font-medium'
                              : 'text-teal-700 font-medium'
                          }
                        >
                          {st.isDisabled ? '已禁用' : '正常'}
                        </span>
                      </td>
                      <td className="py-3 px-3 tabular-nums text-slate-500">
                        {new Date(st.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="py-3 px-3 text-right space-x-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setResetTarget(st);
                            setNewPwd('');
                          }}
                          className="text-sky-700 hover:underline inline-flex items-center gap-0.5"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>重置密码</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemoveStudent(st)}
                          className="text-red-600 hover:underline inline-flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>移出班级</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Class Create / Edit Modal */}
      {classModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveClass}
            className="bg-white rounded-2xl border border-slate-200 p-5 w-full max-w-sm space-y-4 text-xs"
          >
            <h3 className="text-base font-bold text-slate-900">
              {classModal.mode === 'create' ? '新建班级' : '编辑班级信息'}
            </h3>
            <label className="block space-y-1">
              <span className="text-slate-600 font-medium">年级</span>
              <select
                value={classModal.grade}
                onChange={(e) =>
                  setClassModal({ ...classModal, grade: e.target.value })
                }
                className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="高一">高一</option>
                <option value="高二">高二</option>
                <option value="高三">高三</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-slate-600 font-medium">班级名称</span>
              <input
                type="text"
                required
                value={classModal.name}
                onChange={(e) =>
                  setClassModal({ ...classModal, name: e.target.value })
                }
                placeholder="例如：高一(2)班"
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setClassModal(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Student Modal */}
      {addStudentOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddStudent}
            className="bg-white rounded-2xl border border-slate-200 p-5 w-full max-w-sm space-y-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                添加学生到班级
              </h3>
              <button
                type="button"
                onClick={() => setAddStudentOpen(false)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block space-y-1">
              <span className="text-slate-600 font-medium">
                登录用户名（字母/数字/下划线）
              </span>
              <input
                type="text"
                required
                value={stuForm.username}
                onChange={(e) =>
                  setStuForm({ ...stuForm, username: e.target.value })
                }
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-slate-600 font-medium">真实姓名</span>
              <input
                type="text"
                required
                value={stuForm.realName}
                onChange={(e) =>
                  setStuForm({ ...stuForm, realName: e.target.value })
                }
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-slate-600 font-medium">学号（可选）</span>
              <input
                type="text"
                value={stuForm.studentNo}
                onChange={(e) =>
                  setStuForm({ ...stuForm, studentNo: e.target.value })
                }
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-slate-600 font-medium">
                初始密码（至少 6 位，留空则使用系统初始默认设置）
              </span>
              <input
                type="password"
                value={stuForm.password}
                onChange={(e) =>
                  setStuForm({ ...stuForm, password: e.target.value })
                }
                placeholder="至少 6 位"
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddStudentOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium"
              >
                确认添加
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CSV Import Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 w-full max-w-lg space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                CSV 批量导入学生账号
              </h3>
              <button
                type="button"
                onClick={() => setCsvModalOpen(false)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600 leading-relaxed">
              每行一名学生，字段顺序：
              <span className="font-mono text-slate-900">
                用户名,真实姓名,学号,初始密码
              </span>
              （学号和初始密码可省略，首次登录后学生会收到修改密码提醒）。
            </p>
            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl font-mono text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCsvModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleCsvImport()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium"
              >
                开始导入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Student Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              重置密码 - {resetTarget.realName}
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
    </div>
  );
}

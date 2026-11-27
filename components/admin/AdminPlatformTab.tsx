'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, Link2, Loader2, XCircle } from 'lucide-react';
import { adminFetch } from '@/lib/api';

interface PlatformStatus {
  mode: string;
  baseUrl: string;
  webUrl: string;
  ssoEnabled: boolean;
  studentDirectLogin: string;
  reach: {
    configured: boolean;
    circuitOpen: boolean;
    lastOkAt: string;
    lastErrorAt: string;
    lastError: string;
  };
  boundUsers: number;
  unboundUsers: number;
  alignedClasses: number;
  unalignedClasses: number;
}

interface AlignItem {
  id: string;
  name: string;
  grade: string;
  teacherName: string;
  studentCount: number;
  platformClassId: number | null;
  platformName: string;
  suggestedId: number | null;
}

interface AlignData {
  platformReachable: boolean;
  platformClasses: Array<{
    id: number;
    className: string;
    gradeLevel: string;
    displayName: string;
  }>;
  items: AlignItem[];
}

const DIRECT_LOGIN_LABELS: Record<string, string> = {
  warn: '允许，并提示学生平时从平台进入',
  deny: '禁止，学生只能从平台进入',
  allow: '允许，不提示',
};

function formatTime(value: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

/** 平台对接的管理工具：连接状态、把本地班级与平台班级对齐 */
export default function AdminPlatformTab() {
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [align, setAlign] = useState<AlignData | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [busyClassId, setBusyClassId] = useState('');

  const fetchAll = useCallback(
    () =>
      Promise.all([
        adminFetch<PlatformStatus>('/api/admin/platform/status'),
        adminFetch<AlignData>('/api/admin/platform/align-candidates'),
      ]),
    []
  );

  const applyData = useCallback(([s, a]: [PlatformStatus, AlignData]) => {
    setStatus(s);
    setAlign(a);
    setSelections(() => {
      const next: Record<string, string> = {};
      for (const item of a.items) {
        const current =
          item.platformClassId !== null
            ? String(item.platformClassId)
            : item.suggestedId !== null
              ? String(item.suggestedId)
              : '';
        if (current) next[item.id] = current;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    fetchAll()
      .then((data) => {
        if (active) applyData(data);
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : '加载失败');
      });
    return () => {
      active = false;
    };
  }, [fetchAll, applyData]);

  const load = useCallback(async () => {
    try {
      applyData(await fetchAll());
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败');
    }
  }, [fetchAll, applyData]);

  const handleCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await adminFetch<{ ok: boolean; latencyMs?: number; error?: string }>(
        '/api/admin/platform/check',
        { method: 'POST' }
      );
      setCheckResult(
        res.ok
          ? { ok: true, text: `连接正常，耗时 ${res.latencyMs ?? '?'} 毫秒` }
          : { ok: false, text: res.error || '连接失败' }
      );
    } catch (e) {
      setCheckResult({ ok: false, text: e instanceof Error ? e.message : '连接失败' });
    } finally {
      setChecking(false);
      void load();
    }
  };

  const handleAlign = async (item: AlignItem) => {
    const selected = selections[item.id] ?? '';
    const platformClassId = selected ? Number(selected) : null;
    setBusyClassId(item.id);
    setErr('');
    setMsg('');
    try {
      await adminFetch('/api/admin/platform/align-class', {
        method: 'POST',
        body: JSON.stringify({ classId: item.id, platformClassId }),
      });
      setMsg(
        platformClassId === null
          ? `已解除「${item.name}」与平台班级的对齐`
          : `已把「${item.name}」对齐到平台班级`
      );
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusyClassId('');
    }
  };

  const platformClassOptions = [...(align?.platformClasses || [])].sort((a, b) =>
    `${a.gradeLevel}${a.displayName}`.localeCompare(`${b.gradeLevel}${b.displayName}`, 'zh-CN')
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">平台对接</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          教师与学生账号来自个性化学习平台；这里查看连接状态，并把本系统的班级与平台班级对应起来
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

      {!status || !align ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">成员验证方式</div>
              <div className="text-base font-bold text-slate-900 mt-1">个性化学习平台</div>
              <div className="text-[11px] text-slate-400 mt-0.5 break-all">{status.baseUrl}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">从平台一键进入</div>
              <div
                className={`text-base font-bold mt-1 ${
                  status.ssoEnabled ? 'text-teal-700' : 'text-slate-400'
                }`}
              >
                {status.ssoEnabled ? '已启用' : '未启用'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 break-all">
                {status.ssoEnabled ? `${status.webUrl}/caozuoti/` : '联系管理员开启后显示入口'}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">学生用密码直接登录</div>
              <div className="text-base font-bold text-slate-900 mt-1">
                {status.studentDirectLogin === 'deny' ? '已禁止' : '已允许'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {DIRECT_LOGIN_LABELS[status.studentDirectLogin] || status.studentDirectLogin}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">账号</div>
              <div className="text-base font-bold text-slate-900 mt-1 tabular-nums">
                {status.boundUsers}{' '}
                <span className="text-xs font-normal text-slate-500">已绑定平台</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                另有 {status.unboundUsers} 个未绑定的旧账号
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">连接状态</h3>
              <button
                type="button"
                disabled={checking}
                onClick={() => void handleCheck()}
                className="h-8 px-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 self-start sm:self-center"
              >
                {checking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Activity className="w-3.5 h-3.5" />
                )}
                <span>{checking ? '正在检测...' : '检测连接'}</span>
              </button>
            </div>

            {checkResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  checkResult.ok
                    ? 'bg-teal-50 border-teal-200 text-teal-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {checkResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{checkResult.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                <div className="text-slate-500">最近一次连通</div>
                <div className="font-medium text-slate-900 mt-1 tabular-nums">
                  {formatTime(status.reach.lastOkAt)}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                <div className="text-slate-500">最近一次失败</div>
                <div className="font-medium text-slate-900 mt-1 tabular-nums">
                  {formatTime(status.reach.lastErrorAt)}
                </div>
                {status.reach.lastError && (
                  <div className="text-[11px] text-red-600 mt-1 break-all">
                    {status.reach.lastError}
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                <div className="text-slate-500">保护状态</div>
                <div
                  className={`font-medium mt-1 ${
                    status.reach.circuitOpen ? 'text-amber-700' : 'text-teal-700'
                  }`}
                >
                  {status.reach.circuitOpen ? '平台连续不通，暂时快速拒绝新登录' : '正常'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  平台不通时不影响已登录的用户
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              平台停机时，已登录的用户照常答题交卷，只有新登录会受影响。
              旧账号若因为两边用户名不同而没有被自动认领，到「用户与角色」里对该账号点「继承旧账号」。
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">班级对齐</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                把本系统里原有的班级与平台上的同一个班对应起来。对齐后，这个班以前发布的考试继续有效，
                平台上的学生进入本系统时也会落在这个班里。
                已对齐 {status.alignedClasses} 个，未对齐 {status.unalignedClasses} 个。
              </p>
            </div>

            {!align.platformReachable && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                暂时读不到平台的班级列表，请先「检测连接」，待平台可达后再刷新本页。
              </div>
            )}

            {align.items.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">本系统还没有班级</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3 font-medium">本系统班级</th>
                      <th className="py-2.5 px-3 font-medium">归属教师</th>
                      <th className="py-2.5 px-3 font-medium text-right">学生数</th>
                      <th className="py-2.5 px-3 font-medium">对应的平台班级</th>
                      <th className="py-2.5 px-3 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {align.items.map((item) => {
                      const selected = selections[item.id] ?? '';
                      const unchanged =
                        selected ===
                        (item.platformClassId === null ? '' : String(item.platformClassId));
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900">
                              {item.grade} {item.name}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {item.teacherName || '—'}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                            {item.studentCount}
                          </td>
                          <td className="py-3 px-3">
                            <select
                              value={selected}
                              onChange={(e) =>
                                setSelections((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              disabled={!align.platformReachable || busyClassId === item.id}
                              className="h-8 px-2 border border-slate-300 rounded-lg bg-white text-xs max-w-[16rem]"
                            >
                              <option value="">未对齐</option>
                              {platformClassOptions.map((p) => (
                                <option key={p.id} value={String(p.id)}>
                                  {p.displayName}（编号 {p.id}）
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              disabled={
                                unchanged || busyClassId !== '' || !align.platformReachable
                              }
                              onClick={() => void handleAlign(item)}
                              className="text-sky-700 hover:underline disabled:text-slate-300 disabled:no-underline font-medium inline-flex items-center gap-0.5"
                            >
                              {busyClassId === item.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Link2 className="w-3 h-3" />
                              )}
                              <span>
                                {selected
                                  ? item.platformClassId === null
                                    ? '对齐'
                                    : '保存'
                                  : item.platformClassId !== null
                                    ? '解除对齐'
                                    : '对齐'}
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

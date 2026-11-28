'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  Cpu,
  Layers,
  Loader2,
  Save,
  Star,
} from 'lucide-react';
import { adminFetch } from '@/lib/api';
import { refreshAuthConfig, type PublicSubjectSummary } from '@/lib/authConfig';
import { computeSiteTitle } from '@/lib/subjects';
import { TYPE_LABELS, type SubjectId } from '@/lib/types';

interface SubjectStats {
  kpCount: number;
  questionCount: number;
  examCount: number;
  teacherCount: number;
}

interface SubjectsResponse {
  subjects: PublicSubjectSummary[];
  enabledSubjects: PublicSubjectSummary[];
  defaultSubjectId: SubjectId;
  siteTitle: string;
  customSiteTitle: string;
  stats: Record<string, SubjectStats>;
}

export default function AdminSubjectsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<PublicSubjectSummary[]>([]);
  const [defaultSubjectId, setDefaultSubjectId] = useState<SubjectId>('it');
  const [customSiteTitle, setCustomSiteTitle] = useState('');
  const [stats, setStats] = useState<Record<string, SubjectStats>>({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    adminFetch<SubjectsResponse>('/api/admin/subjects')
      .then((res) => {
        setSubjects(res.subjects);
        setDefaultSubjectId(res.defaultSubjectId);
        setCustomSiteTitle(res.customSiteTitle || '');
        setStats(res.stats || {});
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : '加载学科配置失败');
      })
      .finally(() => setLoading(false));
  }, []);

  const enabledSubjects = useMemo(
    () => subjects.filter((s) => s.isEnabled),
    [subjects]
  );

  const previewTitle = useMemo(
    () => computeSiteTitle(enabledSubjects, customSiteTitle),
    [enabledSubjects, customSiteTitle]
  );

  const toggleSubject = (id: SubjectId) => {
    setErr('');
    setMsg('');
    const target = subjects.find((s) => s.id === id);
    if (!target) return;
    if (target.isEnabled && enabledSubjects.length <= 1) {
      setErr('系统至少需要保留 1 个已启用学科，不能全部关闭');
      return;
    }
    const next = subjects.map((s) =>
      s.id === id ? { ...s, isEnabled: !s.isEnabled } : s
    );
    setSubjects(next);
    const nextEnabled = next.filter((s) => s.isEnabled);
    if (!nextEnabled.some((s) => s.id === defaultSubjectId) && nextEnabled[0]) {
      setDefaultSubjectId(nextEnabled[0].id);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enabledSubjects.length === 0) {
      setErr('至少需要启用 1 个学科');
      return;
    }
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const res = await adminFetch<{
        ok: boolean;
        subjects: PublicSubjectSummary[];
        defaultSubjectId: SubjectId;
        siteTitle: string;
        customSiteTitle: string;
      }>('/api/admin/subjects', {
        method: 'PUT',
        body: JSON.stringify({
          subjects: subjects.map((s) => ({ id: s.id, isEnabled: s.isEnabled })),
          defaultSubjectId,
          customSiteTitle,
        }),
      });
      setSubjects(res.subjects);
      setDefaultSubjectId(res.defaultSubjectId);
      setCustomSiteTitle(res.customSiteTitle || '');
      await refreshAuthConfig();
      setMsg(`学科与系统名称配置已保存，当前站点名称：「${res.siteTitle}」`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存学科配置失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">学科与站点配置</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            自由启用或关闭学科模块，指定默认学科，并实时自定义学生/教师端显示的平台标题
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="h-9 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 self-start"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>{saving ? '保存中...' : '保存学科配置'}</span>
        </button>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}
      {err && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {err}
        </div>
      )}

      {/* Site Title Customization */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-sky-600" />
            <span>全站顶部标题设置</span>
          </span>
          <span className="text-slate-500">
            实时预览：<strong className="text-slate-900">{previewTitle}</strong>
          </span>
        </div>
        <div className="grid sm:grid-cols-12 gap-3 items-center">
          <input
            type="text"
            maxLength={60}
            value={customSiteTitle}
            onChange={(e) => setCustomSiteTitle(e.target.value)}
            placeholder="留空则按已启用学科自动命名（单学科显示「XX会考·操作题系统」，双学科显示「高中会考实操练习与测评系统」）"
            className="sm:col-span-9 h-9 px-3 border border-slate-300 rounded-lg text-sm"
          />
          <button
            type="button"
            onClick={() => setCustomSiteTitle('')}
            className="sm:col-span-3 h-9 px-3 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600"
          >
            恢复自动命名
          </button>
        </div>
      </div>

      {/* Subject Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {subjects.map((sub) => {
          const st = stats[sub.id] || {
            kpCount: 0,
            questionCount: 0,
            examCount: 0,
            teacherCount: 0,
          };
          const isDefault = defaultSubjectId === sub.id;
          const Icon = sub.id === 'gt' ? Cpu : BookOpenCheck;

          return (
            <div
              key={sub.id}
              className={`rounded-2xl border p-5 space-y-4 transition-colors ${
                sub.isEnabled
                  ? 'bg-white border-slate-200'
                  : 'bg-slate-50/70 border-slate-200 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      sub.isEnabled
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {sub.name}
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400">
                        ({sub.id})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {sub.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Resource Stats */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
                <div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">
                    {st.kpCount}
                  </div>
                  <div className="text-[11px] text-slate-500">知识点</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">
                    {st.questionCount}
                  </div>
                  <div className="text-[11px] text-slate-500">题库题数</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">
                    {st.examCount}
                  </div>
                  <div className="text-[11px] text-slate-500">考试任务</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">
                    {st.teacherCount}
                  </div>
                  <div className="text-[11px] text-slate-500">专属教师</div>
                </div>
              </div>

              {/* Included Modules */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-slate-500">
                  包含交互操作题型（{sub.questionTypes.length} 类）：
                </div>
                <div className="text-xs text-slate-700 leading-relaxed">
                  {sub.questionTypes.map((qt) => TYPE_LABELS[qt]).join(' · ')}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => toggleSubject(sub.id)}
                  className={`h-8 px-3 rounded-lg font-medium border transition-colors ${
                    sub.isEnabled
                      ? 'border-red-200 text-red-700 bg-red-50/50 hover:bg-red-50'
                      : 'border-teal-200 text-teal-800 bg-teal-50 hover:bg-teal-100'
                  }`}
                >
                  {sub.isEnabled ? '停用该学科' : '启用该学科'}
                </button>

                <button
                  type="button"
                  disabled={!sub.isEnabled || isDefault}
                  onClick={() => setDefaultSubjectId(sub.id)}
                  className={`h-8 px-3 rounded-lg font-medium inline-flex items-center gap-1 border ${
                    isDefault
                      ? 'border-sky-300 bg-sky-50 text-sky-800'
                      : !sub.isEnabled
                        ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>{isDefault ? '当前默认学科' : '设为默认学科'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </form>
  );
}

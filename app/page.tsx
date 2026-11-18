'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe,
  Loader2,
  Play,
  Sparkles,
} from 'lucide-react';
import StudentHeader from '@/components/StudentHeader';
import { getStudentToken, studentFetch } from '@/lib/api';
import {
  TYPE_LABELS,
  type DifficultyLevel,
  type QuestionType,
  type StudentProfile,
} from '@/lib/types';

interface QuestionSummary {
  id: string;
  title: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  knowledgePoints: string[];
  scenario: string;
  totalScore: number;
  source: 'seed' | 'ai';
}

const CATEGORIES: Array<{
  type: QuestionType;
  name: string;
  desc: string;
  icon: typeof FileText;
  accent: string;
}> = [
  {
    type: 'word',
    name: 'Word 文字处理',
    desc: '字体段落排版、查找替换、表格与图文混排、页眉页脚及页面设置',
    icon: FileText,
    accent: 'text-sky-700 bg-sky-50',
  },
  {
    type: 'excel',
    name: 'Excel 电子表格',
    desc: '常用函数公式（SUM/AVERAGE/IF/RANK）、排序筛选、合并居中与图表制作',
    icon: FileSpreadsheet,
    accent: 'text-teal-700 bg-teal-50',
  },
  {
    type: 'web',
    name: '网页制作 (HTML/CSS)',
    desc: '网页标签结构、图片替代文本、超链接、列表表格表单与 CSS 样式规则',
    icon: Globe,
    accent: 'text-sky-700 bg-sky-50',
  },
  {
    type: 'file',
    name: '文件与文件夹管理',
    desc: '新建目录、重命名、复制移动、快捷方式创建与只读/隐藏属性设置',
    icon: FolderOpen,
    accent: 'text-teal-700 bg-teal-50',
  },
];

export default function StudentHomePage() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [countsByType, setCountsByType] = useState<Record<string, number>>({});
  const [kpByType, setKpByType] = useState<Record<string, string[]>>({});

  const [selectedType, setSelectedType] = useState<QuestionType>('word');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('基础');
  const [knowledgePoint, setKnowledgePoint] = useState<string>('');
  const [drawMode, setDrawMode] = useState<'auto' | 'bank' | 'ai'>('auto');

  const [launching, setLaunching] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Question bank list
  const [bankFilterType, setBankFilterType] = useState<string>('');
  const [bankFilterDiff, setBankFilterDiff] = useState<string>('');
  const [bankItems, setBankItems] = useState<QuestionSummary[]>([]);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankPage, setBankPage] = useState(1);
  const [loadingBank, setLoadingBank] = useState(true);

  const loadBank = useCallback(async (page: number, t: string, d: string) => {
    setLoadingBank(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: '8',
      });
      if (t) qs.set('type', t);
      if (d) qs.set('difficulty', d);
      const data = await studentFetch<{
        items: QuestionSummary[];
        total: number;
      }>(`/api/questions?${qs.toString()}`);
      setBankItems(data.items);
      setBankTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoadingBank(false);
    }
  }, []);

  useEffect(() => {
    const token = getStudentToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    (async () => {
      try {
        const me = await studentFetch<{ student: StudentProfile }>(
          '/api/auth/me'
        );
        setStudent(me.student);
        const meta = await studentFetch<{
          countsByType: Record<string, number>;
          knowledgePointsByType: Record<string, string[]>;
        }>('/api/questions/meta');
        setCountsByType(meta.countsByType);
        setKpByType(meta.knowledgePointsByType);
        await loadBank(1, '', '');
      } catch {
        router.replace('/login');
      }
    })();
  }, [router, loadBank]);

  const handleStartPractice = async () => {
    setErrorMsg('');
    setLaunching(true);
    try {
      const res = await studentFetch<{ questionId: string }>(
        '/api/questions/draw',
        {
          method: 'POST',
          body: JSON.stringify({
            type: selectedType,
            difficulty,
            knowledgePoint: knowledgePoint || undefined,
            mode: drawMode,
          }),
        }
      );
      router.push(`/practice/${res.questionId}`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '抽取题目失败，请稍后重试'
      );
      setLaunching(false);
    }
  };

  const handleStartExam = async () => {
    setErrorMsg('');
    setStartingExam(true);
    try {
      const res = await studentFetch<{ examId: string }>('/api/exams/start', {
        method: 'POST',
      });
      router.push(`/exam?examId=${res.examId}`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '创建模拟试卷失败，请稍后重试'
      );
      setStartingExam(false);
    }
  };

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  const availableKps = kpByType[selectedType] || [];
  const totalPages = Math.max(1, Math.ceil(bankTotal / 8));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader student={student} />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Hero & Exam CTA */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-medium text-sky-700">
              高中信息技术学业水平考试 · 全真模拟操作训练
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              在真实模拟环境中反复演练每一道操作题
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              涵盖文字处理、电子表格、网页制作与文件管理四大核心模块。系统依据会考评分细则自动逐点判分，并实时提供分步解析与参考答案对比。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleStartExam}
              disabled={startingExam}
              className="h-11 px-5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium rounded-xl text-sm transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              {startingExam ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              <span>{startingExam ? '正在组卷...' : '开始全真模拟考试 (40分钟)'}</span>
            </button>
          </div>
        </section>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Practice Configurator + 4 Module Cards */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 4 Categories Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = selectedType === cat.type;
              return (
                <button
                  key={cat.type}
                  type="button"
                  onClick={() => {
                    setSelectedType(cat.type);
                    setKnowledgePoint('');
                  }}
                  className={`text-left p-5 rounded-xl border transition-colors bg-white ${
                    active
                      ? 'border-sky-600 ring-2 ring-sky-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${cat.accent}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">
                      题库 {countsByType[cat.type] || 0} 题
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {cat.name}
                  </h2>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    {cat.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Launch Panel */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                专项练习设置
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                当前题型：{TYPE_LABELS[selectedType]}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-700 block">
                选择难度
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(['基础', '中等', '提高'] as DifficultyLevel[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                      difficulty === d
                        ? 'border-sky-600 bg-sky-50 text-sky-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                知识点标签（可选）
              </label>
              <select
                value={knowledgePoint}
                onChange={(e) => setKnowledgePoint(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
              >
                <option value="">全部知识点</option>
                {availableKps.map((kp) => (
                  <option key={kp} value={kp}>
                    {kp}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-700 block">
                题目来源
              </span>
              <div className="space-y-1.5 text-xs">
                {(
                  [
                    {
                      v: 'auto',
                      label: '智能抽题（优先题库，不足时 AI 实时生成）',
                    },
                    { v: 'bank', label: '仅从已发布题库中随机抽取' },
                    { v: 'ai', label: 'AI 大模型实时生成全新操作题' },
                  ] as const
                ).map((m) => (
                  <label
                    key={m.v}
                    className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name="drawMode"
                      checked={drawMode === m.v}
                      onChange={() => setDrawMode(m.v)}
                    />
                    <span className="text-slate-700">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartPractice}
              disabled={launching}
              className="w-full h-11 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {launching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {drawMode === 'ai'
                      ? '正在调用 AI 生成并自检题目...'
                      : '正在准备操作环境...'}
                  </span>
                </>
              ) : (
                <>
                  {drawMode === 'ai' ? (
                    <Sparkles className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span>开始练习</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Published Question Bank Browser */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                精选操作题题库
              </h2>
              <p className="text-xs text-slate-500">
                也可直接从下方题库任选一道题目进入练习
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={bankFilterType}
                onChange={(e) => {
                  const val = e.target.value;
                  setBankFilterType(val);
                  setBankPage(1);
                  loadBank(1, val, bankFilterDiff);
                }}
                className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="">全部题型</option>
                <option value="word">Word 文字处理</option>
                <option value="excel">Excel 电子表格</option>
                <option value="web">网页制作 (HTML/CSS)</option>
                <option value="file">文件与文件夹管理</option>
              </select>
              <select
                value={bankFilterDiff}
                onChange={(e) => {
                  const val = e.target.value;
                  setBankFilterDiff(val);
                  setBankPage(1);
                  loadBank(1, bankFilterType, val);
                }}
                className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="">全部难度</option>
                <option value="基础">基础</option>
                <option value="中等">中等</option>
                <option value="提高">提高</option>
              </select>
            </div>
          </div>

          {loadingBank ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
            </div>
          ) : bankItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              当前筛选条件下暂无题目
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {bankItems.map((q) => (
                <div
                  key={q.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {q.title}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                      <span>{TYPE_LABELS[q.type]}</span>
                      <span aria-hidden="true">·</span>
                      <span>难度 {q.difficulty}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">满分 {q.totalScore} 分</span>
                      <span aria-hidden="true">·</span>
                      <span>{q.knowledgePoints.join(' / ')}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/practice/${q.id}`)}
                    className="px-4 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                  >
                    进入作答
                  </button>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="tabular-nums">
                第 {bankPage} / {totalPages} 页（共 {bankTotal} 题）
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={bankPage <= 1}
                  onClick={() => {
                    const p = bankPage - 1;
                    setBankPage(p);
                    loadBank(p, bankFilterType, bankFilterDiff);
                  }}
                  className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  type="button"
                  disabled={bankPage >= totalPages}
                  onClick={() => {
                    const p = bankPage + 1;
                    setBankPage(p);
                    loadBank(p, bankFilterType, bankFilterDiff);
                  }}
                  className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

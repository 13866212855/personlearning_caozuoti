'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  Edit3,
  Eye,
  Globe,
  Loader2,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import SimulatorRenderer from '@/components/simulators/SimulatorRenderer';
import { useAuthConfig } from '@/hooks/useAuthConfig';
import { getCachedPortalUser, portalFetch } from '@/lib/api';
import {
  getSubjectForType,
  getSubjectTypes,
  SUBJECT_LABELS,
  SUBJECT_PACKS,
} from '@/lib/subjects';
import {
  TYPE_LABELS,
  type CheckpointResult,
  type DifficultyLevel,
  type FullQuestion,
  type KnowledgePointItem,
  type QuestionType,
  type SimulatorState,
  type SubjectId,
} from '@/lib/types';

interface PreviewQuestion extends FullQuestion {
  localId: string;
}

function createEmptySimulatorState(type: QuestionType): SimulatorState {
  switch (type) {
    case 'excel':
      return { cells: {}, merges: [], charts: [] };
    case 'web':
      return { files: [] };
    case 'file':
      return { items: [] };
    case 'python':
      return { code: '', customInput: '', lastOutput: '', lastError: '' };
    case 'database':
      return { tables: [], sql: '', lastColumns: [], lastRows: [], lastChanges: 0, lastError: '' };
    case 'sketch3view':
      return { gridCols: 10, gridRows: 10, givenLines: [], lines: [], dimensions: [] };
    case 'circuit':
      return { components: [], wires: [], powered: false, lightLevel: 50, tempC: 25 };
    case 'structure':
      return {
        nodes: [],
        baseMembers: [],
        members: [],
        jointType: 'rigid',
        supportBaseWidth: 120,
        testLoadN: 50,
      };
    case 'control':
      return {
        mode: 'closed',
        availableOptions: [],
        slots: { input: '', controller: '', actuator: '', plant: '', output: '' },
        hasFeedbackEdge: false,
      };
    case 'craft':
      return {
        availableSteps: [],
        orderedSteps: [],
        availableTools: [],
        selectedTools: {},
        safetyOptions: [],
        safetyChecks: [],
      };
    case 'word':
    default:
      return {
        paragraphs: [],
        tables: [],
        images: [],
        headerText: '',
        footerText: '',
        pageSetup: {
          orientation: 'portrait',
          marginTop: 2.54,
          marginBottom: 2.54,
          marginLeft: 3.18,
          marginRight: 3.18,
        },
      };
  }
}

function normalizeFullQuestion(raw: FullQuestion): FullQuestion {
  const safeType: QuestionType = raw?.type || 'word';
  const safeSteps = Array.isArray(raw?.steps) ? raw.steps : [];
  const safeCheckpoints = Array.isArray(raw?.checkpoints) ? raw.checkpoints : [];
  return {
    ...raw,
    type: safeType,
    title: String(raw?.title || '未命名操作题'),
    scenario: String(raw?.scenario || ''),
    totalScore: Number(raw?.totalScore || 100),
    knowledgePoints: Array.isArray(raw?.knowledgePoints)
      ? raw.knowledgePoints
      : [],
    knowledgePointIds: Array.isArray(raw?.knowledgePointIds)
      ? raw.knowledgePointIds
      : [],
    materials: raw?.materials?.initialState
      ? raw.materials
      : {
          description: raw?.materials?.description || '',
          assets: Array.isArray(raw?.materials?.assets) ? raw.materials.assets : undefined,
          initialState: createEmptySimulatorState(safeType),
        },
    steps: safeSteps,
    checkpoints: safeCheckpoints,
    analysis: Array.isArray(raw?.analysis) ? raw.analysis : [],
    commonMistakes: Array.isArray(raw?.commonMistakes)
      ? raw.commonMistakes
      : [],
  };
}

const ANHUI_KP_PRESETS: Record<
  QuestionType,
  Array<{ label: string; kpIds: string[] }>
> = {
  word: [
    {
      label: '会考高频：图文混排综合',
      kpIds: ['kp-word-1', 'kp-word-7', 'kp-word-8', 'kp-word-9', 'kp-word-3', 'kp-word-5'],
    },
    {
      label: '会考高频：表格与页面版式',
      kpIds: ['kp-word-1', 'kp-word-2', 'kp-word-4', 'kp-word-6'],
    },
  ],
  excel: [
    {
      label: '会考高频：函数计算与排名',
      kpIds: ['kp-excel-7', 'kp-excel-4', 'kp-excel-1', 'kp-excel-11', 'kp-excel-6'],
    },
    {
      label: '会考高频：统计排序筛选图表',
      kpIds: ['kp-excel-8', 'kp-excel-10', 'kp-excel-2', 'kp-excel-14', 'kp-excel-3'],
    },
  ],
  web: [
    {
      label: '会考高频：图文超链接网页',
      kpIds: ['kp-web-7', 'kp-web-1', 'kp-web-8', 'kp-web-2', 'kp-web-12'],
    },
    {
      label: '会考高频：CSS样式与表格列表',
      kpIds: ['kp-web-6', 'kp-web-9', 'kp-web-3', 'kp-web-5', 'kp-web-11', 'kp-web-13'],
    },
  ],
  file: [
    {
      label: '会考高频：目录分类与移动重命名',
      kpIds: ['kp-file-1', 'kp-file-6', 'kp-file-7', 'kp-file-8'],
    },
    {
      label: '会考高频：复制、快捷方式与属性',
      kpIds: ['kp-file-2', 'kp-file-3', 'kp-file-5', 'kp-file-10'],
    },
  ],
  python: [
    {
      label: '新课标高频：输入输出与分支循环',
      kpIds: ['kp-python-1', 'kp-python-2', 'kp-python-4', 'kp-python-5'],
    },
    {
      label: '新课标高频：列表统计与函数算法',
      kpIds: ['kp-python-7', 'kp-python-8', 'kp-python-10', 'kp-python-11'],
    },
  ],
  database: [
    {
      label: '会考高频：SELECT 筛选排序查询',
      kpIds: ['kp-db-1', 'kp-db-2', 'kp-db-3'],
    },
    {
      label: '会考高频：统计聚合与增删改',
      kpIds: ['kp-db-4', 'kp-db-5', 'kp-db-6', 'kp-db-7'],
    },
  ],
  sketch3view: [
    {
      label: '会考高频：三视图补画实线与虚线',
      kpIds: ['kp-gt-sketch-1', 'kp-gt-sketch-2', 'kp-gt-sketch-3', 'kp-gt-sketch-4'],
    },
    {
      label: '会考高频：组合体尺寸标注与中心线',
      kpIds: ['kp-gt-sketch-5', 'kp-gt-sketch-6', 'kp-gt-sketch-8', 'kp-gt-sketch-9'],
    },
  ],
  circuit: [
    {
      label: '会考高频：光敏/热敏传感器开关控制',
      kpIds: ['kp-gt-circuit-1', 'kp-gt-circuit-2', 'kp-gt-circuit-5', 'kp-gt-circuit-8'],
    },
    {
      label: '会考高频：三极管与继电器负载回路',
      kpIds: ['kp-gt-circuit-3', 'kp-gt-circuit-5', 'kp-gt-circuit-7', 'kp-gt-circuit-9'],
    },
  ],
  structure: [
    {
      label: '会考高频：三角形斜撑加固与稳定性',
      kpIds: ['kp-gt-structure-1', 'kp-gt-structure-3', 'kp-gt-structure-4', 'kp-gt-structure-8'],
    },
    {
      label: '会考高频：材料选型与连接方式对比',
      kpIds: ['kp-gt-structure-5', 'kp-gt-structure-6', 'kp-gt-structure-7', 'kp-gt-structure-9'],
    },
  ],
  control: [
    {
      label: '会考高频：闭环控制框图与反馈环节',
      kpIds: ['kp-gt-control-4', 'kp-gt-control-5', 'kp-gt-control-6', 'kp-gt-control-7'],
    },
    {
      label: '会考高频：开环控制辨析与干扰分析',
      kpIds: ['kp-gt-control-2', 'kp-gt-control-3', 'kp-gt-control-8', 'kp-gt-control-9'],
    },
  ],
  craft: [
    {
      label: '会考高频：金工加工时序与工量具匹配',
      kpIds: ['kp-gt-craft-1', 'kp-gt-craft-2', 'kp-gt-craft-3', 'kp-gt-craft-4'],
    },
    {
      label: '会考高频：游标卡尺读数与钻孔安全',
      kpIds: ['kp-gt-craft-5', 'kp-gt-craft-7', 'kp-gt-craft-8', 'kp-gt-craft-9'],
    },
  ],
};

export default function TeacherQuestionStudioTab() {
  const auth = useAuthConfig();
  const enabledSubjects: SubjectId[] =
    auth?.enabledSubjects && auth.enabledSubjects.length > 0
      ? auth.enabledSubjects.map((s) => s.id)
      : ['it', 'gt'];

  const [subTab, setSubTab] = useState<'ai' | 'bank'>('ai');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [subjectOverride, setSubjectOverride] = useState<SubjectId | null>(null);
  const activeSubject: SubjectId = (() => {
    if (subjectOverride && enabledSubjects.includes(subjectOverride)) {
      return subjectOverride;
    }
    const cachedSubject = getCachedPortalUser()?.subjectId;
    if (
      (cachedSubject === 'it' || cachedSubject === 'gt') &&
      enabledSubjects.includes(cachedSubject)
    ) {
      return cachedSubject;
    }
    if (auth?.defaultSubjectId && enabledSubjects.includes(auth.defaultSubjectId)) {
      return auth.defaultSubjectId;
    }
    return enabledSubjects[0] || 'it';
  })();

  // Knowledge points & AI Quota
  const [kps, setKps] = useState<KnowledgePointItem[]>([]);
  const [quota, setQuota] = useState({ used: 0, limit: 30, remaining: 30 });
  const [selectedKpIds, setSelectedKpIds] = useState<string[]>([]);
  const [kpFilter, setKpFilter] = useState('');
  const [newKpChapter, setNewKpChapter] = useState('教师自定义');
  const [newKpName, setNewKpName] = useState('');
  const [addingKp, setAddingKp] = useState(false);

  // AI Form
  const [genMode, setGenMode] = useState<'ai' | 'template'>('ai');
  const [aiTypeState, setAiType] = useState<QuestionType>(() => {
    const cachedSubject = getCachedPortalUser()?.subjectId;
    return cachedSubject === 'gt' ? 'sketch3view' : 'excel';
  });
  const aiType: QuestionType = getSubjectTypes(activeSubject).includes(aiTypeState)
    ? aiTypeState
    : activeSubject === 'gt'
      ? 'sketch3view'
      : 'excel';
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('中等');
  const [count, setCount] = useState(1);
  const [stepCount, setStepCount] = useState(4);
  const [totalScore, setTotalScore] = useState(100);
  const [needsImage, setNeedsImage] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewList, setPreviewList] = useState<PreviewQuestion[]>([]);
  const [savingId, setSavingId] = useState('');
  const [expandedAnalysisIds, setExpandedAnalysisIds] = useState<string[]>([]);

  // Bank list
  const [scope, setScope] = useState<'all' | 'mine' | 'system' | 'shared'>('all');
  const [bankSubject, setBankSubject] = useState<'' | SubjectId>('');
  const [bankType, setBankType] = useState('');
  const [bankDiff, setBankDiff] = useState('');
  const [bankKeyword, setBankKeyword] = useState('');
  const [bankPage, setBankPage] = useState(1);
  const [bankItems, setBankItems] = useState<FullQuestion[]>([]);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankLoading, setBankLoading] = useState(false);

  // Trial Simulator ("试做") Modal
  const [trialQ, setTrialQ] = useState<FullQuestion | null>(null);
  const [trialState, setTrialState] = useState<SimulatorState | null>(null);
  const [trialGrading, setTrialGrading] = useState(false);
  const [trialResult, setTrialResult] = useState<{
    autoScore: number;
    maxScore: number;
    checkpointResults: CheckpointResult[];
  } | null>(null);

  // Quick Edit Bank Question Modal
  const [editTarget, setEditTarget] = useState<FullQuestion | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Quick Assign Questions to Class/Student Modal
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignQuestionIds, setAssignQuestionIds] = useState<string[]>([]);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignTargetType, setAssignTargetType] = useState<'class' | 'student'>('class');
  const [assignTargetIds, setAssignTargetIds] = useState<string[]>([]);
  const [assignClasses, setAssignClasses] = useState<
    Array<{ id: string; name: string; grade: string; studentCount: number }>
  >([]);
  const [assignStudents, setAssignStudents] = useState<
    Array<{ id: string; realName: string; username: string; className: string }>
  >([]);
  const [assignLoadingTargets, setAssignLoadingTargets] = useState(false);
  const [assignDuration, setAssignDuration] = useState(40);
  const [assignMaxAttempts, setAssignMaxAttempts] = useState(3);
  const [assignAnswerPolicy, setAssignAnswerPolicy] = useState<
    'immediate' | 'after_end' | 'never'
  >('immediate');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const loadBank = useCallback(
    async (page = bankPage) => {
      setBankLoading(true);
      try {
        const qs = new URLSearchParams({
          scope,
          page: String(page),
          pageSize: '10',
        });
        if (bankSubject) qs.set('subjectId', bankSubject);
        if (bankType) qs.set('type', bankType);
        if (bankDiff) qs.set('difficulty', bankDiff);
        if (bankKeyword.trim()) qs.set('keyword', bankKeyword.trim());
        const res = await portalFetch<{
          items: FullQuestion[];
          total: number;
          page: number;
        }>(`/api/teacher/questions?${qs.toString()}`);
        setBankItems(Array.isArray(res?.items) ? res.items.map(normalizeFullQuestion) : []);
        setBankTotal(Number(res?.total || 0));
        setBankPage(Number(res?.page || 1));
      } catch (e) {
        setErr(e instanceof Error ? e.message : '加载题库失败');
      } finally {
        setBankLoading(false);
      }
    },
    [scope, bankSubject, bankType, bankDiff, bankKeyword, bankPage]
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      portalFetch<{ items: KnowledgePointItem[] }>('/api/teacher/knowledge-points'),
      portalFetch<{ aiQuota: { used: number; limit: number; remaining: number } }>(
        '/api/teacher/overview'
      ),
    ])
      .then(([kpRes, ovRes]) => {
        if (!active) return;
        setKps(Array.isArray(kpRes?.items) ? kpRes.items : []);
        if (ovRes?.aiQuota) {
          const q = ovRes.aiQuota;
          setQuota({
            used: q.used ?? 0,
            limit: q.limit ?? 30,
            remaining: q.remaining ?? Math.max(0, (q.limit ?? 30) - (q.used ?? 0)),
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (subTab !== 'bank') return;
    let active = true;
    const qs = new URLSearchParams({
      scope,
      page: '1',
      pageSize: '10',
    });
    if (bankSubject) qs.set('subjectId', bankSubject);
    if (bankType) qs.set('type', bankType);
    if (bankDiff) qs.set('difficulty', bankDiff);
    portalFetch<{
      items: FullQuestion[];
      total: number;
      page: number;
    }>(`/api/teacher/questions?${qs.toString()}`)
      .then((res) => {
        if (!active) return;
        setBankItems(Array.isArray(res?.items) ? res.items.map(normalizeFullQuestion) : []);
        setBankTotal(Number(res?.total || 0));
        setBankPage(Number(res?.page || 1));
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : '加载题库失败');
      });
    return () => {
      active = false;
    };
  }, [subTab, scope, bankSubject, bankType, bankDiff]);

  const kpCountByType = useMemo(() => {
    const counts: Record<QuestionType, number> = {
      word: 0,
      excel: 0,
      web: 0,
      file: 0,
      python: 0,
      database: 0,
      sketch3view: 0,
      circuit: 0,
      structure: 0,
      control: 0,
      craft: 0,
    };
    for (const k of kps) {
      if (k.type in counts) counts[k.type] += 1;
    }
    return counts;
  }, [kps]);

  const currentTypeKps = useMemo(
    () => kps.filter((k) => k.type === aiType),
    [kps, aiType]
  );

  const kpsByChapter = useMemo(() => {
    const kw = kpFilter.trim().toLowerCase();
    const filtered = kw
      ? currentTypeKps.filter(
          (k) =>
            k.name.toLowerCase().includes(kw) ||
            k.chapter.toLowerCase().includes(kw)
        )
      : currentTypeKps;
    const groups: Record<string, KnowledgePointItem[]> = {};
    for (const k of filtered) {
      if (!groups[k.chapter]) groups[k.chapter] = [];
      groups[k.chapter].push(k);
    }
    return groups;
  }, [currentTypeKps, kpFilter]);

  const toggleKp = (id: string) => {
    setSelectedKpIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const applyPresetKps = (kpIds: string[]) => {
    const validSet = new Set(currentTypeKps.map((k) => k.id));
    setSelectedKpIds(kpIds.filter((id) => validSet.has(id)));
  };

  const handleAddCustomKp = async () => {
    if (!newKpName.trim()) return;
    setAddingKp(true);
    setErr('');
    try {
      const res = await portalFetch<{ item: KnowledgePointItem }>(
        '/api/teacher/knowledge-points',
        {
          method: 'POST',
          body: JSON.stringify({
            type: aiType,
            chapter: newKpChapter.trim() || '教师自定义',
            name: newKpName.trim(),
          }),
        }
      );
      setKps((prev) => [...prev, res.item]);
      setSelectedKpIds((prev) => [...prev, res.item.id]);
      setNewKpName('');
      setMsg(`已添加自定义知识点「${res.item.name}」`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '添加知识点失败');
    } finally {
      setAddingKp(false);
    }
  };

  const handleGenerate = async (overrideMode?: 'ai' | 'template') => {
    const activeMode = overrideMode || genMode;
    if (overrideMode && overrideMode !== genMode) {
      setGenMode(overrideMode);
    }
    setGenerating(true);
    setErr('');
    setMsg('');
    const chosenKps = kps
      .filter((k) => selectedKpIds.includes(k.id))
      .map((k) => k.name);

    try {
      const res = await portalFetch<{
        questions?: FullQuestion[];
        errors?: string[];
        quota?: { used: number; limit: number; remaining: number };
      }>('/api/teacher/questions/ai-generate', {
        method: 'POST',
        body: JSON.stringify({
          mode: activeMode,
          type: aiType,
          difficulty,
          count,
          stepCount,
          totalScore,
          needsImage: aiType === 'word' || aiType === 'web' ? needsImage : false,
          knowledgePoints: chosenKps,
          knowledgePointIds: selectedKpIds,
          customPrompt: customPrompt.trim() || undefined,
        }),
      });
      if (res?.quota) setQuota(res.quota);
      const list = Array.isArray(res?.questions) ? res.questions : [];
      if (list.length === 0) {
        const errArr = Array.isArray(res?.errors) ? res.errors : [];
        throw new Error(
          errArr[0] || '出题服务未返回有效题目数据，请检查后台配置或改用「会考标准模板快速出题」'
        );
      }
      const wrapped: PreviewQuestion[] = list.map((rawQ, idx) => ({
        ...normalizeFullQuestion(rawQ),
        visibility: 'private',
        localId: `prev-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      }));
      setPreviewList((prev) => [...wrapped, ...prev]);
      const errArr = Array.isArray(res?.errors) ? res.errors : [];
      setMsg(
        `${activeMode === 'template' ? '会考标准模板引擎' : 'AI'}已生成 ${list.length} 道新题目，可先微调文字与步骤分值或「试做验证」后再入库${
          errArr.length > 0 ? `（部分失败：${errArr[0]}）` : ''
        }`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : '生成题目失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateOne = async (localId: string, q: PreviewQuestion) => {
    setSavingId(localId);
    setErr('');
    try {
      const res = await portalFetch<{
        questions?: FullQuestion[];
        quota?: { used: number; limit: number; remaining: number };
      }>('/api/teacher/questions/ai-generate', {
        method: 'POST',
        body: JSON.stringify({
          mode: genMode,
          type: q.type,
          difficulty: q.difficulty,
          count: 1,
          stepCount: (q.steps || []).length || stepCount,
          totalScore: q.totalScore || 100,
          knowledgePoints: Array.isArray(q.knowledgePoints) ? q.knowledgePoints : [],
          knowledgePointIds: Array.isArray(q.knowledgePointIds) ? q.knowledgePointIds : [],
          customPrompt: customPrompt.trim() || undefined,
        }),
      });
      if (res?.quota) setQuota(res.quota);
      const nextQ = Array.isArray(res?.questions) ? res.questions[0] : undefined;
      if (nextQ) {
        setPreviewList((prev) =>
          prev.map((item) =>
            item.localId === localId
              ? {
                  ...normalizeFullQuestion(nextQ),
                  visibility: item.visibility,
                  localId,
                }
              : item
          )
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '重新生成失败');
    } finally {
      setSavingId('');
    }
  };

  const savePreviewQuestion = async (
    q: PreviewQuestion,
    andAssign: boolean
  ) => {
    setSavingId(q.localId);
    setErr('');
    try {
      const steps = Array.isArray(q.steps) ? q.steps : [];
      const sumStepScore = steps.reduce((acc, s) => acc + Number(s.score || 0), 0);
      const effectiveTotal = sumStepScore > 0 ? sumStepScore : q.totalScore;
      const saved = await portalFetch<{ id: string }>('/api/teacher/questions', {
        method: 'POST',
        body: JSON.stringify({
          title: q.title,
          type: q.type,
          difficulty: q.difficulty,
          knowledgePoints: Array.isArray(q.knowledgePoints) ? q.knowledgePoints : [],
          knowledgePointIds: Array.isArray(q.knowledgePointIds) ? q.knowledgePointIds : [],
          scenario: q.scenario,
          totalScore: effectiveTotal,
          materials: q.materials,
          steps,
          checkpoints: Array.isArray(q.checkpoints) ? q.checkpoints : [],
          referenceAnswer: q.referenceAnswer,
          analysis: Array.isArray(q.analysis) ? q.analysis : [],
          commonMistakes: Array.isArray(q.commonMistakes) ? q.commonMistakes : [],
          visibility: q.visibility === 'shared' ? 'shared' : 'private',
          source: 'ai',
        }),
      });
      setPreviewList((prev) => prev.filter((item) => item.localId !== q.localId));
      setMsg(`已将「${q.title}」存入您的题库`);
      if (andAssign && saved?.id) {
        await openAssignModal([saved.id], q.title);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存题目失败');
    } finally {
      setSavingId('');
    }
  };

  const openTrial = (q: FullQuestion) => {
    const normalized = normalizeFullQuestion(q);
    setTrialQ(normalized);
    setTrialState(
      JSON.parse(JSON.stringify(normalized.materials.initialState)) as SimulatorState
    );
    setTrialResult(null);
  };

  const runTrialGrade = async () => {
    if (!trialQ || !trialState) return;
    setTrialGrading(true);
    try {
      const res = await portalFetch<{
        autoScore: number;
        maxScore: number;
        checkpointResults: CheckpointResult[];
      }>('/api/teacher/questions/test-grade', {
        method: 'POST',
        body: JSON.stringify({
          type: trialQ.type,
          checkpoints: trialQ.checkpoints,
          answer: trialState,
        }),
      });
      setTrialResult(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '试做判分失败');
    } finally {
      setTrialGrading(false);
    }
  };

  const handleCopyQuestion = async (id: string) => {
    setErr('');
    try {
      await portalFetch(`/api/teacher/questions/${id}/copy`, { method: 'POST' });
      setMsg('已复制到「我的题库」为私有副本，可自由编辑');
      void loadBank(bankPage);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '复制题目失败');
    }
  };

  const handleToggleVisibility = async (q: FullQuestion) => {
    const nextVis = q.visibility === 'shared' ? 'private' : 'shared';
    try {
      await portalFetch(`/api/teacher/questions/${q.id}`, {
        method: 'PUT',
        body: JSON.stringify({ visibility: nextVis }),
      });
      setMsg(
        nextVis === 'shared'
          ? `已将「${q.title}」设为全校教师共享`
          : `已将「${q.title}」设为仅自己私有`
      );
      void loadBank(bankPage);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '切换共享状态失败');
    }
  };

  const handleDeleteBankQuestion = async (q: FullQuestion) => {
    try {
      await portalFetch(`/api/teacher/questions/${q.id}`, { method: 'DELETE' });
      setMsg(`已删除题目「${q.title}」`);
      void loadBank(bankPage);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleSaveBankEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    setErr('');
    try {
      await portalFetch(`/api/teacher/questions/${editTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editTarget.title,
          difficulty: editTarget.difficulty,
          scenario: editTarget.scenario,
          steps: editTarget.steps,
          visibility: editTarget.visibility === 'shared' ? 'shared' : 'private',
        }),
      });
      setMsg(`已保存「${editTarget.title}」的修改`);
      setEditTarget(null);
      void loadBank(bankPage);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存修改失败');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleSelectBankQuestion = (id: string) => {
    setSelectedBankIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allCurrentPageSelected =
    bankItems.length > 0 &&
    bankItems.every((item) => selectedBankIds.includes(item.id));

  const toggleSelectAllPage = () => {
    if (allCurrentPageSelected) {
      const pageIds = new Set(bankItems.map((i) => i.id));
      setSelectedBankIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const merged = new Set([
        ...selectedBankIds,
        ...bankItems.map((i) => i.id),
      ]);
      setSelectedBankIds(Array.from(merged));
    }
  };

  const openAssignModal = async (qIds: string[], sampleTitle?: string) => {
    if (qIds.length === 0) return;
    setErr('');
    setAssignQuestionIds(qIds);
    setAssignTitle(
      qIds.length === 1 && sampleTitle
        ? `操作练习：${sampleTitle}`.slice(0, 60)
        : `专项操作练习（共 ${qIds.length} 题）`
    );
    setAssignTargetType('class');
    setAssignModalOpen(true);
    setAssignLoadingTargets(true);
    try {
      const [clsRes, stuRes] = await Promise.all([
        portalFetch<{
          items: Array<{
            id: string;
            name: string;
            grade: string;
            studentCount: number;
          }>;
        }>('/api/teacher/classes'),
        portalFetch<{
          items: Array<{
            id: string;
            realName: string;
            username: string;
            className: string;
          }>;
        }>('/api/teacher/students'),
      ]);
      const clsItems = Array.isArray(clsRes?.items) ? clsRes.items : [];
      const stuItems = Array.isArray(stuRes?.items) ? stuRes.items : [];
      setAssignClasses(clsItems);
      setAssignStudents(stuItems);
      setAssignTargetIds(clsItems.map((c) => c.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载班级与学生名单失败');
    } finally {
      setAssignLoadingTargets(false);
    }
  };

  const toggleAssignTargetId = (id: string) => {
    setAssignTargetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assignTargetIds.length === 0) {
      setErr('请至少选择 1 个班级或学生');
      return;
    }
    setAssignSubmitting(true);
    setErr('');
    try {
      const res = await portalFetch<{
        examId: string;
        title: string;
        questionCount: number;
        assignedStudentCount: number;
      }>('/api/teacher/questions/assign', {
        method: 'POST',
        body: JSON.stringify({
          title: assignTitle.trim() || undefined,
          questionIds: assignQuestionIds,
          targetType: assignTargetType,
          targetIds: assignTargetIds,
          duration: assignDuration,
          maxAttempts: assignMaxAttempts,
          showAnswerPolicy: assignAnswerPolicy,
          antiCheatSwitch: false,
          validDays: 90,
        }),
      });
      setAssignModalOpen(false);
      setSelectedBankIds([]);
      setMsg(
        `已成功发布「${res.title}」（共 ${res.questionCount} 题），已分配给所选${
          assignTargetType === 'class' ? '班级' : '学生'
        }（当前覆盖 ${res.assignedStudentCount} 名已注册学生，新加入该班级的学生也会自动看到）`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : '分配试题失败');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const totalBankPages = Math.max(1, Math.ceil(bankTotal / 10));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">出题中心与个人题库</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            按会考知识点树与自定义要求智能生成操作题，支持教师在模拟环境中「试做验证」后再入库组卷
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-xl self-start text-xs">
          <button
            type="button"
            onClick={() => setSubTab('ai')}
            className={`px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 ${
              subTab === 'ai'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>按知识点智能出题</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('bank')}
            className={`px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 ${
              subTab === 'bank'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>题库管理</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800">
          {msg}
        </div>
      )}
      {err && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{err}</span>
          </div>
          {subTab === 'ai' && genMode === 'ai' && (
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerate('template')}
              className="h-8 px-3 rounded-lg bg-white border border-red-300 hover:bg-red-100/60 text-red-800 font-medium inline-flex items-center gap-1.5 shrink-0"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>改用会考标准模板立即生成</span>
            </button>
          )}
        </div>
      )}

      {/* ==================== AI Generator Subtab ==================== */}
      {subTab === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Form */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-900">出题参数设置</span>
              <span className="text-xs font-medium text-teal-700 tabular-nums">
                {genMode === 'template'
                  ? '模板引擎 · 不消耗 AI 额度'
                  : `今日可用额度：${quota.remaining ?? Math.max(0, quota.limit - quota.used)} / ${quota.limit} 题`}
              </span>
            </div>

            {/* Generation Mode Toggle */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setGenMode('ai')}
                className={`h-8 px-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  genMode === 'ai'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 大模型智能出题</span>
              </button>
              <button
                type="button"
                onClick={() => setGenMode('template')}
                className={`h-8 px-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  genMode === 'template'
                    ? 'bg-white text-teal-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>标准模板快速出题</span>
              </button>
            </div>

            {enabledSubjects.length > 1 && (
              <div className="space-y-1.5">
                <label className="block font-medium text-slate-700">选择学科</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
                  {enabledSubjects.map((sid) => {
                    const active = activeSubject === sid;
                    return (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => {
                          setSubjectOverride(sid);
                          const nextTypes = getSubjectTypes(sid);
                          if (!nextTypes.includes(aiType)) {
                            setAiType(sid === 'gt' ? 'sketch3view' : 'excel');
                            setSelectedKpIds([]);
                            setKpFilter('');
                          }
                        }}
                        className={`h-8 px-2.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                          active
                            ? sid === 'gt'
                              ? 'bg-white text-teal-700 shadow-xs'
                              : 'bg-white text-sky-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {SUBJECT_LABELS[sid]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block font-medium text-slate-700">
                1. 选择题型（{SUBJECT_LABELS[activeSubject]}全 {getSubjectTypes(activeSubject).length} 类操作模块）
              </label>
              <div className="grid grid-cols-2 gap-2">
                {getSubjectTypes(activeSubject).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setAiType(t);
                      setSelectedKpIds([]);
                      setKpFilter('');
                    }}
                    className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                      aiType === t
                        ? activeSubject === 'gt'
                          ? 'border-teal-600 bg-teal-50 text-teal-900'
                          : 'border-sky-600 bg-sky-50 text-sky-800'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-medium">{TYPE_LABELS[t]}</div>
                    <div className="text-[11px] opacity-75 tabular-nums mt-0.5">
                      涵盖 {kpCountByType[t]} 个会考考点
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="font-medium text-slate-700">
                  2. 选择考查知识点（可多选）
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedKpIds(currentTypeKps.map((k) => k.id))}
                    className="text-sky-700 hover:underline"
                  >
                    全选本类
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedKpIds([])}
                    className="text-slate-500 hover:underline"
                  >
                    清空
                  </button>
                  <span className="text-slate-500 tabular-nums">
                    已选 {selectedKpIds.length}/{currentTypeKps.length}
                  </span>
                </div>
              </div>

              {/* 安徽会考高频考点一键组合 */}
              <div className="flex flex-wrap items-center gap-1.5">
                {ANHUI_KP_PRESETS[aiType].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPresetKps(preset.kpIds)}
                    className="px-2 py-1 rounded-md bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[11px] font-medium text-sky-800 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={kpFilter}
                  onChange={(e) => setKpFilter(e.target.value)}
                  placeholder="快速筛选本模块会考知识点..."
                  className="w-full h-8 pl-8 pr-2.5 border border-slate-200 rounded-lg bg-white text-xs"
                />
              </div>

              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl p-3 space-y-3 bg-slate-50/50">
                {Object.entries(kpsByChapter).length === 0 ? (
                  <div className="text-center text-slate-400 py-4">
                    未找到匹配的知识点
                  </div>
                ) : (
                  Object.entries(kpsByChapter).map(([chapter, list]) => (
                    <div key={chapter} className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-500">
                        {chapter}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((kp) => {
                          const checked = selectedKpIds.includes(kp.id);
                          return (
                            <button
                              key={kp.id}
                              type="button"
                              onClick={() => toggleKp(kp.id)}
                              className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                                checked
                                  ? 'bg-sky-600 border-sky-600 text-white'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-sky-300'
                              }`}
                            >
                              {kp.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newKpChapter}
                  onChange={(e) => setNewKpChapter(e.target.value)}
                  placeholder="分类名"
                  className="w-24 h-8 px-2 border border-slate-200 rounded-lg bg-white"
                />
                <input
                  type="text"
                  value={newKpName}
                  onChange={(e) => setNewKpName(e.target.value)}
                  placeholder="新增自定义知识点（如 VLOOKUP）"
                  className="flex-1 h-8 px-2.5 border border-slate-200 rounded-lg bg-white"
                />
                <button
                  type="button"
                  disabled={addingKp || !newKpName.trim()}
                  onClick={() => void handleAddCustomKp()}
                  className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="font-medium text-slate-700">难度等级</span>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="基础">基础</option>
                  <option value="中等">中等</option>
                  <option value="提高">提高</option>
                </select>
              </label>

              <label className="space-y-1 block">
                <span className="font-medium text-slate-700">单题总分</span>
                <input
                  type="number"
                  min={10}
                  max={200}
                  step={10}
                  value={totalScore}
                  onChange={(e) => setTotalScore(Number(e.target.value))}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg tabular-nums"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-medium text-slate-700">操作步骤数</span>
                <select
                  value={stepCount}
                  onChange={(e) => setStepCount(Number(e.target.value))}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  {[3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} 个操作步骤
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 block">
                <span className="font-medium text-slate-700">生成数量</span>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} 道题
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {(aiType === 'word' || aiType === 'web') && (
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needsImage}
                  onChange={(e) => setNeedsImage(e.target.checked)}
                />
                <span>生成配套插图素材（使用图片大模型生成并本地缓存）</span>
              </label>
            )}

            <div className="space-y-1">
              <label className="block font-medium text-slate-700">
                自定义出题要求 / 教学情境（可选）
              </label>
              <textarea
                rows={3}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例如：结合高一校园运动会成绩统计情境，要求先用 SUM 计算总分，再用 RANK 排名并生成柱形图。"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <button
              type="button"
              disabled={generating || (genMode === 'ai' && quota.remaining <= 0)}
              onClick={() => void handleGenerate()}
              className={`w-full h-10 disabled:opacity-50 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                genMode === 'template'
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : 'bg-sky-600 hover:bg-sky-700'
              }`}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {genMode === 'template'
                      ? '正在组装会考标准操作题...'
                      : '正在生成题目与自动判分规则...'}
                  </span>
                </>
              ) : (
                <>
                  {genMode === 'template' ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {genMode === 'template'
                      ? '按标准模板立即生成并预览'
                      : 'AI 立即生成并预览'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Right Preview List */}
          <div className="lg:col-span-7 space-y-4">
            {previewList.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-2 text-xs text-slate-500">
                <Sparkles className="w-8 h-8 text-sky-400 mx-auto" />
                <div className="text-sm font-semibold text-slate-700">
                  待生成的题目将在此处预览
                </div>
                <p>
                  支持先修改题干与步骤分值、在真实仿真器里「试做验证」评分点准确度，再一键存入个人或共享题库。
                </p>
              </div>
            ) : (
              previewList.map((q) => {
                const steps = Array.isArray(q.steps) ? q.steps : [];
                const kpsList = Array.isArray(q.knowledgePoints) ? q.knowledgePoints : [];
                const analysisList = Array.isArray(q.analysis) ? q.analysis : [];
                const mistakesList = Array.isArray(q.commonMistakes) ? q.commonMistakes : [];
                const stepSum = steps.reduce((s, x) => s + Number(x.score || 0), 0);
                const showAnalysis = expandedAnalysisIds.includes(q.localId);

                return (
                  <div
                    key={q.localId}
                    className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sky-700">
                          {TYPE_LABELS[q.type]}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-600">难度：{q.difficulty}</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-600 tabular-nums">
                          步骤合计：{stepSum} 分
                        </span>
                      </div>

                      <select
                        value={q.visibility}
                        onChange={(e) =>
                          setPreviewList((prev) =>
                            prev.map((item) =>
                              item.localId === q.localId
                                ? {
                                    ...item,
                                    visibility: e.target.value as 'private' | 'shared',
                                  }
                                : item
                            )
                          )
                        }
                        className="h-7 px-2 border border-slate-200 rounded-lg bg-slate-50 text-xs"
                      >
                        <option value="private">存为个人私有</option>
                        <option value="shared">存入并共享给全校教师</option>
                      </select>
                    </div>

                    {kpsList.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">考查考点：</span>
                        {kpsList.map((kpName) => (
                          <span
                            key={kpName}
                            className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-700"
                          >
                            {kpName}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block space-y-1">
                        <span className="text-slate-500 font-medium">题目标题</span>
                        <input
                          type="text"
                          value={q.title}
                          onChange={(e) =>
                            setPreviewList((prev) =>
                              prev.map((item) =>
                                item.localId === q.localId
                                  ? { ...item, title: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="w-full h-8 px-2.5 border border-slate-200 rounded-lg font-semibold text-slate-900 text-sm"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-slate-500 font-medium">情境说明</span>
                        <textarea
                          rows={2}
                          value={q.scenario}
                          onChange={(e) =>
                            setPreviewList((prev) =>
                              prev.map((item) =>
                                item.localId === q.localId
                                  ? { ...item, scenario: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="w-full p-2 border border-slate-200 rounded-lg text-slate-700"
                        />
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">
                          操作步骤（共 {steps.length} 步，可微调文字与分值）
                        </span>
                        {stepSum !== q.totalScore && (
                          <span className="text-[11px] text-amber-700">
                            分值已修改，入库时将自动按 {stepSum} 分保存
                          </span>
                        )}
                      </div>
                      {steps.map((st, sIdx) => (
                        <div key={st.index ?? sIdx} className="flex items-start gap-2">
                          <span className="w-5 h-7 flex items-center justify-center font-mono text-slate-400">
                            {sIdx + 1}.
                          </span>
                          <input
                            type="text"
                            value={st.instruction}
                            onChange={(e) =>
                              setPreviewList((prev) =>
                                prev.map((item) => {
                                  if (item.localId !== q.localId) return item;
                                  const nextSteps = [...(item.steps || [])];
                                  nextSteps[sIdx] = {
                                    ...nextSteps[sIdx],
                                    instruction: e.target.value,
                                  };
                                  return { ...item, steps: nextSteps };
                                })
                              )
                            }
                            className="flex-1 h-7 px-2 border border-slate-200 rounded-lg text-slate-800"
                          />
                          <input
                            type="number"
                            value={st.score}
                            onChange={(e) =>
                              setPreviewList((prev) =>
                                prev.map((item) => {
                                  if (item.localId !== q.localId) return item;
                                  const nextSteps = [...(item.steps || [])];
                                  nextSteps[sIdx] = {
                                    ...nextSteps[sIdx],
                                    score: Number(e.target.value),
                                  };
                                  return { ...item, steps: nextSteps };
                                })
                              )
                            }
                            className="w-16 h-7 px-2 border border-slate-200 rounded-lg text-right tabular-nums"
                          />
                        </div>
                      ))}
                    </div>

                    {(analysisList.length > 0 || mistakesList.length > 0) && (
                      <div className="border border-slate-200 rounded-xl bg-slate-50/60 p-3 space-y-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAnalysisIds((prev) =>
                              prev.includes(q.localId)
                                ? prev.filter((id) => id !== q.localId)
                                : [...prev, q.localId]
                            )
                          }
                          className="text-[11px] font-medium text-sky-700 hover:underline"
                        >
                          {showAnalysis
                            ? '收起参考解析与易错点'
                            : `查看参考解析与常见易错点（${analysisList.length} 条）`}
                        </button>
                        {showAnalysis && (
                          <div className="space-y-1.5 text-[11px] text-slate-700 pt-1 border-t border-slate-200">
                            {analysisList.map((a, idx) => (
                              <div key={idx}>• {a}</div>
                            ))}
                            {mistakesList.length > 0 && (
                              <div className="text-amber-800 pt-1">
                                易错提醒：{mistakesList.join('；')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openTrial(q)}
                          className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium inline-flex items-center gap-1"
                        >
                          <Play className="w-3.5 h-3.5 text-sky-600" />
                          <span>试做验证</span>
                        </button>
                        <button
                          type="button"
                          disabled={savingId === q.localId}
                          onClick={() => void handleRegenerateOne(q.localId, q)}
                          className="h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium inline-flex items-center gap-1"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${savingId === q.localId ? 'animate-spin' : ''}`}
                          />
                          <span>重新生成</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewList((prev) =>
                              prev.filter((item) => item.localId !== q.localId)
                            )
                          }
                          className="h-8 px-2.5 text-red-600 hover:bg-red-50 rounded-lg inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>舍弃</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={savingId === q.localId}
                          onClick={() => void savePreviewQuestion(q, false)}
                          className="h-8 px-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg font-medium inline-flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>存入题库</span>
                        </button>
                        <button
                          type="button"
                          disabled={savingId === q.localId}
                          onClick={() => void savePreviewQuestion(q, true)}
                          className="h-8 px-3.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg font-medium inline-flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>入库并分配给学生</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================== Question Bank Subtab ==================== */}
      {subTab === 'bank' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  ['all', '全部可用题库'],
                  ['mine', '我的题目'],
                  ['system', '系统标准题库'],
                  ['shared', '教师共享题库'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setScope(val)}
                  className={`px-3 py-1.5 rounded-lg border font-medium ${
                    scope === val
                      ? 'bg-sky-600 border-sky-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={bankSubject}
                onChange={(e) => {
                  const nextSubj = e.target.value as '' | SubjectId;
                  setBankSubject(nextSubj);
                  if (nextSubj && bankType && getSubjectForType(bankType as QuestionType) !== nextSubj) {
                    setBankType('');
                  }
                }}
                className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">全部学科</option>
                <option value="it">高中信息技术</option>
                <option value="gt">高中通用技术</option>
              </select>
              <select
                value={bankType}
                onChange={(e) => setBankType(e.target.value)}
                className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">全部题型</option>
                {(!bankSubject || bankSubject === 'it') && (
                  <optgroup label="高中信息技术">
                    {SUBJECT_PACKS.it.questionTypes.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </optgroup>
                )}
                {(!bankSubject || bankSubject === 'gt') && (
                  <optgroup label="高中通用技术">
                    {SUBJECT_PACKS.gt.questionTypes.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <select
                value={bankDiff}
                onChange={(e) => setBankDiff(e.target.value)}
                className="h-8 px-2.5 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">全部难度</option>
                <option value="基础">基础</option>
                <option value="中等">中等</option>
                <option value="提高">提高</option>
              </select>
              <input
                type="text"
                value={bankKeyword}
                onChange={(e) => setBankKeyword(e.target.value)}
                placeholder="搜索标题/知识点"
                className="h-8 px-2.5 border border-slate-200 rounded-lg w-40 bg-white"
              />
              <button
                type="button"
                onClick={() => void loadBank(1)}
                className="h-8 px-3 bg-slate-900 text-white rounded-lg inline-flex items-center gap-1"
              >
                <Search className="w-3.5 h-3.5" />
                <span>筛选</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs">
            <div className="flex items-center gap-2 text-sky-900">
              <Users className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                勾选下方任意试题后，可点击「分配给学生」直接发布到名下班级（新注册进入该班级的学生也会自动看到）。
              </span>
            </div>
            {selectedBankIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sky-800">
                  已选 {selectedBankIds.length} 题
                </span>
                <button
                  type="button"
                  onClick={() => void openAssignModal(selectedBankIds)}
                  className="h-7 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium inline-flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>批量分配给学生</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBankIds([])}
                  className="h-7 px-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg"
                >
                  清空
                </button>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {bankLoading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
              </div>
            ) : bankItems.length === 0 ? (
              <div className="py-14 text-center text-xs text-slate-500">
                暂无符合条件的题目，可切换到「按知识点智能出题」生成新题。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-3 pl-4 pr-2 w-9">
                        <input
                          type="checkbox"
                          checked={allCurrentPageSelected}
                          onChange={toggleSelectAllPage}
                          aria-label="全选本页题目"
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                      </th>
                      <th className="py-3 px-4 font-medium">题目与知识点</th>
                      <th className="py-3 px-4 font-medium">题型 / 难度</th>
                      <th className="py-3 px-4 font-medium">归属与可见性</th>
                      <th className="py-3 px-4 font-medium text-right">满分</th>
                      <th className="py-3 px-4 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bankItems.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50">
                        <td className="py-3 pl-4 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedBankIds.includes(q.id)}
                            onChange={() => toggleSelectBankQuestion(q.id)}
                            aria-label={`选择题目 ${q.title}`}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                        </td>
                        <td className="py-3 px-4 max-w-sm">
                          <div className="font-semibold text-slate-900">{q.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {q.knowledgePoints.join(' · ') || '会考操作题'}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-slate-800">{TYPE_LABELS[q.type]}</div>
                          <div className="text-[11px] text-slate-500">
                            {SUBJECT_LABELS[q.subjectId || getSubjectForType(q.type)]} · {q.difficulty}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-slate-700">{q.ownerName || '系统'}</div>
                          <div className="text-[11px] flex items-center gap-1 mt-0.5">
                            {q.visibility === 'public' ? (
                              <span className="text-sky-700 inline-flex items-center gap-0.5">
                                <Globe className="w-3 h-3" />
                                系统公开
                              </span>
                            ) : q.visibility === 'shared' ? (
                              <span className="text-teal-700 inline-flex items-center gap-0.5">
                                <Globe className="w-3 h-3" />
                                教师共享
                              </span>
                            ) : (
                              <span className="text-slate-500 inline-flex items-center gap-0.5">
                                <Lock className="w-3 h-3" />
                                个人私有
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-800">
                          {q.totalScore}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2.5">
                          <button
                            type="button"
                            onClick={() => void openAssignModal([q.id], q.title)}
                            className="text-teal-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                          >
                            <Send className="w-3 h-3" />
                            <span>分配给学生</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openTrial(q)}
                            className="text-sky-700 hover:underline inline-flex items-center gap-0.5"
                          >
                            <Eye className="w-3 h-3" />
                            <span>试做</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyQuestion(q.id)}
                            className="text-slate-700 hover:underline inline-flex items-center gap-0.5"
                          >
                            <Copy className="w-3 h-3" />
                            <span>复制</span>
                          </button>
                          {q.isOwner && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditTarget(JSON.parse(JSON.stringify(q)))}
                                className="text-sky-700 hover:underline inline-flex items-center gap-0.5"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>编辑</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleToggleVisibility(q)}
                                className="text-teal-700 hover:underline"
                              >
                                {q.visibility === 'shared' ? '设为私有' : '共享'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteBankQuestion(q)}
                                className="text-red-600 hover:underline"
                              >
                                删除
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalBankPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>
                  共 {bankTotal} 道题 · 第 {bankPage} / {totalBankPages} 页
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={bankPage <= 1}
                    onClick={() => void loadBank(bankPage - 1)}
                    className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={bankPage >= totalBankPages}
                    onClick={() => void loadBank(bankPage + 1)}
                    className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== Trial Simulator Modal ("试做验证") ==================== */}
      {trialQ && trialState && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  教师试做验证：{trialQ.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {TYPE_LABELS[trialQ.type]} · 在右侧模拟环境操作后可点击「验证自动判分」检查评分规则
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTrialQ(null)}
                className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4 space-y-3 text-xs">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="font-semibold text-slate-900">题目要求</div>
                  <p className="text-slate-600 leading-relaxed">{trialQ.scenario}</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-800">
                    {trialQ.steps.map((s) => (
                      <li key={s.index}>
                        {s.instruction}（{s.score} 分）
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={trialGrading}
                    onClick={() => void runTrialGrade()}
                    className="flex-1 h-9 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium flex items-center justify-center gap-1.5"
                  >
                    {trialGrading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>验证自动判分</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTrialState(
                        JSON.parse(JSON.stringify(trialQ.referenceAnswer)) as SimulatorState
                      )
                    }
                    className="h-9 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium"
                  >
                    载入参考答案
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTrialState(
                        JSON.parse(
                          JSON.stringify(trialQ.materials.initialState)
                        ) as SimulatorState
                      );
                      setTrialResult(null);
                    }}
                    className="h-9 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg"
                  >
                    重置
                  </button>
                </div>

                {trialResult && (
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="font-bold text-slate-900">
                      试做判分结果：
                      <span className="text-sky-700 tabular-nums">
                        {trialResult.autoScore} / {trialResult.maxScore} 分
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {trialResult.checkpointResults.map((cp) => (
                        <div
                          key={cp.checkpointId}
                          className="flex items-start gap-1.5 text-[11px]"
                        >
                          {cp.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className="text-slate-800">{cp.description}</span>
                            <span className="text-slate-500 ml-1 tabular-nums">
                              ({cp.earnedScore}/{cp.maxScore})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-8 min-h-[460px] border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2">
                <SimulatorRenderer
                  type={trialQ.type}
                  value={trialState}
                  onChange={setTrialState}
                  assets={trialQ.materials.assets}
                  historyKey={trialQ.id}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Edit Owned Bank Question Modal ==================== */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveBankEdit}
            className="bg-white rounded-2xl border border-slate-200 p-5 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">编辑题目信息</h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block space-y-1">
              <span className="font-medium text-slate-700">题目标题</span>
              <input
                type="text"
                required
                value={editTarget.title}
                onChange={(e) =>
                  setEditTarget({ ...editTarget, title: e.target.value })
                }
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">难度</span>
                <select
                  value={editTarget.difficulty}
                  onChange={(e) =>
                    setEditTarget({
                      ...editTarget,
                      difficulty: e.target.value as DifficultyLevel,
                    })
                  }
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="基础">基础</option>
                  <option value="中等">中等</option>
                  <option value="提高">提高</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-medium text-slate-700">可见范围</span>
                <select
                  value={editTarget.visibility}
                  onChange={(e) =>
                    setEditTarget({
                      ...editTarget,
                      visibility: e.target.value as 'private' | 'shared',
                    })
                  }
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="private">个人私有</option>
                  <option value="shared">共享给全校教师</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="font-medium text-slate-700">题目情境</span>
              <textarea
                rows={3}
                value={editTarget.scenario}
                onChange={(e) =>
                  setEditTarget({ ...editTarget, scenario: e.target.value })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />
            </label>

            <div className="space-y-2">
              <span className="font-medium text-slate-700 block">操作步骤说明</span>
              {editTarget.steps.map((st, idx) => (
                <input
                  key={st.index}
                  type="text"
                  value={st.instruction}
                  onChange={(e) => {
                    const nextSteps = [...editTarget.steps];
                    nextSteps[idx] = { ...nextSteps[idx], instruction: e.target.value };
                    setEditTarget({ ...editTarget, steps: nextSteps });
                  }}
                  className="w-full h-8 px-2.5 border border-slate-300 rounded-lg"
                />
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium"
              >
                {savingEdit ? '保存中...' : '保存修改'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== Quick Assign Questions Modal ==================== */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmAssign}
            className="bg-white rounded-2xl border border-slate-200 p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  分配试题给班级 / 学生
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  已选 {assignQuestionIds.length} 道试题，提交后立即发布，学生登录后即可开始作答
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block space-y-1">
              <span className="font-medium text-slate-700">任务 / 练习名称</span>
              <input
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={assignTitle}
                onChange={(e) => setAssignTitle(e.target.value)}
                placeholder="例如：高一会考 Word 与 Excel 专项练习"
                className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">分配对象</span>
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignTargetType('class');
                      setAssignTargetIds(assignClasses.map((c) => c.id));
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium ${
                      assignTargetType === 'class'
                        ? 'bg-white text-sky-700 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    按班级分配
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignTargetType('student');
                      setAssignTargetIds([]);
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium ${
                      assignTargetType === 'student'
                        ? 'bg-white text-sky-700 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    按指定学生分配
                  </button>
                </div>
              </div>

              <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-2.5 space-y-1.5 bg-slate-50/50">
                {assignLoadingTargets ? (
                  <div className="py-6 flex justify-center">
                    <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
                  </div>
                ) : assignTargetType === 'class' ? (
                  assignClasses.length === 0 ? (
                    <div className="py-4 text-center text-slate-500">
                      您名下暂无班级，请先在「班级与学生」创建班级
                    </div>
                  ) : (
                    assignClasses.map((cls) => (
                      <label
                        key={cls.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-sky-300"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={assignTargetIds.includes(cls.id)}
                            onChange={() => toggleAssignTargetId(cls.id)}
                            className="rounded border-slate-300 text-sky-600"
                          />
                          <span className="font-medium text-slate-900">
                            {cls.grade} {cls.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          {cls.studentCount} 名学生
                        </span>
                      </label>
                    ))
                  )
                ) : assignStudents.length === 0 ? (
                  <div className="py-4 text-center text-slate-500">
                    名下暂无学生，按班级分配后新注册的学生也能自动看到试题
                  </div>
                ) : (
                  assignStudents.map((stu) => (
                    <label
                      key={stu.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-sky-300"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={assignTargetIds.includes(stu.id)}
                          onChange={() => toggleAssignTargetId(stu.id)}
                          className="rounded border-slate-300 text-sky-600"
                        />
                        <span className="font-medium text-slate-900">
                          {stu.realName}
                        </span>
                        <span className="text-slate-400 font-mono">
                          ({stu.username})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {stu.className}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">练习时长（分）</span>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={assignDuration}
                  onChange={(e) => setAssignDuration(Number(e.target.value))}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg tabular-nums"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-medium text-slate-700">可练习次数</span>
                <select
                  value={assignMaxAttempts}
                  onChange={(e) => setAssignMaxAttempts(Number(e.target.value))}
                  className="w-full h-9 px-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value={1}>1 次</option>
                  <option value={3}>3 次</option>
                  <option value={5}>5 次</option>
                  <option value={10}>10 次</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-medium text-slate-700">解析可见时机</span>
                <select
                  value={assignAnswerPolicy}
                  onChange={(e) =>
                    setAssignAnswerPolicy(
                      e.target.value as 'immediate' | 'after_end' | 'never'
                    )
                  }
                  className="w-full h-9 px-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="immediate">交卷立即查看</option>
                  <option value="after_end">截止后查看</option>
                  <option value="never">暂不公开答案</option>
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={assignSubmitting || assignTargetIds.length === 0}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-medium inline-flex items-center gap-1.5"
              >
                {assignSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>发布分配中...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>立即发布给学生</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

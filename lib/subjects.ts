import type { QuestionType, SubjectId } from './types';

export interface SubjectPackMeta {
  id: SubjectId;
  name: string;
  shortName: string;
  description: string;
  examContext: string;
  questionTypes: QuestionType[];
}

export const SUBJECT_PACKS: Record<SubjectId, SubjectPackMeta> = {
  it: {
    id: 'it',
    name: '高中信息技术',
    shortName: '信息技术',
    description:
      '涵盖 Word 文字处理、Excel 电子表格、HTML/CSS 网页制作、文件管理、Python 程序设计与数据库 SQL 查询六大模块。',
    examContext: '普通高中学业水平考试（信息技术操作题）',
    questionTypes: ['word', 'excel', 'web', 'file', 'python', 'database'],
  },
  gt: {
    id: 'gt',
    name: '高中通用技术',
    shortName: '通用技术',
    description:
      '涵盖三视图与技术草图绘制、电子控制电路连线调试、结构设计与受力稳定实验、控制系统框图与金工/木工工艺流程五大实操模块。',
    examContext: '普通高中学业水平合格性考试（通用技术实践操作）',
    questionTypes: ['sketch3view', 'circuit', 'structure', 'control', 'craft'],
  },
};

export const ALL_QUESTION_TYPES: QuestionType[] = [
  'word',
  'excel',
  'web',
  'file',
  'python',
  'database',
  'sketch3view',
  'circuit',
  'structure',
  'control',
  'craft',
];

export const SUBJECT_LABELS: Record<SubjectId, string> = {
  it: '高中信息技术',
  gt: '高中通用技术',
};

export function getSubjectForType(type: QuestionType): SubjectId {
  if (SUBJECT_PACKS.gt.questionTypes.includes(type)) return 'gt';
  return 'it';
}

export function getSubjectTypes(subjectId: SubjectId): QuestionType[] {
  return SUBJECT_PACKS[subjectId]?.questionTypes || SUBJECT_PACKS.it.questionTypes;
}

export function computeSiteTitle(
  enabledSubjects: Array<{ id: SubjectId; name: string; shortName: string }>,
  customTitle?: string
): string {
  const clean = (customTitle || '').trim();
  if (clean) return clean;
  if (enabledSubjects.length === 1) {
    return `${enabledSubjects[0].name}会考·操作题系统`;
  }
  return '高中会考实操练习与测评系统';
}

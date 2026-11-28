import type { QuestionType, SubjectId } from './types';

export type StudentDirectLoginPolicy = 'warn' | 'deny' | 'allow';

export interface PublicSubjectSummary {
  id: SubjectId;
  name: string;
  shortName: string;
  description: string;
  isEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
  questionTypes: QuestionType[];
}

/** 后端公开接口 GET /api/auth/config 的返回：账号模式、学科配置与站点标题 */
export interface AuthConfig {
  mode: 'local' | 'platform';
  platformName: string;
  platformWebUrl: string;
  platformRegisterUrl: string;
  ssoEnabled: boolean;
  ssoEntryUrl: string;
  studentDirectLogin: StudentDirectLoginPolicy;
  registrationEnabled: boolean;
  memberManagement: boolean;
  subjects: PublicSubjectSummary[];
  enabledSubjects: PublicSubjectSummary[];
  defaultSubjectId: SubjectId;
  siteTitle: string;
  customSiteTitle: string;
}

const DEFAULT_SUBJECTS: PublicSubjectSummary[] = [
  {
    id: 'it',
    name: '高中信息技术',
    shortName: '信息技术',
    description:
      '涵盖 Word 文字处理、Excel 电子表格、HTML/CSS 网页制作、文件管理、Python 程序设计与数据库 SQL 查询六大模块。',
    isEnabled: true,
    isDefault: true,
    sortOrder: 1,
    questionTypes: ['word', 'excel', 'web', 'file', 'python', 'database'],
  },
  {
    id: 'gt',
    name: '高中通用技术',
    shortName: '通用技术',
    description:
      '涵盖三视图与技术草图绘制、电子控制电路连线调试、结构设计与受力稳定实验、控制系统框图与金工/木工工艺流程五大实操模块。',
    isEnabled: true,
    isDefault: false,
    sortOrder: 2,
    questionTypes: ['sketch3view', 'circuit', 'structure', 'control', 'craft'],
  },
];

/** 取不到配置时按本地账号模式处理，本地模式下的界面不受影响 */
export const LOCAL_AUTH_CONFIG: AuthConfig = {
  mode: 'local',
  platformName: '个性化学习平台',
  platformWebUrl: '',
  platformRegisterUrl: '',
  ssoEnabled: false,
  ssoEntryUrl: '',
  studentDirectLogin: 'warn',
  registrationEnabled: true,
  memberManagement: true,
  subjects: DEFAULT_SUBJECTS,
  enabledSubjects: DEFAULT_SUBJECTS,
  defaultSubjectId: 'it',
  siteTitle: '高中会考实操练习与测评系统',
  customSiteTitle: '',
};

let pending: Promise<AuthConfig> | null = null;
const listeners = new Set<(cfg: AuthConfig) => void>();

export function subscribeAuthConfig(cb: (cfg: AuthConfig) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function fetchAuthConfig(force = false): Promise<AuthConfig> {
  if (force) {
    pending = null;
  }
  if (!pending) {
    pending = fetch('/api/auth/config', { cache: 'no-store' })
      .then(async (resp) => {
        if (!resp.ok) return LOCAL_AUTH_CONFIG;
        const raw = (await resp.json()) as Partial<AuthConfig>;
        return {
          ...LOCAL_AUTH_CONFIG,
          ...raw,
          subjects: Array.isArray(raw.subjects) && raw.subjects.length > 0
            ? raw.subjects
            : LOCAL_AUTH_CONFIG.subjects,
          enabledSubjects:
            Array.isArray(raw.enabledSubjects) && raw.enabledSubjects.length > 0
              ? raw.enabledSubjects
              : LOCAL_AUTH_CONFIG.enabledSubjects,
          defaultSubjectId: raw.defaultSubjectId || 'it',
          siteTitle: raw.siteTitle || LOCAL_AUTH_CONFIG.siteTitle,
          customSiteTitle: raw.customSiteTitle || '',
        };
      })
      .catch(() => {
        pending = null;
        return LOCAL_AUTH_CONFIG;
      });
  }
  return pending;
}

export async function refreshAuthConfig(): Promise<AuthConfig> {
  const cfg = await fetchAuthConfig(true);
  for (const cb of listeners) {
    cb(cfg);
  }
  return cfg;
}

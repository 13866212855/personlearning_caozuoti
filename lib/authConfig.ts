export type StudentDirectLoginPolicy = 'warn' | 'deny' | 'allow';

/** 后端公开接口 GET /api/auth/config 的返回：当前是本地账号模式还是平台对接模式、哪些入口开放 */
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
}

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
};

let pending: Promise<AuthConfig> | null = null;

export function fetchAuthConfig(): Promise<AuthConfig> {
  if (!pending) {
    pending = fetch('/api/auth/config', { cache: 'no-store' })
      .then(async (resp) =>
        resp.ok ? ((await resp.json()) as AuthConfig) : LOCAL_AUTH_CONFIG
      )
      .catch(() => {
        // 请求失败不缓存，下次挂载时再试
        pending = null;
        return LOCAL_AUTH_CONFIG;
      });
  }
  return pending;
}

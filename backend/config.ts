import path from 'node:path';

export type AuthMode = 'local' | 'platform';
export type StudentDirectLoginPolicy = 'warn' | 'deny' | 'allow';

const authMode: AuthMode =
  process.env.AUTH_MODE === 'platform' ? 'platform' : 'local';
const rawStudentDirectLogin = process.env.PLATFORM_STUDENT_DIRECT_LOGIN || 'warn';
const studentDirectLogin: StudentDirectLoginPolicy = (['warn', 'deny', 'allow'].includes(
  rawStudentDirectLogin
)
  ? rawStudentDirectLogin
  : 'warn') as StudentDirectLoginPolicy;

export const APP_CONFIG = {
  port: Number(process.env.PORT || 3000),
  dbPath: path.resolve(process.cwd(), 'data', 'app.db'),
  uploadsDir: path.resolve(process.cwd(), 'data', 'uploads'),
  studentJwtSecret:
    process.env.STUDENT_JWT_SECRET || 'it_exam_student_jwt_secret_2026_secure',
  adminJwtSecret:
    process.env.ADMIN_JWT_SECRET || 'it_exam_admin_jwt_secret_2026_isolated',
  // 个性化学习平台（personlearning）成员对接：local = 本项目自己管理账号
  platform: {
    authMode,
    baseUrl: (process.env.PLATFORM_BASE_URL || '').replace(/\/+$/, ''),
    webUrl: (process.env.PLATFORM_WEB_URL || '').replace(/\/+$/, ''),
    ssoEnabled: process.env.PLATFORM_SSO_ENABLED === 'true',
    studentDirectLogin,
    timeoutMs: Number(process.env.PLATFORM_TIMEOUT_MS || 6000),
  },
  defaultLlm: {
    baseUrl: process.env.LLM_BASE_URL || 'https://apihub.agnes-ai.com/v1',
    apiKey:
      process.env.LLM_API_KEY ||
      'sk-vWM7RHG5n7bljBNi3GgHfygxqiKlUYrPWZLLSUByIGm4BiM9',
    textModel: process.env.LLM_TEXT_MODEL || 'Agnes-2.5-flash',
    imageModel: process.env.LLM_IMAGE_MODEL || 'Agnes-Image-2.1-flash',
    temperature: 0.4,
    maxTokens: 4096,
    timeoutMs: 45000,
  },
};

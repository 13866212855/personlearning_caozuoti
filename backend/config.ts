import path from 'node:path';

export const APP_CONFIG = {
  port: Number(process.env.PORT || 3000),
  dbPath: path.resolve(process.cwd(), 'data', 'app.db'),
  uploadsDir: path.resolve(process.cwd(), 'data', 'uploads'),
  studentJwtSecret:
    process.env.STUDENT_JWT_SECRET || 'it_exam_student_jwt_secret_2026_secure',
  adminJwtSecret:
    process.env.ADMIN_JWT_SECRET || 'it_exam_admin_jwt_secret_2026_isolated',
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

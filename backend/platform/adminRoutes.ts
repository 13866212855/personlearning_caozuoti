import { Router } from 'express';
import { z } from 'zod';
import { getDb, logAdminAction } from '../db';
import { APP_CONFIG } from '../config';
import { type AuthedRequest } from '../middleware/auth';
import {
  checkPlatformHealth,
  getPlatformStatus,
  listPlatformClasses,
  type PlatformClassBrief,
} from './client';
import {
  alignLocalClassToPlatform,
  mergeLegacyAccount,
  platformClassDisplayName,
} from './memberSync';

/** 管理端的"平台对接"工具：连接状态、把本地班级与平台班级对齐、把旧账号并入平台账号 */
const router = Router();

// 只有启用平台对接时这些接口才有意义
router.use((_req, res, next) => {
  if (APP_CONFIG.platform.authMode !== 'platform') {
    res.status(403).json({ error: '当前未启用平台对接' });
    return;
  }
  next();
});

router.get('/status', (_req: AuthedRequest, res) => {
  const db = getDb();
  const count = (sql: string) => (db.prepare(sql).get() as { cnt: number }).cnt;
  res.json({
    mode: APP_CONFIG.platform.authMode,
    baseUrl: APP_CONFIG.platform.baseUrl,
    webUrl: APP_CONFIG.platform.webUrl,
    ssoEnabled: APP_CONFIG.platform.ssoEnabled,
    studentDirectLogin: APP_CONFIG.platform.studentDirectLogin,
    reach: getPlatformStatus(),
    boundUsers: count(
      'SELECT COUNT(*) as cnt FROM users WHERE platform_user_id IS NOT NULL'
    ),
    unboundUsers: count(
      "SELECT COUNT(*) as cnt FROM users WHERE platform_user_id IS NULL AND role <> 'super_admin'"
    ),
    alignedClasses: count(
      'SELECT COUNT(*) as cnt FROM classes WHERE platform_class_id IS NOT NULL'
    ),
    unalignedClasses: count(
      'SELECT COUNT(*) as cnt FROM classes WHERE platform_class_id IS NULL'
    ),
  });
});

router.post('/check', async (_req: AuthedRequest, res) => {
  try {
    res.json({ ok: true, latencyMs: await checkPlatformHealth() });
  } catch (err) {
    res.json({ ok: false, error: err instanceof Error ? err.message : '连接失败' });
  }
});

function normalizeClassName(name: string): string {
  return name.replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')');
}

interface LocalClassRow {
  id: string;
  name: string;
  grade: string;
  platform_class_id: number | null;
  teacher_name: string;
  teacher_username: string;
  student_count: number;
}

router.get('/align-candidates', async (_req: AuthedRequest, res) => {
  const db = getDb();
  const localClasses = db
    .prepare(
      `SELECT c.id, c.name, c.grade, c.platform_class_id,
              u.real_name AS teacher_name, u.username AS teacher_username,
              (SELECT COUNT(*) FROM users WHERE role = 'student' AND class_id = c.id) AS student_count
       FROM classes c
       LEFT JOIN users u ON c.teacher_id = u.id
       ORDER BY c.created_at ASC`
    )
    .all() as LocalClassRow[];

  let platformClasses: PlatformClassBrief[] = [];
  let platformReachable = true;
  try {
    platformClasses = await listPlatformClasses();
  } catch {
    platformReachable = false;
  }

  const items = localClasses.map((cls) => {
    const localName = normalizeClassName(cls.name);
    const matched = cls.platform_class_id
      ? platformClasses.find((p) => p.id === cls.platform_class_id) || null
      : null;
    // 同名（或互相包含）的平台班级作为默认候选，其余由管理员在下拉框里手选
    const suggested =
      platformClasses.find((p) => {
        const display = normalizeClassName(
          platformClassDisplayName(p.className, p.gradeLevel)
        );
        const raw = normalizeClassName(p.className);
        return (
          display === localName ||
          raw === localName ||
          (raw.length >= 2 && (display.endsWith(localName) || localName.endsWith(raw)))
        );
      }) || null;
    return {
      id: cls.id,
      name: cls.name,
      grade: cls.grade,
      teacherName: cls.teacher_name || cls.teacher_username || '',
      studentCount: Number(cls.student_count || 0),
      platformClassId: matched ? matched.id : null,
      platformName: matched
        ? platformClassDisplayName(matched.className, matched.gradeLevel)
        : '',
      suggestedId: suggested ? suggested.id : null,
    };
  });

  res.json({
    platformReachable,
    platformClasses: platformClasses.map((p) => ({
      ...p,
      displayName: platformClassDisplayName(p.className, p.gradeLevel),
    })),
    items,
  });
});

const AlignSchema = z.object({
  classId: z.string().min(1),
  platformClassId: z.number().int().positive().nullable(),
});

router.post('/align-class', async (req: AuthedRequest, res) => {
  const parsed = AlignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数格式不正确' });
    return;
  }
  const { classId, platformClassId } = parsed.data;

  let brief: PlatformClassBrief | null = null;
  if (platformClassId !== null) {
    try {
      brief = (await listPlatformClasses()).find((p) => p.id === platformClassId) || null;
    } catch {
      // 平台暂时不可达时仍允许按编号对齐，班名等下次登录时再同步
      brief = null;
    }
  }

  try {
    alignLocalClassToPlatform(getDb(), classId, platformClassId, brief);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '对齐失败' });
    return;
  }

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    platformClassId === null ? '解除班级与平台班级的对齐' : '对齐本地班级与平台班级',
    'class',
    classId,
    `平台班级编号 ${platformClassId ?? '-'}`
  );
  res.json({ ok: true });
});

const MergeSchema = z.object({
  targetId: z.string().min(1),
  legacyId: z.string().min(1),
});

// targetId = 已绑定平台的账号；legacyId = 未绑定的旧本地账号（合并后保留旧账号）
router.post('/merge', (req: AuthedRequest, res) => {
  const parsed = MergeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数格式不正确' });
    return;
  }
  const { targetId, legacyId } = parsed.data;

  try {
    mergeLegacyAccount(getDb(), legacyId, targetId);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '合并失败' });
    return;
  }

  logAdminAction(
    req.admin!.id,
    req.admin!.username,
    '旧账号继承平台账号',
    'user',
    legacyId,
    `并入的平台账号行 ${targetId}`
  );
  res.json({ ok: true });
});

export default router;

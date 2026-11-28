import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { generateInviteCode, getDb } from '../db';
import { findPlatformClass, type PlatformClassBrief } from './client';

/**
 * 平台成员 → 本地"成员镜像"。
 * users 表不再保存平台账号的密码与角色判定，只负责把平台成员映射成本项目稳定的主键
 * （成绩、考试、通知等业务数据都以 users.id 作为关联键，主键不能变）。
 */

export type LocalRole = 'teacher' | 'student';
/** homeroom = 班主任带班；subject = 学科教师授课；legacy = 平台对接之前本地班级的归属关系 */
export type TeacherRelation = 'homeroom' | 'subject' | 'legacy';

/** 平台重置密码与教师建号的默认值：用来判断是否仍在使用初始密码 */
export const PLATFORM_DEFAULT_PASSWORD = '111111';
export const UNASSIGNED_CLASS_NAME = '未分班';

/** student → 学生；teacher / subject_teacher → 教师；家长与平台管理员不能登录 */
export function mapPlatformRole(platformRole: string): LocalRole | null {
  if (platformRole === 'student') return 'student';
  if (platformRole === 'teacher' || platformRole === 'subject_teacher') return 'teacher';
  return null;
}

/** 平台班名可能不含年级（如"1班"），展示时补上年级 */
export function platformClassDisplayName(className: string, gradeLevel: string): string {
  if (!gradeLevel || className.includes(gradeLevel)) return className;
  return `${gradeLevel}${className}`;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  real_name: string;
  grade: string;
  class_name: string;
  student_no: string;
  teacher_id: string;
  class_id: string;
  is_disabled: number;
  must_change_password: number;
  platform_user_id: number | null;
  platform_username: string;
  platform_role: string;
  platform_status: string;
  platform_synced_at: string;
}

interface MirroredClass {
  id: string;
  name: string;
  grade: string;
  teacherId: string;
}

const BIND_COLUMNS =
  'platform_user_id = ?, platform_username = ?, platform_role = ?, platform_status = ?, platform_synced_at = ?';

/** 一个平台班级对应一行本地班级；已存在则同步班名与年级 */
export function ensureClassMirror(
  db: Database.Database,
  brief: PlatformClassBrief
): MirroredClass {
  const now = new Date().toISOString();
  const name = platformClassDisplayName(brief.className, brief.gradeLevel);
  const existing = db
    .prepare('SELECT id, teacher_id FROM classes WHERE platform_class_id = ?')
    .get(brief.id) as { id: string; teacher_id: string } | undefined;

  if (existing) {
    db.prepare(
      'UPDATE classes SET name = ?, grade = ?, platform_synced_at = ?, updated_at = ? WHERE id = ?'
    ).run(name, brief.gradeLevel, now, now, existing.id);
    return {
      id: existing.id,
      name,
      grade: brief.gradeLevel,
      teacherId: existing.teacher_id || '',
    };
  }

  const id = `cls-plat-${brief.id}`;
  let inviteCode = generateInviteCode();
  while (db.prepare('SELECT id FROM classes WHERE invite_code = ?').get(inviteCode)) {
    inviteCode = generateInviteCode();
  }
  db.prepare(
    `INSERT INTO classes (id, name, grade, teacher_id, invite_code, created_at, updated_at, platform_class_id, platform_synced_at)
     VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)`
  ).run(id, name, brief.gradeLevel, inviteCode, now, now, brief.id, now);
  return { id, name, grade: brief.gradeLevel, teacherId: '' };
}

function setTeacherClassRelation(
  db: Database.Database,
  classId: string,
  teacherId: string,
  relation: TeacherRelation
) {
  db.prepare(
    `INSERT INTO class_teachers (class_id, teacher_id, relation) VALUES (?, ?, ?)
     ON CONFLICT(class_id, teacher_id) DO UPDATE SET relation = excluded.relation`
  ).run(classId, teacherId, relation);
}

/**
 * 把班级的归属教师换成此人。
 * 原归属教师若本就是"平台对接之前本地班级的归属教师"（没有平台授课关系），保留一条 legacy 关系，名下历史数据不受影响；
 * 若原归属教师与该班的关系来自平台（homeroom / subject），关系必须原样保留——
 * 把平台关系改标成 legacy 会让已被替换的教师一直保有访问权；该关系是否仍有效，由那位教师自己下次登录时按平台数据清理。
 */
function setClassPrimaryTeacher(db: Database.Database, classId: string, teacherId: string) {
  const cls = db
    .prepare('SELECT teacher_id FROM classes WHERE id = ?')
    .get(classId) as { teacher_id: string } | undefined;
  const previous = cls?.teacher_id || '';
  if (previous === teacherId) return;
  if (previous) {
    const previousRelation = db
      .prepare('SELECT relation FROM class_teachers WHERE class_id = ? AND teacher_id = ?')
      .get(classId, previous) as { relation: TeacherRelation } | undefined;
    if (!previousRelation || previousRelation.relation === 'legacy') {
      setTeacherClassRelation(db, classId, previous, 'legacy');
    }
  }
  db.prepare('UPDATE classes SET teacher_id = ?, updated_at = ? WHERE id = ?').run(
    teacherId,
    new Date().toISOString(),
    classId
  );
  db.prepare(
    "UPDATE users SET teacher_id = ? WHERE class_id = ? AND role = 'student'"
  ).run(teacherId, classId);
}

/** 按平台上的授课关系刷新教师的班级：写入当前关系，清掉平台上已不再分配的平台班级关系 */
function syncTeacherRelations(
  db: Database.Database,
  teacherId: string,
  relation: TeacherRelation,
  classes: PlatformClassBrief[]
) {
  const kept: string[] = [];
  for (const brief of classes) {
    const cls = ensureClassMirror(db, brief);
    setTeacherClassRelation(db, cls.id, teacherId, relation);
    if (relation === 'homeroom' || !cls.teacherId) {
      setClassPrimaryTeacher(db, cls.id, teacherId);
    }
    if (relation === 'homeroom') {
      // 平台上一个班只有一名班主任。此人是该班当前的班主任，那么其他人的班主任关系都已失效
      // （被替换的班主任可能很久不再登录，不能等他自己登录时才清理）。
      db.prepare(
        "DELETE FROM class_teachers WHERE class_id = ? AND relation = 'homeroom' AND teacher_id <> ?"
      ).run(cls.id, teacherId);
    }
    kept.push(cls.id);
  }

  // 班主任与学科教师两种平台关系一起查：此人在平台上换了角色后，旧角色留下的关系同样要清
  const stale = db
    .prepare(
      `SELECT ct.class_id as class_id FROM class_teachers ct
       INNER JOIN classes c ON c.id = ct.class_id
       WHERE ct.teacher_id = ? AND ct.relation IN ('homeroom', 'subject')
         AND c.platform_class_id IS NOT NULL`
    )
    .all(teacherId) as Array<{ class_id: string }>;

  for (const { class_id } of stale) {
    if (kept.includes(class_id)) continue;
    db.prepare(
      'DELETE FROM class_teachers WHERE class_id = ? AND teacher_id = ?'
    ).run(class_id, teacherId);
    // 学科教师先于班主任登录时会被记为该班的归属教师；被移出时同样要把归属教师撤掉
    const cls = db
      .prepare('SELECT teacher_id FROM classes WHERE id = ?')
      .get(class_id) as { teacher_id: string } | undefined;
    if (cls?.teacher_id === teacherId) {
      db.prepare("UPDATE classes SET teacher_id = '' WHERE id = ?").run(class_id);
      db.prepare(
        "UPDATE users SET teacher_id = '' WHERE class_id = ? AND role = 'student'"
      ).run(class_id);
    }
  }
}

export interface PlatformMember {
  platformId: number;
  username: string;
  name: string;
  platformRole: string;
  role: LocalRole;
  /** 学生在平台的年级与班级 */
  gradeLevel: string;
  classId: number | null;
  /** 教师在平台的授课关系 */
  teacherRelation: TeacherRelation;
  teacherClasses: PlatformClassBrief[];
}

export interface SyncedMember {
  id: string;
  platformId: number;
  role: LocalRole;
  isDisabled: boolean;
}

/**
 * 写入或更新一名平台成员的镜像行，返回其本地账号。
 * 首次登录时尝试"认领"旧的本地账号以继承历史数据：
 * 密码登录要求 旧密码校验通过，单点进入要求 真实姓名完全相同；两者都要求用户名与角色一致。
 */
export async function syncPlatformMember(
  member: PlatformMember,
  options: { password?: string } = {}
): Promise<SyncedMember> {
  const db = getDb();
  const now = new Date().toISOString();
  let row = db
    .prepare('SELECT * FROM users WHERE platform_user_id = ?')
    .get(member.platformId) as UserRow | undefined;

  if (!row) {
    const candidates = db
      .prepare(
        'SELECT * FROM users WHERE platform_user_id IS NULL AND username = ? AND role = ?'
      )
      .all(member.username, member.role) as UserRow[];
    row = candidates.find((candidate) =>
      options.password !== undefined
        ? bcrypt.compareSync(options.password, candidate.password_hash)
        : candidate.real_name === member.name
    );
    if (row) {
      db.prepare(`UPDATE users SET ${BIND_COLUMNS}, updated_at = ? WHERE id = ?`).run(
        member.platformId,
        member.username,
        member.platformRole,
        'ok',
        now,
        now,
        row.id
      );
    }
  }

  if (!row) {
    const id =
      member.role === 'student'
        ? `stu-plat-${member.platformId}`
        : `tch-plat-${member.platformId}`;
    const usernameTaken = db
      .prepare('SELECT 1 FROM users WHERE username = ?')
      .get(member.username);
    db.prepare(
      `INSERT INTO users (
        id, username, password_hash, role, real_name, grade, class_name,
        student_no, teacher_id, class_id, is_disabled, must_change_password,
        created_at, updated_at, platform_user_id, platform_username, platform_role,
        platform_status, platform_synced_at
      ) VALUES (?, ?, ?, ?, ?, '', '', '', '', '', 0, 0, ?, ?, ?, ?, ?, 'ok', ?)`
    ).run(
      id,
      usernameTaken ? `${member.username}#${member.platformId}` : member.username,
      bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 8),
      member.role,
      member.name,
      now,
      now,
      member.platformId,
      member.username,
      member.platformRole,
      now
    );
    row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
  }

  const mustChangePassword =
    options.password !== undefined
      ? options.password === PLATFORM_DEFAULT_PASSWORD
        ? 1
        : 0
      : row.must_change_password;

  if (member.role === 'teacher') {
    syncTeacherRelations(db, row.id, member.teacherRelation, member.teacherClasses);
    db.prepare(
      `UPDATE users SET role = ?, real_name = ?, must_change_password = ?, platform_class_id = NULL,
        ${BIND_COLUMNS}, last_login_at = ?, updated_at = ? WHERE id = ?`
    ).run(
      member.role,
      member.name,
      mustChangePassword,
      member.platformId,
      member.username,
      member.platformRole,
      'ok',
      now,
      now,
      now,
      row.id
    );
    return {
      id: row.id,
      platformId: member.platformId,
      role: member.role,
      isDisabled: Boolean(row.is_disabled),
    };
  }

  let grade = row.grade;
  let classId = '';
  let className = UNASSIGNED_CLASS_NAME;
  let teacherId = '';
  if (member.classId !== null) {
    const brief = await findPlatformClass(member.classId);
    if (brief) {
      const cls = ensureClassMirror(db, brief);
      grade = cls.grade;
      classId = cls.id;
      className = cls.name;
      teacherId = cls.teacherId;
    } else {
      grade = member.gradeLevel || grade;
    }
  } else {
    grade = member.gradeLevel || '';
  }

  db.prepare(
    `UPDATE users SET role = ?, real_name = ?, must_change_password = ?,
      grade = ?, class_id = ?, class_name = ?, teacher_id = ?, platform_class_id = ?,
      ${BIND_COLUMNS}, last_login_at = ?, updated_at = ? WHERE id = ?`
  ).run(
    member.role,
    member.name,
    mustChangePassword,
    grade,
    classId,
    className,
    teacherId,
    member.classId,
    member.platformId,
    member.username,
    member.platformRole,
    'ok',
    now,
    now,
    now,
    row.id
  );

  return {
    id: row.id,
    platformId: member.platformId,
    role: member.role,
    isDisabled: Boolean(row.is_disabled),
  };
}

export interface PortalUserPayload {
  id: string;
  username: string;
  role: LocalRole;
  realName: string;
  grade: string;
  className: string;
  studentNo: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  subjectId: string;
  mustChangePassword: boolean;
  unreadNotifications: number;
  platformRole: string;
}

/** 登录接口与 /me 接口返回给前端的用户对象（与本地账号模式下的结构保持一致） */
export function loadPortalUserPayload(
  db: Database.Database,
  userId: string
): PortalUserPayload {
  const row = db
    .prepare(
      `SELECT id, username, role, real_name, grade, class_name, student_no, teacher_id,
              class_id, subject_id, must_change_password, platform_role
       FROM users WHERE id = ?`
    )
    .get(userId) as
    | {
        id: string;
        username: string;
        role: string;
        real_name: string;
        grade: string;
        class_name: string;
        student_no: string;
        teacher_id: string;
        class_id: string;
        subject_id: string;
        must_change_password: number;
        platform_role: string;
      }
    | undefined;
  if (!row || (row.role !== 'teacher' && row.role !== 'student')) {
    throw new Error('账号不存在');
  }

  let teacherName = '';
  let className = row.class_name;
  if (row.role === 'student') {
    if (row.teacher_id) {
      const teacher = db
        .prepare('SELECT real_name, username FROM users WHERE id = ?')
        .get(row.teacher_id) as { real_name: string; username: string } | undefined;
      teacherName = teacher ? teacher.real_name || teacher.username : '';
    }
    if (row.class_id) {
      const cls = db
        .prepare('SELECT name FROM classes WHERE id = ?')
        .get(row.class_id) as { name: string } | undefined;
      if (cls) className = cls.name;
    }
  }

  const unread = db
    .prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(userId) as { cnt: number };

  return {
    id: row.id,
    username: row.username,
    role: row.role,
    realName: row.real_name,
    grade: row.grade,
    className,
    studentNo: row.student_no,
    teacherId: row.teacher_id || '',
    teacherName,
    classId: row.class_id || '',
    subjectId: row.subject_id || '',
    mustChangePassword: Boolean(row.must_change_password),
    unreadNotifications: Number(unread?.cnt || 0),
    platformRole: row.platform_role || '',
  };
}

/**
 * 把"已绑定平台的账号"合并进"旧的本地账号"：旧账号继承平台绑定，新账号上的业务数据改挂到旧账号，
 * 最后删除新账号。调用方保证 targetId 已绑定平台、legacyId 未绑定且两者角色相同。
 */
export function mergeLegacyAccount(
  db: Database.Database,
  legacyId: string,
  targetId: string
): void {
  const legacy = db.prepare('SELECT * FROM users WHERE id = ?').get(legacyId) as
    | UserRow
    | undefined;
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as
    | UserRow
    | undefined;

  if (!legacy || !target) throw new Error('账号不存在');
  if (legacyId === targetId) throw new Error('请选择另一个账号');
  if (!target.platform_user_id) throw new Error('该账号尚未绑定平台，无需合并');
  if (legacy.platform_user_id) throw new Error('该旧账号已经绑定了平台账号');
  if (legacy.role !== target.role) throw new Error('两个账号的角色不一致，不能合并');

  const now = new Date().toISOString();
  const move = (table: string, column: string) => {
    db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(
      legacyId,
      targetId
    );
  };

  db.transaction(() => {
    move('submissions', 'student_id');
    move('submissions', 'adjusted_by');
    move('exam_submissions', 'student_id');
    move('exam_submissions', 'adjusted_by');
    move('notifications', 'user_id');
    move('notifications', 'sender_id');
    db.prepare(
      "UPDATE exam_assignments SET target_id = ? WHERE target_type = 'student' AND target_id = ?"
    ).run(legacyId, targetId);
    move('exams', 'teacher_id');
    move('questions', 'owner_id');
    move('knowledge_points', 'owner_id');
    move('classes', 'teacher_id');
    move('ai_generation_logs', 'user_id');
    move('generation_jobs', 'admin_id');
    move('admin_logs', 'admin_id');
    move('users', 'teacher_id');

    // 草稿与授课关系带联合唯一约束：冲突的保留新账号上的，其余改挂到旧账号
    db.prepare('UPDATE OR IGNORE drafts SET student_id = ? WHERE student_id = ?').run(
      legacyId,
      targetId
    );
    db.prepare('DELETE FROM drafts WHERE student_id = ?').run(targetId);
    db.prepare(
      'UPDATE OR IGNORE class_teachers SET teacher_id = ? WHERE teacher_id = ?'
    ).run(legacyId, targetId);
    db.prepare('DELETE FROM class_teachers WHERE teacher_id = ?').run(targetId);

    // platform_user_id 上有唯一索引：先解除新账号的绑定，再把绑定挪到旧账号
    db.prepare('UPDATE users SET platform_user_id = NULL WHERE id = ?').run(targetId);
    // 管理员若已禁用了平台账号，合并后不能借旧账号恢复访问
    if (target.is_disabled) {
      db.prepare('UPDATE users SET is_disabled = 1 WHERE id = ?').run(legacyId);
    }
    db.prepare(
      `UPDATE users SET ${BIND_COLUMNS}, last_login_at = ?, updated_at = ? WHERE id = ?`
    ).run(
      target.platform_user_id,
      target.platform_username,
      target.platform_role,
      target.platform_status,
      target.platform_synced_at,
      now,
      now,
      legacyId
    );
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  })();
}

/**
 * 把本地班级与平台班级对齐（platformClassId 为 null 表示解除）。
 * 对齐后该班此前发布的考试继续有效，平台上的学生登录后也会落在这个班里。
 */
export function alignLocalClassToPlatform(
  db: Database.Database,
  classId: string,
  platformClassId: number | null,
  brief: PlatformClassBrief | null
): void {
  const cls = db
    .prepare('SELECT id, platform_class_id FROM classes WHERE id = ?')
    .get(classId) as { id: string; platform_class_id: number | null } | undefined;
  if (!cls) throw new Error('班级不存在');
  const now = new Date().toISOString();

  if (platformClassId === null) {
    db.prepare(
      "UPDATE classes SET platform_class_id = NULL, platform_synced_at = '', updated_at = ? WHERE id = ?"
    ).run(now, classId);
    return;
  }

  const other = db
    .prepare('SELECT id FROM classes WHERE platform_class_id = ? AND id <> ?')
    .get(platformClassId, classId);
  if (other) throw new Error('该平台班级已经对应另一个本地班级');

  if (brief) {
    const name = platformClassDisplayName(brief.className, brief.gradeLevel);
    db.prepare(
      'UPDATE classes SET platform_class_id = ?, platform_synced_at = ?, name = ?, grade = ?, updated_at = ? WHERE id = ?'
    ).run(platformClassId, now, name, brief.gradeLevel, now, classId);
    db.prepare(
      "UPDATE users SET class_name = ?, grade = ?, updated_at = ? WHERE class_id = ? AND role = 'student'"
    ).run(name, brief.gradeLevel, now, classId);
  } else {
    db.prepare(
      'UPDATE classes SET platform_class_id = ?, platform_synced_at = ?, updated_at = ? WHERE id = ?'
    ).run(platformClassId, now, now, classId);
  }
}

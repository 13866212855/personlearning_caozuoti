import type Database from 'better-sqlite3';
import type { Response } from 'express';
import { APP_CONFIG } from '../config';

export function isPlatformMode(): boolean {
  return APP_CONFIG.platform.authMode === 'platform';
}

/** 平台模式下成员与班级由平台统一管理：本项目对应的写操作一律拒绝 */
export function rejectWhenPlatformManaged(
  res: Response,
  message = '成员与班级由个性化学习平台统一管理，请到平台办理'
): boolean {
  if (!isPlatformMode()) return false;
  res.status(403).json({ error: message });
  return true;
}

/**
 * 教师的班级范围。本项目的班级模型是"一个班一名归属教师"（classes.teacher_id）；
 * 平台模式下班主任仍然写入 classes.teacher_id，学科教师的授课关系登记在 class_teachers。
 * 下面两个条件各带 2 个占位符，依次绑定教师 id 两次。
 */
export function teacherClassCondition(alias = ''): string {
  const p = alias ? `${alias}.` : '';
  return `(${p}teacher_id = ? OR ${p}id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?))`;
}

export function teacherStudentCondition(alias = ''): string {
  const p = alias ? `${alias}.` : '';
  return `(${p}teacher_id = ? OR ${p}class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?))`;
}

export function getTeacherClassIds(
  db: Database.Database,
  teacherId: string
): string[] {
  const rows = db
    .prepare(`SELECT c.id FROM classes c WHERE ${teacherClassCondition('c')}`)
    .all(teacherId, teacherId) as Array<{ id: string }>;
  return rows.map((r) => String(r.id));
}

export function ownsClass(
  db: Database.Database,
  teacherId: string,
  classId: string
): boolean {
  return Boolean(
    db
      .prepare(`SELECT 1 FROM classes c WHERE c.id = ? AND ${teacherClassCondition('c')}`)
      .get(classId, teacherId, teacherId)
  );
}

export function ownsStudent(
  db: Database.Database,
  teacherId: string,
  studentId: string
): boolean {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM users WHERE id = ? AND role = 'student' AND ${teacherStudentCondition()}`
      )
      .get(studentId, teacherId, teacherId)
  );
}

export function ownsAllStudents(
  db: Database.Database,
  teacherId: string,
  studentIds: string[]
): boolean {
  return studentIds.every((studentId) => ownsStudent(db, teacherId, studentId));
}

export function ownsAssignments(
  db: Database.Database,
  teacherId: string,
  assignments: Array<{ targetType: string; targetId: string }>
): boolean {
  return assignments.every((a) =>
    a.targetType === 'class'
      ? ownsClass(db, teacherId, a.targetId)
      : ownsStudent(db, teacherId, a.targetId)
  );
}

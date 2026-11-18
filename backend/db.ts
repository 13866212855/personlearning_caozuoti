import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { APP_CONFIG } from './config';
import { BUILTIN_KNOWLEDGE_POINTS } from './seed/knowledgePoints';
import { SEED_QUESTIONS } from './seed/questions';
import type { Question, QuestionVisibility } from './types';

let dbInstance: Database.Database | null = null;

function hasColumn(
  db: Database.Database,
  table: string,
  column: string
): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return cols.some((c) => c.name === column);
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
    )
    .get(table);
  return Boolean(row);
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(path.dirname(APP_CONFIG.dbPath), { recursive: true });
  fs.mkdirSync(APP_CONFIG.uploadsDir, { recursive: true });

  const db = new Database(APP_CONFIG.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runSchemaAndMigrations(db);
  initializeDefaults(db);
  dbInstance = db;
  return db;
}

function runSchemaAndMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      real_name TEXT NOT NULL DEFAULT '',
      grade TEXT NOT NULL DEFAULT '',
      class_name TEXT NOT NULL DEFAULT '',
      student_no TEXT NOT NULL DEFAULT '',
      teacher_id TEXT DEFAULT '',
      class_id TEXT DEFAULT '',
      is_disabled INTEGER NOT NULL DEFAULT 0,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grade TEXT NOT NULL DEFAULT '高一',
      teacher_id TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_points (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      chapter TEXT NOT NULL,
      name TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 1,
      owner_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_configs (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      text_model TEXT NOT NULL,
      image_model TEXT NOT NULL,
      temperature REAL NOT NULL DEFAULT 0.4,
      max_tokens INTEGER NOT NULL DEFAULT 4096,
      timeout_ms INTEGER NOT NULL DEFAULT 45000,
      teacher_daily_ai_limit INTEGER NOT NULL DEFAULT 30,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      knowledge_points_json TEXT NOT NULL,
      knowledge_point_ids_json TEXT NOT NULL DEFAULT '[]',
      scenario TEXT NOT NULL,
      total_score INTEGER NOT NULL DEFAULT 100,
      materials_json TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      checkpoints_json TEXT NOT NULL,
      reference_answer_json TEXT NOT NULL,
      analysis_json TEXT NOT NULL,
      common_mistakes_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      source TEXT NOT NULL DEFAULT 'seed',
      owner_id TEXT NOT NULL DEFAULT 'system',
      visibility TEXT NOT NULL DEFAULT 'public',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      exam_id TEXT NOT NULL DEFAULT '',
      state_json TEXT NOT NULL,
      hints_used_json TEXT NOT NULL DEFAULT '[]',
      elapsed_seconds INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(student_id, question_id, exam_id)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      exam_id TEXT DEFAULT '',
      answer_json TEXT NOT NULL,
      auto_score REAL NOT NULL,
      final_score REAL NOT NULL,
      max_score REAL NOT NULL,
      checkpoint_results_json TEXT NOT NULL,
      hints_used_count INTEGER NOT NULL DEFAULT 0,
      hint_penalty REAL NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      teacher_comment TEXT DEFAULT '',
      adjusted_by TEXT DEFAULT '',
      graded_by_ai INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      type TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      count INTEGER NOT NULL,
      knowledge_point TEXT DEFAULT '',
      status TEXT NOT NULL,
      completed_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      errors_json TEXT NOT NULL DEFAULT '[]',
      created_question_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      admin_username TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT DEFAULT '',
      details TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_generation_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sender_id TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'system',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      link TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Non-destructive column additions on existing tables
  if (!hasColumn(db, 'llm_configs', 'teacher_daily_ai_limit')) {
    db.exec(
      'ALTER TABLE llm_configs ADD COLUMN teacher_daily_ai_limit INTEGER NOT NULL DEFAULT 30'
    );
  }

  if (!hasColumn(db, 'questions', 'owner_id')) {
    db.exec(
      "ALTER TABLE questions ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'system'"
    );
  }
  if (!hasColumn(db, 'questions', 'visibility')) {
    db.exec(
      "ALTER TABLE questions ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'"
    );
  }
  if (!hasColumn(db, 'questions', 'knowledge_point_ids_json')) {
    db.exec(
      "ALTER TABLE questions ADD COLUMN knowledge_point_ids_json TEXT NOT NULL DEFAULT '[]'"
    );
  }

  // Non-destructive migration for old exams table -> legacy_exams
  if (tableExists(db, 'exams') && !hasColumn(db, 'exams', 'teacher_id')) {
    if (!tableExists(db, 'legacy_exams')) {
      db.exec('ALTER TABLE exams RENAME TO legacy_exams');
    } else {
      db.exec('DROP TABLE exams');
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      teacher_id TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 40,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      max_attempts INTEGER NOT NULL DEFAULT 1,
      score_policy TEXT NOT NULL DEFAULT 'highest',
      show_score_immediately INTEGER NOT NULL DEFAULT 1,
      show_answer_policy TEXT NOT NULL DEFAULT 'after_end',
      shuffle INTEGER NOT NULL DEFAULT 0,
      anti_cheat_switch INTEGER NOT NULL DEFAULT 1,
      allow_late INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exam_questions (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 1,
      score INTEGER NOT NULL DEFAULT 100
    );

    CREATE TABLE IF NOT EXISTS exam_assignments (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exam_submissions (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      attempt_no INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'in_progress',
      answers_json TEXT NOT NULL DEFAULT '{}',
      question_results_json TEXT NOT NULL DEFAULT '[]',
      auto_score REAL NOT NULL DEFAULT 0,
      final_score REAL NOT NULL DEFAULT 0,
      max_score REAL NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      switch_count INTEGER NOT NULL DEFAULT 0,
      is_late INTEGER NOT NULL DEFAULT 0,
      teacher_comment TEXT NOT NULL DEFAULT '',
      adjusted_by TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL,
      submitted_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  // Non-destructive migration from legacy students & admins tables into users
  const now = new Date().toISOString();
  if (tableExists(db, 'admins')) {
    const legacyAdmins = db.prepare('SELECT * FROM admins').all() as Array<{
      id: string;
      username: string;
      password_hash: string;
      is_default_password: number;
      created_at: string;
      updated_at: string;
    }>;
    const upsertAdmin = db.prepare(`
      INSERT OR IGNORE INTO users (
        id, username, password_hash, role, real_name, grade, class_name,
        student_no, teacher_id, class_id, is_disabled, must_change_password,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'super_admin', '系统管理员', '', '', '', '', '', 0, ?, ?, ?)
    `);
    for (const a of legacyAdmins) {
      upsertAdmin.run(
        a.id,
        a.username,
        a.password_hash,
        a.is_default_password ? 1 : 0,
        a.created_at || now,
        a.updated_at || now
      );
    }
  }

  if (tableExists(db, 'students')) {
    const legacyStudents = db.prepare('SELECT * FROM students').all() as Array<{
      id: string;
      username: string;
      password_hash: string;
      real_name: string;
      grade: string;
      class_name: string;
      student_no: string;
      is_disabled: number;
      created_at: string;
    }>;
    const upsertStudent = db.prepare(`
      INSERT OR IGNORE INTO users (
        id, username, password_hash, role, real_name, grade, class_name,
        student_no, teacher_id, class_id, is_disabled, must_change_password,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'student', ?, ?, ?, ?, '', '', ?, 0, ?, ?)
    `);
    for (const s of legacyStudents) {
      upsertStudent.run(
        s.id,
        s.username,
        s.password_hash,
        s.real_name || s.username,
        s.grade || '',
        s.class_name || '',
        s.student_no || '',
        s.is_disabled ? 1 : 0,
        s.created_at || now,
        s.created_at || now
      );
    }
  }
}

function initializeDefaults(db: Database.Database) {
  const now = new Date().toISOString();

  // 1. Initialize default LLM configuration
  const llmExists = db
    .prepare('SELECT id FROM llm_configs WHERE id = 1')
    .get();
  if (!llmExists) {
    db.prepare(
      `INSERT INTO llm_configs (id, base_url, api_key, text_model, image_model, temperature, max_tokens, timeout_ms, teacher_daily_ai_limit, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, 30, ?)`
    ).run(
      APP_CONFIG.defaultLlm.baseUrl,
      APP_CONFIG.defaultLlm.apiKey,
      APP_CONFIG.defaultLlm.textModel,
      APP_CONFIG.defaultLlm.imageModel,
      APP_CONFIG.defaultLlm.temperature,
      APP_CONFIG.defaultLlm.maxTokens,
      APP_CONFIG.defaultLlm.timeoutMs,
      now
    );
  }

  // 2. Ensure default super_admin, teacher, default class, and demo student exist
  const adminExists = db
    .prepare("SELECT id FROM users WHERE username = 'admin'")
    .get();
  if (!adminExists) {
    const hash = bcrypt.hashSync(['admin', '123'].join(''), 10);
    db.prepare(
      `INSERT INTO users (
        id, username, password_hash, role, real_name, grade, class_name,
        student_no, teacher_id, class_id, is_disabled, must_change_password,
        created_at, updated_at
      ) VALUES ('admin-1', 'admin', ?, 'super_admin', '超级管理员', '', '', '', '', '', 0, 1, ?, ?)`
    ).run(hash, now, now);
  }

  let teacherRow = db
    .prepare("SELECT id FROM users WHERE username = 'liujyteacher'")
    .get() as { id: string } | undefined;
  if (!teacherRow) {
    const teacherHash = bcrypt.hashSync(['123', '456'].join(''), 10);
    db.prepare(
      `INSERT INTO users (
        id, username, password_hash, role, real_name, grade, class_name,
        student_no, teacher_id, class_id, is_disabled, must_change_password,
        created_at, updated_at
      ) VALUES ('teacher-1', 'liujyteacher', ?, 'teacher', '刘老师', '', '', '', '', '', 0, 1, ?, ?)`
    ).run(teacherHash, now, now);
    teacherRow = { id: 'teacher-1' };
  }

  let defaultClass = db
    .prepare('SELECT id, name, grade FROM classes WHERE teacher_id = ? LIMIT 1')
    .get(teacherRow.id) as
    | { id: string; name: string; grade: string }
    | undefined;
  if (!defaultClass) {
    db.prepare(
      `INSERT INTO classes (id, name, grade, teacher_id, invite_code, created_at, updated_at)
       VALUES ('class-default-1', '高一(1)班', '高一', ?, 'IT2026', ?, ?)`
    ).run(teacherRow.id, now, now);
    defaultClass = { id: 'class-default-1', name: '高一(1)班', grade: '高一' };
  }

  const demoStudent = db
    .prepare("SELECT id FROM users WHERE username = 'a123'")
    .get() as { id: string } | undefined;
  if (!demoStudent) {
    const studentHash = bcrypt.hashSync(['123', '456'].join(''), 10);
    db.prepare(
      `INSERT INTO users (
        id, username, password_hash, role, real_name, grade, class_name,
        student_no, teacher_id, class_id, is_disabled, must_change_password,
        created_at, updated_at
      ) VALUES ('student-demo-1', 'a123', ?, 'student', '演示学生', ?, ?, '20260001', ?, ?, 0, 1, ?, ?)`
    ).run(
      studentHash,
      defaultClass.grade,
      defaultClass.name,
      teacherRow.id,
      defaultClass.id,
      now,
      now
    );
  }

  // Ensure any unattached legacy students are linked to default class if no teacher_id
  db.prepare(
    "UPDATE users SET teacher_id = ?, class_id = ? WHERE role = 'student' AND (teacher_id = '' OR teacher_id IS NULL)"
  ).run(teacherRow.id, defaultClass.id);

  // 3. Seed built-in knowledge points
  const kpCount = db
    .prepare('SELECT COUNT(*) as cnt FROM knowledge_points')
    .get() as { cnt: number };
  if (kpCount.cnt === 0) {
    const insertKp = db.prepare(
      `INSERT INTO knowledge_points (id, type, chapter, name, is_system, owner_id, created_at)
       VALUES (?, ?, ?, ?, 1, '', ?)`
    );
    const txKp = db.transaction(() => {
      for (const kp of BUILTIN_KNOWLEDGE_POINTS) {
        insertKp.run(kp.id, kp.type, kp.chapter, kp.name, now);
      }
    });
    txKp();
  }

  // 4. Seed built-in questions
  const qCount = db
    .prepare('SELECT COUNT(*) as cnt FROM questions')
    .get() as { cnt: number };
  if (qCount.cnt === 0) {
    const insertQ = db.prepare(`
      INSERT INTO questions (
        id, title, type, difficulty, knowledge_points_json, knowledge_point_ids_json, scenario,
        total_score, materials_json, steps_json, checkpoints_json,
        reference_answer_json, analysis_json, common_mistakes_json,
        status, source, owner_id, visibility, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', 'public', ?, ?)
    `);

    const tx = db.transaction((questions: Omit<Question, 'ownerId' | 'visibility'>[]) => {
      for (const q of questions) {
        insertQ.run(
          q.id,
          q.title,
          q.type,
          q.difficulty,
          JSON.stringify(q.knowledgePoints),
          q.scenario,
          q.totalScore,
          JSON.stringify(q.materials),
          JSON.stringify(q.steps),
          JSON.stringify(q.checkpoints),
          JSON.stringify(q.referenceAnswer),
          JSON.stringify(q.analysis),
          JSON.stringify(q.commonMistakes),
          q.status,
          q.source,
          q.createdAt,
          q.updatedAt
        );
      }
    });
    tx(SEED_QUESTIONS);
  }

  // 5. Seed 1 published sample exam for default teacher & default class
  const examCount = db
    .prepare('SELECT COUNT(*) as cnt FROM exams')
    .get() as { cnt: number };
  if (examCount.cnt === 0) {
    const startTime = new Date(Date.now() - 3600 * 1000).toISOString();
    const endTime = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const sampleExamId = 'exam-seed-1';
    db.prepare(
      `INSERT INTO exams (
        id, title, description, teacher_id, duration, start_time, end_time,
        max_attempts, score_policy, show_score_immediately, show_answer_policy,
        shuffle, anti_cheat_switch, allow_late, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 40, ?, ?, 2, 'highest', 1, 'immediate', 0, 1, 0, 'published', ?, ?)`
    ).run(
      sampleExamId,
      '高一信息技术会考操作题综合摸底测试',
      '包含 Word 文字处理、Excel 电子表格、网页制作与文件管理各 1 题，请在规定时间内完成操作并交卷。',
      teacherRow.id,
      startTime,
      endTime,
      now,
      now
    );

    const sampleQIds = ['seed-word-1', 'seed-excel-1', 'seed-web-1', 'seed-file-1'];
    const insertEq = db.prepare(
      `INSERT INTO exam_questions (id, exam_id, question_id, sort_order, score)
       VALUES (?, ?, ?, ?, 100)`
    );
    sampleQIds.forEach((qid, idx) => {
      insertEq.run(`eq-seed-${idx + 1}`, sampleExamId, qid, idx + 1);
    });

    db.prepare(
      `INSERT INTO exam_assignments (id, exam_id, target_type, target_id)
       VALUES ('ea-seed-1', ?, 'class', ?)`
    ).run(sampleExamId, defaultClass.id);

    db.prepare(
      `INSERT INTO notifications (id, user_id, sender_id, type, title, content, link, is_read, created_at)
       VALUES ('notif-seed-1', 'student-demo-1', ?, 'exam_published', ?, ?, '/', 0, ?)`
    ).run(
      teacherRow.id,
      '新考试通知：高一信息技术会考操作题综合摸底测试',
      '刘老师发布了「高一信息技术会考操作题综合摸底测试」，包含 4 道操作题，请及时进入作答。',
      now
    );
  }
}

export function rowToQuestion(row: Record<string, unknown>): Question {
  return {
    id: String(row.id),
    title: String(row.title),
    type: row.type as Question['type'],
    difficulty: row.difficulty as Question['difficulty'],
    knowledgePoints: JSON.parse(String(row.knowledge_points_json || '[]')),
    knowledgePointIds: JSON.parse(String(row.knowledge_point_ids_json || '[]')),
    scenario: String(row.scenario),
    totalScore: Number(row.total_score),
    materials: JSON.parse(String(row.materials_json)),
    steps: JSON.parse(String(row.steps_json)),
    checkpoints: JSON.parse(String(row.checkpoints_json)),
    referenceAnswer: JSON.parse(String(row.reference_answer_json)),
    analysis: JSON.parse(String(row.analysis_json || '[]')),
    commonMistakes: JSON.parse(String(row.common_mistakes_json || '[]')),
    status: row.status as Question['status'],
    source: (row.source as 'seed' | 'ai') || 'seed',
    ownerId: String(row.owner_id || 'system'),
    visibility: (String(row.visibility || 'public') as QuestionVisibility),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function logAdminAction(
  adminId: string,
  adminUsername: string,
  action: string,
  targetType: string,
  targetId: string,
  details: string
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO admin_logs (id, admin_id, admin_username, action, target_type, target_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    adminId,
    adminUsername,
    action,
    targetType,
    targetId,
    details,
    new Date().toISOString()
  );
}

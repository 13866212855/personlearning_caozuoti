import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { APP_CONFIG } from './config';
import { SEED_QUESTIONS } from './seed/questions';
import type { Question } from './types';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(path.dirname(APP_CONFIG.dbPath), { recursive: true });
  fs.mkdirSync(APP_CONFIG.uploadsDir, { recursive: true });

  const db = new Database(APP_CONFIG.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      real_name TEXT NOT NULL,
      grade TEXT NOT NULL,
      class_name TEXT NOT NULL,
      student_no TEXT DEFAULT '',
      is_disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_default_password INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
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
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      knowledge_points_json TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      title TEXT NOT NULL,
      question_ids_json TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      total_score REAL NOT NULL DEFAULT 0,
      max_score REAL NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      submitted_at TEXT
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
  `);

  initializeDefaults(db);
  dbInstance = db;
  return db;
}

function initializeDefaults(db: Database.Database) {
  const now = new Date().toISOString();

  // 1. Initialize default LLM configuration
  const llmExists = db
    .prepare('SELECT id FROM llm_configs WHERE id = 1')
    .get();
  if (!llmExists) {
    db.prepare(
      `INSERT INTO llm_configs (id, base_url, api_key, text_model, image_model, temperature, max_tokens, timeout_ms, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`
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

  // 2. Initialize default admin account on first launch
  const adminCount = db
    .prepare('SELECT COUNT(*) as cnt FROM admins')
    .get() as { cnt: number };
  if (adminCount.cnt === 0) {
    const defaultPwd = ['admin', '123'].join('');
    const hash = bcrypt.hashSync(defaultPwd, 10);
    db.prepare(
      `INSERT INTO admins (id, username, password_hash, is_default_password, updated_at, created_at)
       VALUES (?, ?, ?, 1, ?, ?)`
    ).run('admin-1', 'admin', hash, now, now);
  }

  // 3. Seed built-in questions
  const qCount = db
    .prepare('SELECT COUNT(*) as cnt FROM questions')
    .get() as { cnt: number };
  if (qCount.cnt === 0) {
    const insertQ = db.prepare(`
      INSERT INTO questions (
        id, title, type, difficulty, knowledge_points_json, scenario,
        total_score, materials_json, steps_json, checkpoints_json,
        reference_answer_json, analysis_json, common_mistakes_json,
        status, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((questions: Question[]) => {
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
}

export function rowToQuestion(row: Record<string, unknown>): Question {
  return {
    id: String(row.id),
    title: String(row.title),
    type: row.type as Question['type'],
    difficulty: row.difficulty as Question['difficulty'],
    knowledgePoints: JSON.parse(String(row.knowledge_points_json || '[]')),
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

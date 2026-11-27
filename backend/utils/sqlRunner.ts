import Database from 'better-sqlite3';
import type { DatabaseTable } from '../types';

export interface SqlExecutionResult {
  ok: boolean;
  columns: string[];
  rows: Array<Array<string | number | null>>;
  changes: number;
  updatedTables: DatabaseTable[];
  error?: string;
}

const MAX_SQL_LENGTH = 8000;
const BLOCKED_SQL_PATTERN =
  /\b(ATTACH|DETACH|PRAGMA|LOAD_EXTENSION|VACUUM)\b/i;

function quoteIdent(ident: string): string {
  const clean = String(ident || '').replace(/"/g, '').trim();
  if (!clean) {
    throw new Error('数据表或字段名不能为空');
  }
  return `"${clean}"`;
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1] || '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inSingle && !inDouble) {
      if (ch === '-' && next === '-') {
        inLineComment = true;
        i++;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
      if (ch === ';') {
        if (current.trim()) statements.push(current.trim());
        current = '';
        continue;
      }
    }

    if (ch === "'" && !inDouble) {
      if (inSingle && next === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    }

    current += ch;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function inferSqliteColumnType(
  colIdx: number,
  rows: Array<Array<string | number | null>>
): string {
  let hasNum = false;
  let hasFloat = false;
  let hasText = false;
  for (const row of rows) {
    const v = row[colIdx];
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'number' && Number.isFinite(v)) {
      hasNum = true;
      if (!Number.isInteger(v)) hasFloat = true;
    } else {
      hasText = true;
    }
  }
  if (hasText) return 'TEXT';
  if (hasFloat) return 'REAL';
  if (hasNum) return 'INTEGER';
  return 'TEXT';
}

export function runSqlInMemory(
  tables: DatabaseTable[],
  sql: string
): SqlExecutionResult {
  if (typeof sql !== 'string' || !sql.trim()) {
    return {
      ok: false,
      columns: [],
      rows: [],
      changes: 0,
      updatedTables: tables || [],
      error: '请输入 SQL 查询或操作语句',
    };
  }
  if (sql.length > MAX_SQL_LENGTH) {
    return {
      ok: false,
      columns: [],
      rows: [],
      changes: 0,
      updatedTables: tables || [],
      error: `SQL 语句长度不能超过 ${MAX_SQL_LENGTH} 个字符`,
    };
  }
  if (BLOCKED_SQL_PATTERN.test(sql)) {
    return {
      ok: false,
      columns: [],
      rows: [],
      changes: 0,
      updatedTables: tables || [],
      error: '教学沙盒禁止执行 ATTACH / PRAGMA / VACUUM 等系统管理语句',
    };
  }

  const memDb = new Database(':memory:');
  try {
    // 1. Seed initial tables and rows in memory
    for (const tbl of tables || []) {
      const cols = tbl.columns || [];
      if (!tbl.name || cols.length === 0) continue;
      const colDefs = cols
        .map((c, idx) => `${quoteIdent(c)} ${inferSqliteColumnType(idx, tbl.rows || [])}`)
        .join(', ');
      memDb.exec(`CREATE TABLE ${quoteIdent(tbl.name)} (${colDefs})`);

      const placeholders = cols.map(() => '?').join(', ');
      const insertStmt = memDb.prepare(
        `INSERT INTO ${quoteIdent(tbl.name)} VALUES (${placeholders})`
      );
      for (const r of tbl.rows || []) {
        const padded = cols.map((_, idx) =>
          r[idx] === undefined ? null : r[idx]
        );
        insertStmt.run(...padded);
      }
    }

    // 2. Execute student SQL statements
    const statements = splitSqlStatements(sql);
    if (statements.length === 0) {
      return {
        ok: false,
        columns: [],
        rows: [],
        changes: 0,
        updatedTables: tables || [],
        error: '未检测到有效的 SQL 语句',
      };
    }

    let lastColumns: string[] = [];
    let lastRows: Array<Array<string | number | null>> = [];
    let totalChanges = 0;

    for (const stmtSql of statements) {
      const stmt = memDb.prepare(stmtSql);
      if (stmt.reader) {
        const colNames = stmt.columns().map((c) => c.name);
        const objRows = stmt.all() as Array<Record<string, string | number | null>>;
        lastColumns = colNames;
        lastRows = objRows.map((obj) =>
          colNames.map((c) => (obj[c] === undefined ? null : obj[c]))
        );
      } else {
        const info = stmt.run();
        totalChanges += Number(info.changes || 0);
        lastColumns = [];
        lastRows = [];
      }
    }

    // 3. Snapshot updated user tables
    const tableMeta = memDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid ASC"
      )
      .all() as Array<{ name: string }>;

    const updatedTables: DatabaseTable[] = tableMeta.map(({ name }) => {
      const qStmt = memDb.prepare(`SELECT * FROM ${quoteIdent(name)}`);
      const cols = qStmt.columns().map((c) => c.name);
      const objRows = qStmt.all() as Array<Record<string, string | number | null>>;
      return {
        name,
        columns: cols,
        rows: objRows.map((obj) =>
          cols.map((c) => (obj[c] === undefined ? null : obj[c]))
        ),
      };
    });

    return {
      ok: true,
      columns: lastColumns,
      rows: lastRows,
      changes: totalChanges,
      updatedTables,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      columns: [],
      rows: [],
      changes: 0,
      updatedTables: tables || [],
      error: `SQL 语法或执行错误：${msg}`,
    };
  } finally {
    memDb.close();
  }
}

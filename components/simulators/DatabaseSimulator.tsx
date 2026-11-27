'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  Play,
  RotateCcw,
  Table2,
} from 'lucide-react';
import { getAdminToken, getPortalToken } from '@/lib/api';
import type { DatabaseState, DatabaseTable } from '@/lib/types';

interface DatabaseSimulatorProps {
  value: DatabaseState;
  onChange: (next: DatabaseState) => void;
  readOnly?: boolean;
}

const SQL_SNIPPETS: Array<{ label: string; sql: string }> = [
  { label: '+ SELECT', sql: 'SELECT * FROM 表名;' },
  { label: '+ WHERE', sql: "WHERE 字段 = '值'" },
  { label: '+ ORDER BY', sql: 'ORDER BY 字段 DESC' },
  { label: '+ COUNT/AVG', sql: 'SELECT COUNT(*), AVG(字段) FROM 表名;' },
  { label: '+ GROUP BY', sql: 'GROUP BY 分组字段' },
  { label: '+ INSERT', sql: "INSERT INTO 表名 VALUES (...);" },
  { label: '+ UPDATE', sql: "UPDATE 表名 SET 字段 = 值 WHERE 条件;" },
  { label: '+ DELETE', sql: 'DELETE FROM 表名 WHERE 条件;' },
];

export default function DatabaseSimulator({
  value,
  onChange,
  readOnly = false,
}: DatabaseSimulatorProps) {
  const initialTables = useMemo(() => value?.tables || [], [value?.tables]);
  const sql = value?.sql ?? '';
  const lastColumns = value?.lastColumns || [];
  const lastRows = value?.lastRows || [];
  const lastChanges = value?.lastChanges ?? 0;
  const lastError = value?.lastError ?? '';

  const [selectedTableName, setSelectedTableName] = useState<string>(
    initialTables[0]?.name || ''
  );
  const [previewTables, setPreviewTables] = useState<DatabaseTable[] | null>(
    null
  );
  const [running, setRunning] = useState(false);

  const displayedTables = previewTables || initialTables;
  const activeTable =
    displayedTables.find((t) => t.name === selectedTableName) ||
    displayedTables[0] ||
    null;

  const updateState = (patch: Partial<DatabaseState>) => {
    if (readOnly) return;
    // Keep value.tables immutable so grading always starts from initial seed tables
    onChange({
      tables: initialTables,
      sql,
      lastColumns,
      lastRows,
      lastChanges,
      lastError,
      ...patch,
    });
  };

  const insertSnippet = (snippet: string) => {
    if (readOnly) return;
    const sep = sql && !sql.endsWith('\n') ? '\n' : '';
    updateState({ sql: `${sql}${sep}${snippet}` });
  };

  const handleExecuteSql = async () => {
    if (readOnly || running) return;
    setRunning(true);
    try {
      const token = getPortalToken() || getAdminToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const resp = await fetch('/api/runner/sql', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tables: initialTables,
          sql,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        columns?: string[];
        rows?: Array<Array<string | number | null>>;
        changes?: number;
        updatedTables?: DatabaseTable[];
        error?: string;
      };
      if (!resp.ok) {
        updateState({
          lastError: data.error || `执行请求失败 (${resp.status})`,
        });
        return;
      }
      if (data.ok && Array.isArray(data.updatedTables)) {
        setPreviewTables(data.updatedTables);
      }
      updateState({
        lastColumns: data.columns || [],
        lastRows: data.rows || [],
        lastChanges: data.changes || 0,
        lastError: data.error || '',
      });
    } catch {
      updateState({
        lastError: '连接 SQL 沙盒环境失败，请稍后重试',
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Top Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {!readOnly ? (
            SQL_SNIPPETS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => insertSnippet(s.sql)}
                className="h-7 px-2 text-xs font-mono bg-white border border-slate-200 hover:border-sky-400 hover:text-sky-700 rounded transition-colors whitespace-nowrap"
              >
                {s.label}
              </button>
            ))
          ) : (
            <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-600" />
              <span>SQL 查询与数据库操作（只读回看）</span>
            </span>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            {previewTables && (
              <button
                type="button"
                onClick={() => setPreviewTables(null)}
                className="h-7 px-2.5 text-xs text-slate-600 hover:bg-slate-200/70 rounded inline-flex items-center gap-1 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>查看初始表</span>
              </button>
            )}
            <button
              type="button"
              disabled={running}
              onClick={() => void handleExecuteSql()}
              className="h-7 px-3 text-xs font-medium bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{running ? '执行中...' : '执行 SQL'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Split Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Left: Data Tables & Schema Inspector */}
        <div className="lg:col-span-5 flex flex-col min-h-[260px] bg-slate-50/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Table2 className="w-3.5 h-3.5 text-sky-600" />
              <span>
                {previewTables ? '当前内存表快照' : '数据表结构与原始数据'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {displayedTables.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setSelectedTableName(t.name)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    activeTable?.name === t.name
                      ? 'bg-sky-600 text-white font-medium'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-2">
            {activeTable ? (
              <>
                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                  <span>
                    表名：<code className="font-mono font-semibold text-slate-900">{activeTable.name}</code>
                  </span>
                  <span className="tabular-nums">共 {activeTable.rows.length} 条记录</span>
                </div>
                <div className="border border-slate-200 rounded-lg bg-white overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                        {activeTable.columns.map((col) => (
                          <th
                            key={col}
                            className="py-1.5 px-2.5 font-mono font-semibold whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeTable.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50">
                          {activeTable.columns.map((_, cIdx) => (
                            <td
                              key={cIdx}
                              className="py-1.5 px-2.5 text-slate-700 font-mono whitespace-nowrap tabular-nums"
                            >
                              {row[cIdx] === null || row[cIdx] === undefined
                                ? 'NULL'
                                : String(row[cIdx])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 text-center py-8">
                暂无数据表结构
              </div>
            )}
          </div>
        </div>

        {/* Right: SQL Editor & Result Grid */}
        <div className="lg:col-span-7 flex flex-col min-h-[260px] divide-y divide-slate-200">
          <div className="flex flex-col bg-slate-900 text-slate-100">
            <div className="px-3 py-1.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono">query.sql · SQLite 标准方言</span>
              <span>支持 SELECT / WHERE / ORDER BY / GROUP BY / INSERT / UPDATE / DELETE</span>
            </div>
            <textarea
              rows={7}
              value={sql}
              readOnly={readOnly}
              onChange={(e) => updateState({ sql: e.target.value })}
              spellCheck={false}
              placeholder="-- 在此编写 SQL 语句，例如：&#10;SELECT * FROM books WHERE rating >= 4.8;"
              className="w-full p-3 bg-transparent text-slate-100 font-mono text-xs leading-6 focus:outline-none resize-y"
            />
          </div>

          <div className="flex-1 min-h-[150px] p-3 bg-slate-50/70 flex flex-col space-y-2 overflow-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">SQL 执行结果预览</span>
              {lastError ? (
                <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>执行错误</span>
                </span>
              ) : lastColumns.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-teal-700 font-medium tabular-nums">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>返回 {lastRows.length} 行记录</span>
                </span>
              ) : lastChanges > 0 ? (
                <span className="inline-flex items-center gap-1 text-teal-700 font-medium tabular-nums">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>已更新 {lastChanges} 条记录</span>
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  点击「执行 SQL」运行并预览结果
                </span>
              )}
            </div>

            {lastError ? (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-mono text-red-700">
                {lastError}
              </div>
            ) : lastColumns.length > 0 ? (
              <div className="border border-slate-200 rounded-lg bg-white overflow-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-sky-50 border-b border-slate-200 text-slate-800">
                      {lastColumns.map((col) => (
                        <th
                          key={col}
                          className="py-2 px-3 font-mono font-semibold whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lastRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {lastColumns.map((_, cIdx) => (
                          <td
                            key={cIdx}
                            className="py-1.5 px-3 text-slate-700 font-mono whitespace-nowrap tabular-nums"
                          >
                            {row[cIdx] === null || row[cIdx] === undefined
                              ? 'NULL'
                              : String(row[cIdx])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {lastRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={lastColumns.length}
                          className="py-4 text-center text-slate-400"
                        >
                          查询结果为空（0 行）
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : lastChanges > 0 ? (
              <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800">
                数据更新操作已成功执行（影响 {lastChanges} 行）。可在左侧「当前内存表快照」中查看更新后的数据。
              </div>
            ) : (
              <div className="flex-1 rounded-lg border border-dashed border-slate-200 bg-white flex items-center justify-center text-xs text-slate-400 p-6">
                执行查询后将在此以表格形式展示结果列与数据行
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

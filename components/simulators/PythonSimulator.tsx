'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
  Terminal,
  Trash2,
} from 'lucide-react';
import { getAdminToken, getPortalToken } from '@/lib/api';
import type { PythonState } from '@/lib/types';

interface PythonSimulatorProps {
  value: PythonState;
  onChange: (next: PythonState) => void;
  readOnly?: boolean;
}

const SNIPPETS: Array<{ label: string; code: string }> = [
  { label: '+ input()', code: 'n = int(input())\n' },
  { label: '+ if/else', code: 'if cond:\n    pass\nelse:\n    pass\n' },
  { label: '+ for', code: 'for i in range(n):\n    \n' },
  { label: '+ while', code: 'while cond:\n    \n' },
  { label: '+ def', code: 'def solve(x):\n    return x\n' },
  { label: '+ print', code: 'print(ans)\n' },
];

export default function PythonSimulator({
  value,
  onChange,
  readOnly = false,
}: PythonSimulatorProps) {
  const code = value?.code ?? '';
  const customInput = value?.customInput ?? '';
  const lastOutput = value?.lastOutput ?? '';
  const lastError = value?.lastError ?? '';

  const [running, setRunning] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const lineCount = Math.max(12, code.split('\n').length);

  const updateField = (patch: Partial<PythonState>) => {
    if (readOnly) return;
    onChange({
      code,
      customInput,
      lastOutput,
      lastError,
      ...patch,
    });
  };

  const insertSnippet = (snippet: string) => {
    if (readOnly) return;
    const sep = code && !code.endsWith('\n') ? '\n' : '';
    updateField({ code: `${code}${sep}${snippet}` });
  };

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const nextCode = code.slice(0, start) + '    ' + code.slice(end);
      updateField({ code: nextCode });
      requestAnimationFrame(() => {
        target.selectionStart = start + 4;
        target.selectionEnd = start + 4;
      });
    }
  };

  const handleRun = async () => {
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
      const resp = await fetch('/api/runner/python', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code,
          customInput,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        stdout?: string;
        stderr?: string;
        durationMs?: number;
        blockedReason?: string;
        error?: string;
      };
      if (!resp.ok) {
        updateField({
          lastOutput: '',
          lastError: data.error || `运行请求失败 (${resp.status})`,
        });
        return;
      }
      setDurationMs(typeof data.durationMs === 'number' ? data.durationMs : null);
      updateField({
        lastOutput: data.stdout || '',
        lastError: data.blockedReason || data.stderr || '',
      });
    } catch {
      updateField({
        lastOutput: '',
        lastError: '连接 Python 运行环境失败，请稍后重试',
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
            SNIPPETS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => insertSnippet(s.code)}
                className="h-7 px-2 text-xs font-mono bg-white border border-slate-200 hover:border-sky-400 hover:text-sky-700 rounded transition-colors whitespace-nowrap"
              >
                {s.label}
              </button>
            ))
          ) : (
            <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-sky-600" />
              <span>Python 程序代码（只读回看）</span>
            </span>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => updateField({ lastOutput: '', lastError: '' })}
              className="h-7 px-2.5 text-xs text-slate-600 hover:bg-slate-200/70 rounded inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空输出</span>
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => void handleRun()}
              className="h-7 px-3 text-xs font-medium bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{running ? '运行中...' : '运行代码'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Split Stage */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Left: Code Editor */}
        <div className="lg:col-span-7 flex flex-col min-h-[260px] bg-slate-900 text-slate-100">
          <div className="px-3 py-1.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-mono">main.py · Python 3</span>
            <span>Tab 键自动缩进 4 空格</span>
          </div>
          <div className="flex-1 min-h-0 flex overflow-auto font-mono text-xs leading-6">
            <div
              aria-hidden="true"
              className="select-none py-3 px-2.5 text-right text-slate-500 bg-slate-950/40 border-r border-slate-800 tabular-nums shrink-0"
            >
              {Array.from({ length: lineCount }).map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>
            <textarea
              value={code}
              readOnly={readOnly}
              onChange={(e) => updateField({ code: e.target.value })}
              onKeyDown={handleCodeKeyDown}
              spellCheck={false}
              placeholder="# 在此编写 Python 程序代码..."
              className="flex-1 w-full min-h-[240px] p-3 bg-transparent text-slate-100 focus:outline-none resize-none leading-6 font-mono text-xs"
            />
          </div>
        </div>

        {/* Right: Stdin & Console Output */}
        <div className="lg:col-span-5 flex flex-col min-h-[260px] bg-slate-50/70 divide-y divide-slate-200">
          <div className="p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                自定义测试输入 (stdin)
              </label>
              {!readOnly && customInput && (
                <button
                  type="button"
                  onClick={() => updateField({ customInput: '' })}
                  className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-0.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>清空</span>
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={customInput}
              readOnly={readOnly}
              onChange={(e) => updateField({ customInput: e.target.value })}
              placeholder="若代码调用了 input()，可在此提前填入测试输入（多行输入按回车分隔）"
              className="w-full p-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 resize-y"
            />
          </div>

          <div className="flex-1 min-h-0 p-3 flex flex-col space-y-2 overflow-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">运行输出控制台</span>
              {lastError ? (
                <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>运行异常</span>
                </span>
              ) : lastOutput ? (
                <span className="inline-flex items-center gap-1 text-teal-700 font-medium tabular-nums">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    执行成功{durationMs !== null ? ` · ${durationMs}ms` : ''}
                  </span>
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  点击右上角「运行代码」查看结果
                </span>
              )}
            </div>

            <div className="flex-1 min-h-[120px] rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs overflow-auto whitespace-pre-wrap break-words">
              {lastError ? (
                <div className="text-red-700">{lastError}</div>
              ) : lastOutput ? (
                <div className="text-slate-900">{lastOutput}</div>
              ) : (
                <div className="text-slate-400">
                  （暂无输出内容。提示：使用 input() 时括号内请保持为空，便于自动判分精确比对 stdout）
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

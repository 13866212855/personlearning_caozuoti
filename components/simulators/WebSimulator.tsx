'use client';

import { useMemo, useState } from 'react';
import {
  Code2,
  Copy,
  Eye,
  FileCode,
  FilePlus,
  RefreshCw,
} from 'lucide-react';
import type { QuestionAsset, WebFile, WebState } from '@/lib/types';

interface WebSimulatorProps {
  value: WebState;
  onChange: (next: WebState) => void;
  assets?: QuestionAsset[];
  readOnly?: boolean;
}

export default function WebSimulator({
  value,
  onChange,
  assets = [],
  readOnly = false,
}: WebSimulatorProps) {
  const files = useMemo(() => value.files || [], [value.files]);
  const [activePath, setActivePath] = useState<string>(
    files[0]?.path || 'index.html'
  );
  const [viewMode, setViewMode] = useState<'split' | 'code' | 'preview'>('split');
  const [previewKey, setPreviewKey] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState('');

  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const activeFile =
    files.find((f) => f.path === activePath) || files[0] || null;

  const updateFileContent = (content: string) => {
    if (readOnly || !activeFile) return;
    onChange({
      ...value,
      files: files.map((f) =>
        f.path === activeFile.path ? { ...f, content } : f
      ),
    });
  };

  const handleAddFile = () => {
    if (readOnly || !newFileName.trim()) return;
    const name = newFileName.trim();
    if (files.some((f) => f.path === name)) return;
    const type: WebFile['type'] = name.endsWith('.css') ? 'css' : 'html';
    const nextFile: WebFile = {
      path: name,
      name,
      type,
      content:
        type === 'css'
          ? '/* 新建样式文件 */\n'
          : '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n  <meta charset="UTF-8" />\n</head>\n<body>\n\n</body>\n</html>',
    };
    onChange({ ...value, files: [...files, nextFile] });
    setActivePath(name);
    setNewFileName('');
    setShowNewFile(false);
  };

  const insertSnippet = (snippet: string) => {
    if (readOnly || !activeFile) return;
    updateFileContent(activeFile.content + '\n' + snippet);
  };

  const compiledSrcDoc = useMemo(() => {
    const htmlFile =
      (activeFile?.type === 'html' ? activeFile : null) ||
      files.find((f) => f.type === 'html');
    if (!htmlFile) return '<p>暂无 HTML 文件</p>';

    const cssContent = files
      .filter((f) => f.type === 'css')
      .map((f) => f.content)
      .join('\n');

    let html = htmlFile.content;
    const styleBlock = `<style>\n${cssContent}\n</style>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${styleBlock}\n</head>`);
    } else {
      html = styleBlock + html;
    }
    return html;
  }, [files, activeFile]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Top Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {!readOnly && activeFile?.type === 'html' && (
            <>
              {[
                { label: '+ h1', code: '<h1>标题</h1>' },
                {
                  label: '+ img',
                  code: `<img src="${assets[0]?.url || '/api/seed-assets/heritage.svg'}" alt="说明文字" width="300" />`,
                },
                {
                  label: '+ a',
                  code: '<a href="https://www.ihchina.cn" target="_blank">了解更多</a>',
                },
                {
                  label: '+ ul',
                  code: '<ul>\n  <li>项目一</li>\n  <li>项目二</li>\n  <li>项目三</li>\n</ul>',
                },
                {
                  label: '+ table',
                  code: '<table border="1">\n  <tr><th>列1</th><th>列2</th></tr>\n  <tr><td>内容1</td><td>内容2</td></tr>\n</table>',
                },
                {
                  label: '+ form',
                  code: '<form>\n  <input type="text" placeholder="请输入" />\n  <button type="submit">提交</button>\n</form>',
                },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => insertSnippet(s.code)}
                  className="h-7 px-2 text-xs font-mono bg-white border border-slate-200 hover:border-sky-400 hover:text-sky-700 rounded transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg text-xs">
          {(
            [
              { v: 'split', l: '分屏预览', icon: Code2 },
              { v: 'code', l: '仅代码', icon: FileCode },
              { v: 'preview', l: '仅预览', icon: Eye },
            ] as const
          ).map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => setViewMode(m.v)}
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                viewMode === m.v
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m.l}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* File Explorer */}
        <div className="w-full lg:w-48 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/70 p-2.5 flex flex-col gap-2 shrink-0 overflow-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              项目文件树
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setShowNewFile((v) => !v)}
                title="新建文件"
                className="p-1 text-slate-500 hover:text-sky-700 rounded hover:bg-slate-200/60"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {showNewFile && (
            <div className="flex gap-1">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="如 about.html"
                className="flex-1 min-w-0 h-7 px-2 text-xs border border-slate-300 rounded bg-white"
              />
              <button
                type="button"
                onClick={handleAddFile}
                className="px-2 h-7 text-xs bg-sky-600 text-white rounded"
              >
                建
              </button>
            </div>
          )}

          <div className="space-y-1">
            {files.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setActivePath(f.path)}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-2 transition-colors ${
                  activeFile?.path === f.path
                    ? 'bg-sky-100 text-sky-800 font-semibold'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
          </div>

          {assets.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-1.5">
              <span className="text-xs font-semibold text-slate-700 block">
                可用图片素材
              </span>
              {assets.map((a) => (
                <div
                  key={a.url}
                  className="bg-white border border-slate-200 rounded p-1.5 text-xs space-y-1"
                >
                  <div className="font-medium text-slate-800 truncate">
                    {a.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(a.url);
                      setCopiedUrl(a.url);
                      setTimeout(() => setCopiedUrl(''), 1500);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:underline"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedUrl === a.url ? '已复制路径' : '复制路径'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Code Editor */}
        {viewMode !== 'preview' && (
          <div
            className={`flex flex-col min-h-[260px] ${
              viewMode === 'split'
                ? 'flex-1 border-b lg:border-b-0 lg:border-r border-slate-200'
                : 'flex-1'
            }`}
          >
            <div className="px-3 py-1.5 bg-slate-900 text-slate-300 text-xs font-mono flex items-center justify-between">
              <span>{activeFile?.path || ''}</span>
              <span>{activeFile?.type?.toUpperCase()}</span>
            </div>
            <textarea
              readOnly={readOnly}
              spellCheck={false}
              value={activeFile?.content || ''}
              onChange={(e) => updateFileContent(e.target.value)}
              className="flex-1 w-full p-3 bg-slate-950 text-slate-100 font-mono text-xs leading-6 resize-none focus:outline-none"
            />
          </div>
        )}

        {/* Live Preview */}
        {viewMode !== 'code' && (
          <div className="flex-1 flex flex-col min-h-[260px] bg-white">
            <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>网页实时预览</span>
              <button
                type="button"
                onClick={() => setPreviewKey((k) => k + 1)}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
              >
                <RefreshCw className="w-3 h-3" />
                <span>刷新</span>
              </button>
            </div>
            <iframe
              key={previewKey}
              title="网页实时预览"
              sandbox="allow-scripts"
              srcDoc={compiledSrcDoc}
              className="flex-1 w-full bg-white border-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}

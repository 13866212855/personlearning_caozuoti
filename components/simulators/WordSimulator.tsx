'use client';

import { useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  FilePlus,
  Image as ImageIcon,
  Indent,
  Italic,
  List,
  ListOrdered,
  Replace,
  Settings2,
  Table as TableIcon,
  Trash2,
  Underline,
} from 'lucide-react';
import type { QuestionAsset, WordParagraph, WordState } from '@/lib/types';

interface WordSimulatorProps {
  value: WordState;
  onChange: (next: WordState) => void;
  assets?: QuestionAsset[];
  readOnly?: boolean;
}

const FONT_OPTIONS = ['宋体', '黑体', '微软雅黑', '楷体', 'Times New Roman'];
const SIZE_OPTIONS = [10.5, 12, 14, 16, 18, 20, 24, 28, 36];
const COLOR_OPTIONS = [
  { label: '黑色', value: '#000000' },
  { label: '深蓝', value: '#1D4ED8' },
  { label: '青绿', value: '#0F766E' },
  { label: '红色', value: '#DC2626' },
  { label: '深灰', value: '#334155' },
];

export default function WordSimulator({
  value,
  onChange,
  assets = [],
  readOnly = false,
}: WordSimulatorProps) {
  const paragraphs = value.paragraphs || [];
  const tables = value.tables || [];
  const images = value.images || [];
  const pageSetup = value.pageSetup || {
    orientation: 'portrait',
    marginTop: 2.54,
    marginBottom: 2.54,
    marginLeft: 3.18,
    marginRight: 3.18,
  };

  const [activeId, setActiveId] = useState<string>(paragraphs[0]?.id || '');
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findMsg, setFindMsg] = useState('');

  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(2);

  const [showImageModal, setShowImageModal] = useState(false);
  const [imgSrc, setImgSrc] = useState(
    assets[0]?.url || '/api/seed-assets/info-literacy.svg'
  );
  const [imgAlt, setImgAlt] = useState(assets[0]?.name || '');
  const [imgWidth, setImgWidth] = useState(320);

  const [showPageModal, setShowPageModal] = useState(false);

  const activePara =
    paragraphs.find((p) => p.id === activeId) || paragraphs[0] || null;

  const updateParagraph = (id: string, patch: Partial<WordParagraph>) => {
    if (readOnly) return;
    onChange({
      ...value,
      paragraphs: paragraphs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  };

  const addParagraph = () => {
    if (readOnly) return;
    const newPara: WordParagraph = {
      id: `p-${Date.now()}`,
      text: '新建段落内容',
      fontFamily: '宋体',
      fontSize: 12,
      color: '#000000',
      bold: false,
      italic: false,
      underline: false,
      align: 'left',
      lineHeight: 1.0,
      indent: 0,
      listType: 'none',
    };
    onChange({
      ...value,
      paragraphs: [...paragraphs, newPara],
    });
    setActiveId(newPara.id);
  };

  const deleteParagraph = (id: string) => {
    if (readOnly || paragraphs.length <= 1) return;
    const filtered = paragraphs.filter((p) => p.id !== id);
    onChange({ ...value, paragraphs: filtered });
    if (activeId === id) {
      setActiveId(filtered[0]?.id || '');
    }
  };

  const handleReplaceAll = () => {
    if (readOnly || !findText) return;
    let count = 0;
    const nextParagraphs = paragraphs.map((p) => {
      if (p.text.includes(findText)) {
        const parts = p.text.split(findText);
        count += parts.length - 1;
        return { ...p, text: parts.join(replaceText) };
      }
      return p;
    });
    onChange({ ...value, paragraphs: nextParagraphs });
    setFindMsg(`已完成替换，共替换 ${count} 处`);
  };

  const handleInsertTable = () => {
    if (readOnly) return;
    const r = Math.max(1, Math.min(10, tableRows));
    const c = Math.max(1, Math.min(8, tableCols));
    const rows = Array.from({ length: r }, () =>
      Array.from({ length: c }, () => '')
    );
    onChange({
      ...value,
      tables: [...tables, { id: `tbl-${Date.now()}`, rows }],
    });
    setShowTableModal(false);
  };

  const updateTableCell = (
    tableId: string,
    rowIdx: number,
    colIdx: number,
    cellText: string
  ) => {
    if (readOnly) return;
    onChange({
      ...value,
      tables: tables.map((t) => {
        if (t.id !== tableId) return t;
        const nextRows = t.rows.map((r, ri) =>
          ri === rowIdx ? r.map((c, ci) => (ci === colIdx ? cellText : c)) : r
        );
        return { ...t, rows: nextRows };
      }),
    });
  };

  const handleInsertImage = () => {
    if (readOnly || !imgSrc.trim()) return;
    onChange({
      ...value,
      images: [
        ...images,
        {
          id: `img-${Date.now()}`,
          src: imgSrc.trim(),
          alt: imgAlt.trim(),
          width: imgWidth,
          align: 'center',
        },
      ],
    });
    setShowImageModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      {!readOnly && (
        <div className="bg-white border-b border-slate-200 p-2 flex flex-wrap items-center gap-1.5">
          {/* Font Family */}
          <select
            aria-label="字体"
            value={activePara?.fontFamily || '宋体'}
            onChange={(e) =>
              activePara &&
              updateParagraph(activePara.id, { fontFamily: e.target.value })
            }
            className="h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-800"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* Font Size */}
          <select
            aria-label="字号"
            value={activePara?.fontSize || 12}
            onChange={(e) =>
              activePara &&
              updateParagraph(activePara.id, {
                fontSize: Number(e.target.value),
              })
            }
            className="h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-800 tabular-nums"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}pt
              </option>
            ))}
          </select>

          {/* Color */}
          <select
            aria-label="字体颜色"
            value={activePara?.color || '#000000'}
            onChange={(e) =>
              activePara &&
              updateParagraph(activePara.id, { color: e.target.value })
            }
            className="h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-800"
          >
            {COLOR_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} ({c.value})
              </option>
            ))}
          </select>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* B I U */}
          <button
            type="button"
            title="加粗"
            onClick={() =>
              activePara &&
              updateParagraph(activePara.id, { bold: !activePara.bold })
            }
            className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
              activePara?.bold
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="斜体"
            onClick={() =>
              activePara &&
              updateParagraph(activePara.id, { italic: !activePara.italic })
            }
            className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
              activePara?.italic
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="下划线"
            onClick={() =>
              activePara &&
              updateParagraph(activePara.id, {
                underline: !activePara.underline,
              })
            }
            className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
              activePara?.underline
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Underline className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* Alignment */}
          {(
            [
              { val: 'left', icon: AlignLeft, label: '左对齐' },
              { val: 'center', icon: AlignCenter, label: '居中对齐' },
              { val: 'right', icon: AlignRight, label: '右对齐' },
              { val: 'justify', icon: AlignJustify, label: '两端对齐' },
            ] as const
          ).map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.val}
                type="button"
                title={a.label}
                onClick={() =>
                  activePara &&
                  updateParagraph(activePara.id, { align: a.val })
                }
                className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
                  activePara?.align === a.val
                    ? 'bg-sky-100 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* Line height */}
          <select
            aria-label="行距"
            value={activePara?.lineHeight || 1.0}
            onChange={(e) =>
              activePara &&
              updateParagraph(activePara.id, {
                lineHeight: Number(e.target.value),
              })
            }
            className="h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-800"
          >
            <option value={1.0}>行距 1.0</option>
            <option value={1.25}>行距 1.25</option>
            <option value={1.5}>行距 1.5</option>
            <option value={2.0}>行距 2.0</option>
          </select>

          {/* First-line indent */}
          <button
            type="button"
            title="首行缩进 2 字符"
            onClick={() =>
              activePara &&
              updateParagraph(activePara.id, {
                indent: activePara.indent === 2 ? 0 : 2,
              })
            }
            className={`h-8 px-2 rounded flex items-center gap-1 text-xs font-medium whitespace-nowrap transition-colors ${
              activePara?.indent === 2
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Indent className="w-3.5 h-3.5" />
            <span>缩进2字符</span>
          </button>

          {/* Lists */}
          <button
            type="button"
            title="项目符号"
            onClick={() =>
              activePara &&
              updateParagraph(activePara.id, {
                listType: activePara.listType === 'bullet' ? 'none' : 'bullet',
              })
            }
            className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
              activePara?.listType === 'bullet'
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="编号列表"
            onClick={() =>
              activePara &&
              updateParagraph(activePara.id, {
                listType: activePara.listType === 'number' ? 'none' : 'number',
              })
            }
            className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
              activePara?.listType === 'number'
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* Actions */}
          <button
            type="button"
            onClick={addParagraph}
            className="h-8 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded flex items-center gap-1 whitespace-nowrap"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>新增段落</span>
          </button>
          <button
            type="button"
            onClick={() => setShowTableModal(true)}
            className="h-8 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded flex items-center gap-1 whitespace-nowrap"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>插入表格</span>
          </button>
          <button
            type="button"
            onClick={() => setShowImageModal(true)}
            className="h-8 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded flex items-center gap-1 whitespace-nowrap"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>插入图片</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFindReplace((v) => !v)}
            className={`h-8 px-2.5 text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap ${
              showFindReplace
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Replace className="w-3.5 h-3.5" />
            <span>查找替换</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPageModal(true)}
            className="h-8 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded flex items-center gap-1 whitespace-nowrap"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>页面设置</span>
          </button>
        </div>
      )}

      {/* Find & Replace Bar */}
      {!readOnly && showFindReplace && (
        <div className="bg-sky-50 border-b border-sky-200 px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            placeholder="查找内容"
            className="h-7 px-2 border border-slate-300 rounded bg-white w-36"
          />
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="替换为"
            className="h-7 px-2 border border-slate-300 rounded bg-white w-36"
          />
          <button
            type="button"
            onClick={handleReplaceAll}
            className="h-7 px-3 bg-sky-600 text-white rounded hover:bg-sky-700 font-medium whitespace-nowrap"
          >
            全部替换
          </button>
          {findMsg && <span className="text-sky-800">{findMsg}</span>}
        </div>
      )}

      {/* Document Canvas */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center">
        <div
          className={`bg-white border border-slate-300 shadow-sm flex flex-col justify-between transition-all ${
            pageSetup.orientation === 'landscape'
              ? 'w-full max-w-[920px] min-h-[540px]'
              : 'w-full max-w-[740px] min-h-[720px]'
          }`}
          style={{
            paddingTop: `${Math.max(16, pageSetup.marginTop * 12)}px`,
            paddingBottom: `${Math.max(16, pageSetup.marginBottom * 12)}px`,
            paddingLeft: `${Math.max(20, pageSetup.marginLeft * 12)}px`,
            paddingRight: `${Math.max(20, pageSetup.marginRight * 12)}px`,
          }}
        >
          <div>
            {/* Header */}
            <div className="border-b border-dashed border-slate-200 pb-2 mb-4">
              <input
                type="text"
                readOnly={readOnly}
                value={value.headerText || ''}
                onChange={(e) =>
                  onChange({ ...value, headerText: e.target.value })
                }
                placeholder={readOnly ? '' : '点击此处编辑页眉...'}
                className="w-full text-center text-xs text-slate-500 bg-transparent focus:outline-none focus:bg-sky-50/40 py-0.5 rounded"
              />
            </div>

            {/* Paragraphs */}
            <div className="space-y-3">
              {paragraphs.map((para, idx) => {
                const isActive = para.id === activePara?.id && !readOnly;
                const fontFamilyCss =
                  para.fontFamily === '宋体'
                    ? 'SimSun, "Songti SC", serif'
                    : para.fontFamily === '黑体'
                      ? 'SimHei, "Heiti SC", sans-serif'
                      : para.fontFamily === '楷体'
                        ? 'KaiTi, "Kaiti SC", serif'
                        : para.fontFamily === '微软雅黑'
                          ? '"Microsoft YaHei", sans-serif'
                          : '"Times New Roman", serif';

                return (
                  <div
                    key={para.id}
                    onClick={() => setActiveId(para.id)}
                    className={`group relative rounded p-1.5 transition-colors ${
                      isActive
                        ? 'ring-2 ring-sky-500/40 bg-sky-50/20'
                        : readOnly
                          ? ''
                          : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {para.listType === 'bullet' && (
                        <span className="mt-1 text-slate-700 select-none">
                          •
                        </span>
                      )}
                      {para.listType === 'number' && (
                        <span className="mt-0.5 text-xs text-slate-700 select-none tabular-nums">
                          {idx + 1}.
                        </span>
                      )}
                      {readOnly ? (
                        <p
                          className="flex-1 whitespace-pre-wrap break-words"
                          style={{
                            fontFamily: fontFamilyCss,
                            fontSize: `${para.fontSize * 1.25}px`,
                            color: para.color,
                            fontWeight: para.bold ? 700 : 400,
                            fontStyle: para.italic ? 'italic' : 'normal',
                            textDecoration: para.underline
                              ? 'underline'
                              : 'none',
                            textAlign: para.align,
                            lineHeight: para.lineHeight,
                            textIndent: `${para.indent}em`,
                          }}
                        >
                          {para.text}
                        </p>
                      ) : (
                        <textarea
                          rows={Math.max(1, Math.ceil(para.text.length / 40))}
                          value={para.text}
                          onFocus={() => setActiveId(para.id)}
                          onChange={(e) =>
                            updateParagraph(para.id, { text: e.target.value })
                          }
                          className="flex-1 bg-transparent resize-none focus:outline-none"
                          style={{
                            fontFamily: fontFamilyCss,
                            fontSize: `${para.fontSize * 1.25}px`,
                            color: para.color,
                            fontWeight: para.bold ? 700 : 400,
                            fontStyle: para.italic ? 'italic' : 'normal',
                            textDecoration: para.underline
                              ? 'underline'
                              : 'none',
                            textAlign: para.align,
                            lineHeight: para.lineHeight,
                            textIndent: `${para.indent}em`,
                          }}
                        />
                      )}
                      {!readOnly && paragraphs.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteParagraph(para.id);
                          }}
                          title="删除段落"
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-1 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tables */}
            {tables.length > 0 && (
              <div className="mt-5 space-y-4">
                {tables.map((tbl) => (
                  <div key={tbl.id} className="relative group">
                    {!readOnly && (
                      <div className="flex justify-end mb-1">
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              ...value,
                              tables: tables.filter((t) => t.id !== tbl.id),
                            })
                          }
                          className="text-xs text-red-600 hover:underline"
                        >
                          删除表格
                        </button>
                      </div>
                    )}
                    <table className="w-full border-collapse border border-slate-400 text-sm">
                      <tbody>
                        {tbl.rows.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td
                                key={ci}
                                className="border border-slate-400 p-1.5"
                              >
                                {readOnly ? (
                                  <span>{cell}</span>
                                ) : (
                                  <input
                                    type="text"
                                    value={cell}
                                    onChange={(e) =>
                                      updateTableCell(
                                        tbl.id,
                                        ri,
                                        ci,
                                        e.target.value
                                      )
                                    }
                                    className="w-full bg-transparent focus:outline-none focus:bg-sky-50/40 px-1"
                                  />
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {/* Images */}
            {images.length > 0 && (
              <div className="mt-5 space-y-4">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={`flex flex-col ${
                      img.align === 'center'
                        ? 'items-center'
                        : img.align === 'right'
                          ? 'items-end'
                          : 'items-start'
                    }`}
                  >
                    <img
                      src={img.src}
                      alt={img.alt || '文档插图'}
                      referrerPolicy="no-referrer"
                      style={{ width: `${img.width || 320}px` }}
                      className="max-w-full rounded border border-slate-200"
                    />
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span>替代文本: {img.alt || '（未设置）'}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              ...value,
                              images: images.filter((i) => i.id !== img.id),
                            })
                          }
                          className="text-red-600 hover:underline"
                        >
                          移除图片
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-dashed border-slate-200 pt-2 mt-8">
            <input
              type="text"
              readOnly={readOnly}
              value={value.footerText || ''}
              onChange={(e) =>
                onChange({ ...value, footerText: e.target.value })
              }
              placeholder={readOnly ? '' : '点击此处编辑页脚...'}
              className="w-full text-center text-xs text-slate-500 bg-transparent focus:outline-none focus:bg-sky-50/40 py-0.5 rounded"
            />
          </div>
        </div>
      </div>

      {/* Insert Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-900">插入表格</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-slate-600">行数</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={tableRows}
                  onChange={(e) => setTableRows(Number(e.target.value))}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-600">列数</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={tableCols}
                  onChange={(e) => setTableCols(Number(e.target.value))}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleInsertTable}
                className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium"
              >
                确认插入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insert Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold text-slate-900">插入图片</h3>
            <div className="space-y-3 text-sm">
              {assets.length > 0 && (
                <div className="space-y-1">
                  <span className="text-slate-600">选择题目素材</span>
                  <select
                    value={imgSrc}
                    onChange={(e) => {
                      setImgSrc(e.target.value);
                      const found = assets.find((a) => a.url === e.target.value);
                      if (found && !imgAlt) setImgAlt(found.name);
                    }}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white"
                  >
                    {assets.map((a) => (
                      <option key={a.url} value={a.url}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <label className="block space-y-1">
                <span className="text-slate-600">图片路径</span>
                <input
                  type="text"
                  value={imgSrc}
                  onChange={(e) => setImgSrc(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-600">替代文本 (alt)</span>
                <input
                  type="text"
                  value={imgAlt}
                  onChange={(e) => setImgAlt(e.target.value)}
                  placeholder="例如：信息素养结构图"
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-600">显示宽度 (px)</span>
                <input
                  type="number"
                  min={100}
                  max={600}
                  value={imgWidth}
                  onChange={(e) => setImgWidth(Number(e.target.value))}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleInsertImage}
                className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium"
              >
                插入图片
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Setup Modal */}
      {showPageModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold text-slate-900">页面设置</h3>
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <span className="text-slate-600">纸张方向</span>
                <div className="flex gap-2">
                  {(
                    [
                      { v: 'portrait', l: '纵向' },
                      { v: 'landscape', l: '横向' },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...value,
                          pageSetup: { ...pageSetup, orientation: o.v },
                        })
                      }
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                        pageSetup.orientation === o.v
                          ? 'border-sky-600 bg-sky-50 text-sky-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-600">上边距 (cm)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={pageSetup.marginTop}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        pageSetup: {
                          ...pageSetup,
                          marginTop: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600">下边距 (cm)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={pageSetup.marginBottom}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        pageSetup: {
                          ...pageSetup,
                          marginBottom: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600">左边距 (cm)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={pageSetup.marginLeft}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        pageSetup: {
                          ...pageSetup,
                          marginLeft: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600">右边距 (cm)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={pageSetup.marginRight}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        pageSetup: {
                          ...pageSetup,
                          marginRight: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowPageModal(false)}
                className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

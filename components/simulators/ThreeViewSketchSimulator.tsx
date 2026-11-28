'use client';

import { useMemo, useState } from 'react';
import {
  Eraser,
  Minus,
  Pencil,
  Ruler,
  Trash2,
} from 'lucide-react';
import type {
  Sketch3ViewState,
  SketchLine,
  SketchLineStyle,
  SketchViewName,
} from '@/lib/types';

interface Props {
  value: Sketch3ViewState;
  onChange: (next: Sketch3ViewState) => void;
  readOnly?: boolean;
}

const VIEW_LABELS: Record<SketchViewName, { title: string; subtitle: string }> = {
  front: { title: '主视图（长 × 高）', subtitle: 'Front View' },
  left: { title: '左视图（宽 × 高）', subtitle: 'Left View' },
  top: { title: '俯视图（长 × 宽）', subtitle: 'Top View' },
};

const STYLE_LABELS: Record<SketchLineStyle, { label: string; dash?: string }> = {
  solid: { label: '粗实线（可见轮廓）' },
  dashed: { label: '虚线（不可见轮廓）', dash: '5 4' },
  center: { label: '细点画线（对称轴线）', dash: '8 3 2 3' },
};

function normLineKey(l: SketchLine): string {
  const forward = l.x1 < l.x2 || (l.x1 === l.x2 && l.y1 <= l.y2);
  const ax = forward ? l.x1 : l.x2;
  const ay = forward ? l.y1 : l.y2;
  const bx = forward ? l.x2 : l.x1;
  const by = forward ? l.y2 : l.y1;
  return `${l.view}:${ax},${ay}-${bx},${by}:${l.style}`;
}

export default function ThreeViewSketchSimulator({
  value,
  onChange,
  readOnly = false,
}: Props) {
  const cols = Math.max(4, Math.min(12, value?.gridCols || 6));
  const rows = Math.max(4, Math.min(12, value?.gridRows || 6));
  const givenLines = useMemo(() => value?.givenLines || [], [value?.givenLines]);
  const userLines = useMemo(() => value?.lines || [], [value?.lines]);
  const dimensions = useMemo(() => value?.dimensions || [], [value?.dimensions]);

  const [tool, setTool] = useState<'draw' | 'erase'>('draw');
  const [lineStyle, setLineStyle] = useState<SketchLineStyle>('solid');
  const [showProjectionGuides, setShowProjectionGuides] = useState(true);
  const [pendingStart, setPendingStart] = useState<{
    view: SketchViewName;
    x: number;
    y: number;
  } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{
    view: SketchViewName;
    x: number;
    y: number;
  } | null>(null);

  const cellPx = 32;
  const padPx = 24;
  const svgW = cols * cellPx + padPx * 2;
  const svgH = rows * cellPx + padPx * 2;

  const toPx = (gx: number, gy: number) => ({
    px: padPx + gx * cellPx,
    py: padPx + gy * cellPx,
  });

  const handleVertexClick = (view: SketchViewName, x: number, y: number) => {
    if (readOnly) return;
    if (tool === 'erase') return;

    if (!pendingStart || pendingStart.view !== view) {
      setPendingStart({ view, x, y });
      return;
    }

    if (pendingStart.x === x && pendingStart.y === y) {
      setPendingStart(null);
      return;
    }

    const nextLine: SketchLine = {
      view,
      x1: pendingStart.x,
      y1: pendingStart.y,
      x2: x,
      y2: y,
      style: lineStyle,
    };
    const key = normLineKey(nextLine);
    const exists = userLines.some((l) => normLineKey(l) === key);
    if (!exists) {
      onChange({
        ...value,
        lines: [...userLines, nextLine],
      });
    }
    setPendingStart(null);
  };

  const handleRemoveUserLine = (idx: number) => {
    if (readOnly) return;
    const next = userLines.filter((_, i) => i !== idx);
    onChange({
      ...value,
      lines: next,
    });
  };

  const handleClearUserLines = () => {
    if (readOnly) return;
    setPendingStart(null);
    onChange({
      ...value,
      lines: [],
    });
  };

  const handleDimChange = (dimId: string, nextVal: string) => {
    if (readOnly) return;
    onChange({
      ...value,
      dimensions: dimensions.map((d) =>
        d.id === dimId ? { ...d, value: nextVal } : d
      ),
    });
  };

  const renderViewPane = (view: SketchViewName) => {
    const viewGiven = givenLines.filter((l) => l.view === view);
    const viewUser = userLines
      .map((l, idx) => ({ line: l, globalIdx: idx }))
      .filter((x) => x.line.view === view);
    const meta = VIEW_LABELS[view];

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center">
        <div className="w-full flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-semibold text-slate-900">{meta.title}</div>
            <div className="text-[11px] text-slate-400">{meta.subtitle}</div>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-slate-500">
            已补 {viewUser.length} 线
          </span>
        </div>

        <svg
          width="100%"
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="max-w-[260px] bg-slate-50 border border-slate-200 rounded-lg select-none"
        >
          {/* Coordinate axis labels */}
          {Array.from({ length: cols + 1 }).map((_, gx) => {
            const { px } = toPx(gx, 0);
            return (
              <g key={`cx-${gx}`}>
                <line
                  x1={px}
                  y1={padPx}
                  x2={px}
                  y2={padPx + rows * cellPx}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <text
                  x={px}
                  y={14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#94a3b8"
                  fontFamily="monospace"
                >
                  {gx}
                </text>
              </g>
            );
          })}
          {Array.from({ length: rows + 1 }).map((_, gy) => {
            const { py } = toPx(0, gy);
            return (
              <g key={`cy-${gy}`}>
                <line
                  x1={padPx}
                  y1={py}
                  x2={padPx + cols * cellPx}
                  y2={py}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <text
                  x={12}
                  y={py + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#94a3b8"
                  fontFamily="monospace"
                >
                  {gy}
                </text>
              </g>
            );
          })}

          {/* Alignment projection cues */}
          {showProjectionGuides && pendingStart && pendingStart.view !== view && (
            <>
              {(view === 'top' || view === 'front') &&
                (pendingStart.view === 'front' || pendingStart.view === 'top') && (
                  <line
                    x1={toPx(pendingStart.x, 0).px}
                    y1={padPx}
                    x2={toPx(pendingStart.x, 0).px}
                    y2={padPx + rows * cellPx}
                    stroke="#38bdf8"
                    strokeWidth={1.2}
                    strokeDasharray="4 3"
                  />
                )}
              {(view === 'left' || view === 'front') &&
                (pendingStart.view === 'front' || pendingStart.view === 'left') && (
                  <line
                    x1={padPx}
                    y1={toPx(0, pendingStart.y).py}
                    x2={padPx + cols * cellPx}
                    y2={toPx(0, pendingStart.y).py}
                    stroke="#14b8a6"
                    strokeWidth={1.2}
                    strokeDasharray="4 3"
                  />
                )}
            </>
          )}

          {/* Given immutable lines */}
          {viewGiven.map((l, i) => {
            const p1 = toPx(l.x1, l.y1);
            const p2 = toPx(l.x2, l.y2);
            return (
              <line
                key={`g-${i}`}
                x1={p1.px}
                y1={p1.py}
                x2={p2.px}
                y2={p2.py}
                stroke="#334155"
                strokeWidth={l.style === 'center' ? 1.4 : 2.6}
                strokeDasharray={STYLE_LABELS[l.style]?.dash}
                strokeLinecap="round"
              />
            );
          })}

          {/* User-drawn lines */}
          {viewUser.map(({ line: l, globalIdx }) => {
            const p1 = toPx(l.x1, l.y1);
            const p2 = toPx(l.x2, l.y2);
            return (
              <g
                key={`u-${globalIdx}`}
                className={!readOnly && tool === 'erase' ? 'cursor-pointer' : ''}
                onClick={() => {
                  if (!readOnly && tool === 'erase') {
                    handleRemoveUserLine(globalIdx);
                  }
                }}
              >
                <line
                  x1={p1.px}
                  y1={p1.py}
                  x2={p2.px}
                  y2={p2.py}
                  stroke={tool === 'erase' ? '#ef4444' : '#0284c7'}
                  strokeWidth={l.style === 'center' ? 1.8 : 3}
                  strokeDasharray={STYLE_LABELS[l.style]?.dash}
                  strokeLinecap="round"
                />
                {!readOnly && tool === 'erase' && (
                  <line
                    x1={p1.px}
                    y1={p1.py}
                    x2={p2.px}
                    y2={p2.py}
                    stroke="transparent"
                    strokeWidth={12}
                  />
                )}
              </g>
            );
          })}

          {/* Preview dashed segment from pendingStart to hoverPoint */}
          {!readOnly &&
            tool === 'draw' &&
            pendingStart?.view === view &&
            hoverPoint?.view === view && (
              <line
                x1={toPx(pendingStart.x, pendingStart.y).px}
                y1={toPx(pendingStart.x, pendingStart.y).py}
                x2={toPx(hoverPoint.x, hoverPoint.y).px}
                y2={toPx(hoverPoint.x, hoverPoint.y).py}
                stroke="#0ea5e9"
                strokeWidth={2}
                strokeDasharray={STYLE_LABELS[lineStyle]?.dash || '3 3'}
                opacity={0.75}
              />
            )}

          {/* Clickable grid vertices */}
          {!readOnly &&
            tool === 'draw' &&
            Array.from({ length: rows + 1 }).map((_, gy) =>
              Array.from({ length: cols + 1 }).map((__, gx) => {
                const { px, py } = toPx(gx, gy);
                const isSelected =
                  pendingStart?.view === view &&
                  pendingStart.x === gx &&
                  pendingStart.y === gy;
                const isHover =
                  hoverPoint?.view === view &&
                  hoverPoint.x === gx &&
                  hoverPoint.y === gy;
                return (
                  <g key={`pt-${gx}-${gy}`}>
                    <circle
                      cx={px}
                      cy={py}
                      r={isSelected ? 5 : isHover ? 4.5 : 2.5}
                      fill={isSelected ? '#0284c7' : isHover ? '#38bdf8' : '#cbd5e1'}
                    />
                    <circle
                      cx={px}
                      cy={py}
                      r={10}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoverPoint({ view, x: gx, y: gy })}
                      onMouseLeave={() => setHoverPoint(null)}
                      onClick={() => handleVertexClick(view, gx, gy)}
                    />
                  </g>
                );
              })
            )}
        </svg>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-y-auto p-3 gap-3">
      {/* Top Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => setTool('draw')}
                className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  tool === 'draw'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>画线工具</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingStart(null);
                  setTool('erase');
                }}
                className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  tool === 'erase'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>橡皮擦</span>
              </button>

              <div className="h-5 w-px bg-slate-200 mx-1" />

              {(['solid', 'dashed', 'center'] as SketchLineStyle[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setTool('draw');
                    setLineStyle(st);
                  }}
                  className={`h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    tool === 'draw' && lineStyle === st
                      ? 'border-sky-600 bg-sky-50 text-sky-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>{STYLE_LABELS[st].label}</span>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showProjectionGuides}
              onChange={(e) => setShowProjectionGuides(e.target.checked)}
              className="rounded border-slate-300 text-sky-600"
            />
            <span>投影对齐参考线</span>
          </label>
          {!readOnly && userLines.length > 0 && (
            <button
              type="button"
              onClick={handleClearUserLines}
              className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空补线</span>
            </button>
          )}
        </div>
      </div>

      {/* Instructions & Active Pointer Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-600">
        <span>
          {value?.partTitle ? `零件图样：${value.partTitle} · ` : ''}
          三视图规律：主俯长对正、主左高平齐、俯左宽相等（深色为已知图线，蓝色为您补充的图线）
        </span>
        {pendingStart && (
          <span className="font-mono tabular-nums text-sky-700 font-medium">
            已选起点 {VIEW_LABELS[pendingStart.view].title.slice(0, 3)} ({pendingStart.x}, {pendingStart.y})，请点击终点
          </span>
        )}
      </div>

      {/* Standard 3-View Engineering Orthographic Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {renderViewPane('front')}
        {renderViewPane('left')}
        {renderViewPane('top')}

        {/* Dimensions & Line List Deck */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Ruler className="w-4 h-4 text-sky-600" />
            <span>尺寸标注与已画图线清单</span>
          </div>

          {dimensions.length > 0 ? (
            <div className="space-y-2">
              {dimensions.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                >
                  <div className="text-xs text-slate-700">
                    <span className="font-medium">{d.label}</span>
                    <span className="text-slate-400 ml-1.5">
                      ({VIEW_LABELS[d.view].title.slice(0, 3)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={d.value}
                      disabled={readOnly}
                      onChange={(e) => handleDimChange(d.id, e.target.value)}
                      placeholder="输入数值"
                      className="w-24 h-7 px-2 border border-slate-300 rounded text-xs font-mono tabular-nums text-right bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100"
                    />
                    <span className="text-[11px] text-slate-500">mm</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">本题无需额外填写尺寸数值。</p>
          )}

          <div className="border-t border-slate-100 pt-2">
            <div className="text-[11px] font-medium text-slate-500 mb-1.5">
              自绘线段（{userLines.length} 条）
            </div>
            {userLines.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                点击网格交点即可开始补全缺失图线。
              </p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {userLines.map((l, idx) => (
                  <div
                    key={`${normLineKey(l)}-${idx}`}
                    className="flex items-center justify-between text-[11px] font-mono tabular-nums bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700"
                  >
                    <span>
                      {VIEW_LABELS[l.view].title.slice(0, 3)} ({l.x1},{l.y1})→({l.x2},{l.y2}) ·{' '}
                      {l.style === 'dashed' ? '虚线' : l.style === 'center' ? '点画线' : '实线'}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveUserLine(idx)}
                        className="text-red-500 hover:text-red-700 px-1"
                        title="删除该线段"
                      >
                        删除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

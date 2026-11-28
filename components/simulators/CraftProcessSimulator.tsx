'use client';

import { useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Ruler,
  ShieldAlert,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { CraftProcessState } from '@/lib/types';

interface Props {
  value: CraftProcessState;
  onChange: (next: CraftProcessState) => void;
  readOnly?: boolean;
}

export default function CraftProcessSimulator({
  value,
  onChange,
  readOnly = false,
}: Props) {
  const availableSteps = useMemo(() => value?.availableSteps || [], [value?.availableSteps]);
  const orderedSteps = useMemo(() => value?.orderedSteps || [], [value?.orderedSteps]);
  const availableTools = useMemo(() => value?.availableTools || [], [value?.availableTools]);
  const selectedTools = useMemo(() => value?.selectedTools || {}, [value?.selectedTools]);
  const safetyOptions = useMemo(() => value?.safetyOptions || [], [value?.safetyOptions]);
  const safetyChecks = useMemo(() => value?.safetyChecks || [], [value?.safetyChecks]);

  const hasCaliper =
    typeof value?.caliperMainMm === 'number' &&
    typeof value?.caliperVernierDiv === 'number';
  const mainMm = value?.caliperMainMm ?? 12;
  const vernierDiv = value?.caliperVernierDiv ?? 6;

  const handleAddStep = (step: string) => {
    if (readOnly || orderedSteps.includes(step)) return;
    onChange({
      ...value,
      orderedSteps: [...orderedSteps, step],
    });
  };

  const handleMoveStep = (idx: number, dir: -1 | 1) => {
    if (readOnly) return;
    const target = idx + dir;
    if (target < 0 || target >= orderedSteps.length) return;
    const next = [...orderedSteps];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ ...value, orderedSteps: next });
  };

  const handleRemoveStep = (step: string) => {
    if (readOnly) return;
    const nextTools = { ...selectedTools };
    delete nextTools[step];
    onChange({
      ...value,
      orderedSteps: orderedSteps.filter((s) => s !== step),
      selectedTools: nextTools,
    });
  };

  const handleSelectTool = (step: string, tool: string) => {
    if (readOnly) return;
    onChange({
      ...value,
      selectedTools: {
        ...selectedTools,
        [step]: tool,
      },
    });
  };

  const handleToggleSafety = (item: string) => {
    if (readOnly) return;
    const exists = safetyChecks.includes(item);
    onChange({
      ...value,
      safetyChecks: exists
        ? safetyChecks.filter((s) => s !== item)
        : [...safetyChecks, item],
    });
  };

  // Vernier caliper geometry (20-division, 0.05 mm precision)
  const pxPerMm = 14;
  const zeroX = 34 + (mainMm + vernierDiv * 0.05) * pxPerMm;

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-y-auto p-3 gap-3">
      {/* Header strip */}
      <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
          <Wrench className="w-4 h-4 text-sky-600" />
          <span>{value?.taskTitle || '金工/木工工艺流程与精密测量仿真台'}</span>
        </div>
        <span className="text-[11px] font-mono tabular-nums text-slate-500">
          已排工序 {orderedSteps.length}/{availableSteps.length}
        </span>
      </div>

      {/* Main Two-Column Sequencer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: Available Step Pool */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-800">
            1. 待选加工工序池（点击添加）
          </div>
          <div className="space-y-1.5">
            {availableSteps.map((step) => {
              const added = orderedSteps.includes(step);
              return (
                <button
                  key={step}
                  type="button"
                  disabled={readOnly || added}
                  onClick={() => handleAddStep(step)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                    added
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-sky-400 hover:bg-sky-50'
                  }`}
                >
                  <span>{step}</span>
                  {!added && <Plus className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Ordered Process + Tool Mapping */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
          <div className="text-xs font-semibold text-slate-800">
            2. 加工工艺流程图（调整先后顺序并选配工量具）
          </div>
          {orderedSteps.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
              请从左侧「待选加工工序池」按先后顺序依次点击添加工序。
            </div>
          ) : (
            <div className="space-y-2">
              {orderedSteps.map((step, idx) => (
                <div
                  key={step}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-sky-600 text-white text-xs font-mono tabular-nums font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-900">
                      {step}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectedTools[step] || ''}
                      disabled={readOnly}
                      onChange={(e) => handleSelectTool(step, e.target.value)}
                      className="h-7 px-2 border border-slate-300 rounded text-xs bg-white text-slate-800"
                    >
                      <option value="">-- 选配工量具 --</option>
                      {availableTools.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>

                    {!readOnly && (
                      <>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveStep(idx, -1)}
                          className="h-7 w-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                          title="上移"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === orderedSteps.length - 1}
                          onClick={() => handleMoveStep(idx, 1)}
                          className="h-7 w-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                          title="下移"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(step)}
                          className="h-7 w-7 rounded border border-slate-200 bg-white text-red-500 hover:bg-red-50 flex items-center justify-center"
                          title="移出工序"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Vernier Caliper + Safety规范 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {hasCaliper && (
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-sky-600" />
                <span>3. 游标卡尺放大读数图（20 分度 · 精度 0.05 mm）</span>
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg bg-slate-50 p-2 overflow-x-auto">
              <svg viewBox="0 0 560 116" className="w-full min-w-[460px] h-auto select-none">
                {/* Main Scale (0 - 34 mm) */}
                <rect x="20" y="12" width="520" height="42" fill="#ffffff" stroke="#94a3b8" strokeWidth={1.2} />
                {Array.from({ length: 35 }).map((_, mm) => {
                  const x = 34 + mm * pxPerMm;
                  const isTen = mm % 10 === 0;
                  const isFive = mm % 5 === 0;
                  const h = isTen ? 18 : isFive ? 13 : 8;
                  return (
                    <g key={`m-${mm}`}>
                      <line x1={x} y1={54 - h} x2={x} y2={54} stroke="#0f172a" strokeWidth={isTen ? 1.5 : 1} />
                      {isTen && (
                        <text x={x} y={28} textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#0f172a">
                          {mm / 10} cm
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Vernier Scale (20 divisions = 19 mm) */}
                <rect
                  x={zeroX - 10}
                  y="56"
                  width={19 * pxPerMm + 24}
                  height="42"
                  fill="#f0f9ff"
                  stroke="#0284c7"
                  strokeWidth={1.2}
                />
                {Array.from({ length: 21 }).map((_, d) => {
                  const x = zeroX + d * 0.95 * pxPerMm;
                  const isMajor = d % 5 === 0;
                  const h = isMajor ? 16 : 10;
                  const isAligned = d === vernierDiv;
                  return (
                    <g key={`v-${d}`}>
                      <line
                        x1={x}
                        y1={56}
                        x2={x}
                        y2={56 + h}
                        stroke={isAligned ? '#dc2626' : '#0369a1'}
                        strokeWidth={isAligned ? 1.8 : 1}
                      />
                      {isMajor && (
                        <text
                          x={x}
                          y={88}
                          textAnchor="middle"
                          fontSize="9"
                          fontFamily="monospace"
                          fill={isAligned ? '#dc2626' : '#0369a1'}
                          fontWeight={isAligned ? '700' : '400'}
                        >
                          {d}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="text-xs text-slate-700">
                请输入测量读数（红线对齐第 <span className="font-mono font-bold text-red-600">{vernierDiv}</span> 格）：
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={value?.caliperReading || ''}
                  disabled={readOnly}
                  onChange={(e) =>
                    onChange({ ...value, caliperReading: e.target.value })
                  }
                  placeholder="例如 12.30"
                  className="w-28 h-8 px-2.5 border border-slate-300 rounded-lg text-xs font-mono tabular-nums text-right bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-xs text-slate-500">mm</span>
              </div>
            </div>
          </div>
        )}

        {/* Safety Checks */}
        <div
          className={`${
            hasCaliper ? 'lg:col-span-5' : 'lg:col-span-12'
          } bg-white border border-slate-200 rounded-xl p-3 space-y-2`}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>加工安全操作规范（勾选正确做法）</span>
          </div>
          <div className="space-y-1.5">
            {safetyOptions.map((item) => {
              const checked = safetyChecks.includes(item);
              return (
                <label
                  key={item}
                  className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                    checked
                      ? 'border-sky-300 bg-sky-50 text-sky-950'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => handleToggleSafety(item)}
                    className="mt-0.5 rounded border-slate-300 text-sky-600"
                  />
                  <span>{item}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

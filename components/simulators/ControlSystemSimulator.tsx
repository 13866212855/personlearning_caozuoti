'use client';

import { useMemo } from 'react';
import {
  ArrowRight,
  GitBranch,
  RotateCcw,
} from 'lucide-react';
import type { ControlSystemState } from '@/lib/types';

interface Props {
  value: ControlSystemState;
  onChange: (next: ControlSystemState) => void;
  readOnly?: boolean;
}

type SlotKey = keyof ControlSystemState['slots'];

const SLOT_LABELS: Array<{
  key: SlotKey;
  title: string;
  closedOnly?: boolean;
}> = [
  { key: 'input', title: '给定量（输入）' },
  { key: 'comparator', title: '比较器', closedOnly: true },
  { key: 'controller', title: '控制器' },
  { key: 'actuator', title: '执行器' },
  { key: 'plant', title: '被控对象' },
  { key: 'output', title: '被控量（输出）' },
  { key: 'sensor', title: '检测装置（传感器）', closedOnly: true },
];

export default function ControlSystemSimulator({
  value,
  onChange,
  readOnly = false,
}: Props) {
  const mode = value?.mode || 'open';
  const options = useMemo(() => value?.availableOptions || [], [value?.availableOptions]);
  const slots = useMemo(
    () =>
      value?.slots || {
        input: '',
        comparator: '',
        controller: '',
        actuator: '',
        plant: '',
        sensor: '',
        output: '',
      },
    [value?.slots]
  );
  const hasFeedbackEdge = Boolean(value?.hasFeedbackEdge);

  const visibleSlots = useMemo(
    () => SLOT_LABELS.filter((s) => mode === 'closed' || !s.closedOnly),
    [mode]
  );

  const handleModeChange = (nextMode: 'open' | 'closed') => {
    if (readOnly) return;
    onChange({
      ...value,
      mode: nextMode,
      hasFeedbackEdge: nextMode === 'open' ? false : hasFeedbackEdge,
    });
  };

  const handleSlotChange = (key: SlotKey, val: string) => {
    if (readOnly) return;
    onChange({
      ...value,
      slots: {
        ...slots,
        [key]: val,
      },
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-y-auto p-3 gap-3">
      {/* Top Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => handleModeChange('open')}
            className={`h-8 px-3 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              mode === 'open'
                ? 'border-sky-600 bg-sky-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            开环控制系统
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => handleModeChange('closed')}
            className={`h-8 px-3 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              mode === 'closed'
                ? 'border-sky-600 bg-sky-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            闭环控制系统（带反馈）
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasFeedbackEdge}
            disabled={readOnly || mode !== 'closed'}
            onChange={(e) =>
              onChange({ ...value, hasFeedbackEdge: e.target.checked })
            }
            className="rounded border-slate-300 text-sky-600"
          />
          <span className="font-medium">
            {mode === 'closed'
              ? '连接检测反馈通道（输出端 → 比较器）'
              : '开环控制无反馈通道'}
          </span>
        </label>
      </div>

      {/* Block Diagram Stage */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-900 flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-sky-600" />
            <span>{value?.systemTitle || '控制系统方框图构建台'}</span>
          </span>
          {value?.disturbance && (
            <span className="text-amber-700">
              干扰因素参考：{value.disturbance}
            </span>
          )}
        </div>

        {/* Forward Path */}
        <div className="flex flex-wrap items-center justify-center gap-2 py-3 px-2 bg-slate-50 border border-slate-200 rounded-xl">
          {visibleSlots
            .filter((s) => s.key !== 'sensor')
            .map((slot, idx, arr) => {
              const currentVal = slots[slot.key] || '';
              return (
                <div key={slot.key} className="flex items-center gap-2">
                  <div
                    className={`w-36 rounded-lg border p-2 bg-white space-y-1.5 ${
                      currentVal ? 'border-sky-300' : 'border-slate-300'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-slate-600 text-center">
                      {slot.title}
                    </div>
                    <select
                      value={currentVal}
                      disabled={readOnly}
                      onChange={(e) => handleSlotChange(slot.key, e.target.value)}
                      className="w-full h-7 px-1.5 border border-slate-200 rounded text-[11px] text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">-- 请选择 --</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  {idx < arr.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </div>
              );
            })}
        </div>

        {/* Feedback Loop Path (Closed Mode) */}
        {mode === 'closed' && (
          <div
            className={`rounded-xl border p-3 flex flex-col sm:flex-row items-center justify-between gap-3 ${
              hasFeedbackEdge
                ? 'border-emerald-300 bg-emerald-50/60'
                : 'border-dashed border-slate-300 bg-slate-50/50'
            }`}
          >
            <div className="flex items-center gap-2 text-xs">
              <RotateCcw
                className={`w-4 h-4 ${
                  hasFeedbackEdge ? 'text-emerald-600' : 'text-slate-400'
                }`}
              />
              <span
                className={
                  hasFeedbackEdge
                    ? 'text-emerald-900 font-medium'
                    : 'text-slate-500'
                }
              >
                {hasFeedbackEdge
                  ? '闭环反馈通道已接通：输出量经检测装置送回比较器与给定量对比'
                  : '反馈通道未连接：请在上方勾选「连接检测反馈通道」'}
              </span>
            </div>

            <div className="w-56 rounded-lg border border-slate-200 bg-white p-2 space-y-1">
              <div className="text-[11px] font-semibold text-slate-600">
                检测装置（传感器）
              </div>
              <select
                value={slots.sensor || ''}
                disabled={readOnly}
                onChange={(e) => handleSlotChange('sensor', e.target.value)}
                className="w-full h-7 px-1.5 border border-slate-200 rounded text-[11px] text-slate-900 bg-slate-50"
              >
                <option value="">-- 请选择检测装置 --</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Option Bank Reference */}
        <div className="border-t border-slate-100 pt-3">
          <div className="text-[11px] font-medium text-slate-500 mb-2">
            候选环节要素库（可对照含义选择填入上方方框）
          </div>
          <div className="flex flex-wrap gap-1.5">
            {options.map((opt) => {
              const usedIn = visibleSlots.find((s) => slots[s.key] === opt);
              return (
                <span
                  key={opt}
                  className={`px-2.5 py-1 rounded-md border text-xs ${
                    usedIn
                      ? 'border-sky-300 bg-sky-50 text-sky-900 font-medium'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {opt}
                  {usedIn ? ` → ${usedIn.title.split('（')[0]}` : ''}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

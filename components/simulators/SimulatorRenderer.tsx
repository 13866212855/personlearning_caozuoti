'use client';

import { useEffect, useRef } from 'react';
import { Redo2, Undo2, X } from 'lucide-react';
import type {
  CircuitState,
  ControlSystemState,
  CraftProcessState,
  DatabaseState,
  ExcelState,
  FileState,
  PythonState,
  QuestionAsset,
  QuestionType,
  SimulatorState,
  Sketch3ViewState,
  StructureState,
  WebState,
  WordState,
} from '@/lib/types';
import { useSimulatorHistory } from '@/hooks/useSimulatorHistory';
import WordSimulator from './WordSimulator';
import ExcelSimulator from './ExcelSimulator';
import WebSimulator from './WebSimulator';
import FileManagerSimulator from './FileManagerSimulator';
import PythonSimulator from './PythonSimulator';
import DatabaseSimulator from './DatabaseSimulator';
import ThreeViewSketchSimulator from './ThreeViewSketchSimulator';
import CircuitSimulator from './CircuitSimulator';
import StructureSimulator from './StructureSimulator';
import ControlSystemSimulator from './ControlSystemSimulator';
import CraftProcessSimulator from './CraftProcessSimulator';

interface SimulatorRendererProps {
  type: QuestionType;
  value: SimulatorState;
  onChange?: (next: SimulatorState) => void;
  assets?: QuestionAsset[];
  readOnly?: boolean;
  /**
   * 每道题传一个唯一 key（一般用题目 id）。
   * 传入后启用撤销/重做历史层；不传或只读时保持原有直通行为。
   */
  historyKey?: string;
}

function isModalTarget(
  target: HTMLElement | null,
  wrapper: HTMLElement | null
): boolean {
  if (!target || !wrapper) return false;
  let el: HTMLElement | null = target;
  while (el && el !== wrapper) {
    if (window.getComputedStyle(el).position === 'fixed') return true;
    el = el.parentElement;
  }
  return false;
}

export default function SimulatorRenderer({
  type,
  value,
  onChange,
  assets = [],
  readOnly = false,
  historyKey,
}: SimulatorRendererProps) {
  const enabled =
    !readOnly && typeof onChange === 'function' && Boolean(historyKey);
  const hist = useSimulatorHistory({
    type,
    enabled,
    historyKey: historyKey || 'default',
    value,
    onChange: onChange || (() => {}),
  });
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z 快捷键（仅当焦点位于本模拟器内时生效）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!enabled) return;
    if ((e.nativeEvent as KeyboardEvent).isComposing) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    const isUndo = key === 'z' && !e.shiftKey;
    const isRedo = (key === 'z' && e.shiftKey) || key === 'y';
    if (!isUndo && !isRedo) return;
    if (isModalTarget(e.target as HTMLElement, wrapperRef.current)) return;
    e.preventDefault();
    if (isUndo) {
      hist.undo();
    } else {
      hist.redo();
    }
  };

  // 兜底：浏览器菜单/系统级"撤销"事件（historyUndo/historyRedo）
  useEffect(() => {
    if (!enabled) return;
    const el = wrapperRef.current;
    if (!el) return;
    const onBeforeInput = (ev: Event) => {
      const inputEvent = ev as InputEvent;
      if (inputEvent.inputType === 'historyUndo') {
        ev.preventDefault();
        hist.undo();
      } else if (inputEvent.inputType === 'historyRedo') {
        ev.preventDefault();
        hist.redo();
      }
    };
    el.addEventListener('beforeinput', onBeforeInput);
    return () => el.removeEventListener('beforeinput', onBeforeInput);
  });

  const noop = () => {};

  const renderSimulator = (simOnChange: (next: SimulatorState) => void) => {
    const innerKey = enabled ? historyKey : undefined;
    if (type === 'word') {
      return (
        <WordSimulator
          key={innerKey}
          value={value as WordState}
          onChange={simOnChange}
          assets={assets}
          readOnly={readOnly}
        />
      );
    }
    if (type === 'excel') {
      return (
        <ExcelSimulator
          key={innerKey}
          value={value as ExcelState}
          onChange={simOnChange}
          readOnly={readOnly}
        />
      );
    }
    if (type === 'web') {
      return (
        <WebSimulator
          key={innerKey}
          value={value as WebState}
          onChange={simOnChange}
          assets={assets}
          readOnly={readOnly}
        />
      );
    }
    if (type === 'python') {
      return (
        <PythonSimulator
          key={innerKey}
          value={value as PythonState}
          onChange={simOnChange}
          readOnly={readOnly}
        />
      );
    }
    if (type === 'database') {
      return (
        <DatabaseSimulator
          key={innerKey}
          value={value as DatabaseState}
          onChange={simOnChange}
          readOnly={readOnly}
        />
      );
    }
    if (type === 'sketch3view') {
      return (
        <ThreeViewSketchSimulator
          key={innerKey}
          value={value as Sketch3ViewState}
          onChange={simOnChange}
          readOnly={readOnly}
        />
      );
    }
    if (type === 'circuit') {
      return (
        <CircuitSimulator
          key={innerKey}
          value={value as CircuitState}
          onChange={simOnChange}
          readOnly={readOnly}
        />
      );
    }
    if (type === 'structure') {
      return (
        <StructureSimulator
          key={innerKey}
          value={value as StructureState}
          onChange={simOnChange}
          readOnly={readOnly}
        />
      );
    }
    if (type === 'control') {
      return (
        <ControlSystemSimulator
          key={innerKey}
          value={value as ControlSystemState}
          onChange={simOnChange}
          readOnly={readOnly}
        />
      );
    }
    if (type === 'craft') {
      return (
        <CraftProcessSimulator
          key={innerKey}
          value={value as CraftProcessState}
          onChange={simOnChange}
          readOnly={readOnly}
        />
      );
    }
    return (
      <FileManagerSimulator
        key={innerKey}
        value={value as FileState}
        onChange={simOnChange}
        readOnly={readOnly}
      />
    );
  };

  // 只读回看（成绩单、教师/管理员查看）或未启用历史层：保持原有直通渲染
  if (!enabled) {
    return renderSimulator(onChange || noop);
  }

  return (
    <div
      ref={wrapperRef}
      onKeyDown={handleKeyDown}
      className="relative flex flex-col h-full min-h-0"
    >
      {/* 撤销/重做工具条 */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-2 py-1 flex items-center gap-1 text-xs">
        <button
          type="button"
          title="撤销上一步操作 (Ctrl+Z)"
          disabled={!hist.canUndo}
          onClick={hist.undo}
          className={`h-7 px-2 rounded flex items-center gap-1 font-medium transition-colors ${
            hist.canUndo
              ? 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-300 cursor-not-allowed'
          }`}
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>撤销</span>
        </button>
        <button
          type="button"
          title="重做 (Ctrl+Y 或 Ctrl+Shift+Z)"
          disabled={!hist.canRedo}
          onClick={hist.redo}
          className={`h-7 px-2 rounded flex items-center gap-1 font-medium transition-colors ${
            hist.canRedo
              ? 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-300 cursor-not-allowed'
          }`}
        >
          <Redo2 className="w-3.5 h-3.5" />
          <span>重做</span>
        </button>
        <span className="ml-auto text-[11px] text-slate-400 hidden md:inline">
          误删内容可按 Ctrl+Z 恢复
        </span>
      </div>

      {/* 模拟器主体 */}
      <div className="flex-1 min-h-0">{renderSimulator(hist.handleChange)}</div>

      {/* 删除等破坏性操作提示条 */}
      {hist.toast && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white text-xs pl-3 pr-2 py-2 rounded-lg flex items-center gap-2.5 shadow-lg">
          <span className="whitespace-nowrap">{hist.toast.label}</span>
          <button
            type="button"
            onClick={hist.undo}
            className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 font-medium underline underline-offset-2 whitespace-nowrap"
          >
            撤销
          </button>
          <button
            type="button"
            title="关闭提示"
            onClick={hist.dismissToast}
            className="p-1 rounded hover:bg-white/15 text-white/70"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

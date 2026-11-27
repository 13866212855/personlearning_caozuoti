'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { describeChange } from '@/lib/simDiff';
import type { QuestionType, SimulatorState } from '@/lib/types';

const MAX_HISTORY = 100;
const COALESCE_MS = 800;
const TOAST_MS = 5000;

interface HistoryStack {
  past: SimulatorState[];
  present: SimulatorState;
  future: SimulatorState[];
  /** 上一次"输入类"修改的合并键，null 表示上一步是结构操作 */
  lastKey: string | null;
  lastAt: number;
  /** 标记本次 value 变化由本层触发（undo/redo/edit），避免被当作外部修改 */
  applying: boolean;
}

export interface HistoryToast {
  id: number;
  label: string;
}

interface UseSimulatorHistoryParams {
  type: QuestionType;
  /** 只读或未接 onChange 时关闭整个历史层 */
  enabled: boolean;
  /** 每道题一个 key，切题时历史栈互相隔离并缓存 */
  historyKey: string;
  value: SimulatorState;
  onChange: (next: SimulatorState) => void;
}

export function useSimulatorHistory({
  type,
  enabled,
  historyKey,
  value,
  onChange,
}: UseSimulatorHistoryParams) {
  const stacksRef = useRef<Map<string, HistoryStack>>(new Map());
  const onChangeRef = useRef(onChange);

  const [toast, setToast] = useState<HistoryToast | null>(null);
  const [flags, setFlags] = useState({ canUndo: false, canRedo: false });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef(0);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const getStack = useCallback((): HistoryStack => {
    let st = stacksRef.current.get(historyKey);
    if (!st) {
      st = {
        past: [],
        present: value,
        future: [],
        lastKey: null,
        lastAt: 0,
        applying: false,
      };
      stacksRef.current.set(historyKey, st);
      // 限制缓存题数，防止长时间使用内存增长
      if (stacksRef.current.size > 20) {
        const oldest = stacksRef.current.keys().next();
        if (!oldest.done && oldest.value !== historyKey) {
          stacksRef.current.delete(oldest.value);
        }
      }
    }
    return st;
  }, [historyKey, value]);

  const syncFlags = useCallback((st: HistoryStack) => {
    setFlags((prev) => {
      const canUndo = st.past.length > 0;
      const canRedo = st.future.length > 0;
      if (prev.canUndo === canUndo && prev.canRedo === canRedo) return prev;
      return { canUndo, canRedo };
    });
  }, []);

  // 每次渲染后（effect 中，而非渲染期间）：
  // 1. 为当前 historyKey 创建/复用历史栈；
  // 2. 捕获"绕过本层"的外部修改（如重置本题、载入参考答案），
  //    把修改前的状态压入历史，使这些操作同样可以被 Ctrl+Z 撤销。
  const activeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      activeKeyRef.current = null;
      return;
    }
    const keyChanged = activeKeyRef.current !== historyKey;
    activeKeyRef.current = historyKey;
    const st = getStack();
    let mutated = false;
    if (st.applying) {
      st.applying = false;
    } else if (value !== st.present) {
      st.past.push(st.present);
      if (st.past.length > MAX_HISTORY) st.past.shift();
      st.present = value;
      st.future = [];
      st.lastKey = null;
      st.lastAt = 0;
      mutated = true;
    }
    if (keyChanged || mutated) {
      // 微任务中同步按钮可用性，避免在 effect 内同步 setState
      queueMicrotask(() => syncFlags(st));
    }
  });

  const showToastFor = useCallback((label: string) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, label });
  }, []);

  const handleChange = useCallback(
    (next: SimulatorState) => {
      if (!enabled) {
        onChangeRef.current(next);
        return;
      }
      const st = getStack();
      if (jsonEqual(next, st.present)) return;

      const desc = describeChange(type, st.present, next);
      const now = Date.now();
      const canMerge =
        desc.coalesceKey !== null &&
        st.lastKey === desc.coalesceKey &&
        now - st.lastAt < COALESCE_MS;

      if (!canMerge) {
        st.past.push(st.present);
        if (st.past.length > MAX_HISTORY) st.past.shift();
        st.future = [];
      }
      st.present = next;
      st.lastKey = desc.coalesceKey;
      st.lastAt = now;

      if (desc.showToast) showToastFor(desc.label);
      syncFlags(st);
      st.applying = true;
      onChangeRef.current(next);
    },
    [enabled, type, getStack, showToastFor, syncFlags]
  );

  const undo = useCallback(() => {
    if (!enabled) return;
    const st = getStack();
    if (st.past.length === 0) return;
    const prev = st.past.pop() as SimulatorState;
    st.future.unshift(st.present);
    st.present = prev;
    st.lastKey = null;
    st.lastAt = 0;
    st.applying = true;
    setToast(null);
    syncFlags(st);
    onChangeRef.current(prev);
  }, [enabled, getStack, syncFlags]);

  const redo = useCallback(() => {
    if (!enabled) return;
    const st = getStack();
    if (st.future.length === 0) return;
    const next = st.future.shift() as SimulatorState;
    st.past.push(st.present);
    if (st.past.length > MAX_HISTORY) st.past.shift();
    st.present = next;
    st.lastKey = null;
    st.lastAt = 0;
    st.applying = true;
    setToast(null);
    syncFlags(st);
    onChangeRef.current(next);
  }, [enabled, getStack, syncFlags]);

  // 提示条 5 秒自动消失
  useEffect(() => {
    if (!toast) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_MS);
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [toast]);

  const dismissToast = useCallback(() => setToast(null), []);

  return {
    handleChange,
    undo,
    redo,
    canUndo: flags.canUndo,
    canRedo: flags.canRedo,
    toast,
    dismissToast,
  };
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

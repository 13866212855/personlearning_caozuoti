'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Cable,
  CheckCircle2,
  Power,
  SlidersHorizontal,
  Trash2,
  Zap,
} from 'lucide-react';
import { evaluateCircuit } from '@/lib/gtEvaluators';
import type { CircuitComponent, CircuitState } from '@/lib/types';

interface Props {
  value: CircuitState;
  onChange: (next: CircuitState) => void;
  readOnly?: boolean;
}

const COMP_W = 112;
const COMP_H = 54;

function getPinPositions(comp: CircuitComponent): Array<{
  pin: string;
  fullId: string;
  x: number;
  y: number;
}> {
  const pins = comp.pins || ['a', 'b'];
  const cx = comp.x;
  const cy = comp.y;
  if (pins.length === 1) {
    return [{ pin: pins[0], fullId: `${comp.id}.${pins[0]}`, x: cx + COMP_W / 2, y: cy + COMP_H / 2 }];
  }
  if (pins.length === 2) {
    return [
      { pin: pins[0], fullId: `${comp.id}.${pins[0]}`, x: cx - 6, y: cy + COMP_H / 2 },
      { pin: pins[1], fullId: `${comp.id}.${pins[1]}`, x: cx + COMP_W + 6, y: cy + COMP_H / 2 },
    ];
  }
  if (pins.length === 3) {
    return [
      { pin: pins[0], fullId: `${comp.id}.${pins[0]}`, x: cx - 6, y: cy + COMP_H / 2 },
      { pin: pins[1], fullId: `${comp.id}.${pins[1]}`, x: cx + COMP_W + 6, y: cy + 14 },
      { pin: pins[2], fullId: `${comp.id}.${pins[2]}`, x: cx + COMP_W + 6, y: cy + COMP_H - 12 },
    ];
  }
  return pins.map((p, idx) => {
    const isLeft = idx < 2;
    const row = idx % 2;
    return {
      pin: p,
      fullId: `${comp.id}.${p}`,
      x: isLeft ? cx - 6 : cx + COMP_W + 6,
      y: row === 0 ? cy + 14 : cy + COMP_H - 12,
    };
  });
}

export default function CircuitSimulator({
  value,
  onChange,
  readOnly = false,
}: Props) {
  const components = useMemo(() => value?.components || [], [value?.components]);
  const wires = useMemo(() => value?.wires || [], [value?.wires]);
  const powered = Boolean(value?.powered);
  const lightLevel = value?.lightLevel ?? 50;
  const tempC = value?.tempC ?? 25;

  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(
    components[0]?.id || null
  );

  const evalRes = useMemo(() => evaluateCircuit(value), [value]);

  const pinCoords = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const c of components) {
      for (const p of getPinPositions(c)) {
        map.set(p.fullId.toLowerCase(), { x: p.x, y: p.y });
      }
    }
    return map;
  }, [components]);

  const handlePinClick = (fullPinId: string) => {
    if (readOnly) return;
    if (!selectedPin) {
      setSelectedPin(fullPinId);
      return;
    }
    if (selectedPin.toLowerCase() === fullPinId.toLowerCase()) {
      setSelectedPin(null);
      return;
    }

    const a = selectedPin;
    const b = fullPinId;
    const exists = wires.some(
      (w) =>
        (w.from.toLowerCase() === a.toLowerCase() &&
          w.to.toLowerCase() === b.toLowerCase()) ||
        (w.from.toLowerCase() === b.toLowerCase() &&
          w.to.toLowerCase() === a.toLowerCase())
    );
    if (!exists) {
      onChange({
        ...value,
        wires: [...wires, { from: a, to: b }],
      });
    }
    setSelectedPin(null);
  };

  const handleRemoveWire = (idx: number) => {
    if (readOnly) return;
    onChange({
      ...value,
      wires: wires.filter((_, i) => i !== idx),
    });
  };

  const handleTogglePower = () => {
    if (readOnly) return;
    onChange({
      ...value,
      powered: !powered,
    });
  };

  const handleUpdateComponent = (
    compId: string,
    patch: Partial<CircuitComponent>
  ) => {
    if (readOnly) return;
    onChange({
      ...value,
      components: components.map((c) =>
        c.id === compId ? { ...c, ...patch } : c
      ),
    });
  };

  const hasLightSensor = components.some((c) => c.type === 'sensor_light');
  const hasTempSensor = components.some((c) => c.type === 'sensor_temp');

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-y-auto p-3 gap-3">
      {/* Top Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={readOnly}
            onClick={handleTogglePower}
            className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              powered
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            } disabled:opacity-60`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{powered ? '电源总开关：已通电' : '电源总开关：已断开'}</span>
          </button>

          {selectedPin && (
            <span className="text-xs font-mono text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1">
              已选起点引脚：{selectedPin}（请再点击目标引脚完成连线）
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          {evalRes.shortCircuit ? (
            <span className="text-red-700 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>警告：短路风险</span>
            </span>
          ) : evalRes.activeComponentIds.length > 0 ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>回路工作正常 ({evalRes.activeComponentIds.length} 项输出激活)</span>
            </span>
          ) : (
            <span className="text-slate-500 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>待触发或回路未闭合</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Two-Zone Stage + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left: Interactive Breadboard Canvas (7/12) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              {value?.title || '电子控制实验工作台（点击两个元件引脚即可拉线）'}
            </span>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              导线 {wires.length} 条
            </span>
          </div>

          <div className="w-full overflow-x-auto border border-slate-200 rounded-lg bg-slate-50">
            <svg viewBox="0 0 640 340" className="w-full min-w-[540px] h-auto select-none">
              <defs>
                <pattern id="circuitGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="640" height="340" fill="url(#circuitGrid)" />

              {/* Existing Wires */}
              {wires.map((w, idx) => {
                const p1 = pinCoords.get(w.from.toLowerCase());
                const p2 = pinCoords.get(w.to.toLowerCase());
                if (!p1 || !p2) return null;
                const midX = (p1.x + p2.x) / 2;
                const d = `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
                return (
                  <g
                    key={`${w.from}-${w.to}-${idx}`}
                    className={!readOnly ? 'cursor-pointer' : ''}
                    onClick={() => handleRemoveWire(idx)}
                  >
                    <path
                      d={d}
                      fill="none"
                      stroke={powered && !evalRes.shortCircuit ? '#0284c7' : '#475569'}
                      strokeWidth={2.8}
                    />
                    <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
                  </g>
                );
              })}

              {/* Components */}
              {components.map((c) => {
                const isActive = Boolean(evalRes.activeOutputs[c.id]);
                const isConducting = evalRes.conductingSensors.includes(c.id);
                const isSelected = selectedCompId === c.id;
                const pins = getPinPositions(c);

                let borderCol = isSelected ? '#0284c7' : '#cbd5e1';
                let fillCol = '#ffffff';
                if (c.type === 'vcc') fillCol = '#fef2f2';
                else if (c.type === 'gnd') fillCol = '#f1f5f9';
                else if (isActive) {
                  fillCol = '#ecfdf5';
                  borderCol = '#059669';
                } else if (isConducting && powered) {
                  fillCol = '#f0f9ff';
                }

                return (
                  <g
                    key={c.id}
                    onClick={() => setSelectedCompId(c.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={c.x}
                      y={c.y}
                      width={COMP_W}
                      height={COMP_H}
                      rx={8}
                      fill={fillCol}
                      stroke={borderCol}
                      strokeWidth={isSelected ? 2 : 1.4}
                    />
                    <text
                      x={c.x + 10}
                      y={c.y + 18}
                      fontSize="11"
                      fontWeight="600"
                      fill="#0f172a"
                    >
                      {c.label}
                    </text>
                    <text
                      x={c.x + 10}
                      y={c.y + 34}
                      fontSize="10"
                      fontFamily="monospace"
                      fill="#64748b"
                    >
                      {c.type === 'switch'
                        ? c.closed !== false
                          ? '状态: 闭合'
                          : '状态: 断开'
                        : c.value || c.id}
                    </text>
                    <text
                      x={c.x + 10}
                      y={c.y + 47}
                      fontSize="9"
                      fill={isActive ? '#059669' : '#94a3b8'}
                      fontWeight={isActive ? '700' : '400'}
                    >
                      {isActive
                        ? '● 工作/激活'
                        : isConducting
                          ? '◆ 导通触发'
                          : c.id}
                    </text>

                    {/* Clickable Terminal Pins */}
                    {pins.map((p) => {
                      const isSelPin =
                        selectedPin?.toLowerCase() === p.fullId.toLowerCase();
                      return (
                        <g
                          key={p.fullId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePinClick(p.fullId);
                          }}
                          className={!readOnly ? 'cursor-crosshair' : ''}
                        >
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isSelPin ? 7 : 5.5}
                            fill={isSelPin ? '#0284c7' : '#ffffff'}
                            stroke={isSelPin ? '#0369a1' : '#334155'}
                            strokeWidth={2}
                          />
                          <text
                            x={p.x < c.x ? p.x - 8 : p.x + 8}
                            y={p.y + 3}
                            textAnchor={p.x < c.x ? 'end' : 'start'}
                            fontSize="9"
                            fontFamily="monospace"
                            fill="#475569"
                          >
                            {p.pin}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>

          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              evalRes.shortCircuit
                ? 'bg-red-50 border-red-200 text-red-800'
                : evalRes.activeComponentIds.length > 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {evalRes.summary}
          </div>
        </div>

        {/* Right: Environment Sliders, Component Controls & Wire List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <SlidersHorizontal className="w-4 h-4 text-sky-600" />
            <span>环境仿真与元件参数</span>
          </div>

          {(hasLightSensor || value?.lightLevel !== undefined) && (
            <div className="space-y-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">环境光照强度</span>
                <span className="font-mono tabular-nums font-semibold text-sky-700">
                  {lightLevel} %
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={lightLevel}
                disabled={readOnly}
                onChange={(e) =>
                  onChange({ ...value, lightLevel: Number(e.target.value) })
                }
                className="w-full accent-sky-600"
              />
            </div>
          )}

          {(hasTempSensor || value?.tempC !== undefined) && (
            <div className="space-y-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">环境模拟温度</span>
                <span className="font-mono tabular-nums font-semibold text-amber-700">
                  {tempC} ℃
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                value={tempC}
                disabled={readOnly}
                onChange={(e) =>
                  onChange({ ...value, tempC: Number(e.target.value) })
                }
                className="w-full accent-amber-600"
              />
            </div>
          )}

          {/* Editable Component Parameters */}
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-slate-500">
              器件状态与参数设定
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {components
                .filter(
                  (c) =>
                    c.type === 'switch' ||
                    c.type === 'resistor' ||
                    c.type === 'sensor_light' ||
                    c.type === 'sensor_temp'
                )
                .map((c) => (
                  <div
                    key={c.id}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-800">{c.label}</div>
                      <div className="text-[11px] font-mono text-slate-400">{c.id}</div>
                    </div>
                    {c.type === 'switch' ? (
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() =>
                          handleUpdateComponent(c.id, {
                            closed: c.closed === false,
                          })
                        }
                        className={`h-7 px-2.5 rounded text-xs font-medium whitespace-nowrap ${
                          c.closed !== false
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {c.closed !== false ? '已闭合' : '已断开'}
                      </button>
                    ) : (
                      <input
                        type="text"
                        value={c.value || ''}
                        disabled={readOnly}
                        onChange={(e) =>
                          handleUpdateComponent(c.id, { value: e.target.value })
                        }
                        placeholder="如 10kΩ 或 <=30"
                        className="w-24 h-7 px-2 border border-slate-300 rounded text-xs font-mono bg-white"
                      />
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Connected Wires List */}
          <div className="border-t border-slate-100 pt-2 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
              <span className="flex items-center gap-1">
                <Cable className="w-3.5 h-3.5" />
                <span>已连接导线（点击导线也可断开）</span>
              </span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {wires.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  暂无导线，点击电路板上的器件引脚圆点即可连接。
                </p>
              ) : (
                wires.map((w, idx) => (
                  <div
                    key={`${w.from}-${w.to}-${idx}`}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono text-slate-700"
                  >
                    <span>
                      {w.from} ── {w.to}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveWire(idx)}
                        className="text-red-500 hover:text-red-700 p-0.5"
                        title="断开导线"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

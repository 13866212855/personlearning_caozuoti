'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Hammer,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { evaluateStructure } from '@/lib/gtEvaluators';
import type { StructureMember, StructureState } from '@/lib/types';

interface Props {
  value: StructureState;
  onChange: (next: StructureState) => void;
  readOnly?: boolean;
}

const MAT_META: Record<
  StructureMember['material'],
  { label: string; color: string; factor: string }
> = {
  wood: { label: '木材', color: '#b45309', factor: '轻质基础 1.0x' },
  aluminum: { label: '铝合金', color: '#0284c7', factor: '中强耐腐 1.35x' },
  steel: { label: '钢材', color: '#334155', factor: '高强抗压 1.8x' },
};

function sameEdge(a: StructureMember, b: StructureMember): boolean {
  return (
    (a.from === b.from && a.to === b.to) ||
    (a.from === b.to && a.to === b.from)
  );
}

export default function StructureSimulator({
  value,
  onChange,
  readOnly = false,
}: Props) {
  const nodes = useMemo(() => value?.nodes || [], [value?.nodes]);
  const baseMembers = useMemo(() => value?.baseMembers || [], [value?.baseMembers]);
  const members = useMemo(() => value?.members || [], [value?.members]);
  const jointType = value?.jointType || 'hinged';
  const supportBaseWidth = value?.supportBaseWidth ?? 120;
  const testLoadN = value?.testLoadN ?? 150;

  const [material, setMaterial] = useState<StructureMember['material']>('steel');
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [loadTested, setLoadTested] = useState(false);

  const evalRes = useMemo(() => evaluateStructure(value), [value]);

  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  const handleNodeClick = (nodeId: string) => {
    if (readOnly) return;
    if (!pendingNodeId) {
      setPendingNodeId(nodeId);
      return;
    }
    if (pendingNodeId === nodeId) {
      setPendingNodeId(null);
      return;
    }
    const candidate: StructureMember = {
      from: pendingNodeId,
      to: nodeId,
      material,
    };
    const existsInBase = baseMembers.some((m) => sameEdge(m, candidate));
    const existsInUser = members.some((m) => sameEdge(m, candidate));
    if (!existsInBase && !existsInUser) {
      onChange({
        ...value,
        members: [...members, candidate],
      });
    }
    setPendingNodeId(null);
  };

  const handleRemoveMember = (idx: number) => {
    if (readOnly) return;
    onChange({
      ...value,
      members: members.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-y-auto p-3 gap-3">
      {/* Top Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {!readOnly &&
            (['wood', 'aluminum', 'steel'] as StructureMember['material'][]).map(
              (m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMaterial(m)}
                  className={`h-8 px-3 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    material === m
                      ? 'border-sky-600 bg-sky-50 text-sky-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {MAT_META[m].label}（{MAT_META[m].factor}）
                </button>
              )
            )}
        </div>

        <button
          type="button"
          onClick={() => setLoadTested(true)}
          className="h-8 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Hammer className="w-3.5 h-3.5" />
          <span>施加 {testLoadN} N 测试载荷</span>
        </button>
      </div>

      {/* Two-zone Interactive Truss Canvas + Mechanical Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left: SVG Truss Stage */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900">
              {value?.taskTitle || '结构设计与稳定性实验台（点击两个节点加装杆件）'}
            </span>
            {pendingNodeId ? (
              <span className="font-mono text-sky-700 font-medium">
                已选起点 {pendingNodeId}，点击另一个节点连接斜撑/横杆
              </span>
            ) : (
              <span className="font-mono tabular-nums text-[11px] text-slate-400">
                三角形单元 {evalRes.triangleCount} 个 · 总杆件 {evalRes.totalMembers} 根
              </span>
            )}
          </div>

          <div className="w-full border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
            <svg viewBox="0 0 520 300" className="w-full h-auto select-none">
              {/* Ground & Support Base Span indicator */}
              <rect x="0" y="252" width="520" height="48" fill="#e2e8f0" opacity={0.5} />
              <line x1="20" y1="252" x2="500" y2="252" stroke="#64748b" strokeWidth={2} />

              {/* Support Base Width visualization */}
              <line
                x1={Math.max(40, 260 - supportBaseWidth / 2)}
                y1={276}
                x2={Math.min(480, 260 + supportBaseWidth / 2)}
                y2={276}
                stroke="#0284c7"
                strokeWidth={2}
              />
              <text
                x="260"
                y="292"
                textAnchor="middle"
                fontSize="11"
                fontFamily="monospace"
                fill="#0369a1"
              >
                支撑面宽: {supportBaseWidth} mm · 连接: {jointType === 'rigid' ? '刚连接' : '铰连接'}
              </text>

              {/* Load Arrow Indicator */}
              <g opacity={loadTested ? 1 : 0.65}>
                <line
                  x1="260"
                  y1="14"
                  x2="260"
                  y2="56"
                  stroke={evalRes.isStable ? '#0284c7' : '#dc2626'}
                  strokeWidth={3}
                />
                <polygon
                  points="253,52 267,52 260,64"
                  fill={evalRes.isStable ? '#0284c7' : '#dc2626'}
                />
                <text
                  x="274"
                  y="36"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="700"
                  fill={evalRes.isStable ? '#0369a1' : '#b91c1c'}
                >
                  F = {testLoadN} N
                </text>
              </g>

              {/* Base Members */}
              {baseMembers.map((m, idx) => {
                const a = nodeMap.get(m.from);
                const b = nodeMap.get(m.to);
                if (!a || !b) return null;
                return (
                  <line
                    key={`bm-${idx}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#475569"
                    strokeWidth={6}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* User Added Members */}
              {members.map((m, idx) => {
                const a = nodeMap.get(m.from);
                const b = nodeMap.get(m.to);
                if (!a || !b) return null;
                return (
                  <g
                    key={`um-${idx}`}
                    className={!readOnly ? 'cursor-pointer' : ''}
                    onClick={() => handleRemoveMember(idx)}
                  >
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={MAT_META[m.material]?.color || '#0284c7'}
                      strokeWidth={6}
                      strokeLinecap="round"
                    />
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={14}
                    />
                  </g>
                );
              })}

              {/* Structural Nodes */}
              {nodes.map((n) => {
                const isPending = pendingNodeId === n.id;
                return (
                  <g
                    key={n.id}
                    onClick={() => handleNodeClick(n.id)}
                    className={!readOnly ? 'cursor-pointer' : ''}
                  >
                    {n.fixed && (
                      <polygon
                        points={`${n.x - 10},${n.y + 14} ${n.x + 10},${n.y + 14} ${n.x},${n.y + 4}`}
                        fill="#64748b"
                      />
                    )}
                    {jointType === 'rigid' ? (
                      <rect
                        x={n.x - 9}
                        y={n.y - 9}
                        width={18}
                        height={18}
                        rx={2}
                        fill={isPending ? '#0284c7' : '#ffffff'}
                        stroke={isPending ? '#0369a1' : '#0f172a'}
                        strokeWidth={2.5}
                      />
                    ) : (
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={9}
                        fill={isPending ? '#0284c7' : '#ffffff'}
                        stroke={isPending ? '#0369a1' : '#0f172a'}
                        strokeWidth={2.5}
                      />
                    )}
                    <text
                      x={n.x}
                      y={n.y - 14}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="monospace"
                      fill="#0f172a"
                    >
                      {n.label || n.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div
            className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
              evalRes.isStable
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {evalRes.isStable ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{evalRes.summary}</span>
          </div>
        </div>

        {/* Right: Parameters & Telemetry */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <span>连接方式、支承面与强度指标</span>
          </div>

          {/* Telemetry Readout */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-500">最大承载力</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {evalRes.maxSafeLoadN} N
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-500">安全系数 (≥1.0 达标)</div>
              <div
                className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                  evalRes.safetyFactor >= 1.0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {evalRes.safetyFactor}
              </div>
            </div>
          </div>

          {/* Joint Type */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-700">节点连接方式</div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'hinged', label: '铰连接（可转动）' },
                  { id: 'rigid', label: '刚连接（固定）' },
                ] as const
              ).map((jt) => (
                <button
                  key={jt.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => onChange({ ...value, jointType: jt.id })}
                  className={`h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors ${
                    jointType === jt.id
                      ? 'border-sky-600 bg-sky-50 text-sky-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {jt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Support Base Width */}
          <div className="space-y-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 font-medium">底座支撑宽度</span>
              <span className="font-mono tabular-nums font-semibold text-sky-700">
                {supportBaseWidth} mm
              </span>
            </div>
            <input
              type="range"
              min={60}
              max={240}
              step={10}
              value={supportBaseWidth}
              disabled={readOnly}
              onChange={(e) =>
                onChange({ ...value, supportBaseWidth: Number(e.target.value) })
              }
              className="w-full accent-sky-600"
            />
          </div>

          {/* Added User Members List */}
          <div className="border-t border-slate-100 pt-2 flex-1 flex flex-col min-h-0">
            <div className="text-[11px] font-medium text-slate-500 mb-1.5">
              自增结构杆件（{members.length} 根）
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {members.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  在左侧图上依次点击两个节点（如 A 与 C）添加斜撑杆件。
                </p>
              ) : (
                members.map((m, idx) => (
                  <div
                    key={`${m.from}-${m.to}-${idx}`}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono text-slate-700"
                  >
                    <span>
                      {m.from} — {m.to} · {MAT_META[m.material]?.label || m.material}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(idx)}
                        className="text-red-500 hover:text-red-700 p-0.5"
                        title="拆除杆件"
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

'use client';

import { useMemo, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownZA,
  ArrowUpAZ,
  BarChart3,
  Bold,
  Filter,
  Grid3X3,
  Merge,
  Trash2,
} from 'lucide-react';
import {
  colToIndex,
  evaluateExcelSheet,
  expandRange,
  formatExcelDisplay,
  indexToCol,
  parseCellRef,
} from '@/lib/excelFormula';
import type { ExcelCell, ExcelChart, ExcelState } from '@/lib/types';

interface ExcelSimulatorProps {
  value: ExcelState;
  onChange: (next: ExcelState) => void;
  readOnly?: boolean;
}

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const ROWS = Array.from({ length: 14 }, (_, i) => i + 1);

export default function ExcelSimulator({
  value,
  onChange,
  readOnly = false,
}: ExcelSimulatorProps) {
  const cells = useMemo(() => value.cells || {}, [value.cells]);
  const merges = value.merges || [];
  const charts = value.charts || [];

  const [anchorRef, setAnchorRef] = useState<string>('A1');
  const [rangeText, setRangeText] = useState<string>('A1');
  const [isDragging, setIsDragging] = useState(false);

  const [showChartModal, setShowChartModal] = useState(false);
  const [chartType, setChartType] = useState<'column' | 'line' | 'pie'>('column');
  const [chartTitle, setChartTitle] = useState('数据统计图');
  const [chartLabelRange, setChartLabelRange] = useState('A2:A5');
  const [chartDataRange, setChartDataRange] = useState('C2:C5');

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterKeyword, setFilterKeyword] = useState(
    value.filterInfo?.keyword || ''
  );

  const computed = useMemo(() => evaluateExcelSheet(cells), [cells]);

  const activeCell = cells[anchorRef] || { value: '' };
  const formulaBarVal = activeCell.formula || activeCell.value || '';

  const selectedRefs = useMemo(() => expandRange(rangeText), [rangeText]);

  const updateCellRaw = (ref: string, rawInput: string) => {
    if (readOnly) return;
    const prev = cells[ref] || { value: '' };
    const isFormula = rawInput.trim().startsWith('=');
    const nextCells: Record<string, ExcelCell> = {
      ...cells,
      [ref]: {
        ...prev,
        formula: isFormula ? rawInput.trim() : '',
        value: isFormula ? '' : rawInput,
      },
    };
    const nextComputed = evaluateExcelSheet(nextCells);
    if (isFormula) {
      nextCells[ref].value = nextComputed[ref] || '';
    }
    onChange({ ...value, cells: nextCells });
  };

  const applyStyleToSelection = (patch: Partial<ExcelCell>) => {
    if (readOnly) return;
    const nextCells = { ...cells };
    for (const ref of selectedRefs) {
      const prev = nextCells[ref] || { value: '' };
      nextCells[ref] = { ...prev, ...patch };
    }
    onChange({ ...value, cells: nextCells });
  };

  const handleToggleMerge = () => {
    if (readOnly || !rangeText.includes(':')) return;
    const norm = rangeText.toUpperCase();
    const exists = merges.includes(norm);
    const nextMerges = exists
      ? merges.filter((m) => m !== norm)
      : [...merges, norm];
    onChange({ ...value, merges: nextMerges });
  };

  const handleSort = (order: 'asc' | 'desc') => {
    if (readOnly) return;
    const parsed = parseCellRef(anchorRef);
    if (!parsed) return;
    const colLetter = indexToCol(parsed.col);

    // Find numeric/data rows starting from row 2 or 3 (below header)
    const rowIndicesWithData = ROWS.filter((r) => {
      if (r === 1) return false;
      return COLS.some((c) => {
        const val = cells[`${c}${r}`]?.value;
        return val !== undefined && val !== '';
      });
    });

    // Check if row 2 is a header row (no pure numbers in row 2 when row 3 has numbers)
    const row2HasNum = COLS.some((c) => {
      const v = computed[`${c}2`] || cells[`${c}2`]?.value || '';
      return v !== '' && Number.isFinite(Number(v));
    });
    const startRow = row2HasNum ? 2 : 3;
    const sortableRows = rowIndicesWithData.filter((r) => r >= startRow);
    // Stop before summary rows if column A contains 最高/总计/平均
    const dataRows = sortableRows.filter((r) => {
      const aVal = cells[`A${r}`]?.value || '';
      return !aVal.includes('最高') && !aVal.includes('畅销') && !aVal.includes('合计');
    });

    if (dataRows.length < 2) {
      onChange({ ...value, sortInfo: { column: colLetter, order } });
      return;
    }

    const rowSnapshots = dataRows.map((r) => {
      const rowData: Record<string, ExcelCell> = {};
      for (const c of COLS) {
        if (cells[`${c}${r}`]) rowData[c] = { ...cells[`${c}${r}`] };
      }
      const sortRaw = computed[`${colLetter}${r}`] || cells[`${colLetter}${r}`]?.value || '';
      return { r, rowData, sortRaw };
    });

    rowSnapshots.sort((a, b) => {
      const na = Number(a.sortRaw);
      const nb = Number(b.sortRaw);
      if (Number.isFinite(na) && Number.isFinite(nb)) {
        return order === 'asc' ? na - nb : nb - na;
      }
      return order === 'asc'
        ? a.sortRaw.localeCompare(b.sortRaw)
        : b.sortRaw.localeCompare(a.sortRaw);
    });

    const nextCells = { ...cells };
    dataRows.forEach((targetRow, idx) => {
      const snap = rowSnapshots[idx];
      for (const c of COLS) {
        if (snap.rowData[c]) {
          nextCells[`${c}${targetRow}`] = snap.rowData[c];
        } else {
          delete nextCells[`${c}${targetRow}`];
        }
      }
    });

    onChange({
      ...value,
      cells: nextCells,
      sortInfo: { column: colLetter, order },
    });
  };

  const handleApplyFilter = () => {
    if (readOnly) return;
    const parsed = parseCellRef(anchorRef);
    const colLetter = parsed ? indexToCol(parsed.col) : 'A';
    onChange({
      ...value,
      filterInfo: filterKeyword.trim()
        ? { column: colLetter, keyword: filterKeyword.trim() }
        : undefined,
    });
    setShowFilterModal(false);
  };

  const handleInsertChart = () => {
    if (readOnly) return;
    const nextChart: ExcelChart = {
      id: `chart-${Date.now()}`,
      type: chartType,
      title: chartTitle.trim() || '图表',
      labelRange: chartLabelRange.trim().toUpperCase(),
      dataRange: chartDataRange.trim().toUpperCase(),
    };
    onChange({ ...value, charts: [...charts, nextChart] });
    setShowChartModal(false);
  };

  const handleCellMouseDown = (ref: string) => {
    setAnchorRef(ref);
    setRangeText(ref);
    setIsDragging(true);
  };

  const handleCellMouseEnter = (ref: string) => {
    if (!isDragging) return;
    if (ref === anchorRef) {
      setRangeText(ref);
    } else {
      setRangeText(`${anchorRef}:${ref}`);
    }
  };

  // Merge lookup
  const getMergeBounds = (ref: string) => {
    const pos = parseCellRef(ref);
    if (!pos) return null;
    for (const m of merges) {
      const [s, e] = m.split(':');
      const sp = parseCellRef(s);
      const ep = parseCellRef(e);
      if (!sp || !ep) continue;
      const minC = Math.min(sp.col, ep.col);
      const maxC = Math.max(sp.col, ep.col);
      const minR = Math.min(sp.row, ep.row);
      const maxR = Math.max(sp.row, ep.row);
      if (
        pos.col >= minC &&
        pos.col <= maxC &&
        pos.row >= minR &&
        pos.row <= maxR
      ) {
        if (pos.col === minC && pos.row === minR) {
          return {
            isOrigin: true,
            colSpan: maxC - minC + 1,
            rowSpan: maxR - minR + 1,
          };
        }
        return { isOrigin: false, colSpan: 1, rowSpan: 1 };
      }
    }
    return null;
  };

  return (
    <div
      className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden select-none"
      onMouseUp={() => setIsDragging(false)}
    >
      {/* Toolbar */}
      {!readOnly && (
        <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            title="加粗"
            onClick={() => applyStyleToSelection({ bold: !activeCell.bold })}
            className={`h-8 w-8 rounded flex items-center justify-center ${
              activeCell.bold
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Bold className="w-4 h-4" />
          </button>

          <select
            aria-label="填充色"
            value={activeCell.bgColor || ''}
            onChange={(e) =>
              applyStyleToSelection({ bgColor: e.target.value })
            }
            className="h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700"
          >
            <option value="">无填充</option>
            <option value="#E0F2FE">浅蓝 (#E0F2FE)</option>
            <option value="#DCFCE7">浅绿 (#DCFCE7)</option>
            <option value="#FEF9C3">浅黄 (#FEF9C3)</option>
            <option value="#F1F5F9">浅灰 (#F1F5F9)</option>
          </select>

          <select
            aria-label="数字格式"
            value={activeCell.numberFormat || 'general'}
            onChange={(e) =>
              applyStyleToSelection({
                numberFormat: e.target.value as ExcelCell['numberFormat'],
              })
            }
            className="h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700"
          >
            <option value="general">常规</option>
            <option value="number2">数值 (2位小数)</option>
            <option value="percent">百分比 (%)</option>
            <option value="currency">货币 (¥)</option>
          </select>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          <button
            type="button"
            title="左对齐"
            onClick={() => applyStyleToSelection({ align: 'left' })}
            className={`h-8 w-8 rounded flex items-center justify-center ${
              activeCell.align === 'left'
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="居中"
            onClick={() => applyStyleToSelection({ align: 'center' })}
            className={`h-8 w-8 rounded flex items-center justify-center ${
              activeCell.align === 'center'
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="右对齐"
            onClick={() => applyStyleToSelection({ align: 'right' })}
            className={`h-8 w-8 rounded flex items-center justify-center ${
              activeCell.align === 'right'
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <AlignRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            title="全部边框"
            onClick={() =>
              applyStyleToSelection({ border: !activeCell.border })
            }
            className={`h-8 px-2 rounded flex items-center gap-1 text-xs font-medium ${
              activeCell.border
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>边框</span>
          </button>

          <button
            type="button"
            onClick={handleToggleMerge}
            className="h-8 px-2 rounded flex items-center gap-1 text-xs font-medium text-slate-700 hover:bg-slate-200 whitespace-nowrap"
          >
            <Merge className="w-3.5 h-3.5" />
            <span>合并/取消</span>
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          <button
            type="button"
            onClick={() => handleSort('asc')}
            className="h-8 px-2 rounded flex items-center gap-1 text-xs font-medium text-slate-700 hover:bg-slate-200 whitespace-nowrap"
          >
            <ArrowUpAZ className="w-3.5 h-3.5" />
            <span>升序</span>
          </button>
          <button
            type="button"
            onClick={() => handleSort('desc')}
            className="h-8 px-2 rounded flex items-center gap-1 text-xs font-medium text-slate-700 hover:bg-slate-200 whitespace-nowrap"
          >
            <ArrowDownZA className="w-3.5 h-3.5" />
            <span>降序</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className={`h-8 px-2 rounded flex items-center gap-1 text-xs font-medium whitespace-nowrap ${
              value.filterInfo
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>筛选</span>
          </button>
          <button
            type="button"
            onClick={() => setShowChartModal(true)}
            className="h-8 px-2 rounded flex items-center gap-1 text-xs font-medium text-slate-700 hover:bg-slate-200 whitespace-nowrap"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>插入图表</span>
          </button>
        </div>
      )}

      {/* Formula Bar */}
      {!readOnly && (
        <div className="bg-white border-b border-slate-200 px-3 py-1.5 flex items-center gap-2 text-xs">
          <input
            type="text"
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value.toUpperCase())}
            className="w-24 h-7 px-2 border border-slate-200 rounded bg-slate-50 font-mono text-center text-slate-700"
            title="当前选区，可手动输入如 A1:G1"
          />
          <span className="font-mono font-semibold text-sky-700 px-1">fx</span>
          <input
            type="text"
            value={formulaBarVal}
            onChange={(e) => updateCellRaw(anchorRef, e.target.value)}
            placeholder="输入数值、文字或公式（如 =SUM(B3:D3)）"
            className="flex-1 h-7 px-2.5 border border-slate-200 rounded font-mono text-slate-900 focus:outline-none focus:border-sky-500"
          />
        </div>
      )}

      {/* Spreadsheet Grid + Charts */}
      <div className="flex-1 overflow-auto p-3 space-y-4">
        <table className="border-collapse text-xs tabular-nums min-w-full">
          <thead>
            <tr>
              <th className="w-10 h-7 bg-slate-100 border border-slate-300 text-slate-500 font-medium" />
              {COLS.map((c) => (
                <th
                  key={c}
                  className="min-w-[88px] h-7 bg-slate-100 border border-slate-300 text-slate-600 font-semibold"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              // Filter visibility
              if (value.filterInfo && r > 1) {
                const fCol = value.filterInfo.column;
                const fKw = value.filterInfo.keyword;
                const val = computed[`${fCol}${r}`] || cells[`${fCol}${r}`]?.value || '';
                if (!val.includes(fKw)) return null;
              }

              return (
                <tr key={r}>
                  <td className="bg-slate-100 border border-slate-300 text-center text-slate-500 font-medium h-8">
                    {r}
                  </td>
                  {COLS.map((c) => {
                    const ref = `${c}${r}`;
                    const mergeInfo = getMergeBounds(ref);
                    if (mergeInfo && !mergeInfo.isOrigin) return null;

                    const cell = cells[ref];
                    const isSelected = selectedRefs.includes(ref);
                    const isAnchor = anchorRef === ref;
                    const displayRaw = cell?.formula
                      ? computed[ref] || ''
                      : cell?.value || '';
                    const displayText = formatExcelDisplay(
                      displayRaw,
                      cell?.numberFormat
                    );

                    return (
                      <td
                        key={ref}
                        colSpan={mergeInfo?.colSpan || 1}
                        rowSpan={mergeInfo?.rowSpan || 1}
                        onMouseDown={() => handleCellMouseDown(ref)}
                        onMouseEnter={() => handleCellMouseEnter(ref)}
                        className={`h-8 px-1.5 relative ${
                          cell?.border
                            ? 'border border-slate-700'
                            : 'border border-slate-200'
                        } ${
                          isAnchor
                            ? 'ring-2 ring-inset ring-sky-600'
                            : isSelected
                              ? 'bg-sky-50'
                              : ''
                        }`}
                        style={{
                          backgroundColor: isSelected
                            ? undefined
                            : cell?.bgColor || undefined,
                          color: cell?.color || '#0F172A',
                          fontWeight: cell?.bold ? 700 : 400,
                          textAlign:
                            cell?.align || (mergeInfo ? 'center' : 'left'),
                        }}
                      >
                        {isAnchor && !readOnly ? (
                          <input
                            type="text"
                            value={cell?.formula || cell?.value || ''}
                            onChange={(e) => updateCellRaw(ref, e.target.value)}
                            className="w-full h-full bg-transparent focus:outline-none font-mono"
                          />
                        ) : (
                          <span className="block truncate">{displayText}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Rendered Charts */}
        {charts.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            {charts.map((ch) => {
              const labels = expandRange(ch.labelRange).map(
                (r) => computed[r] || cells[r]?.value || r
              );
              const dataVals = expandRange(ch.dataRange).map((r) => {
                const n = Number(computed[r] || cells[r]?.value || 0);
                return Number.isFinite(n) ? n : 0;
              });
              const maxVal = Math.max(1, ...dataVals);
              const palette = ['#0284C7', '#0D9488', '#0369A1', '#14B8A6', '#38BDF8'];

              return (
                <div
                  key={ch.id}
                  className="border border-slate-200 rounded-lg p-3 bg-slate-50/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      {ch.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{ch.dataRange}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              ...value,
                              charts: charts.filter((x) => x.id !== ch.id),
                            })
                          }
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {ch.type === 'column' && (
                    <svg viewBox="0 0 360 170" className="w-full h-44">
                      <line
                        x1="36"
                        y1="140"
                        x2="345"
                        y2="140"
                        stroke="#CBD5E1"
                      />
                      {dataVals.map((val, idx) => {
                        const slotW = 300 / Math.max(1, dataVals.length);
                        const barW = Math.min(40, slotW * 0.6);
                        const h = (val / maxVal) * 105;
                        const x = 40 + idx * slotW + (slotW - barW) / 2;
                        const y = 140 - h;
                        return (
                          <g key={idx}>
                            <rect
                              x={x}
                              y={y}
                              width={barW}
                              height={h}
                              rx="3"
                              fill={palette[idx % palette.length]}
                            />
                            <text
                              x={x + barW / 2}
                              y={y - 4}
                              textAnchor="middle"
                              fontSize="10"
                              fill="#334155"
                            >
                              {val}
                            </text>
                            <text
                              x={x + barW / 2}
                              y={155}
                              textAnchor="middle"
                              fontSize="10"
                              fill="#475569"
                            >
                              {(labels[idx] || '').slice(0, 6)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  )}

                  {ch.type === 'line' && (
                    <svg viewBox="0 0 360 170" className="w-full h-44">
                      <line
                        x1="36"
                        y1="140"
                        x2="345"
                        y2="140"
                        stroke="#CBD5E1"
                      />
                      {dataVals.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="#0284C7"
                          strokeWidth="2.5"
                          points={dataVals
                            .map((val, idx) => {
                              const x =
                                50 +
                                (idx * 280) / Math.max(1, dataVals.length - 1);
                              const y = 140 - (val / maxVal) * 105;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />
                      )}
                      {dataVals.map((val, idx) => {
                        const x =
                          50 + (idx * 280) / Math.max(1, dataVals.length - 1);
                        const y = 140 - (val / maxVal) * 105;
                        return (
                          <g key={idx}>
                            <circle cx={x} cy={y} r="4" fill="#0D9488" />
                            <text
                              x={x}
                              y={y - 7}
                              textAnchor="middle"
                              fontSize="10"
                              fill="#334155"
                            >
                              {val}
                            </text>
                            <text
                              x={x}
                              y={155}
                              textAnchor="middle"
                              fontSize="10"
                              fill="#475569"
                            >
                              {(labels[idx] || '').slice(0, 6)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  )}

                  {ch.type === 'pie' && (() => {
                    const sum = Math.max(
                      1,
                      dataVals.reduce((a, b) => a + b, 0)
                    );
                    let acc = 0;
                    return (
                      <div className="flex items-center gap-4">
                        <svg viewBox="0 0 140 140" className="w-36 h-36">
                          {dataVals.map((val, idx) => {
                            const startAngle = (acc / sum) * 2 * Math.PI;
                            acc += val;
                            const endAngle = (acc / sum) * 2 * Math.PI;
                            const x1 = 70 + 55 * Math.cos(startAngle);
                            const y1 = 70 + 55 * Math.sin(startAngle);
                            const x2 = 70 + 55 * Math.cos(endAngle);
                            const y2 = 70 + 55 * Math.sin(endAngle);
                            const large =
                              endAngle - startAngle > Math.PI ? 1 : 0;
                            const d = `M 70 70 L ${x1} ${y1} A 55 55 0 ${large} 1 ${x2} ${y2} Z`;
                            return (
                              <path
                                key={idx}
                                d={d}
                                fill={palette[idx % palette.length]}
                              />
                            );
                          })}
                        </svg>
                        <div className="space-y-1 text-xs">
                          {labels.map((lb, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-sm inline-block"
                                style={{
                                  backgroundColor:
                                    palette[idx % palette.length],
                                }}
                              />
                              <span>
                                {lb}: {dataVals[idx]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Insert Chart Modal */}
      {showChartModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold text-slate-900">插入图表</h3>
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <span className="text-slate-600">图表类型</span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { v: 'column', l: '柱形图' },
                      { v: 'line', l: '折线图' },
                      { v: 'pie', l: '饼图' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.v}
                      type="button"
                      onClick={() => setChartType(t.v)}
                      className={`py-2 rounded-lg border text-sm font-medium ${
                        chartType === t.v
                          ? 'border-sky-600 bg-sky-50 text-sky-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block space-y-1">
                <span className="text-slate-600">图表标题</span>
                <input
                  type="text"
                  value={chartTitle}
                  onChange={(e) => setChartTitle(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-slate-600">类别标签区域</span>
                  <input
                    type="text"
                    value={chartLabelRange}
                    onChange={(e) => setChartLabelRange(e.target.value)}
                    placeholder="如 A2:A5"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-600">数值数据区域</span>
                  <input
                    type="text"
                    value={chartDataRange}
                    onChange={(e) => setChartDataRange(e.target.value)}
                    placeholder="如 C2:C5"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowChartModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleInsertChart}
                className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium"
              >
                生成图表
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              数据筛选（按当前列 {anchorRef.replace(/\d+/, '')}）
            </h3>
            <input
              type="text"
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              placeholder="输入筛选关键词，留空表示清除筛选"
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleApplyFilter}
                className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium"
              >
                应用筛选
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

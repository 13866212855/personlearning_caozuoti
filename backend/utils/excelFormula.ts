import type { ExcelCell } from '../types';

export function colToIndex(col: string): number {
  let result = 0;
  const upper = col.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }
  return result - 1;
}

export function indexToCol(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(ref.trim());
  if (!match) return null;
  return {
    col: colToIndex(match[1]),
    row: parseInt(match[2], 10),
  };
}

export function expandRange(rangeStr: string): string[] {
  const cleaned = rangeStr.trim().replace(/\$/g, '');
  if (!cleaned.includes(':')) {
    const single = parseCellRef(cleaned);
    return single ? [`${indexToCol(single.col)}${single.row}`] : [];
  }
  const [startStr, endStr] = cleaned.split(':');
  const start = parseCellRef(startStr);
  const end = parseCellRef(endStr);
  if (!start || !end) return [];
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const refs: string[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      refs.push(`${indexToCol(c)}${r}`);
    }
  }
  return refs;
}

export function normalizeFormula(formula: string): string {
  return formula
    .trim()
    .replace(/\s+/g, '')
    .replace(/\$/g, '')
    .toUpperCase();
}

export function evaluateExcelSheet(
  cells: Record<string, ExcelCell>
): Record<string, string> {
  const cache: Record<string, string> = {};
  const visiting = new Set<string>();

  const getRawNumeric = (val: string): number | null => {
    if (val === '' || val === undefined || val === null) return null;
    const cleaned = val.replace(/[¥￥,%]/g, '').trim();
    if (cleaned === '') return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const evalCell = (ref: string): string => {
    const key = ref.toUpperCase();
    if (key in cache) return cache[key];
    if (visiting.has(key)) return '#REF!';
    const cell = cells[key];
    if (!cell) return '';
    const formula = (cell.formula || '').trim();
    if (!formula.startsWith('=')) {
      cache[key] = cell.value ?? '';
      return cache[key];
    }

    visiting.add(key);
    try {
      const result = evalExpr(formula.slice(1).trim());
      cache[key] = result;
      return result;
    } catch {
      cache[key] = '#ERROR!';
      return '#ERROR!';
    } finally {
      visiting.delete(key);
    }
  };

  const getRangeValues = (arg: string): string[] => {
    const trimmed = arg.trim();
    if (trimmed.includes(':')) {
      return expandRange(trimmed).map((r) => evalCell(r));
    }
    if (/^\$?[A-Za-z]+\$?\d+$/.test(trimmed)) {
      return [evalCell(trimmed.replace(/\$/g, ''))];
    }
    return [evalExpr(trimmed)];
  };

  const getRangeNumbers = (args: string[]): number[] => {
    const nums: number[] = [];
    for (const arg of args) {
      for (const v of getRangeValues(arg)) {
        const n = getRawNumeric(v);
        if (n !== null) nums.push(n);
      }
    }
    return nums;
  };

  const splitArgs = (argStr: string): string[] => {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inQuotes = false;
    for (let i = 0; i < argStr.length; i++) {
      const ch = argStr[i];
      if (ch === '"') inQuotes = !inQuotes;
      if (!inQuotes) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) {
          args.push(current.trim());
          current = '';
          continue;
        }
      }
      current += ch;
    }
    if (current.trim() !== '') args.push(current.trim());
    return args;
  };

  const evalCondition = (cond: string): boolean => {
    const ops = ['>=', '<=', '<>', '!=', '=', '>', '<'];
    for (const op of ops) {
      const idx = cond.indexOf(op);
      if (idx > 0) {
        const leftRaw = evalExpr(cond.slice(0, idx).trim());
        const rightRaw = evalExpr(cond.slice(idx + op.length).trim());
        const lNum = getRawNumeric(leftRaw);
        const rNum = getRawNumeric(rightRaw);
        const bothNum = lNum !== null && rNum !== null;
        if (op === '=' || op === '==') {
          return bothNum ? lNum === rNum : leftRaw === rightRaw;
        }
        if (op === '<>' || op === '!=') {
          return bothNum ? lNum !== rNum : leftRaw !== rightRaw;
        }
        if (bothNum) {
          if (op === '>') return lNum > rNum;
          if (op === '<') return lNum < rNum;
          if (op === '>=') return lNum >= rNum;
          if (op === '<=') return lNum <= rNum;
        }
        return false;
      }
    }
    const val = evalExpr(cond);
    return val === 'TRUE' || val === 'true' || Number(val) > 0;
  };

  const evalFunction = (name: string, argStr: string): string => {
    const fn = name.toUpperCase();
    const args = splitArgs(argStr);

    if (fn === 'SUM') {
      const nums = getRangeNumbers(args);
      const sum = nums.reduce((a, b) => a + b, 0);
      return String(Math.round(sum * 1e9) / 1e9);
    }
    if (fn === 'AVERAGE' || fn === 'AVG') {
      const nums = getRangeNumbers(args);
      if (nums.length === 0) return '#DIV/0!';
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      return String(Math.round(avg * 10000) / 10000);
    }
    if (fn === 'MAX') {
      const nums = getRangeNumbers(args);
      if (nums.length === 0) return '0';
      return String(Math.max(...nums));
    }
    if (fn === 'MIN') {
      const nums = getRangeNumbers(args);
      if (nums.length === 0) return '0';
      return String(Math.min(...nums));
    }
    if (fn === 'COUNT') {
      const nums = getRangeNumbers(args);
      return String(nums.length);
    }
    if (fn === 'COUNTA') {
      let cnt = 0;
      for (const a of args) {
        for (const v of getRangeValues(a)) {
          if (v !== '') cnt++;
        }
      }
      return String(cnt);
    }
    if (fn === 'IF') {
      if (args.length < 2) return '#VALUE!';
      const cond = evalCondition(args[0]);
      return cond ? evalExpr(args[1]) : args[2] ? evalExpr(args[2]) : 'FALSE';
    }
    if (fn === 'RANK' || fn === 'RANK.EQ') {
      if (args.length < 2) return '#VALUE!';
      const targetVal = getRawNumeric(evalExpr(args[0]));
      if (targetVal === null) return '#VALUE!';
      const list = getRangeNumbers([args[1]]);
      const order = args[2] ? Number(evalExpr(args[2])) : 0; // 0 = desc, 1 = asc
      const sorted = [...list].sort((a, b) => (order === 1 ? a - b : b - a));
      const rank = sorted.indexOf(targetVal);
      return rank >= 0 ? String(rank + 1) : '#N/A';
    }
    if (fn === 'ROUND') {
      if (args.length < 2) return '#VALUE!';
      const num = getRawNumeric(evalExpr(args[0]));
      const digits = Number(evalExpr(args[1]));
      if (num === null || !Number.isFinite(digits)) return '#VALUE!';
      const factor = Math.pow(10, digits);
      return String(Math.round(num * factor) / factor);
    }
    if (fn === 'COUNTIF') {
      if (args.length < 2) return '#VALUE!';
      const vals = getRangeValues(args[0]);
      const criteria = evalExpr(args[1]);
      let cnt = 0;
      for (const v of vals) {
        if (criteria.startsWith('>=')) {
          const n = getRawNumeric(v);
          const t = getRawNumeric(criteria.slice(2));
          if (n !== null && t !== null && n >= t) cnt++;
        } else if (criteria.startsWith('<=')) {
          const n = getRawNumeric(v);
          const t = getRawNumeric(criteria.slice(2));
          if (n !== null && t !== null && n <= t) cnt++;
        } else if (criteria.startsWith('>')) {
          const n = getRawNumeric(v);
          const t = getRawNumeric(criteria.slice(1));
          if (n !== null && t !== null && n > t) cnt++;
        } else if (criteria.startsWith('<')) {
          const n = getRawNumeric(v);
          const t = getRawNumeric(criteria.slice(1));
          if (n !== null && t !== null && n < t) cnt++;
        } else if (v === criteria) {
          cnt++;
        }
      }
      return String(cnt);
    }
    return '#NAME?';
  };

  const evalExpr = (expr: string): string => {
    const trimmed = expr.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return trimmed;
    }
    if (/^\$?[A-Za-z]+\$?\d+$/.test(trimmed)) {
      return evalCell(trimmed.replace(/\$/g, ''));
    }

    // Replace function calls iteratively from innermost to outermost
    let work = trimmed;
    const fnRegex = /([A-Za-z_.]+)\(([^()]*)\)/;
    let safety = 0;
    while (fnRegex.test(work) && safety < 30) {
      safety++;
      work = work.replace(fnRegex, (_, fnName, argStr) => {
        const res = evalFunction(fnName, argStr);
        return /^-?\d+(\.\d+)?$/.test(res) ? res : `"${res}"`;
      });
    }

    if (
      (work.startsWith('"') && work.endsWith('"')) &&
      work.indexOf('"', 1) === work.length - 1
    ) {
      return work.slice(1, -1);
    }

    // Replace remaining cell references with numeric values
    const withCells = work.replace(/\$?([A-Za-z]+)\$?(\d+)/g, (_, c, r) => {
      const val = evalCell(`${c.toUpperCase()}${r}`);
      const num = getRawNumeric(val);
      return num !== null ? String(num) : '0';
    });

    // Safe arithmetic evaluation (+, -, *, /, parentheses)
    if (/^[0-9+\-*/().\s]+$/.test(withCells)) {
      const fn = new Function(`return (${withCells});`);
      const val = fn();
      if (typeof val === 'number' && Number.isFinite(val)) {
        return String(Math.round(val * 1e9) / 1e9);
      }
    }

    return work;
  };

  for (const key of Object.keys(cells)) {
    evalCell(key);
  }

  return cache;
}

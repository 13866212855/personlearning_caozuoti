import type {
  CircuitState,
  ControlSystemState,
  CraftProcessState,
  DatabaseState,
  ExcelCell,
  ExcelState,
  FileState,
  PythonState,
  QuestionType,
  SimulatorState,
  Sketch3ViewState,
  StructureState,
  WebState,
  WordParagraph,
  WordState,
} from './types';

/**
 * 对比模拟器前后两个状态，产出：
 * - label: 给「已删除段落 [撤销]」提示条用的操作描述
 * - coalesceKey: 非 null 表示这是"输入类"连续修改（打字），可与上一步合并成一次撤销
 * - showToast: 是否弹出提示条（仅破坏性/大范围操作）
 */
export interface ChangeDescription {
  label: string;
  coalesceKey: string | null;
  showToast: boolean;
}

const jsonEq = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function sameParagraphIds(a: WordParagraph[], b: WordParagraph[]): boolean {
  return a.length === b.length && a.every((p, i) => p.id === b[i].id);
}

function isWordTextOnlyChange(a: WordParagraph, b: WordParagraph): boolean {
  const x = { ...a, text: '' };
  const y = { ...b, text: '' };
  return jsonEq(x, y);
}

function isCellValueOnlyChange(
  a: ExcelCell | undefined,
  b: ExcelCell | undefined
): boolean {
  const { value: _va, formula: _fa, ...x } = a || { value: '' };
  const { value: _vb, formula: _fb, ...y } = b || { value: '' };
  void _va;
  void _fa;
  void _vb;
  void _fb;
  return jsonEq(x, y);
}

function changedCellRefs(
  prev: Record<string, ExcelCell>,
  next: Record<string, ExcelCell>
): string[] {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (!jsonEq(prev[k], next[k])) changed.push(k);
  }
  return changed;
}

function describeWord(prev: WordState, next: WordState): ChangeDescription {
  const pp = prev.paragraphs || [];
  const np = next.paragraphs || [];
  const tablesSame = jsonEq(prev.tables, next.tables);
  const imagesSame = jsonEq(prev.images, next.images);
  const pageSame = jsonEq(prev.pageSetup, next.pageSetup);
  const headerSame = prev.headerText === next.headerText;
  const footerSame = prev.footerText === next.footerText;

  if (!tablesSame) {
    const removed = (prev.tables?.length || 0) - (next.tables?.length || 0);
    return removed > 0
      ? { label: `已删除表格`, coalesceKey: null, showToast: true }
      : { label: `已插入表格`, coalesceKey: null, showToast: false };
  }
  if (!imagesSame) {
    const removed = (prev.images?.length || 0) - (next.images?.length || 0);
    return removed > 0
      ? { label: `已移除图片`, coalesceKey: null, showToast: true }
      : { label: `已插入图片`, coalesceKey: null, showToast: false };
  }
  if (!pageSame) {
    return { label: '修改页面设置', coalesceKey: null, showToast: false };
  }
  if (!headerSame && footerSame) {
    return { label: '编辑页眉', coalesceKey: 'word-header', showToast: false };
  }
  if (!footerSame && headerSame) {
    return { label: '编辑页脚', coalesceKey: 'word-footer', showToast: false };
  }

  const docFrameSame =
    tablesSame && imagesSame && pageSame && headerSame && footerSame;
  if (docFrameSame && pp.length === np.length && sameParagraphIds(pp, np)) {
    const changedIdx: number[] = [];
    for (let i = 0; i < pp.length; i += 1) {
      if (!jsonEq(pp[i], np[i])) changedIdx.push(i);
    }
    if (changedIdx.length === 1) {
      const i = changedIdx[0];
      if (isWordTextOnlyChange(pp[i], np[i])) {
        return {
          label: '编辑段落内容',
          coalesceKey: `word-text:${np[i].id}`,
          showToast: false,
        };
      }
      return { label: '修改段落格式', coalesceKey: null, showToast: false };
    }
    if (changedIdx.length > 1) {
      const allTextOnly = changedIdx.every((i) =>
        isWordTextOnlyChange(pp[i], np[i])
      );
      if (allTextOnly) {
        return { label: '批量修改文本', coalesceKey: null, showToast: false };
      }
    }
    if (changedIdx.length === 0) {
      return { label: '编辑内容', coalesceKey: null, showToast: false };
    }
  }
  if (docFrameSame && np.length === pp.length - 1) {
    // 删除一段：剩余段落的 id 顺序应是原序列去掉某一个后的结果
    let matched = false;
    for (let skip = 0; skip < pp.length; skip += 1) {
      const rest = pp.filter((_, i) => i !== skip);
      if (sameParagraphIds(rest, np)) {
        matched = true;
        break;
      }
    }
    if (matched) {
      return { label: '已删除段落', coalesceKey: null, showToast: true };
    }
  }
  if (docFrameSame && np.length === pp.length + 1) {
    return { label: '已新增段落', coalesceKey: null, showToast: false };
  }
  return { label: '编辑文档内容', coalesceKey: null, showToast: false };
}

function describeExcel(prev: ExcelState, next: ExcelState): ChangeDescription {
  const mergesSame = jsonEq(prev.merges, next.merges);
  const chartsSame = jsonEq(prev.charts, next.charts);
  const sortSame = jsonEq(prev.sortInfo, next.sortInfo);
  const filterSame = jsonEq(prev.filterInfo, next.filterInfo);

  if (!chartsSame) {
    const removed = (prev.charts?.length || 0) - (next.charts?.length || 0);
    return removed > 0
      ? { label: '已删除图表', coalesceKey: null, showToast: true }
      : { label: '已插入图表', coalesceKey: null, showToast: false };
  }
  if (!sortSame) {
    return { label: '已排序', coalesceKey: null, showToast: true };
  }
  if (!filterSame) {
    return {
      label: next.filterInfo ? '已应用筛选' : '已清除筛选',
      coalesceKey: null,
      showToast: false,
    };
  }
  if (!mergesSame) {
    return { label: '合并/取消合并单元格', coalesceKey: null, showToast: false };
  }

  const changed = changedCellRefs(prev.cells || {}, next.cells || {});
  if (changed.length === 1) {
    const ref = changed[0];
    if (isCellValueOnlyChange(prev.cells?.[ref], next.cells?.[ref])) {
      return {
        label: '编辑单元格',
        coalesceKey: `excel-cell:${ref}`,
        showToast: false,
      };
    }
    return { label: '设置单元格格式', coalesceKey: null, showToast: false };
  }
  if (changed.length > 1) {
    const allValueOnly = changed.every((ref) =>
      isCellValueOnlyChange(prev.cells?.[ref], next.cells?.[ref])
    );
    return {
      label: allValueOnly ? '修改单元格内容' : '设置单元格格式',
      coalesceKey: null,
      showToast: false,
    };
  }
  return { label: '编辑表格', coalesceKey: null, showToast: false };
}

function describeWeb(prev: WebState, next: WebState): ChangeDescription {
  const pf = prev.files || [];
  const nf = next.files || [];
  if (pf.length !== nf.length) {
    return {
      label: nf.length > pf.length ? '已新建文件' : '已删除文件',
      coalesceKey: null,
      showToast: nf.length < pf.length,
    };
  }
  const changedIdx: number[] = [];
  for (let i = 0; i < pf.length; i += 1) {
    if (!jsonEq(pf[i], nf[i])) changedIdx.push(i);
  }
  if (changedIdx.length === 1 && pf[changedIdx[0]].path === nf[changedIdx[0]].path) {
    const path = nf[changedIdx[0]].path;
    return {
      label: '编辑代码',
      coalesceKey: `web-code:${path}`,
      showToast: false,
    };
  }
  return { label: '编辑网页文件', coalesceKey: null, showToast: false };
}

function describeFile(prev: FileState, next: FileState): ChangeDescription {
  const pi = prev.items || [];
  const ni = next.items || [];
  if (ni.length < pi.length) {
    return { label: '已删除文件或文件夹', coalesceKey: null, showToast: true };
  }
  if (ni.length > pi.length) {
    return { label: '已新建/复制文件', coalesceKey: null, showToast: false };
  }
  const changedIdx: number[] = [];
  for (let i = 0; i < pi.length; i += 1) {
    if (!jsonEq(pi[i], ni[i])) changedIdx.push(i);
  }
  if (changedIdx.length >= 1) {
    const structChanged = changedIdx.some(
      (i) =>
        pi[i].path !== ni[i].path ||
        pi[i].parentPath !== ni[i].parentPath ||
        pi[i].name !== ni[i].name
    );
    if (structChanged) {
      return { label: '移动/重命名文件', coalesceKey: null, showToast: false };
    }
    const attrChanged = changedIdx.some(
      (i) =>
        Boolean(pi[i].readOnly) !== Boolean(ni[i].readOnly) ||
        Boolean(pi[i].hidden) !== Boolean(ni[i].hidden)
    );
    if (attrChanged) {
      return { label: '设置文件属性', coalesceKey: null, showToast: false };
    }
    if (changedIdx.length === 1) {
      return {
        label: '编辑文件内容',
        coalesceKey: `file-content:${ni[changedIdx[0]].path}`,
        showToast: false,
      };
    }
  }
  return { label: '编辑文件', coalesceKey: null, showToast: false };
}

export function describeChange(
  type: QuestionType,
  prev: SimulatorState,
  next: SimulatorState
): ChangeDescription {
  try {
    switch (type) {
      case 'word':
        return describeWord(prev as WordState, next as WordState);
      case 'excel':
        return describeExcel(prev as ExcelState, next as ExcelState);
      case 'web':
        return describeWeb(prev as WebState, next as WebState);
      case 'file':
        return describeFile(prev as FileState, next as FileState);
      case 'python': {
        const p = prev as PythonState;
        const n = next as PythonState;
        if (p.code !== n.code) {
          return { label: '编辑 Python 代码', coalesceKey: 'python-code', showToast: false };
        }
        if (p.customInput !== n.customInput) {
          return { label: '修改测试输入', coalesceKey: 'python-stdin', showToast: false };
        }
        return { label: '运行 Python 代码', coalesceKey: null, showToast: false };
      }
      case 'database': {
        const p = prev as DatabaseState;
        const n = next as DatabaseState;
        if (p.sql !== n.sql) {
          return { label: '编辑 SQL 语句', coalesceKey: 'db-sql', showToast: false };
        }
        return { label: '执行 SQL 查询', coalesceKey: null, showToast: false };
      }
      case 'sketch3view': {
        const p = prev as Sketch3ViewState;
        const n = next as Sketch3ViewState;
        const pLines = p.lines?.length || 0;
        const nLines = n.lines?.length || 0;
        if (nLines < pLines) {
          return { label: '已擦除视图图线', coalesceKey: null, showToast: true };
        }
        if (nLines > pLines) {
          return { label: '已绘制视图图线', coalesceKey: null, showToast: false };
        }
        if (!jsonEq(p.dimensions, n.dimensions)) {
          return { label: '修改尺寸标注', coalesceKey: 'sketch-dim', showToast: false };
        }
        return { label: '调整三视图草图', coalesceKey: null, showToast: false };
      }
      case 'circuit': {
        const p = prev as CircuitState;
        const n = next as CircuitState;
        const pWires = p.wires?.length || 0;
        const nWires = n.wires?.length || 0;
        if (nWires < pWires) {
          return { label: '已断开连接导线', coalesceKey: null, showToast: true };
        }
        if (nWires > pWires) {
          return { label: '已连接导线', coalesceKey: null, showToast: false };
        }
        if (Boolean(p.powered) !== Boolean(n.powered)) {
          return { label: n.powered ? '合上电源开关' : '断开电源开关', coalesceKey: null, showToast: false };
        }
        if (p.lightLevel !== n.lightLevel || p.tempC !== n.tempC) {
          return { label: '调节环境模拟参数', coalesceKey: 'circuit-env', showToast: false };
        }
        return { label: '调节电路器件状态', coalesceKey: null, showToast: false };
      }
      case 'structure': {
        const p = prev as StructureState;
        const n = next as StructureState;
        const pMembers = p.members?.length || 0;
        const nMembers = n.members?.length || 0;
        if (nMembers < pMembers) {
          return { label: '已拆除加固杆件', coalesceKey: null, showToast: true };
        }
        if (nMembers > pMembers) {
          return { label: '已加装结构杆件', coalesceKey: null, showToast: false };
        }
        if (p.jointType !== n.jointType) {
          return { label: '切换连接方式', coalesceKey: null, showToast: false };
        }
        if (p.supportBaseWidth !== n.supportBaseWidth) {
          return { label: '调整支承面宽度', coalesceKey: 'struct-base', showToast: false };
        }
        return { label: '调整结构与载荷参数', coalesceKey: 'struct-load', showToast: false };
      }
      case 'control': {
        const p = prev as ControlSystemState;
        const n = next as ControlSystemState;
        if (p.mode !== n.mode) {
          return {
            label: n.mode === 'closed' ? '切换为闭环控制' : '切换为开环控制',
            coalesceKey: null,
            showToast: false,
          };
        }
        if (Boolean(p.hasFeedbackEdge) !== Boolean(n.hasFeedbackEdge)) {
          return {
            label: n.hasFeedbackEdge ? '连接反馈通道' : '断开反馈通道',
            coalesceKey: null,
            showToast: false,
          };
        }
        return { label: '设置控制系统框图环节', coalesceKey: null, showToast: false };
      }
      case 'craft': {
        const p = prev as CraftProcessState;
        const n = next as CraftProcessState;
        if ((n.orderedSteps?.length || 0) < (p.orderedSteps?.length || 0)) {
          return { label: '已移除工序步骤', coalesceKey: null, showToast: true };
        }
        if (!jsonEq(p.orderedSteps, n.orderedSteps)) {
          return { label: '调整加工工序顺序', coalesceKey: null, showToast: false };
        }
        if (!jsonEq(p.selectedTools, n.selectedTools)) {
          return { label: '选配加工工量具', coalesceKey: null, showToast: false };
        }
        if (p.caliperReading !== n.caliperReading) {
          return { label: '修改卡尺读数', coalesceKey: 'craft-caliper', showToast: false };
        }
        return { label: '勾选安全操作规范', coalesceKey: null, showToast: false };
      }
      default:
        break;
    }
  } catch {
    // 描述失败不影响主流程
  }
  return { label: '编辑内容', coalesceKey: null, showToast: false };
}

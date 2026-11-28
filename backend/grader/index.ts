import type {
  Checkpoint,
  CheckpointResult,
  CircuitState,
  ControlSystemState,
  CraftProcessState,
  DatabaseState,
  ExcelState,
  FileState,
  GradeResult,
  PythonState,
  QuestionType,
  SimulatorState,
  Sketch3ViewState,
  SketchLine,
  StructureState,
  WebState,
  WordState,
} from '../types';
import {
  evaluateExcelSheet,
  expandRange,
  normalizeFormula,
} from '../utils/excelFormula';
import {
  areWirePinsConnected,
  evaluateCircuit,
  evaluateStructure,
} from '../../lib/gtEvaluators';
import { checkPythonSyntax, runPythonTestCases } from '../utils/pythonRunner';
import { runSqlInMemory } from '../utils/sqlRunner';

function normalizePath(p: string): string {
  return p
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .toLowerCase();
}

function normalizeColor(c?: string): string {
  return (c || '').trim().toLowerCase().replace(/\s+/g, '');
}

function findWordParagraph(state: WordState, params: Record<string, unknown>) {
  const paragraphs = state.paragraphs || [];
  if (typeof params.paragraphIndex === 'number') {
    return paragraphs[params.paragraphIndex] || null;
  }
  if (typeof params.containsText === 'string') {
    const target = params.containsText.trim();
    return paragraphs.find((p) => p.text.includes(target)) || null;
  }
  return paragraphs[0] || null;
}

function gradeWordCheckpoint(
  cp: Checkpoint,
  state: WordState
): CheckpointResult {
  const p = cp.params || {};
  let passed = false;
  let feedback = '';

  switch (cp.ruleType) {
    case 'word_paragraph_style': {
      const para = findWordParagraph(state, p);
      if (!para) {
        feedback = '未找到匹配的段落。';
        break;
      }
      const mismatches: string[] = [];
      if (p.fontFamily && para.fontFamily !== p.fontFamily) {
        mismatches.push(`字体应为「${p.fontFamily}」，当前为「${para.fontFamily}」`);
      }
      if (p.fontSize && Number(para.fontSize) !== Number(p.fontSize)) {
        mismatches.push(`字号应为 ${p.fontSize}pt，当前为 ${para.fontSize}pt`);
      }
      if (typeof p.bold === 'boolean' && para.bold !== p.bold) {
        mismatches.push(p.bold ? '未设置加粗' : '不应加粗');
      }
      if (typeof p.italic === 'boolean' && para.italic !== p.italic) {
        mismatches.push(p.italic ? '未设置斜体' : '不应斜体');
      }
      if (typeof p.underline === 'boolean' && para.underline !== p.underline) {
        mismatches.push(p.underline ? '未设置下划线' : '不应有下划线');
      }
      if (p.align && para.align !== p.align) {
        mismatches.push(`对齐方式应为「${p.align}」，当前为「${para.align}」`);
      }
      if (p.color && normalizeColor(para.color) !== normalizeColor(String(p.color))) {
        mismatches.push(`颜色应为 ${p.color}，当前为 ${para.color}`);
      }
      if (p.lineHeight && Math.abs(Number(para.lineHeight) - Number(p.lineHeight)) > 0.05) {
        mismatches.push(`行距应为 ${p.lineHeight} 倍，当前为 ${para.lineHeight} 倍`);
      }
      if (typeof p.indent === 'number' && Number(para.indent) !== p.indent) {
        mismatches.push(`首行缩进应为 ${p.indent} 字符，当前为 ${para.indent} 字符`);
      }
      if (p.listType && para.listType !== p.listType) {
        mismatches.push(`项目符号/编号类型应为「${p.listType}」`);
      }
      passed = mismatches.length === 0;
      feedback = passed ? '段落样式设置正确。' : mismatches.join('；');
      break;
    }

    case 'word_text_contains': {
      const target = String(p.text || '').trim();
      const paragraphs = state.paragraphs || [];
      if (typeof p.paragraphIndex === 'number') {
        const para = paragraphs[p.paragraphIndex];
        passed = Boolean(para && para.text.includes(target));
      } else {
        passed = paragraphs.some((para) => para.text.includes(target));
      }
      feedback = passed
        ? `已包含指定文本「${target}」。`
        : `文档中未检测到指定文本「${target}」。`;
      break;
    }

    case 'word_text_not_contains': {
      const forbidden = String(p.text || '').trim();
      const allText = (Array.isArray(state?.paragraphs) ? state.paragraphs : [])
        .map((x) => String(x?.text || ''))
        .join('\n');
      passed = !allText.includes(forbidden);
      feedback = passed
        ? `已成功替换/移除文本「${forbidden}」。`
        : `文档中仍残留「${forbidden}」，请检查替换操作。`;
      break;
    }

    case 'word_table_exists': {
      const tables = Array.isArray(state?.tables) ? state.tables : [];
      const minRows = Number(p.minRows || 1);
      const minCols = Number(p.minCols || 1);
      const matchedTable = tables.find(
        (t) =>
          Array.isArray(t?.rows) &&
          t.rows.length >= minRows &&
          (t.rows[0]?.length || 0) >= minCols
      );
      if (!matchedTable) {
        feedback = `未找到至少 ${minRows} 行 ${minCols} 列的表格。`;
        break;
      }
      const cellChecks = Array.isArray(p.cellChecks)
        ? (p.cellChecks as Array<{
            row: number;
            col: number;
            equals?: string;
            contains?: string;
          }>)
        : [];
      const cellErrors: string[] = [];
      for (const chk of cellChecks) {
        const val = matchedTable.rows[chk.row]?.[chk.col] ?? '';
        if (chk.equals !== undefined && val.trim() !== chk.equals.trim()) {
          cellErrors.push(
            `表格第 ${chk.row + 1} 行第 ${chk.col + 1} 列应为「${chk.equals}」`
          );
        }
        if (chk.contains !== undefined && !val.includes(chk.contains)) {
          cellErrors.push(
            `表格第 ${chk.row + 1} 行第 ${chk.col + 1} 列应包含「${chk.contains}」`
          );
        }
      }
      passed = cellErrors.length === 0;
      feedback = passed ? '表格结构与内容符合要求。' : cellErrors.join('；');
      break;
    }

    case 'word_image_exists': {
      const images = state.images || [];
      const minCount = Number(p.minCount || 1);
      if (images.length < minCount) {
        feedback = `文档中至少需要插入 ${minCount} 张图片，当前仅 ${images.length} 张。`;
        break;
      }
      if (p.requireAlt && images.some((img) => !img.alt || !img.alt.trim())) {
        feedback = '已插入图片，但缺少替代文本（alt 说明）。';
        break;
      }
      if (
        p.altContains &&
        !images.some((img) => (img.alt || '').includes(String(p.altContains)))
      ) {
        feedback = `图片说明应包含「${p.altContains}」。`;
        break;
      }
      passed = true;
      feedback = '图片插入符合要求。';
      break;
    }

    case 'word_header_footer': {
      const errs: string[] = [];
      if (
        p.headerContains &&
        !(state.headerText || '').includes(String(p.headerContains))
      ) {
        errs.push(`页眉应包含「${p.headerContains}」`);
      }
      if (
        p.footerContains &&
        !(state.footerText || '').includes(String(p.footerContains))
      ) {
        errs.push(`页脚应包含「${p.footerContains}」`);
      }
      passed = errs.length === 0;
      feedback = passed ? '页眉页脚设置正确。' : errs.join('；');
      break;
    }

    case 'word_page_setup': {
      const ps = state.pageSetup || {
        orientation: 'portrait',
        marginTop: 2.54,
        marginBottom: 2.54,
        marginLeft: 3.18,
        marginRight: 3.18,
      };
      const errs: string[] = [];
      if (p.orientation && ps.orientation !== p.orientation) {
        errs.push(`纸张方向应为「${p.orientation === 'landscape' ? '横向' : '纵向'}」`);
      }
      if (
        typeof p.marginTop === 'number' &&
        Math.abs(ps.marginTop - p.marginTop) > 0.1
      ) {
        errs.push(`上边距应为 ${p.marginTop}cm`);
      }
      if (
        typeof p.marginBottom === 'number' &&
        Math.abs(ps.marginBottom - p.marginBottom) > 0.1
      ) {
        errs.push(`下边距应为 ${p.marginBottom}cm`);
      }
      if (
        typeof p.marginLeft === 'number' &&
        Math.abs(ps.marginLeft - p.marginLeft) > 0.1
      ) {
        errs.push(`左边距应为 ${p.marginLeft}cm`);
      }
      if (
        typeof p.marginRight === 'number' &&
        Math.abs(ps.marginRight - p.marginRight) > 0.1
      ) {
        errs.push(`右边距应为 ${p.marginRight}cm`);
      }
      passed = errs.length === 0;
      feedback = passed ? '页面设置符合要求。' : errs.join('；');
      break;
    }

    default:
      feedback = `未知的 Word 判分规则: ${cp.ruleType}`;
  }

  return {
    checkpointId: cp.id,
    stepIndex: cp.stepIndex,
    description: cp.description,
    maxScore: cp.score,
    earnedScore: passed ? cp.score : 0,
    passed,
    feedback,
  };
}

function gradeExcelCheckpoint(
  cp: Checkpoint,
  state: ExcelState
): CheckpointResult {
  const p = cp.params || {};
  const cells = state.cells || {};
  const computed = evaluateExcelSheet(cells);
  let passed = false;
  let feedback = '';

  switch (cp.ruleType) {
    case 'excel_cell_formula': {
      const cellRef = String(p.cell || '').toUpperCase();
      const cell = cells[cellRef];
      const rawFormula = cell?.formula || cell?.value || '';
      const normActual = normalizeFormula(rawFormula);

      const candidates: string[] = [];
      if (typeof p.expectedFormula === 'string') {
        candidates.push(normalizeFormula(p.expectedFormula));
      }
      if (Array.isArray(p.alternateFormulas)) {
        for (const af of p.alternateFormulas) {
          candidates.push(normalizeFormula(String(af)));
        }
      }

      let formulaOk = true;
      if (candidates.length > 0) {
        formulaOk = candidates.includes(normActual);
      } else if (typeof p.expectedFormulaPrefix === 'string') {
        formulaOk = normActual.startsWith(
          normalizeFormula(p.expectedFormulaPrefix)
        );
      } else {
        formulaOk = normActual.startsWith('=');
      }

      let valueOk = true;
      const actualVal = computed[cellRef] ?? cell?.value ?? '';
      if (p.expectedValue !== undefined) {
        const tol = typeof p.tolerance === 'number' ? p.tolerance : 0.01;
        const numExp = Number(p.expectedValue);
        const numAct = Number(actualVal);
        if (Number.isFinite(numExp) && Number.isFinite(numAct)) {
          valueOk = Math.abs(numAct - numExp) <= tol;
        } else {
          valueOk = String(actualVal).trim() === String(p.expectedValue).trim();
        }
      }

      passed = formulaOk && valueOk;
      if (passed) {
        feedback = `单元格 ${cellRef} 公式（${rawFormula}）及计算结果（${actualVal}）正确。`;
      } else if (!formulaOk) {
        feedback = `单元格 ${cellRef} 未使用指定公式（当前为「${rawFormula || '空'}」）。`;
      } else {
        feedback = `单元格 ${cellRef} 计算结果不正确（当前为「${actualVal}」，期望「${p.expectedValue}」）。`;
      }
      break;
    }

    case 'excel_cell_value': {
      const cellRef = String(p.cell || '').toUpperCase();
      const actualVal = computed[cellRef] ?? cells[cellRef]?.value ?? '';
      const tol = typeof p.tolerance === 'number' ? p.tolerance : 0.01;
      const numExp = Number(p.expectedValue);
      const numAct = Number(actualVal);
      if (Number.isFinite(numExp) && Number.isFinite(numAct)) {
        passed = Math.abs(numAct - numExp) <= tol;
      } else {
        passed = String(actualVal).trim() === String(p.expectedValue).trim();
      }
      feedback = passed
        ? `单元格 ${cellRef} 数值正确。`
        : `单元格 ${cellRef} 值应为「${p.expectedValue}」，当前为「${actualVal || '空'}」。`;
      break;
    }

    case 'excel_cell_style': {
      const refs = expandRange(String(p.range || p.cell || 'A1'));
      const errs: string[] = [];
      for (const ref of refs) {
        const c = cells[ref] || { value: '' };
        if (typeof p.bold === 'boolean' && Boolean(c.bold) !== p.bold) {
          errs.push(`${ref} 加粗设置不符`);
          break;
        }
        if (typeof p.border === 'boolean' && Boolean(c.border) !== p.border) {
          errs.push(`${ref} 边框设置不符`);
          break;
        }
        if (p.align && c.align !== p.align) {
          errs.push(`${ref} 对齐方式应为 ${p.align}`);
          break;
        }
        if (p.fontFamily && c.fontFamily !== p.fontFamily) {
          errs.push(`${ref} 字体应为 ${p.fontFamily}`);
          break;
        }
        if (p.fontSize && Number(c.fontSize) !== Number(p.fontSize)) {
          errs.push(`${ref} 字号应为 ${p.fontSize}`);
          break;
        }
        if (p.bgColor && normalizeColor(c.bgColor) !== normalizeColor(String(p.bgColor))) {
          errs.push(`${ref} 填充色设置不符`);
          break;
        }
        if (p.color && normalizeColor(c.color) !== normalizeColor(String(p.color))) {
          errs.push(`${ref} 字体颜色设置不符`);
          break;
        }
        if (p.numberFormat && c.numberFormat !== p.numberFormat) {
          errs.push(`${ref} 数字格式应为 ${p.numberFormat}`);
          break;
        }
      }
      passed = errs.length === 0 && refs.length > 0;
      feedback = passed
        ? `区域 ${p.range || p.cell} 格式设置正确。`
        : errs.join('；');
      break;
    }

    case 'excel_merge_exists': {
      const target = String(p.range || '').toUpperCase().replace(/\$/g, '');
      const merges = (state.merges || []).map((m) =>
        m.toUpperCase().replace(/\$/g, '')
      );
      passed = merges.includes(target);
      feedback = passed
        ? `已正确合并单元格区域 ${target}。`
        : `未检测到合并区域 ${target}。`;
      break;
    }

    case 'excel_chart_exists': {
      const charts = state.charts || [];
      const found = charts.find((ch) => {
        if (p.chartType && ch.type !== p.chartType) return false;
        if (p.titleContains && !ch.title.includes(String(p.titleContains))) {
          return false;
        }
        if (
          p.dataRange &&
          ch.dataRange.toUpperCase() !== String(p.dataRange).toUpperCase()
        ) {
          return false;
        }
        return true;
      });
      passed = Boolean(found);
      feedback = passed
        ? '图表类型、标题及数据区域设置正确。'
        : '未找到符合要求的图表，请检查图表类型、标题或数据区域。';
      break;
    }

    case 'excel_sort_applied': {
      const col = String(p.column || '').toUpperCase();
      const order = p.order ? String(p.order) : undefined;
      passed = Boolean(
        state.sortInfo &&
          state.sortInfo.column.toUpperCase() === col &&
          (!order || state.sortInfo.order === order)
      );
      feedback = passed
        ? `已按 ${col} 列完成排序。`
        : `未检测到按 ${col} 列${order === 'desc' ? '降序' : order === 'asc' ? '升序' : ''}排序操作。`;
      break;
    }

    case 'excel_filter_applied': {
      const col = String(p.column || '').toUpperCase();
      const kw = String(p.keywordContains || '');
      passed = Boolean(
        state.filterInfo &&
          state.filterInfo.column.toUpperCase() === col &&
          (!kw || state.filterInfo.keyword.includes(kw))
      );
      feedback = passed
        ? `已按 ${col} 列完成筛选。`
        : `未检测到按 ${col} 列筛选${kw ? `「${kw}」` : ''}的操作。`;
      break;
    }

    default:
      feedback = `未知的 Excel 判分规则: ${cp.ruleType}`;
  }

  return {
    checkpointId: cp.id,
    stepIndex: cp.stepIndex,
    description: cp.description,
    maxScore: cp.score,
    earnedScore: passed ? cp.score : 0,
    passed,
    feedback,
  };
}

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(attrStr)) !== null) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function findHtmlTags(
  html: string,
  tagName: string
): Array<{ attrs: Record<string, string>; innerText: string; raw: string }> {
  const lowerTag = tagName.toLowerCase();
  const voidTags = new Set(['img', 'br', 'hr', 'input', 'meta', 'link']);
  const results: Array<{
    attrs: Record<string, string>;
    innerText: string;
    raw: string;
  }> = [];

  if (voidTags.has(lowerTag)) {
    const selfRegex = new RegExp(`<${lowerTag}\\b([^>]*)/?>`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = selfRegex.exec(html)) !== null) {
      results.push({
        attrs: parseAttributes(m[1] || ''),
        innerText: '',
        raw: m[0],
      });
    }
    return results;
  }

  const pairRegex = new RegExp(
    `<${lowerTag}\\b([^>]*)>([\\s\\S]*?)<\\/${lowerTag}>`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = pairRegex.exec(html)) !== null) {
    const inner = (m[2] || '').replace(/<[^>]+>/g, '').trim();
    results.push({
      attrs: parseAttributes(m[1] || ''),
      innerText: inner,
      raw: m[0],
    });
  }
  return results;
}

function extractCssDeclarations(
  cssText: string,
  selector: string
): Record<string, string> {
  const decls: Record<string, string> = {};
  const normTarget = selector.trim().toLowerCase().replace(/\s+/g, ' ');
  const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRegex.exec(cssText)) !== null) {
    const selectors = m[1]
      .split(',')
      .map((s) => s.trim().toLowerCase().replace(/\s+/g, ' '));
    if (selectors.includes(normTarget)) {
      const body = m[2];
      for (const line of body.split(';')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const prop = line.slice(0, colonIdx).trim().toLowerCase();
          const val = line.slice(colonIdx + 1).trim().toLowerCase();
          decls[prop] = val;
        }
      }
    }
  }
  return decls;
}

function gradeWebCheckpoint(
  cp: Checkpoint,
  state: WebState
): CheckpointResult {
  const p = cp.params || {};
  const files = Array.isArray(state?.files) ? state.files : [];
  let passed = false;
  let feedback = '';

  const getFile = (name?: unknown) => {
    if (typeof name === 'string') {
      return files.find(
        (f) =>
          f &&
          (f.path === name ||
            f.name === name ||
            String(f.path || '').endsWith(`/${name}`))
      );
    }
    return files.find((f) => f?.type === 'html') || files[0];
  };

  switch (cp.ruleType) {
    case 'web_file_exists': {
      const target = String(p.path || '').trim();
      passed = files.some(
        (f) => f.path === target || f.name === target
      );
      feedback = passed
        ? `文件 ${target} 存在。`
        : `未找到文件 ${target}。`;
      break;
    }

    case 'web_html_tag': {
      const htmlFile = getFile(p.file);
      if (!htmlFile) {
        feedback = '未找到 HTML 文件。';
        break;
      }
      const tag = String(p.tag || 'div');
      const matches = findHtmlTags(htmlFile.content, tag);
      const minCount = Number(p.minCount || 1);
      const reqAttrs = (p.attrs || {}) as Record<string, string | boolean>;
      const textContains = p.textContains ? String(p.textContains) : undefined;

      const qualified = matches.filter((m) => {
        if (textContains && !m.innerText.includes(textContains)) {
          return false;
        }
        for (const [k, v] of Object.entries(reqAttrs)) {
          const attrVal = m.attrs[k.toLowerCase()];
          if (v === true) {
            if (attrVal === undefined || attrVal.trim() === '') return false;
          } else if (typeof v === 'string') {
            if (!attrVal || !attrVal.toLowerCase().includes(v.toLowerCase())) {
              return false;
            }
          }
        }
        return true;
      });

      passed = qualified.length >= minCount;
      feedback = passed
        ? `<${tag}> 标签及其属性/内容符合要求。`
        : `未找到足够的符合条件的 <${tag}> 标签（需至少 ${minCount} 个，当前符合 ${qualified.length} 个）。`;
      break;
    }

    case 'web_css_rule': {
      const selector = String(p.selector || '');
      const prop = String(p.property || '').toLowerCase();
      let combinedCss = '';
      if (typeof p.file === 'string') {
        const f = getFile(p.file);
        combinedCss = f?.content || '';
      } else {
        for (const f of files) {
          if (f.type === 'css') {
            combinedCss += '\n' + f.content;
          } else if (f.type === 'html') {
            const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
            let sm: RegExpExecArray | null;
            while ((sm = styleRegex.exec(f.content)) !== null) {
              combinedCss += '\n' + sm[1];
            }
          }
        }
      }
      const decls = extractCssDeclarations(combinedCss, selector);
      const actualVal = decls[prop];
      if (!actualVal) {
        feedback = `未找到选择器「${selector}」的样式属性「${prop}」。`;
        break;
      }
      if (p.expectedValue !== undefined) {
        const normExp = String(p.expectedValue).trim().toLowerCase().replace(/\s+/g, '');
        const normAct = actualVal.replace(/\s+/g, '');
        passed = normAct === normExp || normAct.includes(normExp);
      } else if (p.valueContains !== undefined) {
        passed = actualVal.includes(String(p.valueContains).toLowerCase());
      } else {
        passed = true;
      }
      feedback = passed
        ? `CSS 选择器「${selector}」的 ${prop} 设置正确。`
        : `CSS 选择器「${selector}」的 ${prop} 当前值为「${actualVal}」，不符合要求。`;
      break;
    }

    case 'web_code_contains': {
      const targetFile = getFile(p.file);
      if (!targetFile) {
        feedback = `未找到文件 ${p.file}。`;
        break;
      }
      const pattern = String(p.pattern || '');
      if (p.isRegex) {
        passed = new RegExp(pattern, 'i').test(targetFile.content);
      } else {
        passed = targetFile.content.includes(pattern);
      }
      feedback = passed
        ? `代码内容符合要求。`
        : `文件 ${targetFile.name} 中未检测到预期代码片段「${pattern}」。`;
      break;
    }

    default:
      feedback = `未知的网页判分规则: ${cp.ruleType}`;
  }

  return {
    checkpointId: cp.id,
    stepIndex: cp.stepIndex,
    description: cp.description,
    maxScore: cp.score,
    earnedScore: passed ? cp.score : 0,
    passed,
    feedback,
  };
}

function gradeFileCheckpoint(
  cp: Checkpoint,
  state: FileState
): CheckpointResult {
  const p = cp.params || {};
  const items = Array.isArray(state?.items) ? state.items : [];
  const targetPath = normalizePath(String(p.path || ''));
  let passed = false;
  let feedback = '';

  switch (cp.ruleType) {
    case 'file_exists': {
      const found = items.find(
        (item) => item && normalizePath(String(item.path || '')) === targetPath
      );
      if (!found) {
        feedback = `路径「${p.path}」不存在。`;
        break;
      }
      const errs: string[] = [];
      if (p.itemType && found.type !== p.itemType) {
        errs.push(`类型应为 ${p.itemType}，当前为 ${found.type}`);
      }
      if (
        p.targetPath &&
        normalizePath(found.targetPath || '') !==
          normalizePath(String(p.targetPath))
      ) {
        errs.push(`快捷方式目标应指向 ${p.targetPath}`);
      }
      if (
        typeof p.readOnly === 'boolean' &&
        Boolean(found.readOnly) !== p.readOnly
      ) {
        errs.push(p.readOnly ? '未勾选“只读”属性' : '不应为“只读”属性');
      }
      if (typeof p.hidden === 'boolean' && Boolean(found.hidden) !== p.hidden) {
        errs.push(p.hidden ? '未勾选“隐藏”属性' : '不应为“隐藏”属性');
      }
      if (
        p.contentContains &&
        !(found.content || '').includes(String(p.contentContains))
      ) {
        errs.push(`文件内容应包含「${p.contentContains}」`);
      }
      passed = errs.length === 0;
      feedback = passed
        ? `文件/文件夹「${p.path}」验证通过。`
        : errs.join('；');
      break;
    }

    case 'file_not_exists': {
      const exists = items.some(
        (item) => normalizePath(item.path) === targetPath
      );
      passed = !exists;
      feedback = passed
        ? `「${p.path}」已成功移除或移动。`
        : `「${p.path}」仍然存在于原路径，请检查删除或移动操作。`;
      break;
    }

    default:
      feedback = `未知的文件管理判分规则: ${cp.ruleType}`;
  }

  return {
    checkpointId: cp.id,
    stepIndex: cp.stepIndex,
    description: cp.description,
    maxScore: cp.score,
    earnedScore: passed ? cp.score : 0,
    passed,
    feedback,
  };
}

function gradePythonCheckpoint(
  cp: Checkpoint,
  state: PythonState
): CheckpointResult {
  const p = cp.params || {};
  const code = String(state?.code || '');
  let passed = false;
  let feedback = '';

  switch (cp.ruleType) {
    case 'python_syntax_valid': {
      const check = checkPythonSyntax(code);
      passed = check.valid;
      feedback = passed
        ? 'Python 代码语法检查通过。'
        : check.error || 'Python 代码存在语法错误。';
      break;
    }

    case 'python_code_contains': {
      const pattern = String(p.pattern || '');
      const patterns = Array.isArray(p.patterns)
        ? p.patterns.map((x) => String(x))
        : pattern
          ? [pattern]
          : [];
      if (patterns.length === 0) {
        passed = code.trim().length > 0;
        feedback = passed ? '已编写代码内容。' : '尚未编写 Python 代码。';
        break;
      }
      if (p.isRegex) {
        passed = patterns.every((pat) => new RegExp(pat, 'm').test(code));
      } else if (p.matchAny) {
        passed = patterns.some((pat) => code.includes(pat));
      } else {
        passed = patterns.every((pat) => code.includes(pat));
      }
      feedback = passed
        ? '代码结构与关键语句符合题目要求。'
        : `代码中缺少必要的关键结构或语句（需包含：${patterns.join(p.matchAny ? ' 或 ' : '、')}）。`;
      break;
    }

    case 'python_test_cases': {
      const rawCases = Array.isArray(p.cases)
        ? (p.cases as Array<{
            stdin?: string;
            expectedOutput?: string;
            contains?: string;
          }>)
        : [];
      if (rawCases.length === 0) {
        feedback = '判分规则缺少测试用例配置。';
        break;
      }
      const suite = runPythonTestCases(code, rawCases);
      if (suite.blockedReason || suite.error) {
        passed = false;
        feedback = suite.blockedReason || suite.error || '测试运行失败。';
        break;
      }
      const passCount = suite.results.filter((r) => r.passed).length;
      passed = passCount === rawCases.length;
      if (passed) {
        feedback = `全部 ${rawCases.length} 组测试样例运行通过！`;
      } else {
        const firstFail = suite.results.find((r) => !r.passed);
        if (firstFail?.error) {
          feedback = `第 ${firstFail.index + 1} 组测试运行报错：${firstFail.error}`;
        } else if (firstFail) {
          const expStr =
            firstFail.expectedOutput !== undefined
              ? `，期望输出「${firstFail.expectedOutput}」`
              : '';
          feedback = `测试通过 ${passCount}/${rawCases.length} 组：第 ${firstFail.index + 1} 组实际输出「${firstFail.actualOutput || '(无输出)'}」${expStr}。`;
        } else {
          feedback = `仅通过 ${passCount}/${rawCases.length} 组测试样例。`;
        }
      }
      break;
    }

    default:
      feedback = `未知的 Python 判分规则: ${cp.ruleType}`;
  }

  return {
    checkpointId: cp.id,
    stepIndex: cp.stepIndex,
    description: cp.description,
    maxScore: cp.score,
    earnedScore: passed ? cp.score : 0,
    passed,
    feedback,
  };
}

function normalizeSqlCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));
  }
  return String(v).trim();
}

function gradeDatabaseCheckpoint(
  cp: Checkpoint,
  state: DatabaseState
): CheckpointResult {
  const p = cp.params || {};
  const sql = String(state?.sql || '');
  const tables = state?.tables || [];
  let passed = false;
  let feedback = '';

  switch (cp.ruleType) {
    case 'sql_code_contains': {
      const pattern = String(p.pattern || '');
      const patterns = Array.isArray(p.patterns)
        ? p.patterns.map((x) => String(x))
        : pattern
          ? [pattern]
          : [];
      const normSql = sql.toLowerCase();
      if (patterns.length === 0) {
        passed = normSql.trim().length > 0;
      } else if (p.isRegex) {
        passed = patterns.every((pat) => new RegExp(pat, 'i').test(sql));
      } else {
        passed = patterns.every((pat) => normSql.includes(pat.toLowerCase()));
      }
      feedback = passed
        ? 'SQL 语句关键字与结构符合要求。'
        : `SQL 语句缺少必要的关键字或条件（需包含：${patterns.join('、')}）。`;
      break;
    }

    case 'sql_query_result': {
      const execRes = runSqlInMemory(tables, sql);
      if (!execRes.ok) {
        feedback = execRes.error || 'SQL 执行失败。';
        break;
      }
      if (execRes.columns.length === 0) {
        feedback = '当前 SQL 未产生查询结果集，请确认末尾包含 SELECT 查询语句。';
        break;
      }
      const expectedCols = Array.isArray(p.expectedColumns)
        ? p.expectedColumns.map((c) => String(c).trim().toLowerCase())
        : null;
      const actualCols = execRes.columns.map((c) => c.trim().toLowerCase());
      if (expectedCols) {
        const colsOk =
          expectedCols.length === actualCols.length &&
          expectedCols.every((c, idx) => c === actualCols[idx]);
        if (!colsOk) {
          feedback = `查询结果列名为 [${execRes.columns.join(', ')}]，期望为 [${(p.expectedColumns as string[]).join(', ')}]。`;
          break;
        }
      }

      const expectedRows = Array.isArray(p.expectedRows)
        ? (p.expectedRows as Array<Array<string | number | null>>)
        : null;
      if (expectedRows) {
        const normExpected = expectedRows.map((r) =>
          (Array.isArray(r) ? r : [r]).map(normalizeSqlCell)
        );
        const normActual = (execRes.rows || []).map((r) =>
          (Array.isArray(r) ? r : [r]).map(normalizeSqlCell)
        );
        const ignoreOrder = Boolean(p.ignoreOrder);
        const rowKey = (r: string[]) => r.join('||');
        let rowsOk = normExpected.length === normActual.length;
        if (rowsOk) {
          if (ignoreOrder) {
            const setA = normActual.map(rowKey).sort();
            const setE = normExpected.map(rowKey).sort();
            rowsOk = setA.every((k, i) => k === setE[i]);
          } else {
            rowsOk = normActual.every((r, i) => rowKey(r) === rowKey(normExpected[i]));
          }
        }
        if (!rowsOk) {
          feedback = `查询返回 ${execRes.rows.length} 行数据，与期望结果（${expectedRows.length} 行）不完全一致，请检查筛选或排序条件。`;
          break;
        }
      } else if (typeof p.minRows === 'number' && execRes.rows.length < p.minRows) {
        feedback = `查询至少应返回 ${p.minRows} 行数据，当前仅 ${execRes.rows.length} 行。`;
        break;
      }

      passed = true;
      feedback = `SQL 查询执行正确，共返回 ${execRes.rows.length} 行匹配结果。`;
      break;
    }

    case 'sql_table_state': {
      const execRes = runSqlInMemory(tables, sql);
      if (!execRes.ok) {
        feedback = execRes.error || 'SQL 执行失败。';
        break;
      }
      const tableName = String(p.tableName || '').trim().toLowerCase();
      const targetTable = execRes.updatedTables.find(
        (t) => t.name.toLowerCase() === tableName
      );
      if (!targetTable) {
        feedback = `未找到目标数据表「${p.tableName}」。`;
        break;
      }
      if (typeof p.expectedRowCount === 'number' && targetTable.rows.length !== p.expectedRowCount) {
        feedback = `数据表「${targetTable.name}」当前有 ${targetTable.rows.length} 条记录，期望为 ${p.expectedRowCount} 条。`;
        break;
      }
      const rowChecks = Array.isArray(p.rowContains)
        ? (p.rowContains as Array<Array<string | number | null>>)
        : [];
      const rowKeys = new Set(
        (targetTable.rows || []).map((r) =>
          (Array.isArray(r) ? r : [r]).map(normalizeSqlCell).join('||')
        )
      );
      const missingRow = rowChecks.find(
        (rc) =>
          !rowKeys.has(
            (Array.isArray(rc) ? rc : [rc]).map(normalizeSqlCell).join('||')
          )
      );
      if (missingRow) {
        feedback = `数据表「${targetTable.name}」中未检测到目标记录 [${(Array.isArray(missingRow) ? missingRow : [missingRow]).join(', ')}]。`;
        break;
      }

      const notContains = Array.isArray(p.rowNotContains)
        ? (p.rowNotContains as Array<Array<string | number | null>>)
        : [];
      const stillPresent = notContains.find((rc) =>
        rowKeys.has(
          (Array.isArray(rc) ? rc : [rc]).map(normalizeSqlCell).join('||')
        )
      );
      if (stillPresent) {
        feedback = `数据表「${targetTable.name}」中仍存在应被删除或修改的记录 [${stillPresent.join(', ')}]。`;
        break;
      }

      passed = true;
      feedback = `数据表「${targetTable.name}」更新状态验证通过。`;
      break;
    }

    default:
      feedback = `未知的数据库判分规则: ${cp.ruleType}`;
  }

  return {
    checkpointId: cp.id,
    stepIndex: cp.stepIndex,
    description: cp.description,
    maxScore: cp.score,
    earnedScore: passed ? cp.score : 0,
    passed,
    feedback,
  };
}

function sameSketchSegment(a: SketchLine, b: SketchLine): boolean {
  if (a.view !== b.view) return false;
  const forward = a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;
  const reverse = a.x1 === b.x2 && a.y1 === b.y2 && a.x2 === b.x1 && a.y2 === b.y1;
  return forward || reverse;
}

const VIEW_CN: Record<string, string> = {
  front: '主视图',
  top: '俯视图',
  left: '左视图',
};

const LINE_STYLE_CN: Record<string, string> = {
  solid: '粗实线',
  dashed: '虚线',
  center: '点画线',
};

function gradeSketch3ViewCheckpoint(
  cp: Checkpoint,
  state: Sketch3ViewState
): CheckpointResult {
  const p = cp.params || {};
  const allLines: SketchLine[] = [
    ...(Array.isArray(state?.givenLines) ? state.givenLines : []),
    ...(Array.isArray(state?.lines) ? state.lines : []),
  ];
  let passed = false;
  let feedback = '';

  switch (cp.ruleType) {
    case 'sketch_line_exists': {
      const target: SketchLine = {
        view: (p.view as SketchLine['view']) || 'front',
        x1: Number(p.x1),
        y1: Number(p.y1),
        x2: Number(p.x2),
        y2: Number(p.y2),
        style: (p.style as SketchLine['style']) || 'solid',
      };
      const matched = allLines.find(
        (l) =>
          sameSketchSegment(l, target) &&
          (!p.style || l.style === target.style)
      );
      const wrongStyle = !matched
        ? allLines.find((l) => sameSketchSegment(l, target))
        : undefined;
      passed = Boolean(matched);
      if (passed) {
        feedback = `${VIEW_CN[target.view] || target.view} 线段 (${target.x1},${target.y1})-(${target.x2},${target.y2}) [${LINE_STYLE_CN[target.style] || target.style}] 绘制正确。`;
      } else if (wrongStyle) {
        feedback = `${VIEW_CN[target.view] || target.view} 线段位置正确，但线型应为「${LINE_STYLE_CN[target.style] || target.style}」（当前为「${LINE_STYLE_CN[wrongStyle.style] || wrongStyle.style}」）。`;
      } else {
        feedback = `${VIEW_CN[target.view] || target.view} 缺少目标线段 (${target.x1},${target.y1})-(${target.x2},${target.y2})。`;
      }
      break;
    }

    case 'sketch_line_not_exists': {
      const target: SketchLine = {
        view: (p.view as SketchLine['view']) || 'front',
        x1: Number(p.x1),
        y1: Number(p.y1),
        x2: Number(p.x2),
        y2: Number(p.y2),
        style: (p.style as SketchLine['style']) || 'solid',
      };
      const userLines = Array.isArray(state?.lines) ? state.lines : [];
      const found = userLines.some((l) => sameSketchSegment(l, target));
      passed = !found;
      feedback = passed
        ? '图面无多余错误线段。'
        : `${VIEW_CN[target.view] || target.view} 存在不应出现的线段 (${target.x1},${target.y1})-(${target.x2},${target.y2})，请擦除。`;
      break;
    }

    case 'sketch_dimension_match': {
      const dims = Array.isArray(state?.dimensions) ? state.dimensions : [];
      const view = String(p.view || 'front');
      const expected = String(p.expectedValue || '').trim();
      const label = p.label ? String(p.label).trim() : '';
      const found = dims.find(
        (d) =>
          d.view === view &&
          (!label || d.label.includes(label)) &&
          d.value.trim().replace(/mm$/i, '') === expected.replace(/mm$/i, '')
      );
      passed = Boolean(found);
      feedback = passed
        ? `${VIEW_CN[view] || view} 尺寸标注「${expected}」正确。`
        : `${VIEW_CN[view] || view} 尺寸标注未设为「${expected}」。`;
      break;
    }

    default:
      feedback = `未知的三视图判分规则: ${cp.ruleType}`;
  }

  return {
    checkpointId: cp.id,
    stepIndex: cp.stepIndex,
    description: cp.description,
    maxScore: cp.score,
    earnedScore: passed ? cp.score : 0,
    passed,
    feedback,
  };
}

function gradeCircuitCheckpoint(
  cp: Checkpoint,
  state: CircuitState
): CheckpointResult {
  const p = cp.params || {};
  let passed = false;
  let feedback = '';

  switch (cp.ruleType) {
    case 'circuit_wire_connected': {
      const fromPin = String(p.from || '');
      const toPin = String(p.to || '');
      passed = areWirePinsConnected(state, fromPin, toPin);
      feedback = passed
        ? `导线连接 ${fromPin} ↔ ${toPin} 正确。`
        : `未检测到 ${fromPin} 与 ${toPin} 之间的有效导线连接。`;
      break;
    }

    case 'circuit_component_value': {
      const compId = String(p.componentId || '');
      const comp = (state.components || []).find((c) => c.id === compId);
      if (!comp) {
        feedback = `未找到元件 ${compId}。`;
        break;
      }
      const errs: string[] = [];
      if (p.expectedValue !== undefined) {
        const act = String(comp.value || '').trim().toLowerCase();
        const exp = String(p.expectedValue).trim().toLowerCase();
        if (act !== exp && !act.includes(exp)) {
          errs.push(`${comp.label} 参数应包含/等于「${p.expectedValue}」，当前为「${comp.value || '未设置'}」`);
        }
      }
      if (typeof p.closed === 'boolean' && Boolean(comp.closed) !== p.closed) {
        errs.push(`${comp.label} 开关应处于「${p.closed ? '闭合' : '断开'}」状态`);
      }
      passed = errs.length === 0;
      feedback = passed ? `${comp.label} 参数设置正确。` : errs.join('；');
      break;
    }

    case 'circuit_sim_output': {
      const simState: CircuitState = {
        ...state,
        powered: p.testPowered !== undefined ? Boolean(p.testPowered) : true,
        lightLevel:
          typeof p.testLightLevel === 'number'
            ? p.testLightLevel
            : state.lightLevel ?? 50,
        tempC:
          typeof p.testTempC === 'number' ? p.testTempC : state.tempC ?? 25,
      };
      const evalRes = evaluateCircuit(simState);
      if (evalRes.shortCircuit) {
        passed = false;
        feedback = '检测到 VCC 与 GND 短路，请检查连线回路。';
        break;
      }
      const reqActive = Array.isArray(p.activeOutputIds)
        ? p.activeOutputIds.map((x) => String(x))
        : p.outputId
          ? [String(p.outputId)]
          : [];
      const shouldBeActive =
        p.expectActive !== undefined ? Boolean(p.expectActive) : true;

      if (reqActive.length === 0) {
        passed = shouldBeActive
          ? evalRes.activeComponentIds.length > 0
          : evalRes.activeComponentIds.length === 0;
      } else {
        passed = reqActive.every(
          (id) => Boolean(evalRes.activeOutputs[id]) === shouldBeActive
        );
      }
      feedback = passed
        ? `在测试工况下电路输出状态正确（${shouldBeActive ? '已触发动作' : '处于待机断开状态'}）。`
        : `在测试工况（光照 ${simState.lightLevel}% / 温度 ${simState.tempC}℃）下输出器件未按预期${shouldBeActive ? '导通工作' : '保持关闭'}。`;
      break;
    }

    default:
      feedback = `未知的电路仿真判分规则: ${cp.ruleType}`;
  }

  return {
    checkpointId: cp.id,
    stepIndex: cp.stepIndex,
    description: cp.description,
    maxScore: cp.score,
    earnedScore: passed ? cp.score : 0,
    passed,
    feedback,
  };
}

function gradeStructureCheckpoint(
  cp: Checkpoint,
  state: StructureState
): CheckpointResult {
  const p = cp.params || {};
  let passed = false;
  let feedback = '';

  const allMembers = [
    ...(Array.isArray(state?.baseMembers) ? state.baseMembers : []),
    ...(Array.isArray(state?.members) ? state.members : []),
  ];

  switch (cp.ruleType) {
    case 'structure_member_exists': {
      const from = String(p.from || '').trim();
      const to = String(p.to || '').trim();
      const matched = allMembers.find(
        (m) =>
          (m.from === from && m.to === to) || (m.from === to && m.to === from)
      );
      if (!matched) {
        feedback = `未连接节点 ${from} 与 ${to} 之间的支撑杆件。`;
        break;
      }
      if (p.material && matched.material !== p.material) {
        feedback = `杆件 ${from}-${to} 材料应为「${p.material}」，当前为「${matched.material}」。`;
        break;
      }
      passed = true;
      feedback = `支撑杆件 ${from}-${to} 设置正确。`;
      break;
    }

    case 'structure_joint_style': {
      const errs: string[] = [];
      if (p.jointType && state.jointType !== p.jointType) {
        errs.push(
          `连接方式应设为「${p.jointType === 'rigid' ? '刚连接' : '铰连接'}」`
        );
      }
      if (
        typeof p.minBaseWidth === 'number' &&
        Number(state.supportBaseWidth || 0) < p.minBaseWidth
      ) {
        errs.push(
          `底座支撑宽度应不小于 ${p.minBaseWidth}（当前为 ${state.supportBaseWidth}）`
        );
      }
      passed = errs.length === 0;
      feedback = passed ? '结构连接方式与支撑面尺寸符合要求。' : errs.join('；');
      break;
    }

    case 'structure_load_safe': {
      const res = evaluateStructure(state);
      const minTri = typeof p.minTriangles === 'number' ? p.minTriangles : 1;
      const minSF = typeof p.minSafetyFactor === 'number' ? p.minSafetyFactor : 1.0;
      const errs: string[] = [];
      if (res.triangleCount < minTri) {
        errs.push(`需至少构成 ${minTri} 个稳定三角形（当前 ${res.triangleCount} 个）`);
      }
      if (res.safetyFactor < minSF) {
        errs.push(`安全系数需达到 ${minSF}（当前 ${res.safetyFactor}）`);
      }
      if (!res.isStable) {
        errs.push('当前结构仍存在失稳或超载风险');
      }
      passed = errs.length === 0;
      feedback = passed
        ? `结构强度与稳定性测试通过（安全系数 ${res.safetyFactor}，形成 ${res.triangleCount} 个三角形）。`
        : errs.join('；');
      break;
    }

    default:
      feedback = `未知的结构力学判分规则: ${cp.ruleType}`;
  }

  return {
    checkpointId: cp.id,
    stepIndex: cp.stepIndex,
    description: cp.description,
    maxScore: cp.score,
    earnedScore: passed ? cp.score : 0,
    passed,
    feedback,
  };
}

const CONTROL_SLOT_CN: Record<string, string> = {
  input: '给定量（输入）',
  comparator: '比较器',
  controller: '控制器',
  actuator: '执行器',
  plant: '被控对象',
  sensor: '检测装置（反馈）',
  output: '被控量（输出）',
};

function gradeControlCheckpoint(
  cp: Checkpoint,
  state: ControlSystemState
): CheckpointResult {
  const p = cp.params || {};
  let passed = false;
  let feedback = '';

  switch (cp.ruleType) {
    case 'control_mode_match': {
      const exp = String(p.expectedMode || 'closed');
      passed = state.mode === exp;
      feedback = passed
        ? `控制类型已正确设为「${exp === 'closed' ? '闭环控制' : '开环控制'}」。`
        : `控制类型应选择「${exp === 'closed' ? '闭环控制' : '开环控制'}」。`;
      break;
    }

    case 'control_slot_match': {
      const slotKey = String(p.slot || 'controller') as keyof ControlSystemState['slots'];
      const actual = String(state.slots?.[slotKey] || '').trim();
      const slotName = CONTROL_SLOT_CN[slotKey] || slotKey;
      if (!actual) {
        feedback = `方框「${slotName}」尚未选择或填入具体器件/信号。`;
        break;
      }
      if (p.expectedValue !== undefined) {
        const exp = String(p.expectedValue).trim();
        passed = actual === exp || actual.includes(exp);
      } else if (Array.isArray(p.keywords)) {
        passed = p.keywords.every((k) => actual.includes(String(k)));
      } else {
        passed = true;
      }
      feedback = passed
        ? `方框「${slotName}」配置正确（${actual}）。`
        : `方框「${slotName}」当前为「${actual}」，期望为「${p.expectedValue || (Array.isArray(p.keywords) ? p.keywords.join('、') : '')}」。`;
      break;
    }

    case 'control_feedback_valid': {
      const requireFeedback =
        p.expectFeedback !== undefined ? Boolean(p.expectFeedback) : true;
      if (requireFeedback) {
        const hasEdge = Boolean(state.hasFeedbackEdge);
        const hasSensor = Boolean((state.slots?.sensor || '').trim());
        const isClosed = state.mode === 'closed';
        passed = hasEdge && hasSensor && isClosed;
        feedback = passed
          ? '闭环反馈通道及检测装置配置完整。'
          : '闭环控制系统需切换为闭环模式、连接反馈通道并配置检测装置（传感器）。';
      } else {
        passed = !state.hasFeedbackEdge && state.mode === 'open';
        feedback = passed
          ? '开环控制无反馈路径设置正确。'
          : '开环控制系统不应包含检测反馈回路。';
      }
      break;
    }

    default:
      feedback = `未知的控制系统判分规则: ${cp.ruleType}`;
  }

  return {
    checkpointId: cp.id,
    stepIndex: cp.stepIndex,
    description: cp.description,
    maxScore: cp.score,
    earnedScore: passed ? cp.score : 0,
    passed,
    feedback,
  };
}

function gradeCraftCheckpoint(
  cp: Checkpoint,
  state: CraftProcessState
): CheckpointResult {
  const p = cp.params || {};
  let passed = false;
  let feedback = '';

  switch (cp.ruleType) {
    case 'craft_order_before': {
      const order = Array.isArray(state?.orderedSteps) ? state.orderedSteps : [];
      if (Array.isArray(p.exactOrder)) {
        const exp = p.exactOrder.map((x) => String(x));
        passed =
          order.length >= exp.length &&
          exp.every((step, idx) => order[idx] === step);
        feedback = passed
          ? '加工工艺流程排序完全正确。'
          : `工艺流程排序尚未按规范排列（需依次为：${exp.join(' → ')}）。`;
        break;
      }
      const stepA = String(p.stepA || '');
      const stepB = String(p.stepB || '');
      const idxA = order.indexOf(stepA);
      const idxB = order.indexOf(stepB);
      if (idxA === -1 || idxB === -1) {
        feedback = `工序列表中尚未加入「${idxA === -1 ? stepA : stepB}」。`;
        break;
      }
      passed = idxA < idxB;
      feedback = passed
        ? `工艺顺序正确：「${stepA}」先于「${stepB}」。`
        : `工艺顺序有误：「${stepA}」应当排在「${stepB}」之前执行。`;
      break;
    }

    case 'craft_tool_match': {
      const stepName = String(p.step || '');
      const selected = String(state.selectedTools?.[stepName] || '').trim();
      const allowed = Array.isArray(p.allowedTools)
        ? p.allowedTools.map((x) => String(x))
        : p.expectedTool
          ? [String(p.expectedTool)]
          : [];
      passed = Boolean(selected && allowed.some((t) => selected === t || selected.includes(t)));
      feedback = passed
        ? `工序「${stepName}」工量具选配正确（${selected}）。`
        : `工序「${stepName}」应选用「${allowed.join(' 或 ')}」，当前为「${selected || '未选择'}」。`;
      break;
    }

    case 'craft_safety_checked': {
      const checked = new Set(state.safetyChecks || []);
      const req = Array.isArray(p.requiredChecks)
        ? p.requiredChecks.map((x) => String(x))
        : [];
      const forbidden = Array.isArray(p.forbiddenChecks)
        ? p.forbiddenChecks.map((x) => String(x))
        : [];
      const missing = req.filter((r) => !checked.has(r));
      const wrong = forbidden.filter((f) => checked.has(f));
      passed = missing.length === 0 && wrong.length === 0;
      if (passed) {
        feedback = '加工安全操作规范勾选全部正确。';
      } else {
        const msgs: string[] = [];
        if (missing.length > 0) msgs.push(`漏选必做安全规范：${missing.join('、')}`);
        if (wrong.length > 0) msgs.push(`误选违规操作项：${wrong.join('、')}`);
        feedback = msgs.join('；');
      }
      break;
    }

    case 'craft_reading_approx': {
      const raw = String(state.caliperReading || '').trim().replace(/mm$/i, '');
      const actual = Number(raw);
      const expected = Number(p.expectedReading);
      const tol = typeof p.tolerance === 'number' ? p.tolerance : 0.04;
      passed = raw !== '' && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
      feedback = passed
        ? `游标卡尺读数 ${actual.toFixed(2)} mm 正确。`
        : `游标卡尺读数有误（当前填入「${state.caliperReading || '空'}」，正确读数为 ${expected.toFixed(2)} mm）。`;
      break;
    }

    default:
      feedback = `未知的工艺与测量判分规则: ${cp.ruleType}`;
  }

  return {
    checkpointId: cp.id,
    stepIndex: cp.stepIndex,
    description: cp.description,
    maxScore: cp.score,
    earnedScore: passed ? cp.score : 0,
    passed,
    feedback,
  };
}

export function gradeAnswerDeterministic(
  type: QuestionType,
  checkpoints: Checkpoint[],
  answer: SimulatorState
): GradeResult {
  const results: CheckpointResult[] = [];
  let totalEarned = 0;
  let totalMax = 0;

  for (const cp of checkpoints) {
    totalMax += cp.score;
    let res: CheckpointResult;
    if (type === 'word') {
      res = gradeWordCheckpoint(cp, answer as WordState);
    } else if (type === 'excel') {
      res = gradeExcelCheckpoint(cp, answer as ExcelState);
    } else if (type === 'web') {
      res = gradeWebCheckpoint(cp, answer as WebState);
    } else if (type === 'python') {
      res = gradePythonCheckpoint(cp, answer as PythonState);
    } else if (type === 'database') {
      res = gradeDatabaseCheckpoint(cp, answer as DatabaseState);
    } else if (type === 'sketch3view') {
      res = gradeSketch3ViewCheckpoint(cp, answer as Sketch3ViewState);
    } else if (type === 'circuit') {
      res = gradeCircuitCheckpoint(cp, answer as CircuitState);
    } else if (type === 'structure') {
      res = gradeStructureCheckpoint(cp, answer as StructureState);
    } else if (type === 'control') {
      res = gradeControlCheckpoint(cp, answer as ControlSystemState);
    } else if (type === 'craft') {
      res = gradeCraftCheckpoint(cp, answer as CraftProcessState);
    } else {
      res = gradeFileCheckpoint(cp, answer as FileState);
    }
    totalEarned += res.earnedScore;
    results.push(res);
  }

  return {
    autoScore: totalEarned,
    maxScore: totalMax,
    checkpointResults: results,
    gradedByAi: false,
  };
}

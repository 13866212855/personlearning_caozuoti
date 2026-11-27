import type {
  Checkpoint,
  CheckpointResult,
  DatabaseState,
  ExcelState,
  FileState,
  GradeResult,
  PythonState,
  QuestionType,
  SimulatorState,
  WebState,
  WordState,
} from '../types';
import {
  evaluateExcelSheet,
  expandRange,
  normalizeFormula,
} from '../utils/excelFormula';
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
      const allText = (state.paragraphs || []).map((x) => x.text).join('\n');
      passed = !allText.includes(forbidden);
      feedback = passed
        ? `已成功替换/移除文本「${forbidden}」。`
        : `文档中仍残留「${forbidden}」，请检查替换操作。`;
      break;
    }

    case 'word_table_exists': {
      const tables = state.tables || [];
      const minRows = Number(p.minRows || 1);
      const minCols = Number(p.minCols || 1);
      const matchedTable = tables.find(
        (t) =>
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
  const files = state.files || [];
  let passed = false;
  let feedback = '';

  const getFile = (name?: unknown) => {
    if (typeof name === 'string') {
      return files.find(
        (f) => f.path === name || f.name === name || f.path.endsWith(`/${name}`)
      );
    }
    return files.find((f) => f.type === 'html') || files[0];
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
  const items = state.items || [];
  const targetPath = normalizePath(String(p.path || ''));
  let passed = false;
  let feedback = '';

  switch (cp.ruleType) {
    case 'file_exists': {
      const found = items.find((item) => normalizePath(item.path) === targetPath);
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
        const normExpected = expectedRows.map((r) => r.map(normalizeSqlCell));
        const normActual = execRes.rows.map((r) => r.map(normalizeSqlCell));
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
        targetTable.rows.map((r) => r.map(normalizeSqlCell).join('||'))
      );
      const missingRow = rowChecks.find(
        (rc) => !rowKeys.has(rc.map(normalizeSqlCell).join('||'))
      );
      if (missingRow) {
        feedback = `数据表「${targetTable.name}」中未检测到目标记录 [${missingRow.join(', ')}]。`;
        break;
      }

      const notContains = Array.isArray(p.rowNotContains)
        ? (p.rowNotContains as Array<Array<string | number | null>>)
        : [];
      const stillPresent = notContains.find((rc) =>
        rowKeys.has(rc.map(normalizeSqlCell).join('||'))
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

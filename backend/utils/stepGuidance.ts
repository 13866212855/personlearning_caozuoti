import type {
  Checkpoint,
  CheckpointResult,
  QuestionStep,
  QuestionType,
} from '../types';

export interface StepGuidanceResult {
  stepIndex: number;
  passed: boolean;
  earnedScore: number;
  maxScore: number;
  feedback: string;
  concreteSteps: string[];
  pitfallTip: string;
  demoTopic: string;
  demoLabel: string;
}

const ALIGN_CN: Record<string, string> = {
  left: '左对齐',
  center: '居中对齐',
  right: '右对齐',
  justify: '两端对齐',
};

const LIST_CN: Record<string, string> = {
  bullet: '项目符号',
  number: '编号列表',
  none: '取消列表',
};

const EXCEL_NUM_FMT_CN: Record<string, string> = {
  general: '常规',
  number2: '数值 (2位小数)',
  percent: '百分比 (%)',
  currency: '货币 (¥)',
};

const CHART_TYPE_CN: Record<string, string> = {
  column: '柱形图',
  line: '折线图',
  pie: '饼图',
};

function buildGuidanceForCheckpoint(
  qType: QuestionType,
  cp: Checkpoint
): {
  concreteSteps: string[];
  pitfallTip: string;
  demoTopic: string;
  demoLabel: string;
} {
  const p = cp.params || {};

  if (qType === 'word') {
    switch (cp.ruleType) {
      case 'word_paragraph_style': {
        const targetDesc =
          typeof p.paragraphIndex === 'number'
            ? `第 ${p.paragraphIndex + 1} 段`
            : typeof p.containsText === 'string'
              ? `包含“${p.containsText}”的那一段`
              : '目标段落';
        const actions: string[] = [];
        if (p.fontFamily) actions.push(`「字体」下拉框选“${p.fontFamily}”`);
        if (p.fontSize) actions.push(`「字号」下拉框选“${p.fontSize}pt”`);
        if (p.color) actions.push(`「字体颜色」选对应颜色（${p.color}）`);
        if (p.bold === true) actions.push('点击「B」加粗按钮（变蓝即生效）');
        if (p.italic === true) actions.push('点击「I」斜体按钮');
        if (p.underline === true) actions.push('点击「U」下划线按钮');
        if (p.align) {
          actions.push(`点击「${ALIGN_CN[String(p.align)] || p.align}」对齐按钮`);
        }
        if (p.lineHeight) actions.push(`「行距」下拉框选“行距 ${p.lineHeight}”`);
        if (typeof p.indent === 'number' && p.indent > 0) {
          actions.push('点击工具栏的「缩进2字符」按钮');
        }
        if (p.listType && p.listType !== 'none') {
          actions.push(
            `点击「${LIST_CN[String(p.listType)] || p.listType}」按钮`
          );
        }

        return {
          concreteSteps: [
            `在右侧白色文档区，用鼠标点击${targetDesc}的文字（段落四周会出现蓝色虚线框，表示已选中）。`,
            actions.length > 0
              ? `保持选中状态，在上方工具栏依次设置：${actions.join('；')}。`
              : '在上方工具栏调整该段落的字体、字号、对齐或行距设置。',
            '设置后右侧文档文字会立即变化，请核对字体、字号和对齐是否和题目完全一致。',
          ],
          pitfallTip:
            '很多同学直接点工具栏却没生效，是因为光标没有先点中需要修改的那一段！请务必先看到目标段落周围出现蓝色选中框。',
          demoTopic: 'word_paragraph_style',
          demoLabel: 'Word 段落格式设置演示',
        };
      }

      case 'word_text_not_contains': {
        const oldWord = String(p.text || '旧词');
        return {
          concreteSteps: [
            '点击右侧 Word 工具栏靠后的「查找替换」按钮，上方会展开蓝底替换栏。',
            `在第一个框“查找内容”中输入「${oldWord}」（注意不要多打空格）。`,
            '在第二个框“替换为”中输入题目要求的新词，然后点击蓝色的「全部替换」按钮。',
          ],
          pitfallTip:
            '一定要点击「全部替换」按钮，确保文档中所有位置都替换干净，且不要前后多输空格。',
          demoTopic: 'word_find_replace',
          demoLabel: 'Word 查找与全部替换演示',
        };
      }

      case 'word_text_contains': {
        const target = String(p.text || '');
        const paraLabel =
          typeof p.paragraphIndex === 'number'
            ? `第 ${p.paragraphIndex + 1} 段`
            : '对应段落';
        return {
          concreteSteps: [
            `在右侧文档中找到${paraLabel}，用鼠标点进文字输入框中。`,
            target
              ? `准确输入或修改文字，确保包含「${target}」。`
              : '按题目要求补充或修改文本内容。',
            '如题目要求添加新段，可点击工具栏「新增段落」按钮后再输入文字。',
          ],
          pitfallTip: '注意核对文字标点与字词不要有错别字或多余空格。',
          demoTopic: 'word_edit_text',
          demoLabel: 'Word 段落文本编辑演示',
        };
      }

      case 'word_table_exists': {
        const rows = Number(p.minRows || 3);
        const cols = Number(p.minCols || 2);
        return {
          concreteSteps: [
            '点击上方工具栏的「插入表格」按钮，打开行列设置弹窗。',
            `将“行数”设为 ${rows}、“列数”设为 ${cols}（注意行和列不要填反），点击「确定插入」。`,
            '在文档下方新出现的表格中，用鼠标依次点击每个格子，输入题目要求的表头和数据。',
          ],
          pitfallTip:
            '“几行几列”最容易填反！横着数是一行（比如 3 行就是上下 3 排），竖着数是一列（2 列就是左右 2 格）。',
          demoTopic: 'word_table',
          demoLabel: 'Word 插入与填写表格演示',
        };
      }

      case 'word_image_exists':
        return {
          concreteSteps: [
            '点击上方工具栏的「插入图片」按钮，打开图片素材弹窗。',
            '选择题目配套的本地图片素材。',
            '按要求填写“替代文本（alt 说明）”并确认图片宽度，点击「插入图片」。',
          ],
          pitfallTip:
            '如果题目要求填写图片说明/替代文本，一定要在弹窗里的“图片说明(alt)”输入框填上对应关键词。',
          demoTopic: 'word_image',
          demoLabel: 'Word 插入图片与设置说明演示',
        };

      case 'word_header_footer':
        return {
          concreteSteps: [
            p.headerContains
              ? `滚动到右侧白色模拟纸张的最顶部，点击虚线框“点击此处编辑页眉...”，输入「${p.headerContains}」。`
              : '滚动到右侧白色模拟纸张的最底部，点击页脚输入框并输入要求文字。',
            p.footerContains
              ? `在页面最底部的页脚虚线输入框中，输入「${p.footerContains}」。`
              : '输入完成后点击页面空白处即可自动保存。',
          ],
          pitfallTip:
            '页眉在白色纸张的最上方虚线区域，页脚在最下方虚线区域，不要误写到正文段落里。',
          demoTopic: 'word_header_footer',
          demoLabel: 'Word 页眉与页脚设置演示',
        };

      case 'word_page_setup':
        return {
          concreteSteps: [
            '点击上方工具栏最右侧的「页面设置」按钮。',
            `在弹窗中设置纸张方向（${p.orientation === 'landscape' ? '横向' : '纵向'}）以及上、下、左、右页边距数值（单位 cm）。`,
            '点击弹窗右下角「应用设置」保存。',
          ],
          pitfallTip: '页边距只需输入数字即可，不需要自己输入“cm”单位字母。',
          demoTopic: 'word_page_setup',
          demoLabel: 'Word 页面设置演示',
        };
    }
  }

  if (qType === 'excel') {
    switch (cp.ruleType) {
      case 'excel_cell_formula': {
        const cellRef = String(p.cell || 'D2').toUpperCase();
        const hintFormula = String(
          p.expectedFormula || p.expectedFormulaPrefix || '=SUM(...)'
        );
        return {
          concreteSteps: [
            `在右侧表格中用鼠标单击单元格 ${cellRef}（确认左上角选区框显示为 ${cellRef}）。`,
            `点击表格上方的「fx」公式输入框（或直接输入），必须以英文等号「=」开头输入公式（如：${hintFormula}）。`,
            '输入完成后按键盘上的「Enter 回车键」确认，单元格会自动算出结果。',
          ],
          pitfallTip:
            'Excel 公式最常出错的原因：① 忘记写开头的等号 =；② 在中文输入法下打了中文括号（）或中文冒号：，请切换英文输入法！',
          demoTopic: 'excel_formula',
          demoLabel: 'Excel 公式与函数输入演示',
        };
      }

      case 'excel_cell_value': {
        const cellRef = String(p.cell || 'A1').toUpperCase();
        return {
          concreteSteps: [
            `用鼠标单击单元格 ${cellRef}，确认左上角选区框显示 ${cellRef}。`,
            `在「fx」输入栏或单元格中直接输入「${p.expectedValue ?? ''}」。`,
            '按键盘「Enter」键确认。',
          ],
          pitfallTip: '输入文字或数字时注意不要带多余空格。',
          demoTopic: 'excel_value',
          demoLabel: 'Excel 单元格输入演示',
        };
      }

      case 'excel_cell_style': {
        const range = String(p.range || p.cell || 'A1');
        const actions: string[] = [];
        if (p.bold === true) actions.push('点击「B」加粗按钮');
        if (p.align) {
          actions.push(`点击「${ALIGN_CN[String(p.align)] || p.align}」对齐按钮`);
        }
        if (p.border === true) actions.push('点击「边框」按钮加上框线');
        if (p.bgColor) actions.push(`「填充色」下拉框选择对应背景色（${p.bgColor}）`);
        if (p.numberFormat) {
          actions.push(
            `「数字格式」下拉框选择「${EXCEL_NUM_FMT_CN[String(p.numberFormat)] || p.numberFormat}」`
          );
        }
        return {
          concreteSteps: [
            `用鼠标按住拖动选中区域 ${range}（更快的方法：直接点击左上角选区框，输入 ${range}）。`,
            actions.length > 0
              ? `保持选区高亮，在上方工具栏点击：${actions.join('；')}。`
              : '保持选区高亮，点击上方工具栏设置对应的字体、填充色、对齐、边框或数字格式。',
          ],
          pitfallTip:
            '如果需要选中一大片区域（如 A1:F10），直接在左上角选区框手动输入区域范围往往比鼠标拖动更不容易漏选。',
          demoTopic: 'excel_style',
          demoLabel: 'Excel 区域选择与格式设置演示',
        };
      }

      case 'excel_merge_exists': {
        const range = String(p.range || 'A1:E1').toUpperCase();
        return {
          concreteSteps: [
            `选中要合并的单元格区域 ${range}：可在表格上拖动，或直接在左上角选区输入框里输入「${range}」。`,
            '点击上方工具栏中的「合并/取消」按钮，多个单元格即会合并为一格。',
          ],
          pitfallTip:
            '只点一个单元格时“合并”不会生效！必须选中至少 2 个相邻单元格（选区框里带冒号，如 A1:E1）再点「合并/取消」。',
          demoTopic: 'excel_merge',
          demoLabel: 'Excel 合并单元格演示',
        };
      }

      case 'excel_chart_exists': {
        const chartName = CHART_TYPE_CN[String(p.chartType || 'column')] || '统计图';
        return {
          concreteSteps: [
            '点击上方工具栏最右侧的「插入图表」按钮，打开图表配置弹窗。',
            `选择图表类型为「${chartName}」，并按要求填写“图表标题”${p.titleContains ? `（需包含「${p.titleContains}」）` : ''}。`,
            `准确填写“分类标签区域”（如 A2:A5）和“数据区域”（如 ${p.dataRange || 'D2:D5'}），点击「生成图表」。`,
          ],
          pitfallTip:
            '分类标签区域（横轴名称）和数据区域（纵轴数值）的行数必须一致，且区间冒号要用英文冒号。',
          demoTopic: 'excel_chart',
          demoLabel: 'Excel 插入统计图表演示',
        };
      }

      case 'excel_sort_applied': {
        const col = String(p.column || 'D').toUpperCase();
        const dir = p.order === 'desc' ? '降序' : '升序';
        return {
          concreteSteps: [
            `先用鼠标单击要排序的那一列（${col} 列）中的任意一个数据单元格（例如 ${col}3）。`,
            `然后点击上方工具栏的「${dir}」按钮，表格数据就会按 ${col} 列${dir}重新排列。`,
          ],
          pitfallTip:
            '很多同学直接点「升序/降序」却排错了列，因为光标还停留在 A1！请一定先点中你要按哪一列排序的单元格（如 D3）。',
          demoTopic: 'excel_sort',
          demoLabel: 'Excel 数据排序演示',
        };
      }

      case 'excel_filter_applied': {
        const col = String(p.column || 'B').toUpperCase();
        return {
          concreteSteps: [
            `先单击需要筛选的列（${col} 列）中的任意一个单元格（如 ${col}2）。`,
            '点击工具栏的「筛选」按钮，打开筛选弹窗。',
            `输入筛选关键词${p.keywordContains ? `「${p.keywordContains}」` : ''}，点击「应用筛选」。`,
          ],
          pitfallTip: '先选定目标列里的单元格，再点「筛选」，否则筛选会作用到错误的列。',
          demoTopic: 'excel_filter',
          demoLabel: 'Excel 条件筛选演示',
        };
      }
    }
  }

  if (qType === 'web') {
    switch (cp.ruleType) {
      case 'web_file_exists': {
        const fileName = String(p.path || 'style.css');
        return {
          concreteSteps: [
            '在左侧或顶部的网页文件标签栏，点击「+ 新建文件」按钮。',
            `输入完整文件名「${fileName}」（包含扩展名如 .css 或 .html），点击「创建」。`,
          ],
          pitfallTip: '文件名必须连同扩展名（如 .css）一起写对，不能遗漏后缀。',
          demoTopic: 'web_file',
          demoLabel: '网页制作：新建文件演示',
        };
      }

      case 'web_css_rule': {
        const selector = String(p.selector || 'h1');
        const prop = String(p.property || 'color');
        const expected = String(
          p.expectedValue ?? p.valueContains ?? '属性值'
        );
        return {
          concreteSteps: [
            p.file
              ? `点击顶部文件标签切换到「${p.file}」。`
              : '点击顶部文件标签切换到 CSS 文件（或 HTML 文件中的 <style>...</style> 区域）。',
            `在代码编辑区按规范写出 CSS 规则：${selector} { ${prop}: ${expected}; }`,
            '观察右侧「实时页面预览」，确认样式变化已生效。',
          ],
          pitfallTip:
            'CSS 代码中大括号 { }、冒号 : 和结尾分号 ; 都必须使用英文半角符号，属性名不能拼写错误。',
          demoTopic: 'web_css',
          demoLabel: '网页制作：编写 CSS 样式演示',
        };
      }

      default: {
        const tag = String(p.tag || '');
        return {
          concreteSteps: [
            `在文件标签栏选中目标文件（通常为 ${String(p.file || 'index.html')}）。`,
            tag
              ? `可直接点击工具栏快捷代码按钮（如 + ${tag}）插入模板，再将标签内的文字、属性（如 src/href/alt）改成题目要求。`
              : '在代码编辑区 <body>...</body> 内补充或修改对应的 HTML 标签与属性。',
            '查看右侧「实时页面预览」区，确认网页排版和内容无误。',
          ],
          pitfallTip:
            'HTML 标签要成对闭合（如 <h1>...</h1>），属性值请用英文双引号 "..." 包裹。',
          demoTopic: 'web_html',
          demoLabel: '网页制作：编写 HTML 标签演示',
        };
      }
    }
  }

  if (qType === 'python') {
    switch (cp.ruleType) {
      case 'python_syntax_valid':
        return {
          concreteSteps: [
            '检查左侧代码编辑区中每一行的英文冒号（if / for / while / def 末尾都需要冒号 :）。',
            '检查同一代码块下的缩进是否对齐（统一使用 4 个空格，不要混用 Tab 和空格）。',
            '确认所有括号 ()、引号 "" 和逗号都是英文半角符号，点击「运行代码」确认没有红色报错。',
          ],
          pitfallTip:
            'Python 最容易报 SyntaxError 或 IndentationError：忘记写行尾冒号、中文括号或缩进不对齐！',
          demoTopic: 'python_io',
          demoLabel: 'Python 语法与输入输出演示',
        };

      case 'python_code_contains': {
        const pats = Array.isArray(p.patterns)
          ? p.patterns.join('、')
          : String(p.pattern || '关键语句');
        const isFuncOrList = /def |append|\[|sum\(|len\(/.test(pats);
        return {
          concreteSteps: [
            `按题目要求在代码编辑器中正确写出关键语句或结构（需包含：${pats}）。`,
            '可以点击编辑区上方工具栏的快捷模板按钮（如 input / for / if / def）快速生成语法框架，再修改变量和条件。',
            '编写完成后先点「运行代码」观察右侧输出区是否符合预期。',
          ],
          pitfallTip:
            '使用 input() 读入整数或小数做计算时，一定要用 int(input()) 或 float(input()) 进行类型转换，否则字符串无法直接做数学运算。',
          demoTopic: isFuncOrList ? 'python_func_list' : 'python_branch_loop',
          demoLabel: isFuncOrList
            ? 'Python 列表与自定义函数演示'
            : 'Python 分支与循环结构演示',
        };
      }

      default:
        return {
          concreteSteps: [
            '仔细核对题目给出的输入格式与输出格式（注意是否有多余提示文字，例如 input() 内不要随便放多余提示语）。',
            '在右侧「自定义输入 (stdin)」框填入题目测试数据，点击「运行代码」，对比实际输出与题目要求是否完全一致。',
            '确认边界情况（如 0、负数、相等条件）也都能算出正确结果。',
          ],
          pitfallTip:
            '自动判分时会直接比较程序 print() 输出的内容！写 input() 时括号里保持为空（即 input()），不要写 input("请输入：")，否则会把提示语一起输出导致比对失败。',
          demoTopic: 'python_branch_loop',
          demoLabel: 'Python 程序运行调试与判分演示',
        };
    }
  }

  if (qType === 'database') {
    switch (cp.ruleType) {
      case 'sql_code_contains': {
        const pats = Array.isArray(p.patterns)
          ? p.patterns.join('、')
          : String(p.pattern || 'SQL 关键字');
        const isDml = /insert|update|delete/i.test(pats);
        const isAgg = /count|avg|sum|max|min|group by/i.test(pats);
        return {
          concreteSteps: [
            '先在左侧「数据表结构预览」查看数据表名称和每一列的准确字段名（注意大小写和拼写）。',
            `在右侧 SQL 编辑区写出符合规范的 SQL 语句（需包含：${pats}），也可点击工具栏常用 SQL 模板快捷插入。`,
            '点击「执行 SQL」按钮，确认下方结果预览不报语法错误。',
          ],
          pitfallTip:
            'SQL 中的字符串条件必须使用英文单引号（例如 WHERE class_name = \'高一(1)班\'），不能用中文引号。',
          demoTopic: isDml ? 'sql_dml' : isAgg ? 'sql_aggregate' : 'sql_select',
          demoLabel: isDml
            ? 'SQL 增删改操作演示'
            : isAgg
              ? 'SQL 聚合与分组统计演示'
              : 'SQL SELECT 查询与排序演示',
        };
      }

      case 'sql_table_state':
        return {
          concreteSteps: [
            '在左侧查看目标表的现有字段顺序与当前记录内容。',
            '按题目要求编写 INSERT / UPDATE / DELETE 语句（修改或删除前务必加上准确的 WHERE 条件！）。',
            '点击「执行 SQL」，然后切换到左侧对应数据表确认记录条数和字段值已按要求变化。',
          ],
          pitfallTip:
            '执行 UPDATE 或 DELETE 时如果漏掉 WHERE 条件，会导致整张表所有数据都被修改或清空！',
          demoTopic: 'sql_dml',
          demoLabel: 'SQL 数据插入、更新与删除演示',
        };

      default:
        return {
          concreteSteps: [
            '检查 SELECT 后指定的列名顺序是否与题目要求一致（如果是统计题，注意使用 COUNT / AVG / SUM / MAX / MIN 函数）。',
            '核对 FROM 表名、WHERE 筛选条件以及 ORDER BY 排序方向（ASC 升序 / DESC 降序）。',
            '点击「执行 SQL」，核对下方「查询结果预览」表格中的列名与每一行数据是否正确。',
          ],
          pitfallTip:
            '多条语句时系统只取最后一条 SELECT 的结果进行展示与判分，请确保最后的 SELECT 查询输出了题目要求的列。',
          demoTopic: 'sql_select',
          demoLabel: 'SQL 查询与结果验证演示',
        };
    }
  }

  // File management
  if (cp.ruleType === 'file_exists') {
    if (p.itemType === 'shortcut') {
      return {
        concreteSteps: [
          '在右侧文件列表中，单击选中需要创建快捷方式的源文件（变成蓝色高亮）。',
          '点击上方工具栏的「创建快捷方式」按钮。',
          `若题目要求放在指定目录或特定名称（${String(p.path || '')}），可使用「剪切」→ 切换到目标文件夹 →「粘贴」，再点「重命名」。`,
        ],
        pitfallTip: '快捷方式文件通常以 .lnk 结尾，创建后注意核对它所在的目标文件夹路径是否正确。',
        demoTopic: 'file_shortcut',
        demoLabel: '文件管理：创建快捷方式演示',
      };
    }

    if (typeof p.readOnly === 'boolean' || typeof p.hidden === 'boolean') {
      const attrs: string[] = [];
      if (p.readOnly) attrs.push('勾选“只读”');
      if (p.hidden) attrs.push('勾选“隐藏”');
      return {
        concreteSteps: [
          `在左侧「目录导航」打开文件所在文件夹，单击选中目标文件（${String(p.path || '')}）。`,
          '点击上方工具栏的「属性」按钮。',
          `在弹窗中${attrs.join('、') || '调整只读/隐藏属性'}，点击「保存属性」。`,
        ],
        pitfallTip:
          '设置“隐藏”属性后，如果取消勾选地址栏右侧的“显示隐藏项目”，文件就会看不见，这是正常现象。',
        demoTopic: 'file_properties',
        demoLabel: '文件管理：设置文件属性演示',
      };
    }

    const isFolder = p.itemType === 'folder';
    return {
      concreteSteps: [
        '先在左侧「目录导航」点击进入题目指定的上级文件夹（核对上方地址栏路径是否正确）。',
        `点击工具栏「${isFolder ? '新建文件夹' : '新建文件'}」按钮（若是移动/复制来的文件，则先去原文件夹「复制/剪切」再过来「粘贴」）。`,
        `核对名称及扩展名是否与题目要求的「${String(p.path || '')}」完全一致。`,
      ],
      pitfallTip:
        '新建文件/文件夹前，一定要先看上方灰色地址栏确认自己当前所在的文件夹位置！',
      demoTopic: 'file_create',
      demoLabel: '文件管理：新建/移动文件与文件夹演示',
    };
  }

  // file_not_exists (moved, renamed, or deleted)
  return {
    concreteSteps: [
      `在左侧「目录导航」进入原路径所在文件夹，找到「${String(p.path || '')}」并单击选中。`,
      '如果是「移动」：点击工具栏「剪切」→ 左侧切换到目标文件夹 → 点击「粘贴」。',
      '如果是「重命名」点击「重命名」；如果是「删除」则点击最右侧红色「删除」按钮。',
    ],
    pitfallTip:
      '移动文件必须使用「剪切 + 粘贴」（不要用复制，否则原位置还会留着文件导致扣分）。',
    demoTopic: 'file_move_copy',
    demoLabel: '文件管理：移动、重命名与删除演示',
  };
}

export function buildStepGuidance(
  qType: QuestionType,
  steps: QuestionStep[],
  checkpoints: Checkpoint[],
  checkpointResults: CheckpointResult[],
  touched: boolean
): StepGuidanceResult[] {
  const resultMap = new Map(checkpointResults.map((r) => [r.checkpointId, r]));
  const sortedSteps = [...steps].sort((a, b) => a.index - b.index);

  return sortedSteps.map((step) => {
    const stepCps = checkpoints.filter((c) => c.stepIndex === step.index);
    if (stepCps.length === 0) {
      return {
        stepIndex: step.index,
        passed: touched,
        earnedScore: touched ? step.score : 0,
        maxScore: step.score,
        feedback: touched
          ? '已检测到操作记录。'
          : '请按本步要求在右侧模拟环境中完成操作。',
        concreteSteps: step.hint
          ? [step.hint]
          : ['请仔细阅读本步任务要求，在右侧模拟器工具栏找到对应功能完成操作。'],
        pitfallTip: '操作完成后可继续下一步或点击「检查这一步」确认结果。',
        demoTopic:
          qType === 'word'
            ? 'word_paragraph_style'
            : qType === 'excel'
              ? 'excel_formula'
              : qType === 'web'
                ? 'web_html'
                : qType === 'python'
                  ? 'python_io'
                  : qType === 'database'
                    ? 'sql_select'
                    : 'file_create',
        demoLabel: '操作演示指南',
      };
    }

    const cpOutcomes = stepCps.map((cp) => ({
      cp,
      res: resultMap.get(cp.id),
    }));
    const failed = cpOutcomes.filter((x) => !x.res?.passed);
    const earned = cpOutcomes.reduce(
      (sum, x) => sum + (x.res?.earnedScore || 0),
      0
    );
    const maxScore = cpOutcomes.reduce((sum, x) => sum + x.cp.score, 0);
    const passed = failed.length === 0;

    if (passed) {
      return {
        stepIndex: step.index,
        passed: true,
        earnedScore: earned,
        maxScore,
        feedback:
          cpOutcomes
            .map((x) => x.res?.feedback)
            .filter(Boolean)
            .join(' ') || '本步操作已正确完成！',
        concreteSteps: [],
        pitfallTip: '',
        demoTopic: '',
        demoLabel: '',
      };
    }

    // Merge guidance from the first failing checkpoint of this step (plus custom hint if helpful)
    const primaryFail = failed[0];
    const guidance = buildGuidanceForCheckpoint(qType, primaryFail.cp);
    const combinedFeedback = failed
      .map((f) => f.res?.feedback)
      .filter(Boolean)
      .join('；');

    const concreteSteps = [...guidance.concreteSteps];
    if (step.hint && !concreteSteps.some((s) => s.includes(step.hint!))) {
      concreteSteps.push(`题目专属提示：${step.hint}`);
    }

    return {
      stepIndex: step.index,
      passed: false,
      earnedScore: earned,
      maxScore,
      feedback: combinedFeedback || '本步尚未完成或参数有误。',
      concreteSteps,
      pitfallTip: guidance.pitfallTip,
      demoTopic: guidance.demoTopic,
      demoLabel: guidance.demoLabel,
    };
  });
}

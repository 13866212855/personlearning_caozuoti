import { gradeAnswerDeterministic } from '../grader';
import { getSubjectForType } from '../../lib/subjects';
import type {
  Checkpoint,
  DifficultyLevel,
  Question,
  QuestionStep,
  QuestionType,
  QuestionVisibility,
  SimulatorState,
} from '../types';

export interface TemplateGenParams {
  type: QuestionType;
  difficulty: DifficultyLevel;
  knowledgePoints?: string[];
  knowledgePointIds?: string[];
  customPrompt?: string;
  stepCount?: number;
  totalScore?: number;
  needsImage?: boolean;
  ownerId?: string;
  visibility?: QuestionVisibility;
  variantIndex?: number;
}

interface StepBundle {
  instruction: string;
  hint: string;
  weight: number;
  checkpoints: Array<{
    description: string;
    ruleType: string;
    params: Record<string, unknown>;
  }>;
}

function distributeIntScores(weights: number[], totalScore: number): number[] {
  const safeTotal = Math.max(1, Math.round(totalScore));
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => Math.floor((w / sumW) * safeTotal));
  let diff = safeTotal - raw.reduce((a, b) => a + b, 0);
  let idx = 0;
  while (diff > 0) {
    raw[idx % raw.length] += 1;
    diff -= 1;
    idx += 1;
  }
  return raw;
}

function buildStepsAndCheckpoints(
  bundles: StepBundle[],
  requestedStepCount: number,
  totalScore: number,
  idPrefix: string
): { steps: QuestionStep[]; checkpoints: Checkpoint[] } {
  const targetCount = Math.max(3, Math.min(8, requestedStepCount || 4));
  const chosen = bundles.slice(0, Math.min(targetCount, bundles.length));
  const stepScores = distributeIntScores(
    chosen.map((b) => b.weight),
    totalScore
  );

  const steps: QuestionStep[] = [];
  const checkpoints: Checkpoint[] = [];

  chosen.forEach((b, sIdx) => {
    const stepIndex = sIdx + 1;
    const stepScore = stepScores[sIdx];
    steps.push({
      index: stepIndex,
      instruction: b.instruction,
      score: stepScore,
      hint: b.hint,
    });

    const cpScores = distributeIntScores(
      b.checkpoints.map(() => 1),
      stepScore
    );
    b.checkpoints.forEach((cp, cIdx) => {
      checkpoints.push({
        id: `${idPrefix}-s${stepIndex}-c${cIdx + 1}`,
        stepIndex,
        description: cp.description,
        score: cpScores[cIdx],
        ruleType: cp.ruleType,
        params: cp.params,
      });
    });
  });

  return { steps, checkpoints };
}

function extractThemeTitle(customPrompt?: string, fallback = ''): string {
  const clean = (customPrompt || '').trim();
  if (!clean) return fallback;
  const firstClause = clean.split(/[，。；,.;\n]/)[0].trim();
  if (firstClause.length >= 2 && firstClause.length <= 18) {
    return firstClause;
  }
  return fallback;
}

function buildWordTemplate(params: TemplateGenParams): {
  title: string;
  scenario: string;
  materialsDesc: string;
  initialState: SimulatorState;
  referenceAnswer: SimulatorState;
  bundles: StepBundle[];
  analysis: string[];
  commonMistakes: string[];
  defaultKps: string[];
} {
  const theme = extractThemeTitle(params.customPrompt, '校园智慧科技周宣传简报');
  const includeImg = params.needsImage !== false;
  const imgUrl = '/api/seed-assets/info-literacy.svg';

  const initialState: SimulatorState = {
    paragraphs: [
      {
        id: 'p1',
        text: `${theme}活动通知`,
        fontFamily: '宋体',
        fontSize: 12,
        color: '#000000',
        bold: false,
        italic: false,
        underline: false,
        align: 'left',
        lineHeight: 1.0,
        indent: 0,
        listType: 'none',
      },
      {
        id: 'p2',
        text: '为培养同学们的数字化学习与创新实践能力，学校信息技述教研组决定举办专题展示活动。',
        fontFamily: '宋体',
        fontSize: 12,
        color: '#1e293b',
        bold: false,
        italic: false,
        underline: false,
        align: 'left',
        lineHeight: 1.0,
        indent: 0,
        listType: 'none',
      },
      {
        id: 'p3',
        text: '请各班级按照通知时间提交电子作品，并在作品说明书中标注作者班级与学号信息。',
        fontFamily: '宋体',
        fontSize: 12,
        color: '#1e293b',
        bold: false,
        italic: false,
        underline: false,
        align: 'left',
        lineHeight: 1.0,
        indent: 0,
        listType: 'none',
      },
    ],
    tables: [],
    images: [],
    headerText: '',
    footerText: '',
    pageSetup: {
      orientation: 'portrait',
      marginTop: 2.54,
      marginBottom: 2.54,
      marginLeft: 3.18,
      marginRight: 3.18,
    },
  };

  const referenceAnswer: SimulatorState = {
    paragraphs: [
      {
        id: 'p1',
        text: `${theme}活动通知`,
        fontFamily: '黑体',
        fontSize: 18,
        color: '#1D4ED8',
        bold: true,
        italic: false,
        underline: false,
        align: 'center',
        lineHeight: 1.5,
        indent: 0,
        listType: 'none',
      },
      {
        id: 'p2',
        text: '为培养同学们的数字化学习与创新实践能力，学校信息技术教研组决定举办专题展示活动。',
        fontFamily: '宋体',
        fontSize: 12,
        color: '#1e293b',
        bold: false,
        italic: false,
        underline: false,
        align: 'left',
        lineHeight: 1.5,
        indent: 2,
        listType: 'none',
      },
      {
        id: 'p3',
        text: '请各班级按照通知时间提交电子作品，并在作品说明书中标注作者班级与学号信息。',
        fontFamily: '宋体',
        fontSize: 12,
        color: '#1e293b',
        bold: false,
        italic: false,
        underline: false,
        align: 'left',
        lineHeight: 1.5,
        indent: 2,
        listType: 'none',
      },
    ],
    tables: [
      {
        id: 't1',
        rows: [
          ['项目类别', '负责班级'],
          ['创意编程展示', '高一(1)班'],
          ['网页设计与排版', '高一(2)班'],
        ],
      },
    ],
    images: includeImg
      ? [
          {
            id: 'img1',
            src: imgUrl,
            alt: '校园科技活动宣传图',
            width: 280,
            align: 'center',
          },
        ]
      : [],
    headerText: '高一信息技术学业水平练习',
    footerText: '教务处制',
    pageSetup: {
      orientation: 'portrait',
      marginTop: 2.0,
      marginBottom: 2.0,
      marginLeft: 2.5,
      marginRight: 2.5,
    },
  };

  const bundles: StepBundle[] = [
    {
      instruction:
        '选中第 1 段标题文字，设置字体为「黑体」、字号「18pt」、加粗、颜色「#1D4ED8」并「居中对齐」。',
      hint: '先单击标题段落看到蓝色虚线框，再点击工具栏设置字体、字号、B 加粗、颜色和居中。',
      weight: 20,
      checkpoints: [
        {
          description: '第 1 段标题字体、字号、加粗与居中对齐设置正确',
          ruleType: 'word_paragraph_style',
          params: {
            paragraphIndex: 0,
            fontFamily: '黑体',
            fontSize: 18,
            bold: true,
            align: 'center',
            color: '#1D4ED8',
          },
        },
      ],
    },
    {
      instruction:
        '使用「查找替换」功能，将全文错别字「信息技述」全部替换为「信息技术」。',
      hint: '点击工具栏「查找替换」，填写原词和新词后点击「全部替换」。',
      weight: 15,
      checkpoints: [
        {
          description: '全文已不存在错别字「信息技述」',
          ruleType: 'word_text_not_contains',
          params: { text: '信息技述' },
        },
        {
          description: '第 2 段已正确更正为「信息技术」',
          ruleType: 'word_text_contains',
          params: { text: '信息技术', paragraphIndex: 1 },
        },
      ],
    },
    {
      instruction:
        '选中第 2 段正文，设置「首行缩进 2 字符」且「行距 1.5 倍」。',
      hint: '单击第 2 段后，在工具栏选择「缩进2字符」并将行距设为 1.5。',
      weight: 15,
      checkpoints: [
        {
          description: '第 2 段首行缩进 2 字符与 1.5 倍行距设置正确',
          ruleType: 'word_paragraph_style',
          params: { paragraphIndex: 1, indent: 2, lineHeight: 1.5 },
        },
      ],
    },
    {
      instruction:
        '在文档中插入一个 3 行 2 列的表格，第 1 行表头依次填写「项目类别」「负责班级」，第 2 行填写「创意编程展示」「高一(1)班」。',
      hint: '点击工具栏「插入表格」设置 3 行 2 列，然后依次点进单元格填写内容。',
      weight: 20,
      checkpoints: [
        {
          description: '插入 3 行 2 列表格且表头与内容填写准确',
          ruleType: 'word_table_exists',
          params: {
            minRows: 3,
            minCols: 2,
            cellChecks: [
              { row: 0, col: 0, equals: '项目类别' },
              { row: 0, col: 1, equals: '负责班级' },
              { row: 1, col: 0, equals: '创意编程展示' },
            ],
          },
        },
      ],
    },
    {
      instruction: includeImg
        ? '插入配套素材图片，并填写图片替代文本说明为「校园科技活动宣传图」。'
        : '设置文档页眉文字为「高一信息技术学业水平练习」，页脚文字为「教务处制」。',
      hint: includeImg
        ? '点击工具栏「插入图片」，选择配套素材并填写图片说明(alt)。'
        : '点击白纸最顶部的页眉虚线框和最底部的页脚虚线框分别输入文字。',
      weight: 15,
      checkpoints: includeImg
        ? [
            {
              description: '已插入图片并填写指定替代文本说明',
              ruleType: 'word_image_exists',
              params: {
                minCount: 1,
                requireAlt: true,
                altContains: '校园科技活动宣传图',
              },
            },
          ]
        : [
            {
              description: '页眉与页脚文字设置正确',
              ruleType: 'word_header_footer',
              params: {
                headerContains: '高一信息技术学业水平练习',
                footerContains: '教务处制',
              },
            },
          ],
    },
    {
      instruction:
        '设置文档页眉为「高一信息技术学业水平练习」，页脚为「教务处制」。',
      hint: '点击文档顶部页眉虚线框和底部页脚虚线框输入指定内容。',
      weight: 15,
      checkpoints: [
        {
          description: '页眉与页脚文字设置正确',
          ruleType: 'word_header_footer',
          params: {
            headerContains: '高一信息技术学业水平练习',
            footerContains: '教务处制',
          },
        },
      ],
    },
    {
      instruction:
        '打开「页面设置」，保持纸张方向为「纵向」，将上、下页边距改为 2.0 厘米，左、右边距改为 2.5 厘米并应用。',
      hint: '点击工具栏最右侧「页面设置」，填入数字后点击「应用设置」。',
      weight: 15,
      checkpoints: [
        {
          description: '页面方向与上下左右页边距设置正确',
          ruleType: 'word_page_setup',
          params: {
            orientation: 'portrait',
            marginTop: 2.0,
            marginBottom: 2.0,
            marginLeft: 2.5,
            marginRight: 2.5,
          },
        },
      ],
    },
    {
      instruction: '选中第 3 段正文，同样设置「首行缩进 2 字符」和「1.5 倍行距」。',
      hint: '单击第 3 段正文区域再设置缩进与行距。',
      weight: 10,
      checkpoints: [
        {
          description: '第 3 段格式统一设置完成',
          ruleType: 'word_paragraph_style',
          params: { paragraphIndex: 2, indent: 2, lineHeight: 1.5 },
        },
      ],
    },
  ];

  return {
    title: `${theme}排版与图文处理（${params.difficulty}）`,
    scenario: `学校拟发布「${theme}通知」，现有初稿文档存在格式不统一及错别字问题。请按要求完成标题排版、查找替换、段落缩进、表格插入、图文及页面设置。`,
    materialsDesc: '初始 Word 文档初稿（含 3 段文字）及配套活动插图素材。',
    initialState,
    referenceAnswer,
    bundles,
    analysis: [
      '修改段落样式前先单击目标段落出现蓝色选中框，再操作字体、字号、对齐和缩进按钮。',
      '批量纠正固定错词优先使用「查找替换 -> 全部替换」，防止人工漏改。',
      '页眉、页脚与页面边距分别在页眉页脚虚线框和「页面设置」弹窗中完成。',
    ],
    commonMistakes: [
      '忘记选中目标段落就点击工具栏，导致格式未作用在对应段落上。',
      '插入表格时把“3行2列”填反成“2行3列”。',
    ],
    defaultKps: [
      '字符与段落格式（字体/字号/颜色/加粗）',
      '查找与全部替换',
      '插入表格与单元格填写',
      '页眉与页脚设置',
    ],
  };
}

function buildExcelTemplate(params: TemplateGenParams): {
  title: string;
  scenario: string;
  materialsDesc: string;
  initialState: SimulatorState;
  referenceAnswer: SimulatorState;
  bundles: StepBundle[];
  analysis: string[];
  commonMistakes: string[];
  defaultKps: string[];
} {
  const theme = extractThemeTitle(params.customPrompt, '高一年级运动会项目得分统计');

  const initialCells: Record<string, { value: string; formula?: string; bold?: boolean; bgColor?: string; align?: 'left' | 'center' | 'right'; border?: boolean; numberFormat?: 'general' | 'number2' | 'percent' | 'currency' }> = {
    A1: { value: `${theme}表`, align: 'left' },
    A2: { value: '班级', bold: true },
    B2: { value: '田赛得分', bold: true },
    C2: { value: '径赛得分', bold: true },
    D2: { value: '总分', bold: true },
    E2: { value: '平均分', bold: true },
    A3: { value: '高一(1)班' },
    B3: { value: '86' },
    C3: { value: '92' },
    D3: { value: '' },
    E3: { value: '' },
    A4: { value: '高一(2)班' },
    B4: { value: '94' },
    C4: { value: '90' },
    D4: { value: '' },
    E4: { value: '' },
    A5: { value: '高一(3)班' },
    B5: { value: '80' },
    C5: { value: '84' },
    D5: { value: '' },
    E5: { value: '' },
  };

  const refCells: typeof initialCells = {
    A1: { value: `${theme}表`, bold: true, align: 'center', bgColor: '#E0F2FE' },
    A2: { value: '班级', bold: true, align: 'center', border: true },
    B2: { value: '田赛得分', bold: true, align: 'center', border: true },
    C2: { value: '径赛得分', bold: true, align: 'center', border: true },
    D2: { value: '总分', bold: true, align: 'center', border: true },
    E2: { value: '平均分', bold: true, align: 'center', border: true },
    A3: { value: '高一(1)班', border: true },
    B3: { value: '86', border: true },
    C3: { value: '92', border: true },
    D3: { value: '178', formula: '=SUM(B3:C3)', border: true },
    E3: { value: '89', formula: '=AVERAGE(B3:C3)', border: true, numberFormat: 'number2' },
    A4: { value: '高一(2)班', border: true },
    B4: { value: '94', border: true },
    C4: { value: '90', border: true },
    D4: { value: '184', formula: '=SUM(B4:C4)', border: true },
    E4: { value: '92', formula: '=AVERAGE(B4:C4)', border: true, numberFormat: 'number2' },
    A5: { value: '高一(3)班', border: true },
    B5: { value: '80', border: true },
    C5: { value: '84', border: true },
    D5: { value: '164', formula: '=SUM(B5:C5)', border: true },
    E5: { value: '82', formula: '=AVERAGE(B5:C5)', border: true, numberFormat: 'number2' },
  };

  const initialState: SimulatorState = {
    cells: initialCells,
    merges: [],
    charts: [],
  };

  const referenceAnswer: SimulatorState = {
    cells: refCells,
    merges: ['A1:E1'],
    charts: [
      {
        id: 'chart-1',
        type: 'column',
        title: '各班总分对比柱形图',
        labelRange: 'A3:A5',
        dataRange: 'D3:D5',
      },
    ],
    sortInfo: { column: 'D', order: 'desc' },
  };

  const bundles: StepBundle[] = [
    {
      instruction:
        '选中区域 A1:E1，点击「合并/取消」合并标题行，并设置加粗、居中对齐与浅蓝填充色（#E0F2FE）。',
      hint: '先在左上角名称框输入 A1:E1 并回车选中，再依次点「合并/取消」「B」「居中」和填充色。',
      weight: 20,
      checkpoints: [
        {
          description: '标题区域 A1:E1 已合并',
          ruleType: 'excel_merge_exists',
          params: { range: 'A1:E1' },
        },
        {
          description: '标题区域 A1 已设置加粗与居中对齐',
          ruleType: 'excel_cell_style',
          params: { range: 'A1', bold: true, align: 'center', bgColor: '#E0F2FE' },
        },
      ],
    },
    {
      instruction:
        '分别在 D3、D4、D5 单元格中使用 SUM 函数计算各班总分（例如 D3 输入 =SUM(B3:C3)）。',
      hint: '点中 D3 在 fx 公式栏输入 =SUM(B3:C3) 按回车，同理完成 D4、D5。',
      weight: 25,
      checkpoints: [
        {
          description: 'D3 使用 =SUM(B3:C3) 算出 178',
          ruleType: 'excel_cell_formula',
          params: { cell: 'D3', expectedFormula: '=SUM(B3:C3)', expectedValue: 178 },
        },
        {
          description: 'D4 使用 =SUM(B4:C4) 算出 184',
          ruleType: 'excel_cell_formula',
          params: { cell: 'D4', expectedFormula: '=SUM(B4:C4)', expectedValue: 184 },
        },
        {
          description: 'D5 使用 =SUM(B5:C5) 算出 164',
          ruleType: 'excel_cell_formula',
          params: { cell: 'D5', expectedFormula: '=SUM(B5:C5)', expectedValue: 164 },
        },
      ],
    },
    {
      instruction:
        '在 E3、E4、E5 中使用 AVERAGE 函数计算各班平均分，并将 E3:E5 数字格式设置为保留 2 位小数（number2）。',
      hint: '在 E3 输入 =AVERAGE(B3:C3)，选中 E3:E5 在工具栏数字格式下拉框选择“数值 (2位小数)”。',
      weight: 20,
      checkpoints: [
        {
          description: 'E3 使用 =AVERAGE(B3:C3) 计算平均分 89',
          ruleType: 'excel_cell_formula',
          params: { cell: 'E3', expectedFormula: '=AVERAGE(B3:C3)', expectedValue: 89 },
        },
        {
          description: 'E3:E5 已设置保留 2 位小数格式',
          ruleType: 'excel_cell_style',
          params: { range: 'E3:E5', numberFormat: 'number2' },
        },
      ],
    },
    {
      instruction:
        '插入统计图表：图表类型选择「柱形图 (column)」，标题为「各班总分对比柱形图」，分类区域 A3:A5，数据区域 D3:D5。',
      hint: '点击工具栏「插入图表」，填好图表标题、分类区域和数据区域后确认生成。',
      weight: 20,
      checkpoints: [
        {
          description: '已生成总分对比柱形图（数据区 D3:D5）',
          ruleType: 'excel_chart_exists',
          params: {
            chartType: 'column',
            titleContains: '总分对比',
            dataRange: 'D3:D5',
          },
        },
      ],
    },
    {
      instruction: '点击总分列（D 列）任意单元格，按总分从高到低「降序」排序。',
      hint: '务必先点中 D3 等 D 列单元格，再点工具栏「降序」按钮。',
      weight: 15,
      checkpoints: [
        {
          description: '已按 D 列（总分）降序排列',
          ruleType: 'excel_sort_applied',
          params: { column: 'D', order: 'desc' },
        },
      ],
    },
    {
      instruction: '选中数据区 A2:E5，为所有表格单元格添加「所有边框」。',
      hint: '在左上角选区框输入 A2:E5 回车后，点击工具栏「边框」按钮。',
      weight: 10,
      checkpoints: [
        {
          description: '数据区域 A2:E5 已添加边框线',
          ruleType: 'excel_cell_style',
          params: { range: 'A2:E5', border: true },
        },
      ],
    },
  ];

  return {
    title: `${theme}与图表分析（${params.difficulty}）`,
    scenario: `现有一份「${theme}表」原始工作簿，请你使用电子表格公式计算各班总分与平均分，完成标题合并美化、数字格式设置、图表制作及总分降序排列。`,
    materialsDesc: '包含 3 个班级田赛与径赛成绩的初始 Excel 工作表。',
    initialState,
    referenceAnswer,
    bundles,
    analysis: [
      '所有 Excel 公式必须以英文等号 = 开头，区域范围使用英文冒号连接（如 B3:C3）。',
      '设置多单元格格式或合并时，可直接在左上角名称框输入如 A1:E1 快速框选。',
      '排序前一定要先单击需要作为排序依据的那一列中的单元格。',
    ],
    commonMistakes: [
      '输入公式时漏写开头的 = 号，或使用了中文括号（ ）。',
      '只点中了 A1 一个格子就点「合并」，未能选中连续区域 A1:E1。',
    ],
    defaultKps: [
      '合并单元格与标题样式设置',
      'SUM 求和函数',
      'AVERAGE 平均值函数',
      '创建柱形图/折线图/饼图',
      '单列升序/降序排序',
    ],
  };
}

function buildWebTemplate(params: TemplateGenParams): {
  title: string;
  scenario: string;
  materialsDesc: string;
  initialState: SimulatorState;
  referenceAnswer: SimulatorState;
  bundles: StepBundle[];
  analysis: string[];
  commonMistakes: string[];
  defaultKps: string[];
} {
  const theme = extractThemeTitle(params.customPrompt, '安徽省非遗文化数字展馆');
  const includeImg = params.needsImage !== false;
  const imgUrl = '/api/seed-assets/heritage.svg';

  const initialHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${theme}</title>
</head>
<body>
  <!-- 请在此添加网页标题、简介与导航内容 -->
</body>
</html>`;

  const refHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${theme}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <h1>${theme}</h1>
  <p>数字技术让传统非遗文化在校园焕发新的生机。</p>
  ${includeImg ? `<img src="${imgUrl}" alt="${theme}主题插图" width="280" />` : '<ul><li>徽州木雕</li><li>宣纸制作技艺</li></ul>'}
  <a href="https://www.ah.gov.cn">了解更多</a>
</body>
</html>`;

  const refCss = `body {
  background-color: #f8fafc;
  font-family: sans-serif;
}
h1 {
  color: #1d4ed8;
  text-align: center;
}`;

  const initialState: SimulatorState = {
    files: [{ path: 'index.html', name: 'index.html', type: 'html', content: initialHtml }],
  };

  const referenceAnswer: SimulatorState = {
    files: [
      { path: 'index.html', name: 'index.html', type: 'html', content: refHtml },
      { path: 'styles.css', name: 'styles.css', type: 'css', content: refCss },
    ],
  };

  const bundles: StepBundle[] = [
    {
      instruction: '新建外部样式表文件 styles.css，并在 index.html 的 <head> 内使用 <link> 引入该样式表。',
      hint: '点击代码标签栏「+ 新建文件」输入 styles.css，在 index.html 中加入 <link rel="stylesheet" href="styles.css" />。',
      weight: 20,
      checkpoints: [
        {
          description: '已创建 styles.css 文件',
          ruleType: 'web_file_exists',
          params: { path: 'styles.css' },
        },
        {
          description: 'index.html 中已引入 styles.css',
          ruleType: 'web_code_contains',
          params: { file: 'index.html', pattern: 'styles.css' },
        },
      ],
    },
    {
      instruction: `在 index.html 的 <body> 内添加一级标题 <h1>${theme}</h1> 和一段 <p> 介绍文字。`,
      hint: '可使用工具栏「+ h1」「+ p」快捷按钮插入成对标签，再修改内部文字。',
      weight: 20,
      checkpoints: [
        {
          description: `存在包含「${theme}」的 <h1> 标签`,
          ruleType: 'web_html_tag',
          params: { file: 'index.html', tag: 'h1', minCount: 1, textContains: theme },
        },
        {
          description: '存在 <p> 段落介绍标签',
          ruleType: 'web_html_tag',
          params: { file: 'index.html', tag: 'p', minCount: 1 },
        },
      ],
    },
    {
      instruction: includeImg
        ? `在页面中添加 <img> 图片标签，src 指向素材图片「${imgUrl}」并填写 alt 替代文本。`
        : '在页面中添加无序列表 <ul><li>徽州木雕</li><li>宣纸制作技艺</li></ul>。',
      hint: includeImg
        ? '点击「+ img」插入图片标签，确认 src 与 alt 属性使用英文双引号。'
        : '在 <body> 内编写 <ul> 与两个 <li> 列表项。',
      weight: 20,
      checkpoints: includeImg
        ? [
            {
              description: '已插入带 src 与 alt 属性的 <img> 标签',
              ruleType: 'web_html_tag',
              params: {
                file: 'index.html',
                tag: 'img',
                minCount: 1,
                attrs: { src: imgUrl, alt: true },
              },
            },
          ]
        : [
            {
              description: '页面包含 <ul> 无序列表及 <li> 列表项',
              ruleType: 'web_html_tag',
              params: { file: 'index.html', tag: 'li', minCount: 2 },
            },
          ],
    },
    {
      instruction: '在页面中添加超链接 <a href="https://www.ah.gov.cn">了解更多</a>。',
      hint: '使用 <a> 标签并通过 href 属性指定完整跳转地址。',
      weight: 20,
      checkpoints: [
        {
          description: '已添加包含 href 属性与「了解更多」文本的超链接',
          ruleType: 'web_html_tag',
          params: {
            file: 'index.html',
            tag: 'a',
            minCount: 1,
            textContains: '了解更多',
            attrs: { href: true },
          },
        },
      ],
    },
    {
      instruction: '切换到 styles.css，设置 h1 文字颜色为 #1d4ed8 且居中对齐（text-align: center;）。',
      hint: 'CSS 规则写法：h1 { color: #1d4ed8; text-align: center; }，注意英文分号与大括号。',
      weight: 20,
      checkpoints: [
        {
          description: 'styles.css 中 h1 字体颜色设为 #1d4ed8',
          ruleType: 'web_css_rule',
          params: {
            file: 'styles.css',
            selector: 'h1',
            property: 'color',
            expectedValue: '#1d4ed8',
          },
        },
        {
          description: 'styles.css 中 h1 设置了 text-align: center',
          ruleType: 'web_css_rule',
          params: {
            file: 'styles.css',
            selector: 'h1',
            property: 'text-align',
            expectedValue: 'center',
          },
        },
      ],
    },
    {
      instruction: '在 styles.css 中为 body 设置页面浅灰蓝背景色 background-color: #f8fafc;。',
      hint: '在 body { ... } 样式块内添加 background-color: #f8fafc;。',
      weight: 10,
      checkpoints: [
        {
          description: 'styles.css 中 body 背景色设为 #f8fafc',
          ruleType: 'web_css_rule',
          params: {
            file: 'styles.css',
            selector: 'body',
            property: 'background-color',
            expectedValue: '#f8fafc',
          },
        },
      ],
    },
  ];

  return {
    title: `${theme}网页制作与 CSS 美化（${params.difficulty}）`,
    scenario: `校园文化宣传组正在制作「${theme}」主题静态网页。请你新建外部 CSS 文件并引入，补充 HTML 标题、段落、图文与超链接元素，再完成页面样式美化。`,
    materialsDesc: '包含基础 HTML 骨架的 index.html 及素材图片资源。',
    initialState,
    referenceAnswer,
    bundles,
    analysis: [
      '新建样式文件后必须在 index.html 的 <head> 区域用 <link rel="stylesheet" href="styles.css" /> 关联。',
      '所有 HTML 成对标签（如 <h1>...</h1>、<a>...</a>）都要正确闭合，属性值用英文双引号。',
      '每条 CSS 属性声明结尾都必须写英文分号 ;。',
    ],
    commonMistakes: [
      '只创建了 styles.css 却忘记在 index.html 中用 <link> 引入，导致样式不生效。',
      '插入图片时漏写 alt 属性，或把分号/冒号输成了中文全角符号。',
    ],
    defaultKps: [
      'HTML5 文档基础结构与常用块级/文本标签',
      '图片标签与相对路径引用',
      '超链接创建与属性设置',
      '外部 CSS 文件创建与 <link> 引入',
      '常用 CSS 文本与背景样式属性',
    ],
  };
}

function buildFileTemplate(params: TemplateGenParams): {
  title: string;
  scenario: string;
  materialsDesc: string;
  initialState: SimulatorState;
  referenceAnswer: SimulatorState;
  bundles: StepBundle[];
  analysis: string[];
  commonMistakes: string[];
  defaultKps: string[];
} {
  const theme = extractThemeTitle(params.customPrompt, '社团资料整理归档');

  const initialState: SimulatorState = {
    items: [
      { id: 'r1', path: 'D:', name: '本地磁盘 (D:)', type: 'folder', parentPath: '' },
      { id: 'f1', path: 'D:/待整理', name: '待整理', type: 'folder', parentPath: 'D:' },
      { id: 'f2', path: 'D:/备份区', name: '备份区', type: 'folder', parentPath: 'D:' },
      {
        id: 'doc1',
        path: 'D:/待整理/活动方案.docx',
        name: '活动方案.docx',
        type: 'file',
        parentPath: 'D:/待整理',
        content: '校园社团年度活动策划方案。',
        size: 24,
        readOnly: false,
        hidden: false,
      },
      {
        id: 'doc2',
        path: 'D:/待整理/旧日志.tmp',
        name: '旧日志.tmp',
        type: 'file',
        parentPath: 'D:/待整理',
        content: '临时日志',
        size: 4,
        readOnly: false,
        hidden: false,
      },
      {
        id: 'doc3',
        path: 'D:/待整理/报名表.xlsx',
        name: '报名表.xlsx',
        type: 'file',
        parentPath: 'D:/待整理',
        content: '报名名单数据',
        size: 16,
        readOnly: false,
        hidden: false,
      },
    ],
  };

  const referenceAnswer: SimulatorState = {
    items: [
      { id: 'r1', path: 'D:', name: '本地磁盘 (D:)', type: 'folder', parentPath: '' },
      { id: 'f1', path: 'D:/待整理', name: '待整理', type: 'folder', parentPath: 'D:' },
      { id: 'f2', path: 'D:/备份区', name: '备份区', type: 'folder', parentPath: 'D:' },
      { id: 'f3', path: 'D:/正式归档', name: '正式归档', type: 'folder', parentPath: 'D:' },
      {
        id: 'doc1',
        path: 'D:/正式归档/活动方案.docx',
        name: '活动方案.docx',
        type: 'file',
        parentPath: 'D:/正式归档',
        content: '校园社团年度活动策划方案。',
        size: 24,
        readOnly: true,
        hidden: false,
      },
      {
        id: 'doc3',
        path: 'D:/待整理/报名表.xlsx',
        name: '报名表.xlsx',
        type: 'file',
        parentPath: 'D:/待整理',
        content: '报名名单数据',
        size: 16,
        readOnly: false,
        hidden: false,
      },
      {
        id: 'doc3_copy',
        path: 'D:/备份区/报名表.xlsx',
        name: '报名表.xlsx',
        type: 'file',
        parentPath: 'D:/备份区',
        content: '报名名单数据',
        size: 16,
        readOnly: false,
        hidden: false,
      },
      {
        id: 'sc1',
        path: 'D:/活动方案.docx - 快捷方式.lnk',
        name: '活动方案.docx - 快捷方式.lnk',
        type: 'shortcut',
        parentPath: 'D:',
        targetPath: 'D:/正式归档/活动方案.docx',
        readOnly: false,
        hidden: false,
      },
      {
        id: 'note1',
        path: 'D:/正式归档/说明.txt',
        name: '说明.txt',
        type: 'file',
        parentPath: 'D:/正式归档',
        content: '归档完毕',
        size: 10,
        readOnly: false,
        hidden: false,
      },
    ],
  };

  const bundles: StepBundle[] = [
    {
      instruction: '在 D:/ 根目录下新建名为「正式归档」的文件夹。',
      hint: '确认上方地址栏为 D:/ 后，点击工具栏「新建文件夹」并输入“正式归档”。',
      weight: 20,
      checkpoints: [
        {
          description: 'D:/ 下已创建「正式归档」文件夹',
          ruleType: 'file_exists',
          params: { path: 'D:/正式归档', itemType: 'folder' },
        },
      ],
    },
    {
      instruction: '将 D:/待整理/活动方案.docx 「移动」到 D:/正式归档/ 文件夹下。',
      hint: '选中活动方案.docx 点「剪切」，进入 D:/正式归档 后点「粘贴」。',
      weight: 25,
      checkpoints: [
        {
          description: 'D:/正式归档/活动方案.docx 已到位',
          ruleType: 'file_exists',
          params: { path: 'D:/正式归档/活动方案.docx', itemType: 'file' },
        },
        {
          description: '原目录 D:/待整理/活动方案.docx 已移除',
          ruleType: 'file_not_exists',
          params: { path: 'D:/待整理/活动方案.docx' },
        },
      ],
    },
    {
      instruction: '选中 D:/正式归档/活动方案.docx，打开属性设置并勾选「只读」保存。',
      hint: '选中文件后点击工具栏「属性」按钮，勾选“只读”再点击「保存属性」。',
      weight: 15,
      checkpoints: [
        {
          description: 'D:/正式归档/活动方案.docx 已设为只读属性',
          ruleType: 'file_exists',
          params: { path: 'D:/正式归档/活动方案.docx', itemType: 'file', readOnly: true },
        },
      ],
    },
    {
      instruction: '将 D:/待整理/报名表.xlsx 「复制」一份到 D:/备份区/ 中（保留原文件）。',
      hint: '使用「复制」+「粘贴」，不要使用剪切。',
      weight: 20,
      checkpoints: [
        {
          description: 'D:/备份区/报名表.xlsx 复制成功',
          ruleType: 'file_exists',
          params: { path: 'D:/备份区/报名表.xlsx', itemType: 'file' },
        },
        {
          description: '原目录仍保留 D:/待整理/报名表.xlsx',
          ruleType: 'file_exists',
          params: { path: 'D:/待整理/报名表.xlsx', itemType: 'file' },
        },
      ],
    },
    {
      instruction: '删除临时冗余文件 D:/待整理/旧日志.tmp。',
      hint: '进入 D:/待整理，选中 旧日志.tmp 后点击工具栏「删除」。',
      weight: 20,
      checkpoints: [
        {
          description: '已删除 D:/待整理/旧日志.tmp',
          ruleType: 'file_not_exists',
          params: { path: 'D:/待整理/旧日志.tmp' },
        },
      ],
    },
    {
      instruction: '在 D:/正式归档/ 下新建文本文件「说明.txt」。',
      hint: '先进入 D:/正式归档，再点「新建文件」输入 说明.txt。',
      weight: 10,
      checkpoints: [
        {
          description: '已创建 D:/正式归档/说明.txt',
          ruleType: 'file_exists',
          params: { path: 'D:/正式归档/说明.txt', itemType: 'file' },
        },
      ],
    },
  ];

  return {
    title: `${theme}资源分类与属性管理（${params.difficulty}）`,
    scenario: `请你扮演信息管理员，按照工作规范对 D 盘「待整理」文件夹中的社团文档执行目录创建、移动归档、备份复制、只读属性设置与临时文件清理操作。`,
    materialsDesc: '包含待整理与备份目录的虚拟 Windows 文件系统。',
    initialState,
    referenceAnswer,
    bundles,
    analysis: [
      '「移动」操作必须用「剪切 + 粘贴」，确保原路径不再保留旧文件。',
      '「复制」操作则使用「复制 + 粘贴」，原路径与目标路径同时存在该文件。',
      '新建目录或文件前，先看一眼窗口上方地址栏确认当前位置是否正确。',
    ],
    commonMistakes: [
      '把“移动”错做成了“复制”，导致原文件夹里还留着旧文件而被扣分。',
      '忘记进入 D:/正式归档 目录就直接点新建文件。',
    ],
    defaultKps: [
      '新建文件夹与多级目录结构',
      '移动文件（剪切与粘贴）',
      '复制与粘贴（保留原文件）',
      '设置文件“只读”属性',
      '删除指定冗余或临时文件',
    ],
  };
}

function buildPythonTemplate(params: TemplateGenParams): {
  title: string;
  scenario: string;
  materialsDesc: string;
  initialState: SimulatorState;
  referenceAnswer: SimulatorState;
  bundles: StepBundle[];
  analysis: string[];
  commonMistakes: string[];
  defaultKps: string[];
} {
  const theme = extractThemeTitle(params.customPrompt, '班级体温健康监测统计');

  const initialCode = `# ${theme}程序
# 请在下方读取输入人数 n 及 n 个整数得分，完成统计并输出结果
n = int(input())
`;

  const refCode = `n = int(input())
scores = []
for _ in range(n):
    scores.append(int(input()))

high_cnt = 0
for s in scores:
    if s >= 85:
        high_cnt += 1

avg = sum(scores) / len(scores)
print(high_cnt)
print(f"{avg:.2f}")
`;

  const initialState: SimulatorState = {
    code: initialCode,
    customInput: '4\n90\n82\n88\n76',
    lastOutput: '',
    lastError: '',
  };

  const referenceAnswer: SimulatorState = {
    code: refCode,
    customInput: '4\n90\n82\n88\n76',
    lastOutput: '2\n84.00',
    lastError: '',
  };

  const bundles: StepBundle[] = [
    {
      instruction: '编写合法 Python 3 代码，确保程序无语法与缩进错误（可通过语法检查）。',
      hint: '注意 for、if 行末的英文冒号 : 以及下一行的 4 空格缩进。',
      weight: 20,
      checkpoints: [
        {
          description: 'Python 代码通过语法检查',
          ruleType: 'python_syntax_valid',
          params: {},
        },
      ],
    },
    {
      instruction: '使用 input() 与 int() 读入整数 n 及后续 n 个成绩存入列表。',
      hint: 'input() 返回字符串，需要用 int(input()) 转换为整数再加入列表。',
      weight: 20,
      checkpoints: [
        {
          description: '使用 int(input()) 正确读取并转换输入数据',
          ruleType: 'python_code_contains',
          params: { patterns: ['int(input())'] },
        },
      ],
    },
    {
      instruction: '使用 for 循环与 >= 85 条件分支统计达到优秀线（>= 85 分）的人数。',
      hint: '初始化计数变量 high_cnt = 0，遍历列表遇到 >= 85 时累加 1。',
      weight: 20,
      checkpoints: [
        {
          description: '包含 for 循环与 >= 85 条件判断结构',
          ruleType: 'python_code_contains',
          params: { patterns: ['for ', 'if ', '85'] },
        },
      ],
    },
    {
      instruction: '计算全部数据的平均值并按保留 2 位小数格式化输出（第 1 行输出优秀人数，第 2 行输出两位小数平均分）。',
      hint: '可使用 sum(scores) / len(scores) 计算平均分，再用 print(f"{avg:.2f}") 输出。',
      weight: 40,
      checkpoints: [
        {
          description: '全部 3 组测试样例运行输入输出完全通过',
          ruleType: 'python_test_cases',
          params: {
            cases: [
              { stdin: '4\n90\n82\n88\n76', expectedOutput: '2\n84.00' },
              { stdin: '3\n85\n95\n100', expectedOutput: '3\n93.33' },
              { stdin: '2\n60\n70', expectedOutput: '0\n65.00' },
            ],
          },
        },
      ],
    },
    {
      instruction: '在自定义输入区填写测试样例，点击「运行代码」核对控制台两行输出格式是否正确。',
      hint: '确保不要在 input() 中加入提示文字，避免多余字符混入标准输出。',
      weight: 10,
      checkpoints: [
        {
          description: '程序使用 print() 输出计算结果',
          ruleType: 'python_code_contains',
          params: { patterns: ['print('] },
        },
      ],
    },
  ];

  return {
    title: `Python 循环统计与平均分计算：${theme}（${params.difficulty}）`,
    scenario: `请编写一个 Python 程序处理「${theme}」数据：第一行输入样本数量 n，随后 n 行每行输入一个整数分值。请统计分值 >= 85 的人数（第一行输出）以及所有数据的平均分（第二行输出，保留 2 位小数）。`,
    materialsDesc: '预设初始代码框架 main.py 及示例标准输入数据。',
    initialState,
    referenceAnswer,
    bundles,
    analysis: [
      'input() 读入的数据默认是字符串，参与循环次数或数值比较前务必套用 int()。',
      '使用 f"{avg:.2f}" 或 "%.2f" % avg 可稳定输出两位小数（包括末尾的 .00）。',
      '本题自动判分比对标准输出，input() 括号内请保持为空。',
    ],
    commonMistakes: [
      '把优秀线 >= 85 写成了 > 85，导致刚好 85 分的数据漏计。',
      '使用 round(avg, 2) 直接打印，当结果为整数 84.0 时未补足两位小数 84.00。',
    ],
    defaultKps: [
      'input() 输入与 int()/float() 类型转换',
      'print() 格式化输出与 f-string',
      'if / elif / else 多分支条件判断',
      'for 循环与 range() 计数遍历',
      '列表创建、索引切片与常用方法',
    ],
  };
}

function buildDatabaseTemplate(params: TemplateGenParams): {
  title: string;
  scenario: string;
  materialsDesc: string;
  initialState: SimulatorState;
  referenceAnswer: SimulatorState;
  bundles: StepBundle[];
  analysis: string[];
  commonMistakes: string[];
  defaultKps: string[];
} {
  const theme = extractThemeTitle(params.customPrompt, '校园数字图书馆评优统计');

  const seedTables = [
    {
      name: 'students',
      columns: ['id', 'name', 'class_name', 'score'],
      rows: [
        [1, '陈晨', '高一(1)班', 95],
        [2, '林雪', '高一(2)班', 88],
        [3, '周阳', '高一(1)班', 92],
        [4, '吴越', '高一(3)班', 79],
        [5, '郑好', '高一(2)班', 96],
      ],
    },
  ];

  const refSql = `SELECT name, class_name, score
FROM students
WHERE score >= 90
ORDER BY score DESC;`;

  const initialState: SimulatorState = {
    tables: seedTables,
    sql: '-- 请查询成绩 >= 90 的学生姓名(name)、班级(class_name)与成绩(score)，按成绩降序排列\n',
    lastColumns: [],
    lastRows: [],
    lastChanges: 0,
    lastError: '',
  };

  const referenceAnswer: SimulatorState = {
    tables: seedTables,
    sql: refSql,
    lastColumns: ['name', 'class_name', 'score'],
    lastRows: [
      ['郑好', '高一(2)班', 96],
      ['陈晨', '高一(1)班', 95],
      ['周阳', '高一(1)班', 92],
    ],
    lastChanges: 0,
    lastError: '',
  };

  const bundles: StepBundle[] = [
    {
      instruction: '在 SQL 编辑器中使用 SELECT 指定查询列 name, class_name, score 并指向表 students。',
      hint: '先确认左侧表名为 students，列名为 name、class_name、score，按顺序用英文逗号分隔。',
      weight: 25,
      checkpoints: [
        {
          description: '包含正确的 SELECT ... FROM students 结构',
          ruleType: 'sql_code_contains',
          params: { patterns: ['SELECT', 'FROM', 'students'] },
        },
      ],
    },
    {
      instruction: '添加 WHERE 条件筛选出 score >= 90 的优秀记录。',
      hint: '在 FROM students 后另起一行写 WHERE score >= 90。',
      weight: 25,
      checkpoints: [
        {
          description: '使用 WHERE 条件过滤 >= 90 分记录',
          ruleType: 'sql_code_contains',
          params: { patterns: ['WHERE', '90'] },
        },
      ],
    },
    {
      instruction: '添加 ORDER BY score DESC 按成绩从高到低降序排列，并点击「执行 SQL」验证结果。',
      hint: '降序关键字是 DESC，语句末尾建议加上英文分号 ;。',
      weight: 50,
      checkpoints: [
        {
          description: 'SQL 查询结果列与有序数据行完全正确（3 条高分记录按降序返回）',
          ruleType: 'sql_query_result',
          params: {
            expectedColumns: ['name', 'class_name', 'score'],
            expectedRows: [
              ['郑好', '高一(2)班', 96],
              ['陈晨', '高一(1)班', 95],
              ['周阳', '高一(1)班', 92],
            ],
            ignoreOrder: false,
          },
        },
      ],
    },
    {
      instruction: '核对 SQL 关键字与分号格式完整无误后进入下一步。',
      hint: '检查 ORDER BY score DESC 拼写是否正确。',
      weight: 10,
      checkpoints: [
        {
          description: 'SQL 包含 ORDER BY ... DESC 排序语句',
          ruleType: 'sql_code_contains',
          params: { patterns: ['ORDER BY', 'DESC'] },
        },
      ],
    },
  ];

  return {
    title: `SQL 条件筛选与排序查询：${theme}（${params.difficulty}）`,
    scenario: `学校信息中心建有一张学生信息成绩表 students（字段包含 id、name、class_name、score）。请你编写一条 SQL 查询语句，筛选出成绩不低于 90 分（score >= 90）的学生，仅返回 name、class_name、score 三列，并按成绩从高到低降序排列。`,
    materialsDesc: '内置 SQLite 内存表 students（含 5 条测试记录）。',
    initialState,
    referenceAnswer,
    bundles,
    analysis: [
      'SQL 查询语句标准书写顺序为：SELECT 列名 FROM 表名 WHERE 条件 ORDER BY 排序列 DESC。',
      '当题目明确指定返回列时，不要使用 SELECT *，而要依次写出目标列名。',
    ],
    commonMistakes: [
      '使用了 SELECT * 导致结果多出了 id 列。',
      '忘记写 DESC，默认升序（ASC）排序导致名次顺序相反。',
    ],
    defaultKps: [
      'SELECT 基础字段查询与去重',
      'WHERE 条件筛选（比较/逻辑/BETWEEN/LIKE）',
      'ORDER BY 升序与降序排列',
    ],
  };
}

function buildSketch3ViewTemplate(params: TemplateGenParams): {
  title: string;
  scenario: string;
  materialsDesc: string;
  initialState: SimulatorState;
  referenceAnswer: SimulatorState;
  bundles: StepBundle[];
  analysis: string[];
  commonMistakes: string[];
  defaultKps: string[];
} {
  const theme = extractThemeTitle(params.customPrompt, '阶梯槽形金属连接件');
  const initialState: SimulatorState = {
    partTitle: theme,
    gridCols: 8,
    gridRows: 6,
    givenLines: [
      { view: 'front', x1: 1, y1: 1, x2: 4, y2: 1, style: 'solid' },
      { view: 'front', x1: 4, y1: 1, x2: 4, y2: 3, style: 'solid' },
      { view: 'front', x1: 4, y1: 3, x2: 7, y2: 3, style: 'solid' },
      { view: 'front', x1: 7, y1: 3, x2: 7, y2: 5, style: 'solid' },
      { view: 'front', x1: 7, y1: 5, x2: 1, y2: 5, style: 'solid' },
      { view: 'front', x1: 1, y1: 5, x2: 1, y2: 1, style: 'solid' },
      { view: 'front', x1: 2, y1: 3, x2: 4, y2: 3, style: 'solid' },
      { view: 'front', x1: 2, y1: 3, x2: 2, y2: 5, style: 'solid' },
      { view: 'top', x1: 1, y1: 1, x2: 7, y2: 1, style: 'solid' },
      { view: 'top', x1: 7, y1: 1, x2: 7, y2: 5, style: 'solid' },
      { view: 'top', x1: 7, y1: 5, x2: 1, y2: 5, style: 'solid' },
      { view: 'top', x1: 1, y1: 5, x2: 1, y2: 1, style: 'solid' },
      { view: 'left', x1: 1, y1: 1, x2: 5, y2: 1, style: 'solid' },
      { view: 'left', x1: 5, y1: 1, x2: 5, y2: 5, style: 'solid' },
      { view: 'left', x1: 5, y1: 5, x2: 1, y2: 5, style: 'solid' },
      { view: 'left', x1: 1, y1: 5, x2: 1, y2: 1, style: 'solid' },
    ],
    lines: [],
    dimensions: [
      { id: 'd-len', view: 'front', label: '总长 L (mm)', value: '' },
      { id: 'd-ht', view: 'front', label: '总高 H (mm)', value: '' },
    ],
  };

  const referenceAnswer: SimulatorState = {
    ...initialState,
    lines: [
      { view: 'top', x1: 4, y1: 1, x2: 4, y2: 5, style: 'solid' },
      { view: 'top', x1: 2, y1: 1, x2: 2, y2: 5, style: 'dashed' },
      { view: 'left', x1: 1, y1: 3, x2: 5, y2: 3, style: 'dashed' },
      { view: 'top', x1: 1, y1: 3, x2: 7, y2: 3, style: 'center' },
    ],
    dimensions: [
      { id: 'd-len', view: 'front', label: '总长 L (mm)', value: '60' },
      { id: 'd-ht', view: 'front', label: '总高 H (mm)', value: '40' },
    ],
  };

  const bundles: StepBundle[] = [
    {
      instruction: '在【俯视图】中用“粗实线”补齐台阶分界可见轮廓线 (4,1)-(4,5)。',
      hint: '工具栏选择「粗实线」，在俯视图依次点击 (4,1) 和 (4,5)。',
      weight: 25,
      checkpoints: [
        {
          description: '俯视图台阶分界粗实线 (4,1)-(4,5) 正确',
          ruleType: 'sketch_line_exists',
          params: { view: 'top', x1: 4, y1: 1, x2: 4, y2: 5, style: 'solid' },
        },
      ],
    },
    {
      instruction: '在【俯视图】中用“虚线”补齐被顶部遮挡的通槽内壁轮廓线 (2,1)-(2,5)。',
      hint: '切换到「虚线」工具，连接俯视图坐标 (2,1) 与 (2,5)。',
      weight: 25,
      checkpoints: [
        {
          description: '俯视图不可见通槽虚线 (2,1)-(2,5) 正确',
          ruleType: 'sketch_line_exists',
          params: { view: 'top', x1: 2, y1: 1, x2: 2, y2: 5, style: 'dashed' },
        },
      ],
    },
    {
      instruction: '在【左视图】中用“虚线”补齐后方台阶面水平投影线 (1,3)-(5,3)。',
      hint: '按“高平齐”对准主视图 y=3，在左视图用「虚线」连接 (1,3)-(5,3)。',
      weight: 25,
      checkpoints: [
        {
          description: '左视图台阶隐藏轮廓虚线 (1,3)-(5,3) 正确',
          ruleType: 'sketch_line_exists',
          params: { view: 'left', x1: 1, y1: 3, x2: 5, y2: 3, style: 'dashed' },
        },
      ],
    },
    {
      instruction: '在主视图尺寸标注栏中，将“总长 L (mm)”设为 60，“总高 H (mm)”设为 40。',
      hint: '在下方尺寸标注框分别填写 60 和 40。',
      weight: 15,
      checkpoints: [
        {
          description: '主视图总长尺寸标注为 60',
          ruleType: 'sketch_dimension_match',
          params: { view: 'front', label: '总长', expectedValue: '60' },
        },
      ],
    },
    {
      instruction: '在【俯视图】中用“点画线”绘制对称中心线 (1,3)-(7,3)。',
      hint: '选择「点画线」，在俯视图中间行 y=3 绘制对称中心轴线 (1,3)-(7,3)。',
      weight: 10,
      checkpoints: [
        {
          description: '俯视图对称中心点画线 (1,3)-(7,3) 正确',
          ruleType: 'sketch_line_exists',
          params: { view: 'top', x1: 1, y1: 3, x2: 7, y2: 3, style: 'center' },
        },
      ],
    },
  ];

  return {
    title: `三视图补线与标注实操：${theme}（${params.difficulty}）`,
    scenario: `给出「${theme}」的主视图及俯、左视图外框轮廓。请根据正投影“长对正、高平齐、宽相等”规律，在三视图画板上补齐缺失轮廓线与尺寸标注。`,
    materialsDesc: '标准三视图网格画板，支持粗实线、虚线、点画线绘制及尺寸标注。',
    initialState,
    referenceAnswer,
    bundles,
    analysis: [
      '长对正：主视图与俯视图左右 x 坐标一一对应（x=2 与 x=4）。',
      '高平齐：主视图与左视图上下 y 高度一一对应（y=3 台阶面）。',
    ],
    commonMistakes: [
      '把看不见的内部孔槽棱线误画成粗实线（应为虚线）。',
    ],
    defaultKps: [
      '正投影原理与“长对正、高平齐、宽相等”规律',
      '不可见轮廓线（细虚线）判断与绘制',
    ],
  };
}

function buildCircuitTemplate(params: TemplateGenParams): {
  title: string;
  scenario: string;
  materialsDesc: string;
  initialState: SimulatorState;
  referenceAnswer: SimulatorState;
  bundles: StepBundle[];
  analysis: string[];
  commonMistakes: string[];
  defaultKps: string[];
} {
  const theme = extractThemeTitle(params.customPrompt, '智能温室高温报警电路');
  const initialState: SimulatorState = {
    title: theme,
    powered: false,
    lightLevel: 50,
    tempC: 42,
    components: [
      { id: 'vcc', type: 'vcc', label: '+5V 电源', x: 70, y: 70, pins: ['out'] },
      { id: 'sw1', type: 'switch', label: '总开关 S1', x: 200, y: 70, pins: ['a', 'b'], closed: true },
      { id: 'ntc1', type: 'sensor_temp', label: '热敏 RT (≥35℃导通)', x: 200, y: 170, pins: ['a', 'b'], value: '>=35' },
      { id: 'q1', type: 'transistor_npn', label: '三极管 VT1', x: 360, y: 200, pins: ['b', 'c', 'e'] },
      { id: 'bz1', type: 'buzzer', label: '蜂鸣器 HA', x: 480, y: 70, pins: ['a', 'b'] },
      { id: 'r1', type: 'resistor', label: '限流电阻 R1', x: 480, y: 165, pins: ['a', 'b'], value: '470Ω' },
      { id: 'gnd', type: 'gnd', label: '接地 GND', x: 360, y: 300, pins: ['in'] },
    ],
    wires: [
      { from: 'vcc.out', to: 'sw1.a' },
      { from: 'sw1.b', to: 'ntc1.a' },
      { from: 'vcc.out', to: 'bz1.a' },
      { from: 'q1.e', to: 'gnd.in' },
    ],
  };

  const referenceAnswer: SimulatorState = {
    ...initialState,
    powered: true,
    tempC: 42,
    wires: [
      { from: 'vcc.out', to: 'sw1.a' },
      { from: 'sw1.b', to: 'ntc1.a' },
      { from: 'vcc.out', to: 'bz1.a' },
      { from: 'q1.e', to: 'gnd.in' },
      { from: 'ntc1.b', to: 'q1.b' },
      { from: 'bz1.b', to: 'r1.a' },
      { from: 'r1.b', to: 'q1.c' },
    ],
  };

  const bundles: StepBundle[] = [
    {
      instruction: '将热敏传感器输出端 (ntc1.b) 连接到 NPN 三极管 VT1 的基极 (q1.b)。',
      hint: '点击 ntc1.b 引脚圆点，再点击 q1.b 引脚圆点完成导线连接。',
      weight: 30,
      checkpoints: [
        {
          description: '热敏传感器 ntc1.b 与三极管基极 q1.b 连接正确',
          ruleType: 'circuit_wire_connected',
          params: { from: 'ntc1.b', to: 'q1.b' },
        },
      ],
    },
    {
      instruction: '将蜂鸣器下端 (bz1.b) 连接至限流电阻 R1 (r1.a)。',
      hint: '依次点击 bz1.b 和 r1.a。',
      weight: 25,
      checkpoints: [
        {
          description: '蜂鸣器 bz1.b 与限流电阻 r1.a 连接正确',
          ruleType: 'circuit_wire_connected',
          params: { from: 'bz1.b', to: 'r1.a' },
        },
      ],
    },
    {
      instruction: '将限流电阻另一端 (r1.b) 接到三极管集电极 (q1.c)，形成驱动回路。',
      hint: '依次点击 r1.b 和 q1.c 完成开关回路闭环。',
      weight: 20,
      checkpoints: [
        {
          description: '限流电阻 r1.b 与集电极 q1.c 连接正确',
          ruleType: 'circuit_wire_connected',
          params: { from: 'r1.b', to: 'q1.c' },
        },
      ],
    },
    {
      instruction: '开启「电源总开关」，测试高温 (42℃) 时蜂鸣器鸣响、常温 (22℃) 时停止报警。',
      hint: '点击电源开关使其通电，调整温度滑块验证高低温度切换效应。',
      weight: 25,
      checkpoints: [
        {
          description: '高温工况 (42℃) 下蜂鸣器 HA 成功触发鸣响',
          ruleType: 'circuit_sim_output',
          params: { testPowered: true, testTempC: 42, activeOutputIds: ['bz1'], expectActive: true },
        },
      ],
    },
  ];

  return {
    title: `电子控制电路连线与调试：${theme}（${params.difficulty}）`,
    scenario: `设计「${theme}」，当环境温度 ≥ 35℃ 时热敏传感器导通，触发三极管 VT1 开关导通，驱动蜂鸣器 HA 鸣响报警。请完成实验板缺失接线并通电调试。`,
    materialsDesc: '交互式电子控制实验板，包含 +5V 电源、热敏传感器、NPN 三极管、限流电阻与蜂鸣器。',
    initialState,
    referenceAnswer,
    bundles,
    analysis: [
      '传感器控制信号输入到 NPN 三极管基极 B，发射极 E 接地，集电极 C 串联负载与限流电阻接电源正极。',
    ],
    commonMistakes: [
      '把传感信号接错到发射极 E 或漏接限流电阻造成电流过大/短路。',
    ],
    defaultKps: [
      '热敏传感器（NTC/PTC）温度阈值控制应用',
      'NPN 型三极管放大与开关状态（基极 B 触发导通）',
    ],
  };
}

function buildStructureTemplate(params: TemplateGenParams): {
  title: string;
  scenario: string;
  materialsDesc: string;
  initialState: SimulatorState;
  referenceAnswer: SimulatorState;
  bundles: StepBundle[];
  analysis: string[];
  commonMistakes: string[];
  defaultKps: string[];
} {
  const theme = extractThemeTitle(params.customPrompt, '户外广告牌支撑桁架');
  const initialState: SimulatorState = {
    taskTitle: theme,
    nodes: [
      { id: 'A', x: 70, y: 200, label: '左支座 A', fixed: true },
      { id: 'B', x: 250, y: 200, label: '右支座 B', fixed: true },
      { id: 'C', x: 250, y: 65, label: '右上角 C' },
      { id: 'D', x: 70, y: 65, label: '左上角 D' },
    ],
    baseMembers: [
      { from: 'A', to: 'B', material: 'wood' },
      { from: 'B', to: 'C', material: 'wood' },
      { from: 'C', to: 'D', material: 'wood' },
      { from: 'D', to: 'A', material: 'wood' },
    ],
    members: [],
    jointType: 'hinged',
    supportBaseWidth: 90,
    testLoadN: 240,
  };

  const referenceAnswer: SimulatorState = {
    ...initialState,
    members: [{ from: 'A', to: 'C', material: 'steel' }],
    jointType: 'rigid',
    supportBaseWidth: 150,
  };

  const bundles: StepBundle[] = [
    {
      instruction: '选用“钢材 (steel)”，在节点 A 与 C 之间添加一条对角线斜撑杆件。',
      hint: '材料栏点击「钢材」，依次点击节点 A 与节点 C。',
      weight: 35,
      checkpoints: [
        {
          description: '在节点 A 与 C 之间添加了钢材斜撑杆件',
          ruleType: 'structure_member_exists',
          params: { from: 'A', to: 'C', material: 'steel' },
        },
      ],
    },
    {
      instruction: '将节点连接方式从“铰连接”切换为“刚连接”。',
      hint: '在连接方式控制按钮组点击「刚连接」。',
      weight: 20,
      checkpoints: [
        {
          description: '节点连接方式已设置为刚连接',
          ruleType: 'structure_joint_style',
          params: { jointType: 'rigid' },
        },
      ],
    },
    {
      instruction: '将底座支撑宽度滑块拖动增大至不少于 140 mm，增强抗倾倒稳定性。',
      hint: '调宽底座支撑宽度至 ≥ 140 mm。',
      weight: 20,
      checkpoints: [
        {
          description: '底座支撑宽度不小于 140 mm',
          ruleType: 'structure_joint_style',
          params: { minBaseWidth: 140 },
        },
      ],
    },
    {
      instruction: '观察荷载测评区，确保形成 ≥ 2 个稳定三角形且安全系数 ≥ 1.2 承载 240 N 载荷。',
      hint: '完成斜撑、刚连接和扩宽底座后即可通过稳态测试。',
      weight: 25,
      checkpoints: [
        {
          description: '结构形成 ≥ 2 个三角形且安全系数 ≥ 1.2',
          ruleType: 'structure_load_safe',
          params: { minTriangles: 2, minSafetyFactor: 1.2 },
        },
      ],
    },
  ];

  return {
    title: `结构稳定性与承载加固设计：${theme}（${params.difficulty}）`,
    scenario: `针对「${theme}」矩形基础框架，在顶部施加 240 N 载荷测试。请通过增设斜撑、优化连接方式及底座支撑宽度，使其满足安全系数 ≥ 1.2 的稳固要求。`,
    materialsDesc: '交互式二维桁架力学实验台，支持杆件选材连线、连接方式切换与实时安全系数验算。',
    initialState,
    referenceAnswer,
    bundles,
    analysis: [
      '三角形结构具有几何不变性，能显著增强框架抗侧向变形与抗压承载能力。',
    ],
    commonMistakes: [
      '保留铰连接且未加斜撑导致框架受压变形倾倒。',
    ],
    defaultKps: [
      '三角形稳定性原理与四边形框架斜撑加固',
      '连接方式（铰连接与刚连接）对强度和变形的影响',
    ],
  };
}

function buildControlTemplate(params: TemplateGenParams): {
  title: string;
  scenario: string;
  materialsDesc: string;
  initialState: SimulatorState;
  referenceAnswer: SimulatorState;
  bundles: StepBundle[];
  analysis: string[];
  commonMistakes: string[];
  defaultKps: string[];
} {
  const theme = extractThemeTitle(params.customPrompt, '智能恒温孵化箱');
  const initialState: SimulatorState = {
    systemTitle: `${theme}温度控制系统`,
    mode: 'open',
    availableOptions: [
      '设定目标温度(37.8℃)',
      '温度比较器',
      '单片机控制器',
      '电加热丝',
      '孵化箱内部空间',
      '箱内实际温度',
      '热敏温度传感器',
    ],
    slots: {
      input: '',
      comparator: '',
      controller: '',
      actuator: '',
      plant: '',
      sensor: '',
      output: '',
    },
    hasFeedbackEdge: false,
    disturbance: '箱门开启热量散失',
  };

  const referenceAnswer: SimulatorState = {
    ...initialState,
    mode: 'closed',
    slots: {
      input: '设定目标温度(37.8℃)',
      comparator: '温度比较器',
      controller: '单片机控制器',
      actuator: '电加热丝',
      plant: '孵化箱内部空间',
      sensor: '热敏温度传感器',
      output: '箱内实际温度',
    },
    hasFeedbackEdge: true,
  };

  const bundles: StepBundle[] = [
    {
      instruction: '根据“实时测温并反馈对比”的控制特征，将控制类型设为“闭环控制”。',
      hint: '点击顶部控制类型按钮「闭环控制」。',
      weight: 20,
      checkpoints: [
        {
          description: '控制模式设为闭环控制',
          ruleType: 'control_mode_match',
          params: { expectedMode: 'closed' },
        },
      ],
    },
    {
      instruction: '指派控制器方框为“单片机控制器”，执行器方框为“电加热丝”。',
      hint: '在控制器与执行器槽位下拉选择对应器件。',
      weight: 30,
      checkpoints: [
        {
          description: '控制器与执行器选配正确',
          ruleType: 'control_slot_match',
          params: { slot: 'controller', expectedValue: '单片机控制器' },
        },
      ],
    },
    {
      instruction: '指派被控对象为“孵化箱内部空间”，给定量为“设定目标温度(37.8℃)”，被控量为“箱内实际温度”。',
      hint: '区分给定量（输入期望）与被控量（实际输出）及被控对象。',
      weight: 25,
      checkpoints: [
        {
          description: '被控对象配置正确',
          ruleType: 'control_slot_match',
          params: { slot: 'plant', expectedValue: '孵化箱内部空间' },
        },
      ],
    },
    {
      instruction: '选配比较器（温度比较器）、检测装置（热敏温度传感器），并开启“连接检测反馈通道”。',
      hint: '勾选连接反馈通道并选择检测传感器与比较器。',
      weight: 25,
      checkpoints: [
        {
          description: '闭环反馈回路及检测传感器完整',
          ruleType: 'control_feedback_valid',
          params: { expectFeedback: true },
        },
      ],
    },
  ];

  return {
    title: `控制系统框图分析与设计：${theme}（${params.difficulty}）`,
    scenario: `某「${theme}」要求精准维持 37.8℃ 恒温环境，采用传感器监测箱内温度并与设定值比较，进而控制电加热丝通断。请完成控制模式判断、各环节填图及反馈通道搭建。`,
    materialsDesc: '控制系统方框图编辑器，支持开闭环模式切换与信号槽位配置。',
    initialState,
    referenceAnswer,
    bundles,
    analysis: [
      '单片机为控制核心（控制器），电加热丝执行加热动作（执行器），传感器构成闭环负反馈。',
    ],
    commonMistakes: [
      '混淆执行器与被控对象。',
      '闭环系统遗漏开启反馈连线或传感器方框。',
    ],
    defaultKps: [
      '闭环控制系统组成（比较器、检测装置与反馈环节）',
      '控制器（决策核心）与执行器（动作部件）识别选配',
    ],
  };
}

function buildCraftTemplate(params: TemplateGenParams): {
  title: string;
  scenario: string;
  materialsDesc: string;
  initialState: SimulatorState;
  referenceAnswer: SimulatorState;
  bundles: StepBundle[];
  analysis: string[];
  commonMistakes: string[];
  defaultKps: string[];
} {
  const theme = extractThemeTitle(params.customPrompt, '扁钢书挡支架');
  const initialState: SimulatorState = {
    taskTitle: `${theme}金工加工与质检`,
    availableSteps: ['锉削去毛刺', '划线与样冲冲眼', '锯割下料', '台钻钻安装孔', '弯折与表面涂漆'],
    orderedSteps: [],
    availableTools: ['划针与钢直尺', '手锯与台虎钳', '板锉与角尺', '台钻与平口钳', '折弯机与防锈漆'],
    selectedTools: {},
    safetyOptions: [
      '台钻钻孔时严禁佩戴手套',
      '钻孔前用平口钳夹紧工件',
      '钻孔时佩戴护目镜防护碎屑',
      '戴线手套防止钻头划伤手指',
    ],
    safetyChecks: [],
    caliperMainMm: 18,
    caliperVernierDiv: 4,
    caliperReading: '',
  };

  const referenceAnswer: SimulatorState = {
    ...initialState,
    orderedSteps: ['划线与样冲冲眼', '锯割下料', '锉削去毛刺', '台钻钻安装孔', '弯折与表面涂漆'],
    selectedTools: {
      '划线与样冲冲眼': '划针与钢直尺',
      '锯割下料': '手锯与台虎钳',
      '锉削去毛刺': '板锉与角尺',
      '台钻钻安装孔': '台钻与平口钳',
      '弯折与表面涂漆': '折弯机与防锈漆',
    },
    safetyChecks: [
      '台钻钻孔时严禁佩戴手套',
      '钻孔前用平口钳夹紧工件',
      '钻孔时佩戴护目镜防护碎屑',
    ],
    caliperReading: '18.20',
  };

  const bundles: StepBundle[] = [
    {
      instruction: '按金工工艺顺序依次排好 5 道工序：划线与样冲冲眼 → 锯割下料 → 锉削去毛刺 → 台钻钻安装孔 → 弯折与表面涂漆。',
      hint: '点击待选工序加入工艺卡列表，按“划线→锯→锉→钻→弯折涂饰”排列。',
      weight: 30,
      checkpoints: [
        {
          description: '5 道金工工艺流程顺序完全正确',
          ruleType: 'craft_order_before',
          params: {
            exactOrder: ['划线与样冲冲眼', '锯割下料', '锉削去毛刺', '台钻钻安装孔', '弯折与表面涂漆'],
          },
        },
      ],
    },
    {
      instruction: '为「划线与样冲冲眼」选配“划针与钢直尺”，为「台钻钻安装孔」选配“台钻与平口钳”。',
      hint: '在已排好的工艺卡片右侧选配工量具下拉框中选择。',
      weight: 25,
      checkpoints: [
        {
          description: '划线工序工量具选配正确',
          ruleType: 'craft_tool_match',
          params: { step: '划线与样冲冲眼', expectedTool: '划针与钢直尺' },
        },
      ],
    },
    {
      instruction: '在安全操作规范中勾选全部 3 项正确做法，并确保不勾选“戴线手套防止钻头划伤手指”。',
      hint: '台钻钻孔时严禁戴手套，必须使用平口钳夹紧工件并佩戴护目镜。',
      weight: 20,
      checkpoints: [
        {
          description: '安全操作规范勾选完整且无违规操作',
          ruleType: 'craft_safety_checked',
          params: {
            requiredChecks: [
              '台钻钻孔时严禁佩戴手套',
              '钻孔前用平口钳夹紧工件',
              '钻孔时佩戴护目镜防护碎屑',
            ],
            forbiddenChecks: ['戴线手套防止钻头划伤手指'],
          },
        },
      ],
    },
    {
      instruction: '读出右侧 20 分度游标卡尺测量值（主尺 18mm，游标第 4 格对齐），填入 18.20 mm。',
      hint: '18 + 4 × 0.05 = 18.20 mm。',
      weight: 25,
      checkpoints: [
        {
          description: '20分度游标卡尺读数 18.20 mm 正确',
          ruleType: 'craft_reading_approx',
          params: { expectedReading: 18.2, tolerance: 0.03 },
        },
      ],
    },
  ];

  return {
    title: `加工工艺流程与精密测量：${theme}（${params.difficulty}）`,
    scenario: `某通用技术小组计划制作「${theme}」，请规划规范的金属加工工艺流程、选配各环节工量具、核查安全守则并完成游标卡尺读数。`,
    materialsDesc: '工艺排序与游标卡尺仿真检验台。',
    initialState,
    referenceAnswer,
    bundles,
    analysis: [
      '遵循先基准划线后切削整形、先钻孔后弯折涂饰的安全加工原则。',
      '20分度游标卡尺精度 0.05mm，18mm + 4×0.05mm = 18.20mm。',
    ],
    commonMistakes: [
      '先弯折后钻孔导致无法在台钻平面稳固夹持。',
      '误勾选“钻孔戴线手套”。',
    ],
    defaultKps: [
      '金属加工通用流程（划线→锯割→锉削→钻孔→装配）',
      '游标卡尺主尺整毫米数与游标对齐格数读数方法',
    ],
  };
}

export function generateQuestionFromTemplate(
  params: TemplateGenParams
): Question {
  const stepCount = Math.max(3, Math.min(8, params.stepCount || 4));
  const totalScore = Math.max(10, Math.min(200, params.totalScore || 100));
  const idPrefix = `tpl-${params.type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

  const built =
    params.type === 'word'
      ? buildWordTemplate(params)
      : params.type === 'excel'
        ? buildExcelTemplate(params)
        : params.type === 'web'
          ? buildWebTemplate(params)
          : params.type === 'file'
            ? buildFileTemplate(params)
            : params.type === 'python'
              ? buildPythonTemplate(params)
              : params.type === 'database'
                ? buildDatabaseTemplate(params)
                : params.type === 'sketch3view'
                  ? buildSketch3ViewTemplate(params)
                  : params.type === 'circuit'
                    ? buildCircuitTemplate(params)
                    : params.type === 'structure'
                      ? buildStructureTemplate(params)
                      : params.type === 'control'
                        ? buildControlTemplate(params)
                        : buildCraftTemplate(params);

  const { steps, checkpoints } = buildStepsAndCheckpoints(
    built.bundles,
    stepCount,
    totalScore,
    idPrefix
  );

  // Self-verify against deterministic grader
  const selfCheck = gradeAnswerDeterministic(
    params.type,
    checkpoints,
    built.referenceAnswer
  );
  if (selfCheck.autoScore < selfCheck.maxScore) {
    const failed = selfCheck.checkpointResults
      .filter((c) => !c.passed)
      .map((c) => c.feedback)
      .join('; ');
    throw new Error(`模板自检未通过: ${failed}`);
  }

  const now = new Date().toISOString();
  const kps =
    params.knowledgePoints && params.knowledgePoints.length > 0
      ? params.knowledgePoints
      : built.defaultKps;

  return {
    id: idPrefix,
    subjectId: getSubjectForType(params.type),
    title: built.title,
    type: params.type,
    difficulty: params.difficulty,
    knowledgePoints: kps,
    knowledgePointIds: params.knowledgePointIds || [],
    scenario: built.scenario,
    totalScore: selfCheck.maxScore,
    materials: {
      description: built.materialsDesc,
      initialState: built.initialState,
    },
    steps,
    checkpoints,
    referenceAnswer: built.referenceAnswer,
    analysis: built.analysis,
    commonMistakes: built.commonMistakes,
    status: 'published',
    source: 'ai',
    ownerId: params.ownerId || 'system',
    visibility: params.visibility || 'private',
    createdAt: now,
    updatedAt: now,
  };
}

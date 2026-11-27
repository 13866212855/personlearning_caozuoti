import type { Question } from '../types';

const now = new Date().toISOString();

export const SEED_QUESTIONS: Question[] = [
  // ================= WORD 1 =================
  {
    id: 'seed-word-1',
    title: '校园科技创新节活动通知排版',
    type: 'word',
    difficulty: '基础',
    knowledgePoints: ['字体与段落格式', '查找与替换', '表格制作', '页眉设置'],
    scenario:
      '学校教务处起草了一份《关于举办校园科技创新节的通知》初稿，请你按照高中信息技术会考排版规范完成文字格式、查找替换、活动日程表及页眉设置。',
    totalScore: 100,
    materials: {
      description: '已提供通知正文初稿，请直接修改段落格式、替换错别字并补充日程表和页眉。',
      initialState: {
        paragraphs: [
          {
            id: 'p1',
            text: '关于举办校园科技创新节的通知',
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
            text: '各位同学：为培养同学们的科学探索精神与信息实践能力，学校决定于本月开展“校园科技创新节”系列活动。本次活动包含信息技术竞赛与创客展示，欢迎全体高一、高二同学积极报名参加。',
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
            id: 'p3',
            text: '请各班信息委员于周五前汇总本班参赛名单并提交至实验楼信息中心。',
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
      },
    },
    steps: [
      {
        index: 1,
        instruction: '将第 1 段标题“关于举办校园科技创新节的通知”设置为：黑体、18pt、加粗、居中对齐。',
        score: 25,
        hint: '选中第一段，在工具栏依次选择字体“黑体”、字号“18”、点击“B”加粗和“居中对齐”。',
      },
      {
        index: 2,
        instruction: '将第 2 段正文设置为：首行缩进 2 字符，1.5 倍行距。',
        score: 20,
        hint: '光标定位到第 2 段，点击工具栏的“首行缩进 2 字符”和行距“1.5”。',
      },
      {
        index: 3,
        instruction: '使用“查找和替换”功能，将文档中所有的“信息委员”替换为“信息课代表”。',
        score: 20,
        hint: '点击工具栏“查找替换”，查找内容填“信息委员”，替换为填“信息课代表”，点击全部替换。',
      },
      {
        index: 4,
        instruction: '插入一个 3 行 2 列的表格，第 1 行第 1 列填入“活动项目”，第 1 行第 2 列填入“地点”。',
        score: 20,
        hint: '点击“插入表格”，设置 3 行 2 列，并在第 1 行输入对应表头。',
      },
      {
        index: 5,
        instruction: '设置文档页眉文字为“校园科技创新节组委会”。',
        score: 15,
        hint: '在页面顶部页眉输入框中输入“校园科技创新节组委会”。',
      },
    ],
    checkpoints: [
      {
        id: 'cp-w1-1',
        stepIndex: 1,
        description: '标题为黑体、18pt、加粗、居中对齐',
        score: 25,
        ruleType: 'word_paragraph_style',
        params: {
          paragraphIndex: 0,
          fontFamily: '黑体',
          fontSize: 18,
          bold: true,
          align: 'center',
        },
      },
      {
        id: 'cp-w1-2',
        stepIndex: 2,
        description: '第 2 段设置首行缩进 2 字符与 1.5 倍行距',
        score: 20,
        ruleType: 'word_paragraph_style',
        params: {
          paragraphIndex: 1,
          indent: 2,
          lineHeight: 1.5,
        },
      },
      {
        id: 'cp-w1-3',
        stepIndex: 3,
        description: '完成“信息委员”→“信息课代表”全部替换',
        score: 20,
        ruleType: 'word_text_not_contains',
        params: { text: '信息委员' },
      },
      {
        id: 'cp-w1-4',
        stepIndex: 4,
        description: '插入至少 3 行 2 列表格并填写表头',
        score: 20,
        ruleType: 'word_table_exists',
        params: {
          minRows: 3,
          minCols: 2,
          cellChecks: [
            { row: 0, col: 0, equals: '活动项目' },
            { row: 0, col: 1, equals: '地点' },
          ],
        },
      },
      {
        id: 'cp-w1-5',
        stepIndex: 5,
        description: '页眉包含“校园科技创新节组委会”',
        score: 15,
        ruleType: 'word_header_footer',
        params: { headerContains: '校园科技创新节组委会' },
      },
    ],
    referenceAnswer: {
      paragraphs: [
        {
          id: 'p1',
          text: '关于举办校园科技创新节的通知',
          fontFamily: '黑体',
          fontSize: 18,
          color: '#000000',
          bold: true,
          italic: false,
          underline: false,
          align: 'center',
          lineHeight: 1.0,
          indent: 0,
          listType: 'none',
        },
        {
          id: 'p2',
          text: '各位同学：为培养同学们的科学探索精神与信息实践能力，学校决定于本月开展“校园科技创新节”系列活动。本次活动包含信息技术竞赛与创客展示，欢迎全体高一、高二同学积极报名参加。',
          fontFamily: '宋体',
          fontSize: 12,
          color: '#000000',
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
          text: '请各班信息课代表于周五前汇总本班参赛名单并提交至实验楼信息中心。',
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
      ],
      tables: [
        {
          id: 't1',
          rows: [
            ['活动项目', '地点'],
            ['程序设计竞赛', '机房 1 室'],
            ['人工智能创客展', '科技馆大厅'],
          ],
        },
      ],
      images: [],
      headerText: '校园科技创新节组委会',
      footerText: '',
      pageSetup: {
        orientation: 'portrait',
        marginTop: 2.54,
        marginBottom: 2.54,
        marginLeft: 3.18,
        marginRight: 3.18,
      },
    },
    analysis: [
      '步骤 1：选中第 1 段标题 → 字体设为“黑体”、字号“18”、点击加粗“B” → 对齐方式选“居中”。',
      '步骤 2：选中第 2 段 → 段落设置中将首行缩进设为“2 字符”，行距设为“1.5 倍”。',
      '步骤 3：点击“查找和替换” → 查找“信息委员”，替换为“信息课代表” → 点击“全部替换”。',
      '步骤 4：点击“插入表格” → 行数 3、列数 2 → 在第 1 行依次输入“活动项目”和“地点”。',
      '步骤 5：在页眉区域输入“校园科技创新节组委会”。',
    ],
    commonMistakes: [
      '忘记取消第 1 段的首行缩进导致标题居中偏移（本例第 1 段默认为 0 缩进）。',
      '查找替换时只点了一次“替换”而非“全部替换”，或输入多余空格。',
      '表格行列数颠倒，建成了 2 行 3 列而非 3 行 2 列。',
    ],
    status: 'published',
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  },

  // ================= WORD 2 =================
  {
    id: 'seed-word-2',
    title: '高中生信息素养调查报告图文编排',
    type: 'word',
    difficulty: '中等',
    knowledgePoints: ['项目符号', '图文混排', '页面设置', '文字颜色与下划线'],
    scenario:
      '某研究性学习小组完成了《高中生信息素养调查报告》的文字撰写，需要你对报告进行专业排版，并插入配图与设置横向页面版式。',
    totalScore: 100,
    materials: {
      description: '提供报告文字稿和一张可用插图素材“信息素养结构图”。',
      assets: [
        {
          name: '信息素养结构图',
          url: '/api/seed-assets/info-literacy.svg',
          note: '用于报告第 3 步插入图片',
        },
      ],
      initialState: {
        paragraphs: [
          {
            id: 'p1',
            text: '高中生信息素养调查报告',
            fontFamily: '宋体',
            fontSize: 14,
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
            text: '一、信息意识与信息获取能力',
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
            id: 'p3',
            text: '能够利用搜索引擎精确检索学习资料，并甄别信息来源的权威性。',
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
            id: 'p4',
            text: '二、数字化学习与信息社会责任',
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
      },
    },
    steps: [
      {
        index: 1,
        instruction: '将主标题“高中生信息素养调查报告”设为：微软雅黑、20pt、深蓝色(#1D4ED8)、加粗、居中对齐。',
        score: 25,
        hint: '选中第 1 段，设置字体微软雅黑、字号 20、文字颜色选择深蓝 #1D4ED8、加粗并居中。',
      },
      {
        index: 2,
        instruction: '将第 2 段小标题添加“下划线”，并将第 3 段设置为“项目符号”列表（bullet）。',
        score: 25,
        hint: '第 2 段点击工具栏“U”下划线；第 3 段点击“项目符号”按钮。',
      },
      {
        index: 3,
        instruction: '从素材中插入“信息素养结构图”图片，并将替代文本（alt）设置为“信息素养结构图”。',
        score: 25,
        hint: '点击“插入图片”，选择素材图片并填写替代文本为“信息素养结构图”。',
      },
      {
        index: 4,
        instruction: '打开“页面设置”，将纸张方向改为“横向”，上下页边距均设为 2.0 cm，并在页脚填入“第 1 页”。',
        score: 25,
        hint: '点击“页面设置”，切换横向并修改上、下边距为 2；在页脚输入“第 1 页”。',
      },
    ],
    checkpoints: [
      {
        id: 'cp-w2-1',
        stepIndex: 1,
        description: '主标题样式：微软雅黑、20pt、#1D4ED8、加粗、居中',
        score: 25,
        ruleType: 'word_paragraph_style',
        params: {
          paragraphIndex: 0,
          fontFamily: '微软雅黑',
          fontSize: 20,
          color: '#1D4ED8',
          bold: true,
          align: 'center',
        },
      },
      {
        id: 'cp-w2-2a',
        stepIndex: 2,
        description: '第 2 段小标题添加下划线',
        score: 12,
        ruleType: 'word_paragraph_style',
        params: { paragraphIndex: 1, underline: true },
      },
      {
        id: 'cp-w2-2b',
        stepIndex: 2,
        description: '第 3 段设置项目符号列表',
        score: 13,
        ruleType: 'word_paragraph_style',
        params: { paragraphIndex: 2, listType: 'bullet' },
      },
      {
        id: 'cp-w2-3',
        stepIndex: 3,
        description: '插入图片且替代文本包含“信息素养结构图”',
        score: 25,
        ruleType: 'word_image_exists',
        params: { minCount: 1, requireAlt: true, altContains: '信息素养结构图' },
      },
      {
        id: 'cp-w2-4a',
        stepIndex: 4,
        description: '页面方向为横向，上下边距 2.0 cm',
        score: 15,
        ruleType: 'word_page_setup',
        params: { orientation: 'landscape', marginTop: 2.0, marginBottom: 2.0 },
      },
      {
        id: 'cp-w2-4b',
        stepIndex: 4,
        description: '页脚包含“第 1 页”',
        score: 10,
        ruleType: 'word_header_footer',
        params: { footerContains: '第 1 页' },
      },
    ],
    referenceAnswer: {
      paragraphs: [
        {
          id: 'p1',
          text: '高中生信息素养调查报告',
          fontFamily: '微软雅黑',
          fontSize: 20,
          color: '#1D4ED8',
          bold: true,
          italic: false,
          underline: false,
          align: 'center',
          lineHeight: 1.0,
          indent: 0,
          listType: 'none',
        },
        {
          id: 'p2',
          text: '一、信息意识与信息获取能力',
          fontFamily: '宋体',
          fontSize: 12,
          color: '#000000',
          bold: false,
          italic: false,
          underline: true,
          align: 'left',
          lineHeight: 1.0,
          indent: 0,
          listType: 'none',
        },
        {
          id: 'p3',
          text: '能够利用搜索引擎精确检索学习资料，并甄别信息来源的权威性。',
          fontFamily: '宋体',
          fontSize: 12,
          color: '#000000',
          bold: false,
          italic: false,
          underline: false,
          align: 'left',
          lineHeight: 1.0,
          indent: 0,
          listType: 'bullet',
        },
        {
          id: 'p4',
          text: '二、数字化学习与信息社会责任',
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
      ],
      tables: [],
      images: [
        {
          id: 'img1',
          src: '/api/seed-assets/info-literacy.svg',
          alt: '信息素养结构图',
          width: 360,
          align: 'center',
        },
      ],
      headerText: '',
      footerText: '第 1 页',
      pageSetup: {
        orientation: 'landscape',
        marginTop: 2.0,
        marginBottom: 2.0,
        marginLeft: 3.18,
        marginRight: 3.18,
      },
    },
    analysis: [
      '步骤 1：选中第 1 段 → 设置微软雅黑、20pt、颜色 #1D4ED8、加粗、居中。',
      '步骤 2：第 2 段开启下划线“U”；第 3 段选择项目符号（无序圆点列表）。',
      '步骤 3：点击“插入图片”，选取提供的素材，填写替代文本“信息素养结构图”。',
      '步骤 4：点击“页面设置”，将方向切换为“横向”，上边距与下边距改为 2.0，确定后在页脚输入“第 1 页”。',
    ],
    commonMistakes: [
      '插入图片后忘记填写替代文本（alt 属性）。',
      '页面设置只改了纸张方向，漏掉上、下页边距修改。',
    ],
    status: 'published',
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  },

  // ================= EXCEL 1 =================
  {
    id: 'seed-excel-1',
    title: '高二年级信息技术期中成绩统计表',
    type: 'excel',
    difficulty: '基础',
    knowledgePoints: ['合并居中', 'SUM函数', 'AVERAGE函数', 'RANK函数', '数据排序'],
    scenario:
      '信息技术老师收集了高二(1)班 4 名代表学生的期中测验成绩（理论、操作、综合三部分），请你在电子表格中完成标题合并、函数计算与名次排序。',
    totalScore: 100,
    materials: {
      description: 'A1 为表格主标题，A2:G2 为列标题，第 3~6 行为学生原始成绩数据。',
      initialState: {
        cells: {
          A1: { value: '高二(1)班信息技术期中成绩统计表' },
          A2: { value: '姓名' },
          B2: { value: '理论成绩' },
          C2: { value: '操作成绩' },
          D2: { value: '综合应用' },
          E2: { value: '总分' },
          F2: { value: '平均分' },
          G2: { value: '总分名次' },
          A3: { value: '陈思远' },
          B3: { value: '88' },
          C3: { value: '94' },
          D3: { value: '91' },
          A4: { value: '林语汐' },
          B4: { value: '92' },
          C4: { value: '96' },
          D4: { value: '94' },
          A5: { value: '周子轩' },
          B5: { value: '76' },
          C5: { value: '84' },
          D5: { value: '80' },
          A6: { value: '赵沐阳' },
          B6: { value: '85' },
          C6: { value: '90' },
          D6: { value: '89' },
        },
        merges: [],
        charts: [],
      },
    },
    steps: [
      {
        index: 1,
        instruction: '合并单元格区域 A1:G1，并设置标题居中对齐、加粗。',
        score: 20,
        hint: '框选 A1 到 G1，点击“合并居中”并确保开启加粗“B”。',
      },
      {
        index: 2,
        instruction: '在 E3:E6 中使用 SUM 函数分别计算每位同学的三科总分（如 E3 输入 =SUM(B3:D3)）。',
        score: 25,
        hint: '在 E3 输入 =SUM(B3:D3)，其余行同理填写 E4、E5、E6。',
      },
      {
        index: 3,
        instruction: '在 F3:F6 中使用 AVERAGE 函数分别计算每位同学的平均分（如 F3 输入 =AVERAGE(B3:D3)）。',
        score: 25,
        hint: '在 F3 输入 =AVERAGE(B3:D3)，依次完成 F4、F5、F6。',
      },
      {
        index: 4,
        instruction: '在 G3 中使用 RANK 函数计算陈思远的总分名次：=RANK(E3,E3:E6) 或 =RANK(E3,$E$3:$E$6)。',
        score: 15,
        hint: '在 G3 输入 =RANK(E3,$E$3:$E$6) 计算该生在 E3:E6 中的排名。',
      },
      {
        index: 5,
        instruction: '为数据区域 A2:G6 添加全部边框，并按“E”列总分降序排列。',
        score: 15,
        hint: '选中 A2:G6 点击“边框”，然后选择 E 列执行“降序排序”。',
      },
    ],
    checkpoints: [
      {
        id: 'cp-e1-1',
        stepIndex: 1,
        description: '合并 A1:G1 且 A1 居中加粗',
        score: 20,
        ruleType: 'excel_merge_exists',
        params: { range: 'A1:G1' },
      },
      {
        id: 'cp-e1-2',
        stepIndex: 2,
        description: 'E3 使用 SUM 函数计算总分（结果 273）',
        score: 25,
        ruleType: 'excel_cell_formula',
        params: {
          cell: 'E3',
          expectedFormula: '=SUM(B3:D3)',
          alternateFormulas: ['=B3+C3+D3'],
          expectedValue: 273,
        },
      },
      {
        id: 'cp-e1-3',
        stepIndex: 3,
        description: 'F3 使用 AVERAGE 函数计算平均分（结果 91）',
        score: 25,
        ruleType: 'excel_cell_formula',
        params: {
          cell: 'F3',
          expectedFormula: '=AVERAGE(B3:D3)',
          expectedValue: 91,
        },
      },
      {
        id: 'cp-e1-4',
        stepIndex: 4,
        description: 'G3 使用 RANK 函数计算名次',
        score: 15,
        ruleType: 'excel_cell_formula',
        params: {
          cell: 'G3',
          expectedFormula: '=RANK(E3,E3:E6)',
          alternateFormulas: ['=RANK(E3,$E$3:$E$6)', '=RANK(E3,E3:E6,0)'],
          expectedValue: 2,
        },
      },
      {
        id: 'cp-e1-5',
        stepIndex: 5,
        description: '按 E 列总分执行降序排序',
        score: 15,
        ruleType: 'excel_sort_applied',
        params: { column: 'E', order: 'desc' },
      },
    ],
    referenceAnswer: {
      cells: {
        A1: { value: '高二(1)班信息技术期中成绩统计表', bold: true, align: 'center' },
        A2: { value: '姓名', border: true },
        B2: { value: '理论成绩', border: true },
        C2: { value: '操作成绩', border: true },
        D2: { value: '综合应用', border: true },
        E2: { value: '总分', border: true },
        F2: { value: '平均分', border: true },
        G2: { value: '总分名次', border: true },
        A3: { value: '陈思远', border: true },
        B3: { value: '88', border: true },
        C3: { value: '94', border: true },
        D3: { value: '91', border: true },
        E3: { value: '273', formula: '=SUM(B3:D3)', border: true },
        F3: { value: '91', formula: '=AVERAGE(B3:D3)', border: true },
        G3: { value: '2', formula: '=RANK(E3,$E$3:$E$6)', border: true },
        A4: { value: '林语汐', border: true },
        B4: { value: '92', border: true },
        C4: { value: '96', border: true },
        D4: { value: '94', border: true },
        E4: { value: '282', formula: '=SUM(B4:D4)', border: true },
        F4: { value: '94', formula: '=AVERAGE(B4:D4)', border: true },
        G4: { value: '1', formula: '=RANK(E4,$E$3:$E$6)', border: true },
        A5: { value: '周子轩', border: true },
        B5: { value: '76', border: true },
        C5: { value: '84', border: true },
        D5: { value: '80', border: true },
        E5: { value: '240', formula: '=SUM(B5:D5)', border: true },
        F5: { value: '80', formula: '=AVERAGE(B5:D5)', border: true },
        G5: { value: '4', formula: '=RANK(E5,$E$3:$E$6)', border: true },
        A6: { value: '赵沐阳', border: true },
        B6: { value: '85', border: true },
        C6: { value: '90', border: true },
        D6: { value: '89', border: true },
        E6: { value: '264', formula: '=SUM(B6:D6)', border: true },
        F6: { value: '88', formula: '=AVERAGE(B6:D6)', border: true },
        G6: { value: '3', formula: '=RANK(E6,$E$3:$E$6)', border: true },
      },
      merges: ['A1:G1'],
      charts: [],
      sortInfo: { column: 'E', order: 'desc' },
    },
    analysis: [
      '步骤 1：选中 A1:G1 → 点击工具栏“合并居中” → 点击加粗按钮。',
      '步骤 2：选中 E3 → 输入 `=SUM(B3:D3)`，同理填写 E4~E6。',
      '步骤 3：选中 F3 → 输入 `=AVERAGE(B3:D3)`，同理填写 F4~F6。',
      '步骤 4：选中 G3 → 输入 `=RANK(E3,$E$3:$E$6)`。',
      '步骤 5：选中 A2:G6 添加边框，并在工具栏选择按列 E 降序排序。',
    ],
    commonMistakes: [
      '直接使用心算填入数字 273 而未输入 `=` 开头的公式。',
      'AVERAGE 区域误选了包含总分列 E3（如 `B3:E3`），导致平均分算错。',
    ],
    status: 'published',
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  },

  // ================= EXCEL 2 =================
  {
    id: 'seed-excel-2',
    title: '校园书屋月度图书销售分析与图表',
    type: 'excel',
    difficulty: '中等',
    knowledgePoints: ['IF函数', 'MAX函数', 'COUNTIF函数', '柱形图制作', '数字格式'],
    scenario:
      '学校公益书屋统计了四类畅销图书的月度销售数据，请你使用函数判定畅销等级、统计最高销量与达标数量，并生成直观的柱形图。',
    totalScore: 100,
    materials: {
      description: 'A1:D5 为图书销售记录，请在 D 列判定畅销等级，并在第 6~7 行完成统计，最后插入柱形图。',
      initialState: {
        cells: {
          A1: { value: '图书类别' },
          B1: { value: '单价(元)' },
          C1: { value: '月销量(本)' },
          D1: { value: '销售评级' },
          A2: { value: '人工智能入门' },
          B2: { value: '45' },
          C2: { value: '120' },
          A3: { value: 'Python程序设计' },
          B3: { value: '52' },
          C3: { value: '95' },
          A4: { value: '科学史话' },
          B4: { value: '38' },
          C4: { value: '60' },
          A5: { value: '古典诗词鉴赏' },
          B5: { value: '42' },
          C5: { value: '110' },
          A6: { value: '最高销量' },
          A7: { value: '畅销类目数(>=100)' },
        },
        merges: [],
        charts: [],
      },
    },
    steps: [
      {
        index: 1,
        instruction: '在 D2 中使用 IF 函数判定评级：若 C2>=100 显示“畅销”，否则显示“普通”（公式：=IF(C2>=100,"畅销","普通")）。',
        score: 25,
        hint: '注意英文双引号，公式为 =IF(C2>=100,"畅销","普通")。',
      },
      {
        index: 2,
        instruction: '在 C6 中使用 MAX 函数计算四类图书的最高月销量。',
        score: 20,
        hint: '在 C6 输入 =MAX(C2:C5)。',
      },
      {
        index: 3,
        instruction: '在 C7 中使用 COUNTIF 函数统计月销量 >=100 的图书类目数量（=COUNTIF(C2:C5,">=100")）。',
        score: 20,
        hint: '在 C7 输入 =COUNTIF(C2:C5,">=100")。',
      },
      {
        index: 4,
        instruction: '将表头区域 A1:D1 设置为加粗并填充浅蓝背景色(#E0F2FE)。',
        score: 15,
        hint: '选中 A1:D1，点击加粗并选择填充色 #E0F2FE。',
      },
      {
        index: 5,
        instruction: '插入一张“柱形图”（column），标题设为“图书月销量统计”，类别标签为 A2:A5，数据区域为 C2:C5。',
        score: 20,
        hint: '点击“插入图表”，类型选“柱形图”，标题填“图书月销量统计”，类别区域 A2:A5，数值区域 C2:C5。',
      },
    ],
    checkpoints: [
      {
        id: 'cp-e2-1',
        stepIndex: 1,
        description: 'D2 使用 IF 函数正确判定畅销评级',
        score: 25,
        ruleType: 'excel_cell_formula',
        params: {
          cell: 'D2',
          expectedFormula: '=IF(C2>=100,"畅销","普通")',
          expectedValue: '畅销',
        },
      },
      {
        id: 'cp-e2-2',
        stepIndex: 2,
        description: 'C6 使用 MAX(C2:C5) 计算最高销量（120）',
        score: 20,
        ruleType: 'excel_cell_formula',
        params: {
          cell: 'C6',
          expectedFormula: '=MAX(C2:C5)',
          expectedValue: 120,
        },
      },
      {
        id: 'cp-e2-3',
        stepIndex: 3,
        description: 'C7 使用 COUNTIF 统计畅销数（2）',
        score: 20,
        ruleType: 'excel_cell_formula',
        params: {
          cell: 'C7',
          expectedFormula: '=COUNTIF(C2:C5,">=100")',
          expectedValue: 2,
        },
      },
      {
        id: 'cp-e2-4',
        stepIndex: 4,
        description: '表头 A1:D1 加粗且填充 #E0F2FE',
        score: 15,
        ruleType: 'excel_cell_style',
        params: { range: 'A1:D1', bold: true, bgColor: '#E0F2FE' },
      },
      {
        id: 'cp-e2-5',
        stepIndex: 5,
        description: '插入柱形图“图书月销量统计”（数据区 C2:C5）',
        score: 20,
        ruleType: 'excel_chart_exists',
        params: {
          chartType: 'column',
          titleContains: '图书月销量统计',
          dataRange: 'C2:C5',
        },
      },
    ],
    referenceAnswer: {
      cells: {
        A1: { value: '图书类别', bold: true, bgColor: '#E0F2FE' },
        B1: { value: '单价(元)', bold: true, bgColor: '#E0F2FE' },
        C1: { value: '月销量(本)', bold: true, bgColor: '#E0F2FE' },
        D1: { value: '销售评级', bold: true, bgColor: '#E0F2FE' },
        A2: { value: '人工智能入门' },
        B2: { value: '45' },
        C2: { value: '120' },
        D2: { value: '畅销', formula: '=IF(C2>=100,"畅销","普通")' },
        A3: { value: 'Python程序设计' },
        B3: { value: '52' },
        C3: { value: '95' },
        D3: { value: '普通', formula: '=IF(C3>=100,"畅销","普通")' },
        A4: { value: '科学史话' },
        B4: { value: '38' },
        C4: { value: '60' },
        D4: { value: '普通', formula: '=IF(C4>=100,"畅销","普通")' },
        A5: { value: '古典诗词鉴赏' },
        B5: { value: '42' },
        C5: { value: '110' },
        D5: { value: '畅销', formula: '=IF(C5>=100,"畅销","普通")' },
        A6: { value: '最高销量' },
        C6: { value: '120', formula: '=MAX(C2:C5)' },
        A7: { value: '畅销类目数(>=100)' },
        C7: { value: '2', formula: '=COUNTIF(C2:C5,">=100")' },
      },
      merges: [],
      charts: [
        {
          id: 'ch1',
          type: 'column',
          title: '图书月销量统计',
          labelRange: 'A2:A5',
          dataRange: 'C2:C5',
        },
      ],
    },
    analysis: [
      '步骤 1：在 D2 输入 `=IF(C2>=100,"畅销","普通")`，注意中文引号会导致公式报错。',
      '步骤 2：在 C6 输入 `=MAX(C2:C5)`。',
      '步骤 3：在 C7 输入 `=COUNTIF(C2:C5,">=100")`。',
      '步骤 4：选中 A1:D1，设置加粗及浅蓝填充色 `#E0F2FE`。',
      '步骤 5：点击“插入图表” → 选择柱形图 → 输入标题“图书月销量统计”，标签区域 `A2:A5`，数据区域 `C2:C5`。',
    ],
    commonMistakes: [
      '在 IF 或 COUNTIF 中误用了中文双引号 `“”` 代替英文引号 `""`。',
      '图表的数值区域选成了包含单价列的 `B2:C5`。',
    ],
    status: 'published',
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  },

  // ================= WEB 1 =================
  {
    id: 'seed-web-1',
    title: '非物质文化遗产专题网页制作',
    type: 'web',
    difficulty: '基础',
    knowledgePoints: ['HTML基础标签', '图像与alt属性', '超链接', 'CSS文本与背景'],
    scenario:
      '校广播站正在制作“中国非物质文化遗产”科普展示网页，请你完善 index.html 的页面结构、图片及超链接，并在 styles.css 中设置页面外观。',
    totalScore: 100,
    materials: {
      description: '左侧文件树包含 index.html 和 styles.css，图片素材路径为 /api/seed-assets/heritage.svg。',
      assets: [
        {
          name: '非遗剪纸配图',
          url: '/api/seed-assets/heritage.svg',
          note: '请将该路径填入 img 标签的 src 属性',
        },
      ],
      initialState: {
        files: [
          {
            path: 'index.html',
            name: 'index.html',
            type: 'html',
            content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>中国非物质文化遗产</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="container">
    <!-- 1. 在此处添加 h1 标题 -->

    <p>中国非物质文化遗产凝聚着中华民族千百年的智慧与匠心，包括传统剪纸、青花瓷烧制、京剧与榫卯技艺等。</p>

    <!-- 2. 在此处插入图片与 alt 说明 -->

    <!-- 3. 在此处添加超链接 -->
  </div>
</body>
</html>`,
          },
          {
            path: 'styles.css',
            name: 'styles.css',
            type: 'css',
            content: `body {
  font-family: "Microsoft YaHei", sans-serif;
  margin: 0;
  padding: 24px;
}

.container {
  max-width: 720px;
  margin: 0 auto;
  background: #ffffff;
  padding: 24px;
  border-radius: 8px;
}

/* 4. 在此处设置 h1 居中对齐与颜色 #0F766E */
`,
          },
        ],
      },
    },
    steps: [
      {
        index: 1,
        instruction: '在 index.html 的 container 内添加一级标题 <h1>中国非物质文化遗产</h1>。',
        score: 25,
        hint: '写入 <h1>中国非物质文化遗产</h1>。',
      },
      {
        index: 2,
        instruction: '插入图片标签 <img>，src 指向 /api/seed-assets/heritage.svg，且必须包含非空的 alt 属性（如 alt="非遗剪纸"）。',
        score: 25,
        hint: '<img src="/api/seed-assets/heritage.svg" alt="非遗剪纸" width="320" />',
      },
      {
        index: 3,
        instruction: '添加一个超链接 <a>，文字包含“了解更多”，href 属性设置为 "https://www.ihchina.cn"。',
        score: 25,
        hint: '<a href="https://www.ihchina.cn" target="_blank">了解更多非遗资料</a>',
      },
      {
        index: 4,
        instruction: '在 styles.css 中为 h1 设置 text-align: center; 和 color: #0f766e;。',
        score: 25,
        hint: '在 styles.css 末尾添加 h1 { text-align: center; color: #0f766e; }',
      },
    ],
    checkpoints: [
      {
        id: 'cp-web1-1',
        stepIndex: 1,
        description: '存在 <h1> 且内容包含“中国非物质文化遗产”',
        score: 25,
        ruleType: 'web_html_tag',
        params: {
          file: 'index.html',
          tag: 'h1',
          textContains: '中国非物质文化遗产',
        },
      },
      {
        id: 'cp-web1-2',
        stepIndex: 2,
        description: '存在 <img> 标签且含有效 src 与 alt 属性',
        score: 25,
        ruleType: 'web_html_tag',
        params: {
          file: 'index.html',
          tag: 'img',
          attrs: { src: 'heritage.svg', alt: true },
        },
      },
      {
        id: 'cp-web1-3',
        stepIndex: 3,
        description: '存在指向 ihchina.cn 的 <a> 超链接',
        score: 25,
        ruleType: 'web_html_tag',
        params: {
          file: 'index.html',
          tag: 'a',
          textContains: '了解更多',
          attrs: { href: 'ihchina.cn' },
        },
      },
      {
        id: 'cp-web1-4a',
        stepIndex: 4,
        description: 'styles.css 中 h1 设置 text-align: center',
        score: 12,
        ruleType: 'web_css_rule',
        params: {
          file: 'styles.css',
          selector: 'h1',
          property: 'text-align',
          expectedValue: 'center',
        },
      },
      {
        id: 'cp-web1-4b',
        stepIndex: 4,
        description: 'styles.css 中 h1 颜色设为 #0f766e',
        score: 13,
        ruleType: 'web_css_rule',
        params: {
          file: 'styles.css',
          selector: 'h1',
          property: 'color',
          expectedValue: '#0f766e',
        },
      },
    ],
    referenceAnswer: {
      files: [
        {
          path: 'index.html',
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>中国非物质文化遗产</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="container">
    <h1>中国非物质文化遗产</h1>
    <p>中国非物质文化遗产凝聚着中华民族千百年的智慧与匠心，包括传统剪纸、青花瓷烧制、京剧与榫卯技艺等。</p>
    <img src="/api/seed-assets/heritage.svg" alt="非遗剪纸艺术" width="320" />
    <p><a href="https://www.ihchina.cn" target="_blank">了解更多非遗资料</a></p>
  </div>
</body>
</html>`,
        },
        {
          path: 'styles.css',
          name: 'styles.css',
          type: 'css',
          content: `body {
  font-family: "Microsoft YaHei", sans-serif;
  margin: 0;
  padding: 24px;
}

.container {
  max-width: 720px;
  margin: 0 auto;
  background: #ffffff;
  padding: 24px;
  border-radius: 8px;
}

h1 {
  text-align: center;
  color: #0f766e;
}`,
        },
      ],
    },
    analysis: [
      '步骤 1：在 `<div class="container">` 内加入 `<h1>中国非物质文化遗产</h1>`。',
      '步骤 2：使用 `<img src="/api/seed-assets/heritage.svg" alt="非遗剪纸艺术" />` 插入图片，务必填写 `alt`。',
      '步骤 3：添加 `<a href="https://www.ihchina.cn">了解更多</a>`。',
      '步骤 4：切换到 `styles.css`，编写 `h1 { text-align: center; color: #0f766e; }`。',
    ],
    commonMistakes: [
      '插入 <img> 时忘记写 alt 属性或 alt 为空字符串。',
      'CSS 属性名错写成 align: center（正确应为 text-align: center）。',
    ],
    status: 'published',
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  },

  // ================= WEB 2 =================
  {
    id: 'seed-web-2',
    title: '校园社团招新列表与报名表单网页',
    type: 'web',
    difficulty: '提高',
    knowledgePoints: ['HTML列表', 'HTML表格', 'HTML表单', 'CSS边框与样式'],
    scenario:
      '学校机器人社团需要上线招新页面，请你完成社团方向列表、训练时间表格、在线报名表单及表格样式的美化工作。',
    totalScore: 100,
    materials: {
      description: '请编辑 index.html 和 styles.css，完成列表、表格、表单与样式规则。',
      initialState: {
        files: [
          {
            path: 'index.html',
            name: 'index.html',
            type: 'html',
            content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>机器人社团招新</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <h1>机器人创客社团招新</h1>
  <h2>社团研究方向</h2>
  <!-- 1. 添加无序列表 ul，包含至少 3 个 li -->

  <h2>训练时间安排</h2>
  <!-- 2. 添加 2 行 2 列表格 -->

  <h2>在线报名</h2>
  <!-- 3. 添加 form 表单，含姓名输入框与提交按钮 -->
</body>
</html>`,
          },
          {
            path: 'styles.css',
            name: 'styles.css',
            type: 'css',
            content: `body {
  font-family: sans-serif;
  padding: 20px;
}

/* 4. 为 table 设置 border-collapse: collapse; 和 width: 100%; */
`,
          },
        ],
      },
    },
    steps: [
      {
        index: 1,
        instruction: '使用无序列表 <ul> 和至少 3 个 <li> 列出社团方向（如“开源硬件”、“机器人控制”、“算法编程”）。',
        score: 25,
        hint: '<ul><li>开源硬件</li><li>机器人控制</li><li>算法编程</li></ul>',
      },
      {
        index: 2,
        instruction: '创建一个包含表头的 <table>，至少有 2 个 <tr> 行和 2 个 <td>（或 <th>）单元格。',
        score: 25,
        hint: '<table><tr><th>时间</th><th>内容</th></tr><tr><td>周三下午</td><td>基础训练</td></tr></table>',
      },
      {
        index: 3,
        instruction: '添加一个 <form> 表单，内部包含一个文本输入框 <input type="text"> 和一个提交按钮 <button type="submit">（或 input submit）。',
        score: 25,
        hint: '<form><input type="text" placeholder="请输入姓名" /><button type="submit">提交报名</button></form>',
      },
      {
        index: 4,
        instruction: '在 styles.css 中为 table 设置 border-collapse: collapse; 和 width: 100%;。',
        score: 25,
        hint: 'table { border-collapse: collapse; width: 100%; }',
      },
    ],
    checkpoints: [
      {
        id: 'cp-web2-1',
        stepIndex: 1,
        description: '存在 <ul> 且包含至少 3 个 <li> 列表项',
        score: 25,
        ruleType: 'web_html_tag',
        params: { file: 'index.html', tag: 'li', minCount: 3 },
      },
      {
        id: 'cp-web2-2',
        stepIndex: 2,
        description: '存在 <table> 且至少有 2 个 <tr> 行',
        score: 25,
        ruleType: 'web_html_tag',
        params: { file: 'index.html', tag: 'tr', minCount: 2 },
      },
      {
        id: 'cp-web2-3a',
        stepIndex: 3,
        description: '存在 <form> 表单标签',
        score: 12,
        ruleType: 'web_html_tag',
        params: { file: 'index.html', tag: 'form', minCount: 1 },
      },
      {
        id: 'cp-web2-3b',
        stepIndex: 3,
        description: '表单中包含 type="text" 输入框',
        score: 13,
        ruleType: 'web_html_tag',
        params: {
          file: 'index.html',
          tag: 'input',
          attrs: { type: 'text' },
        },
      },
      {
        id: 'cp-web2-4',
        stepIndex: 4,
        description: 'styles.css 中 table 设置 border-collapse: collapse',
        score: 25,
        ruleType: 'web_css_rule',
        params: {
          file: 'styles.css',
          selector: 'table',
          property: 'border-collapse',
          expectedValue: 'collapse',
        },
      },
    ],
    referenceAnswer: {
      files: [
        {
          path: 'index.html',
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>机器人社团招新</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <h1>机器人创客社团招新</h1>
  <h2>社团研究方向</h2>
  <ul>
    <li>开源硬件</li>
    <li>机器人控制</li>
    <li>算法编程</li>
  </ul>

  <h2>训练时间安排</h2>
  <table border="1">
    <tr><th>时间</th><th>训练内容</th></tr>
    <tr><td>周三 16:30</td><td>电路焊接与编程</td></tr>
  </table>

  <h2>在线报名</h2>
  <form>
    <label>姓名：<input type="text" name="studentName" placeholder="请输入姓名" /></label>
    <button type="submit">提交报名</button>
  </form>
</body>
</html>`,
        },
        {
          path: 'styles.css',
          name: 'styles.css',
          type: 'css',
          content: `body {
  font-family: sans-serif;
  padding: 20px;
}

table {
  border-collapse: collapse;
  width: 100%;
}`,
        },
      ],
    },
    analysis: [
      '步骤 1：使用无序列表标签 `<ul>` 包裹三个 `<li>` 列表项。',
      '步骤 2：创建 `<table>`，内含两对 `<tr>` 行标签及单元格。',
      '步骤 3：添加 `<form>`，并在其中放入 `<input type="text" />` 和提交按钮。',
      '步骤 4：在 `styles.css` 中添加 `table { border-collapse: collapse; width: 100%; }`。',
    ],
    commonMistakes: [
      '把无序列表 `<ul>` 写成了有序列表 `<ol>` 或漏写 `<li>`。',
      '输入框未写 `type="text"` 属性。',
    ],
    status: 'published',
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  },

  // ================= FILE 1 =================
  {
    id: 'seed-file-1',
    title: '高一信息技术作业文件归档整理',
    type: 'file',
    difficulty: '基础',
    knowledgePoints: ['新建文件夹', '移动文件', '重命名', '删除冗余文件'],
    scenario:
      '电脑 D 盘根目录非常杂乱，请你按照老师的要求在虚拟资源管理器中新建分类目录、移动作业文件、规范命名并清理临时垃圾文件。',
    totalScore: 100,
    materials: {
      description: '初始目录为 D:/，其中包含“未命名草稿.txt”、“期末数据.xlsx”、“temp_cache.tmp”等文件。',
      initialState: {
        items: [
          {
            id: 'f-root',
            path: 'D:',
            name: '本地磁盘 (D:)',
            type: 'folder',
            parentPath: '',
          },
          {
            id: 'f-1',
            path: 'D:/未命名草稿.txt',
            name: '未命名草稿.txt',
            type: 'file',
            parentPath: 'D:',
            content: '高一信息技术实验报告草稿内容',
            size: 12,
          },
          {
            id: 'f-2',
            path: 'D:/期末数据.xlsx',
            name: '期末数据.xlsx',
            type: 'file',
            parentPath: 'D:',
            content: '表格数据',
            size: 48,
          },
          {
            id: 'f-3',
            path: 'D:/temp_cache.tmp',
            name: 'temp_cache.tmp',
            type: 'file',
            parentPath: 'D:',
            content: '临时缓存',
            size: 5,
          },
        ],
      },
    },
    steps: [
      {
        index: 1,
        instruction: '在 D:/ 下新建一个名为“作业”的文件夹。',
        score: 25,
        hint: '确保当前路径为 D:/，点击“新建文件夹”，命名为“作业”。',
      },
      {
        index: 2,
        instruction: '将“未命名草稿.txt”重命名为“实验报告.txt”。',
        score: 25,
        hint: '选中“未命名草稿.txt”，点击“重命名”改为“实验报告.txt”（保留扩展名）。',
      },
      {
        index: 3,
        instruction: '将“实验报告.txt”和“期末数据.xlsx”移动到“D:/作业”文件夹下。',
        score: 30,
        hint: '依次选中文件点击“剪切”，进入“D:/作业”后点击“粘贴”。',
      },
      {
        index: 4,
        instruction: '删除临时文件“D:/temp_cache.tmp”。',
        score: 20,
        hint: '选中“temp_cache.tmp”，点击“删除”按钮。',
      },
    ],
    checkpoints: [
      {
        id: 'cp-f1-1',
        stepIndex: 1,
        description: '存在文件夹 D:/作业',
        score: 25,
        ruleType: 'file_exists',
        params: { path: 'D:/作业', itemType: 'folder' },
      },
      {
        id: 'cp-f1-2',
        stepIndex: 2,
        description: 'D:/作业/实验报告.txt 存在（已完成重命名并移动）',
        score: 25,
        ruleType: 'file_exists',
        params: { path: 'D:/作业/实验报告.txt', itemType: 'file' },
      },
      {
        id: 'cp-f1-3',
        stepIndex: 3,
        description: 'D:/作业/期末数据.xlsx 存在且原位置已移除',
        score: 30,
        ruleType: 'file_exists',
        params: { path: 'D:/作业/期末数据.xlsx', itemType: 'file' },
      },
      {
        id: 'cp-f1-4',
        stepIndex: 4,
        description: '已删除 D:/temp_cache.tmp',
        score: 20,
        ruleType: 'file_not_exists',
        params: { path: 'D:/temp_cache.tmp' },
      },
    ],
    referenceAnswer: {
      items: [
        {
          id: 'f-root',
          path: 'D:',
          name: '本地磁盘 (D:)',
          type: 'folder',
          parentPath: '',
        },
        {
          id: 'f-folder',
          path: 'D:/作业',
          name: '作业',
          type: 'folder',
          parentPath: 'D:',
        },
        {
          id: 'f-1',
          path: 'D:/作业/实验报告.txt',
          name: '实验报告.txt',
          type: 'file',
          parentPath: 'D:/作业',
          content: '高一信息技术实验报告草稿内容',
          size: 12,
        },
        {
          id: 'f-2',
          path: 'D:/作业/期末数据.xlsx',
          name: '期末数据.xlsx',
          type: 'file',
          parentPath: 'D:/作业',
          content: '表格数据',
          size: 48,
        },
      ],
    },
    analysis: [
      '步骤 1：进入 D:/ 根目录 → 点击“新建文件夹” → 输入名称“作业”。',
      '步骤 2：选中“未命名草稿.txt” → 点击“重命名” → 改为“实验报告.txt”。',
      '步骤 3：使用“剪切 → 粘贴”将“实验报告.txt”和“期末数据.xlsx”移入“D:/作业”。',
      '步骤 4：选中“temp_cache.tmp” → 点击“删除”。',
    ],
    commonMistakes: [
      '重命名时丢失了 `.txt` 扩展名。',
      '使用了“复制”而非“剪切”，导致文件在原目录仍残留。',
    ],
    status: 'published',
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  },

  // ================= FILE 2 =================
  {
    id: 'seed-file-2',
    title: '社团素材备份、快捷方式与属性设置',
    type: 'file',
    difficulty: '中等',
    knowledgePoints: ['复制文件', '创建快捷方式', '只读属性', '隐藏属性'],
    scenario:
      '为了保护社团策划书不被误修改，同时方便成员从公共目录快速访问，请你完成文件复制备份、创建快捷方式以及文件属性设置。',
    totalScore: 100,
    materials: {
      description: 'D:/社团/ 下有“活动策划书.docx”和“备份区”文件夹。',
      initialState: {
        items: [
          { id: 'r1', path: 'D:', name: '本地磁盘 (D:)', type: 'folder', parentPath: '' },
          { id: 'r2', path: 'D:/社团', name: '社团', type: 'folder', parentPath: 'D:' },
          { id: 'r3', path: 'D:/桌面', name: '桌面', type: 'folder', parentPath: 'D:' },
          {
            id: 'r4',
            path: 'D:/社团/备份区',
            name: '备份区',
            type: 'folder',
            parentPath: 'D:/社团',
          },
          {
            id: 'r5',
            path: 'D:/社团/活动策划书.docx',
            name: '活动策划书.docx',
            type: 'file',
            parentPath: 'D:/社团',
            content: '春季社团嘉年华完整策划方案',
            size: 120,
            readOnly: false,
            hidden: false,
          },
        ],
      },
    },
    steps: [
      {
        index: 1,
        instruction: '将“D:/社团/活动策划书.docx”复制到“D:/社团/备份区”中（保留原文件）。',
        score: 25,
        hint: '选中“活动策划书.docx”点击“复制”，进入“备份区”后点击“粘贴”。',
      },
      {
        index: 2,
        instruction: '将“D:/社团/活动策划书.docx”的属性设置为“只读”（readOnly）。',
        score: 25,
        hint: '选中“D:/社团/活动策划书.docx”，点击“属性”，勾选“只读”并保存。',
      },
      {
        index: 3,
        instruction: '将备份文件“D:/社团/备份区/活动策划书.docx”的属性设置为“隐藏”（hidden）。',
        score: 25,
        hint: '进入“备份区”，打开备份文件的“属性”窗口，勾选“隐藏”。',
      },
      {
        index: 4,
        instruction: '在“D:/桌面”文件夹下为“D:/社团/活动策划书.docx”创建快捷方式，名称为“活动策划书.lnk”。',
        score: 25,
        hint: '选中“D:/社团/活动策划书.docx”，点击“创建快捷方式”，并将其移动到“D:/桌面”，确保名称为“活动策划书.lnk”。',
      },
    ],
    checkpoints: [
      {
        id: 'cp-f2-1',
        stepIndex: 1,
        description: '备份副本 D:/社团/备份区/活动策划书.docx 存在',
        score: 25,
        ruleType: 'file_exists',
        params: { path: 'D:/社团/备份区/活动策划书.docx', itemType: 'file' },
      },
      {
        id: 'cp-f2-2',
        stepIndex: 2,
        description: '原文件 D:/社团/活动策划书.docx 为只读属性',
        score: 25,
        ruleType: 'file_exists',
        params: { path: 'D:/社团/活动策划书.docx', readOnly: true },
      },
      {
        id: 'cp-f2-3',
        stepIndex: 3,
        description: '备份文件 D:/社团/备份区/活动策划书.docx 为隐藏属性',
        score: 25,
        ruleType: 'file_exists',
        params: { path: 'D:/社团/备份区/活动策划书.docx', hidden: true },
      },
      {
        id: 'cp-f2-4',
        stepIndex: 4,
        description: 'D:/桌面/活动策划书.lnk 快捷方式存在且指向原文件',
        score: 25,
        ruleType: 'file_exists',
        params: {
          path: 'D:/桌面/活动策划书.lnk',
          itemType: 'shortcut',
          targetPath: 'D:/社团/活动策划书.docx',
        },
      },
    ],
    referenceAnswer: {
      items: [
        { id: 'r1', path: 'D:', name: '本地磁盘 (D:)', type: 'folder', parentPath: '' },
        { id: 'r2', path: 'D:/社团', name: '社团', type: 'folder', parentPath: 'D:' },
        { id: 'r3', path: 'D:/桌面', name: '桌面', type: 'folder', parentPath: 'D:' },
        {
          id: 'r4',
          path: 'D:/社团/备份区',
          name: '备份区',
          type: 'folder',
          parentPath: 'D:/社团',
        },
        {
          id: 'r5',
          path: 'D:/社团/活动策划书.docx',
          name: '活动策划书.docx',
          type: 'file',
          parentPath: 'D:/社团',
          content: '春季社团嘉年华完整策划方案',
          size: 120,
          readOnly: true,
          hidden: false,
        },
        {
          id: 'r6',
          path: 'D:/社团/备份区/活动策划书.docx',
          name: '活动策划书.docx',
          type: 'file',
          parentPath: 'D:/社团/备份区',
          content: '春季社团嘉年华完整策划方案',
          size: 120,
          readOnly: false,
          hidden: true,
        },
        {
          id: 'r7',
          path: 'D:/桌面/活动策划书.lnk',
          name: '活动策划书.lnk',
          type: 'shortcut',
          parentPath: 'D:/桌面',
          targetPath: 'D:/社团/活动策划书.docx',
          size: 1,
        },
      ],
    },
    analysis: [
      '步骤 1：选中原文件点击“复制”，打开 `D:/社团/备份区` 点击“粘贴”。',
      '步骤 2：选中 `D:/社团/活动策划书.docx` 打开“属性”，勾选“只读”确定。',
      '步骤 3：打开 `D:/社团/备份区` 中副本的“属性”，勾选“隐藏”确定。',
      '步骤 4：为 `D:/社团/活动策划书.docx` 创建快捷方式，并将其移至 `D:/桌面` 并命名为 `活动策划书.lnk`。',
    ],
    commonMistakes: [
      '把“只读”和“隐藏”属性设反了，或者误改了原文件为隐藏。',
      '快捷方式名称未设为 `活动策划书.lnk` 或未放到 `D:/桌面` 下。',
    ],
    status: 'published',
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  },

  // ================= PYTHON 1 =================
  {
    id: 'seed-python-1',
    title: '校园体测成绩筛选与平均分统计（Python）',
    type: 'python',
    difficulty: '基础',
    knowledgePoints: ['输入输出与数据类型转换', '选择分支结构', '计数循环结构', '列表创建与遍历统计'],
    scenario:
      '学校体育组收集了一批同学的 50 米体测折算得分（逗号分隔输入），请你编写一段 Python 程序：读入数据并转换为整数列表，统计及格（>=60分）人数，并按要求格式输出结果。',
    totalScore: 100,
    materials: {
      description: '输入为一行英文逗号分隔的整数成绩（如：85,54,92,60,48），请在代码编辑区补充完整 Python 代码。',
      initialState: {
        code: `# 读取一行成绩并按逗号分割为整数列表
line = input().strip()
scores = [int(x) for x in line.split(",") if x.strip()]

# 1. 请补充统计及格人数（>=60）与及格总分的变量和 for 循环
pass_count = 0
pass_sum = 0

# 2. 按要求计算平均分并输出兩行结果
`,
        customInput: '85,54,92,60,48',
        lastOutput: '',
        lastError: '',
      },
    },
    steps: [
      {
        index: 1,
        instruction: '使用 for 循环遍历 scores 列表，配合 if 判断筛选出大于等于 60 分的成绩，累加到 pass_count 和 pass_sum。',
        score: 30,
        hint: 'for s in scores:\\n    if s >= 60:\\n        pass_count += 1\\n        pass_sum += s',
      },
      {
        index: 2,
        instruction: '确保程序无任何语法错误，计算及格同学的平均分（若 pass_count > 0 则为 pass_sum / pass_count，否则为 0）。',
        score: 20,
        hint: 'avg = pass_sum / pass_count if pass_count > 0 else 0',
      },
      {
        index: 3,
        instruction: '严格分两行输出：第 1 行输出「及格人数:X」（无空格），第 2 行输出「及格平均分:Y.Y」（保留 1 位小数，如 :.1f）。',
        score: 50,
        hint: 'print(f"及格人数:{pass_count}")\\nprint(f"及格平均分:{avg:.1f}")',
      },
    ],
    checkpoints: [
      {
        id: 'cp-py1-1',
        stepIndex: 1,
        description: '使用 for 循环与 >= 60 条件判断统计及格成绩',
        score: 30,
        ruleType: 'python_code_contains',
        params: { patterns: ['for ', 'if ', '60'] },
      },
      {
        id: 'cp-py1-2',
        stepIndex: 2,
        description: 'Python 代码通过语法检查',
        score: 20,
        ruleType: 'python_syntax_valid',
        params: {},
      },
      {
        id: 'cp-py1-3',
        stepIndex: 3,
        description: '多组测试样例输入输出完全通过',
        score: 50,
        ruleType: 'python_test_cases',
        params: {
          cases: [
            {
              stdin: '85,54,92,60,48',
              expectedOutput: '及格人数:3\n及格平均分:79.0',
            },
            {
              stdin: '70,80,90',
              expectedOutput: '及格人数:3\n及格平均分:80.0',
            },
            {
              stdin: '40,55,59',
              expectedOutput: '及格人数:0\n及格平均分:0.0',
            },
          ],
        },
      },
    ],
    referenceAnswer: {
      code: `line = input().strip()
scores = [int(x) for x in line.split(",") if x.strip()]

pass_count = 0
pass_sum = 0
for s in scores:
    if s >= 60:
        pass_count += 1
        pass_sum += s

avg = pass_sum / pass_count if pass_count > 0 else 0
print(f"及格人数:{pass_count}")
print(f"及格平均分:{avg:.1f}")`,
      customInput: '85,54,92,60,48',
      lastOutput: '及格人数:3\n及格平均分:79.0',
      lastError: '',
    },
    analysis: [
      '步骤 1：使用 `for s in scores:` 遍历列表，内部用 `if s >= 60:` 累计及格人数与总分。',
      '步骤 2：求平均分前务必判断 `pass_count > 0`，防止无人及格时出现除以 0 错误（ZeroDivisionError）。',
      '步骤 3：使用 f-string `f"及格平均分:{avg:.1f}"` 保留 1 位小数输出。',
    ],
    commonMistakes: [
      '忘记处理 `pass_count == 0` 的边界情况，导致全不及格测试样例报错。',
      '输出冒号用了中文全角 `：` 或冒号后多加了空格，与题目要求 `及格人数:3` 不一致。',
    ],
    status: 'published',
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  },

  // ================= DATABASE 1 =================
  {
    id: 'seed-database-1',
    title: '高一年级图书借阅与评分 SQL 查询统计',
    type: 'database',
    difficulty: '基础',
    knowledgePoints: ['基础投影查询与去重', '条件过滤与模糊匹配', '查询结果排序与限量', '常用聚合统计函数'],
    scenario:
      '学校图书馆系统保存了一张图书信息表 `books`（含书号 id、书名 title、分类 category、借阅次数 borrow_count、评分 rating），请你使用 SQL 语句完成精准筛选与排序查询。',
    totalScore: 100,
    materials: {
      description: '左侧可查看 books 数据表的所有字段和原始数据。请按步骤编写 SQL，最后确保输出符合第 3 步要求的查询结果集。',
      initialState: {
        tables: [
          {
            name: 'books',
            columns: ['id', 'title', 'category', 'borrow_count', 'rating'],
            rows: [
              [1, 'Python编程入门', '信息技术', 128, 4.9],
              [2, '数据科学导论', '信息技术', 86, 4.7],
              [3, '红楼梦', '文学名著', 142, 4.9],
              [4, '人工智能简史', '信息技术', 105, 4.8],
              [5, '三体', '科幻小说', 210, 4.9],
              [6, '算法图解', '信息技术', 64, 4.6],
            ],
          },
        ],
        sql: '-- 请在此编写 SQL 查询语句\nSELECT title, borrow_count, rating\nFROM books;\n',
        lastColumns: [],
        lastRows: [],
        lastChanges: 0,
        lastError: '',
      },
    },
    steps: [
      {
        index: 1,
        instruction: '使用 SELECT 语句从 books 表中查询书名(title)、借阅次数(borrow_count)和评分(rating)三列。',
        score: 25,
        hint: 'SELECT title, borrow_count, rating FROM books',
      },
      {
        index: 2,
        instruction: '使用 WHERE 子句筛选出 category 等于 \'信息技术\' 且 borrow_count >= 80 的图书。',
        score: 35,
        hint: "WHERE category = '信息技术' AND borrow_count >= 80",
      },
      {
        index: 3,
        instruction: '使用 ORDER BY 对查询结果按 borrow_count 从高到低降序（DESC）排列并执行验证。',
        score: 40,
        hint: 'ORDER BY borrow_count DESC',
      },
    ],
    checkpoints: [
      {
        id: 'cp-db1-1',
        stepIndex: 1,
        description: 'SQL 包含 SELECT 与 FROM books 查询结构',
        score: 25,
        ruleType: 'sql_code_contains',
        params: { patterns: ['SELECT', 'FROM books'] },
      },
      {
        id: 'cp-db1-2',
        stepIndex: 2,
        description: 'SQL 使用 WHERE 筛选信息技术类且借阅次数>=80',
        score: 35,
        ruleType: 'sql_code_contains',
        params: { patterns: ['WHERE', '信息技术', '80'] },
      },
      {
        id: 'cp-db1-3',
        stepIndex: 3,
        description: '查询返回指定三列且按借阅次数降序排列正确',
        score: 40,
        ruleType: 'sql_query_result',
        params: {
          expectedColumns: ['title', 'borrow_count', 'rating'],
          expectedRows: [
            ['Python编程入门', 128, 4.9],
            ['人工智能简史', 105, 4.8],
            ['数据科学导论', 86, 4.7],
          ],
          ignoreOrder: false,
        },
      },
    ],
    referenceAnswer: {
      tables: [
        {
          name: 'books',
          columns: ['id', 'title', 'category', 'borrow_count', 'rating'],
          rows: [
            [1, 'Python编程入门', '信息技术', 128, 4.9],
            [2, '数据科学导论', '信息技术', 86, 4.7],
            [3, '红楼梦', '文学名著', 142, 4.9],
            [4, '人工智能简史', '信息技术', 105, 4.8],
            [5, '三体', '科幻小说', 210, 4.9],
            [6, '算法图解', '信息技术', 64, 4.6],
          ],
        },
      ],
      sql: "SELECT title, borrow_count, rating\nFROM books\nWHERE category = '信息技术' AND borrow_count >= 80\nORDER BY borrow_count DESC;",
      lastColumns: ['title', 'borrow_count', 'rating'],
      lastRows: [
        ['Python编程入门', 128, 4.9],
        ['人工智能简史', 105, 4.8],
        ['数据科学导论', 86, 4.7],
      ],
      lastChanges: 0,
      lastError: '',
    },
    analysis: [
      '步骤 1：使用 `SELECT title, borrow_count, rating FROM books` 指定需要查询的 3 个字段。',
      '步骤 2：通过 `WHERE category = \'信息技术\' AND borrow_count >= 80` 过滤条件。',
      '步骤 3：末尾添加 `ORDER BY borrow_count DESC` 实现按借阅次数从高到低排序。',
    ],
    commonMistakes: [
      '把字段写成了 `SELECT *`，导致返回了多余的 `id` 和 `category` 列。',
      '忘记写 `DESC`，默认是 `ASC` 升序排列。',
    ],
    status: 'published',
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  },
];


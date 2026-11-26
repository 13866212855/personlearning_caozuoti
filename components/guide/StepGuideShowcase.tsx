'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Lightbulb,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { QuestionType } from '@/lib/types';

interface DemoFrame {
  title: string;
  actionText: string;
  highlightControl: string;
  tip: string;
  // Visual stage parameters per simulator family
  stageState: {
    // Word
    selectedPara?: number;
    paraStyled?: boolean;
    showFindBar?: boolean;
    replacedText?: boolean;
    hasTable?: boolean;
    tableFilled?: boolean;
    hasImage?: boolean;
    headerEdited?: boolean;
    pageSetupApplied?: boolean;
    // Excel
    rangeBox?: string;
    formulaBar?: string;
    cellValue?: string;
    styledHeader?: boolean;
    mergedTitle?: boolean;
    showChart?: boolean;
    sortedDesc?: boolean;
    filtered?: boolean;
    // Web
    activeFile?: string;
    filesList?: string[];
    codeSnippet?: string;
    previewHeading?: string;
    previewStyled?: boolean;
    // File
    currentPath?: string;
    selectedFile?: string;
    filesInDir?: Array<{ name: string; kind: 'folder' | 'file' | 'shortcut'; badge?: string }>;
    clipboardNotice?: string;
    propsModal?: boolean;
  };
}

export interface GuideTopicConfig {
  id: string;
  category: QuestionType;
  label: string;
  summary: string;
  pitfall: string;
  frames: DemoFrame[];
}

export const GUIDE_TOPICS: GuideTopicConfig[] = [
  // ================= WORD =================
  {
    id: 'word_paragraph_style',
    category: 'word',
    label: 'Word 段落格式设置',
    summary: '先单击选中目标段落（看到蓝色虚线框），再点工具栏设置字体、字号、对齐或行距。',
    pitfall: '光标没有点进目标段落时，点工具栏按钮不会影响该段落！务必先看到段落四周出现蓝色虚线框。',
    frames: [
      {
        title: '第 1 步：单击选中要修改的段落',
        actionText: '用鼠标单击右侧白色纸张上的第 1 段标题文字，确认段落四周出现蓝色虚线选中框。',
        highlightControl: 'para_0',
        tip: '一次只调整同一格式要求的段落，选中框出现在哪一段，格式就作用在哪一段。',
        stageState: { selectedPara: 0, paraStyled: false },
      },
      {
        title: '第 2 步：在工具栏选择字体、字号与对齐',
        actionText: '保持段落选中状态，在顶部工具栏将「字体」选为黑体、「字号」选 18pt，并点击「居中对齐」和「B」加粗。',
        highlightControl: 'toolbar_style',
        tip: '工具栏按钮变成蓝色高亮表示已开启该格式。',
        stageState: { selectedPara: 0, paraStyled: true },
      },
      {
        title: '第 3 步：核对页面最终效果',
        actionText: '观察纸张中的标题是否已变为黑体、加粗且居中显示，确认无误即可进行下一步。',
        highlightControl: 'para_0',
        tip: '如需设置“首行缩进 2 字符”或“行距 1.5”，同样先点中正文段落，再点「缩进2字符」和「行距」下拉框。',
        stageState: { selectedPara: 0, paraStyled: true },
      },
    ],
  },
  {
    id: 'word_find_replace',
    category: 'word',
    label: 'Word 查找与全部替换',
    summary: '通过「查找替换」工具一次性把全文指定错词替换为正确词汇。',
    pitfall: '一定要点蓝色的「全部替换」，且“查找内容”和“替换为”前后都不要多敲空格。',
    frames: [
      {
        title: '第 1 步：打开查找替换栏',
        actionText: '点击 Word 工具栏上的「查找替换」按钮，展开蓝底替换操作条。',
        highlightControl: 'btn_find',
        tip: '不需要自己用眼睛一个个找，使用「查找替换」既快又不容易漏掉。',
        stageState: { showFindBar: false, replacedText: false },
      },
      {
        title: '第 2 步：填写查找内容与替换为',
        actionText: '在“查找内容”填入原词，在“替换为”填入新词，然后点击蓝色「全部替换」按钮。',
        highlightControl: 'find_bar_btn',
        tip: '确认两个输入框里没有多余空格，再点击「全部替换」。',
        stageState: { showFindBar: true, replacedText: false },
      },
      {
        title: '第 3 步：确认文档全部替换完成',
        actionText: '检查正文所有位置的目标词都已更新为新词。',
        highlightControl: 'para_1',
        tip: '如果漏了一处没替换，系统判分时就会判定为未通过。',
        stageState: { showFindBar: true, replacedText: true },
      },
    ],
  },
  {
    id: 'word_edit_text',
    category: 'word',
    label: 'Word 段落文本编辑与新增',
    summary: '在已有段落修改文字，或使用「新增段落」添加新一段文字。',
    pitfall: '仔细核对标点符号和关键字，避免多字、少字或错别字。',
    frames: [
      {
        title: '第 1 步：点进段落或点击新增段落',
        actionText: '需要改某一段就直接点进文字修改；如需新起一段，点击工具栏「新增段落」。',
        highlightControl: 'btn_add_para',
        tip: '每点一次「新增段落」会在文档末尾增加一个独立段落。',
        stageState: { selectedPara: 1, paraStyled: false },
      },
      {
        title: '第 2 步：准确输入要求文字',
        actionText: '在段落输入框内输入题目指定的关键词和句子，完成后核对一遍。',
        highlightControl: 'para_1',
        tip: '中文句子注意使用中文标点（如句号、逗号）。',
        stageState: { selectedPara: 1, replacedText: true },
      },
    ],
  },
  {
    id: 'word_table',
    category: 'word',
    label: 'Word 插入与填写表格',
    summary: '点击「插入表格」设置正确行数与列数，再点进单元格填写内容。',
    pitfall: '“几行几列”最容易填反！横着数是一行（上下排），竖着数是一列（左右格）。',
    frames: [
      {
        title: '第 1 步：点击「插入表格」设置行列数',
        actionText: '在工具栏点击「插入表格」，在弹窗中分别输入正确的“行数”和“列数”，点击「确定插入」。',
        highlightControl: 'btn_table',
        tip: '例如“3行2列”表示上下共 3 排、左右共 2 格。',
        stageState: { hasTable: false },
      },
      {
        title: '第 2 步：在表格第一行输入表头',
        actionText: '用鼠标单击表格第一行的每个格子，按顺序输入表头名称。',
        highlightControl: 'table_area',
        tip: '表头文字要与题目完全一致。',
        stageState: { hasTable: true, tableFilled: false },
      },
      {
        title: '第 3 步：填写数据行并核对',
        actionText: '依次点进下方数据单元格，输入完整内容。',
        highlightControl: 'table_area',
        tip: '每个格子里不要留多余的回车或空格。',
        stageState: { hasTable: true, tableFilled: true },
      },
    ],
  },
  {
    id: 'word_image',
    category: 'word',
    label: 'Word 插入图片与设置说明',
    summary: '点击「插入图片」，选定题目素材并按要求填写替代文本（alt）。',
    pitfall: '题目如果提到图片说明或替代文本，务必在弹窗的“图片说明(alt)”输入框填写！',
    frames: [
      {
        title: '第 1 步：点击「插入图片」打开素材框',
        actionText: '点击工具栏「插入图片」按钮，选择题目配套图片素材。',
        highlightControl: 'btn_image',
        tip: '只能使用题目提供的本地素材，不要留空。',
        stageState: { hasImage: false },
      },
      {
        title: '第 2 步：填写替代文本并确认插入',
        actionText: '填好“图片说明(alt)”与宽度后点击「插入图片」，页面下方即显示图片。',
        highlightControl: 'image_area',
        tip: '插入后可再核对图片的对齐方式或宽度要求。',
        stageState: { hasImage: true },
      },
    ],
  },
  {
    id: 'word_header_footer',
    category: 'word',
    label: 'Word 页眉与页脚设置',
    summary: '在白色模拟纸张最顶部虚线框输入页眉，在最底部虚线框输入页脚。',
    pitfall: '页眉和页脚都有独立的虚线输入框，千万不要误写进正文第一段里！',
    frames: [
      {
        title: '第 1 步：找到纸张顶部的页眉虚线框',
        actionText: '滚动到白色文档最上方，单击虚线框「点击此处编辑页眉...」。',
        highlightControl: 'header_box',
        tip: '页眉区域位于正文标题的上方，有浅色虚线边框提示。',
        stageState: { headerEdited: false },
      },
      {
        title: '第 2 步：输入页眉/页脚文字',
        actionText: '输入题目要求的页眉文字（如需设置页脚，滚动到纸张最底部同理输入）。',
        highlightControl: 'header_box',
        tip: '输入完毕直接点空白处或下一步即可自动保存。',
        stageState: { headerEdited: true },
      },
    ],
  },
  {
    id: 'word_page_setup',
    category: 'word',
    label: 'Word 页面设置（方向与页边距）',
    summary: '点击「页面设置」弹窗调整纸张方向（纵向/横向）和上下左右边距数值。',
    pitfall: '页边距输入框只需要填纯数字（例如 2.5），不要自己输入“cm”或“厘米”。',
    frames: [
      {
        title: '第 1 步：打开「页面设置」弹窗',
        actionText: '点击工具栏最右侧的「页面设置」按钮。',
        highlightControl: 'btn_page_setup',
        tip: '按钮位于 Word 工具栏最右边。',
        stageState: { pageSetupApplied: false },
      },
      {
        title: '第 2 步：设置方向和边距并应用',
        actionText: '选择“纵向”或“横向”，输入上/下/左/右页边距数值，点击「应用设置」。',
        highlightControl: 'btn_page_setup',
        tip: '一定记得点击弹窗右下角的「应用设置」按钮才会保存生效。',
        stageState: { pageSetupApplied: true },
      },
    ],
  },

  // ================= EXCEL =================
  {
    id: 'excel_formula',
    category: 'excel',
    label: 'Excel 公式与函数输入',
    summary: '选中目标单元格 → 在 fx 公式栏以英文等号 = 开头输入公式 → 按 Enter 回车确认。',
    pitfall: '① 忘记写开头的等号 =；② 在中文输入法下输入了中文括号（）或中文冒号：！请务必切换为英文半角。',
    frames: [
      {
        title: '第 1 步：单击选中要放公式的单元格',
        actionText: '用鼠标点中要出结果的单元格（例如 D2），确认左上角选区框显示为 D2。',
        highlightControl: 'cell_D2',
        tip: '千万别点在原始数据格子上，结果放哪一格就先点哪一格。',
        stageState: { rangeBox: 'D2', formulaBar: '', cellValue: '' },
      },
      {
        title: '第 2 步：在 fx 输入栏输入英文公式',
        actionText: '点击上方「fx」公式输入栏，切换英文输入法，输入如 =SUM(B2:C2) 或 =AVERAGE(B2:C2)。',
        highlightControl: 'fx_bar',
        tip: '注意 = 、( ) 和冒号 : 全都要用英文半角符号，函数名大小写不限。',
        stageState: { rangeBox: 'D2', formulaBar: '=SUM(B2:C2)', cellValue: '' },
      },
      {
        title: '第 3 步：按 Enter 回车键生成计算结果',
        actionText: '按下键盘「Enter 回车键」确认，单元格自动显示计算结果 183。',
        highlightControl: 'cell_D2',
        tip: '如果格子显示为公式文字本身而没算出数字，说明漏了开头的 = 号！',
        stageState: { rangeBox: 'D2', formulaBar: '=SUM(B2:C2)', cellValue: '183' },
      },
    ],
  },
  {
    id: 'excel_value',
    category: 'excel',
    label: 'Excel 单元格数据录入',
    summary: '单击目标单元格，输入准确文本或数值后按 Enter 确认。',
    pitfall: '输入完成后记得按回车键或点击其它单元格，确保数据已写入表格。',
    frames: [
      {
        title: '第 1 步：选中对应单元格',
        actionText: '点击题目指定的单元格（如 A1），观察左上角名称框确认位置正确。',
        highlightControl: 'cell_A1',
        tip: '列字母在上方（A/B/C/D），行数字在左边（1/2/3...）。',
        stageState: { rangeBox: 'A1', formulaBar: '', cellValue: '' },
      },
      {
        title: '第 2 步：输入内容并回车',
        actionText: '在 fx 栏或格子里输入指定文字或数字，按 Enter 键确认。',
        highlightControl: 'fx_bar',
        tip: '文字前后不要多敲空格。',
        stageState: { rangeBox: 'A1', formulaBar: '信息技术会考成绩单', cellValue: '信息技术会考成绩单' },
      },
    ],
  },
  {
    id: 'excel_style',
    category: 'excel',
    label: 'Excel 选区与单元格格式设置',
    summary: '先选中目标区域（可用鼠标拖动，或直接在左上角选区框输入如 A2:D2），再点工具栏按钮设置格式。',
    pitfall: '选中多行多列区域时，直接点击左上角选区框输入范围（如 B2:D5）比鼠标拖动更准确不漏选！',
    frames: [
      {
        title: '第 1 步：选中目标单元格区域',
        actionText: '用鼠标拖选区域，或直接点击左上角选区框输入 A2:D2 后按回车。',
        highlightControl: 'range_box',
        tip: '区域表示法为「左上角:右下角」，中间用英文冒号连接。',
        stageState: { rangeBox: 'A2:D2', styledHeader: false },
      },
      {
        title: '第 2 步：设置加粗、填充色、对齐、边框或数字格式',
        actionText: '保持区域高亮，依次点击工具栏的「B」加粗、「居中」、「边框」、「填充色」或「数字格式」。',
        highlightControl: 'excel_toolbar',
        tip: '例如保留 2 位小数请在「数字格式」下拉框选“数值 (2位小数)”。',
        stageState: { rangeBox: 'A2:D2', styledHeader: true },
      },
    ],
  },
  {
    id: 'excel_merge',
    category: 'excel',
    label: 'Excel 合并单元格',
    summary: '选中至少 2 个连续单元格（如 A1:D1），再点击「合并/取消」按钮。',
    pitfall: '只点中 A1 一个单元格时点击「合并」是没有效果的！必须先框选多个格子（选区框带冒号）。',
    frames: [
      {
        title: '第 1 步：选中需要合并的连续区域',
        actionText: '在表格中从 A1 拖动到 D1，或直接点击左上角选区框输入「A1:D1」。',
        highlightControl: 'range_box',
        tip: '确认选区框显示的是 A1:D1 而不是单个 A1。',
        stageState: { rangeBox: 'A1:D1', mergedTitle: false },
      },
      {
        title: '第 2 步：点击「合并/取消」按钮',
        actionText: '保持 A1:D1 选中状态，点击工具栏上的「合并/取消」按钮，标题行即合并为一体。',
        highlightControl: 'btn_merge',
        tip: '合并后通常还需搭配「居中」对齐让标题更好看。',
        stageState: { rangeBox: 'A1:D1', mergedTitle: true },
      },
    ],
  },
  {
    id: 'excel_chart',
    category: 'excel',
    label: 'Excel 插入统计图表',
    summary: '点击「插入图表」，选择图表类型、填写标题，并分别填好分类标签区域和数据区域。',
    pitfall: '分类标签区域（如 A3:A5）和数据区域（如 D3:D5）的起止行号要一一对应！',
    frames: [
      {
        title: '第 1 步：点击「插入图表」按钮',
        actionText: '在 Excel 工具栏最右侧点击「插入图表」，打开图表配置弹窗。',
        highlightControl: 'btn_chart',
        tip: '生成图表前先在表格里看清哪一列是名称（分类）、哪一列是数值（数据）。',
        stageState: { rangeBox: 'A2:D5', showChart: false },
      },
      {
        title: '第 2 步：选择类型、填标题与区域并生成',
        actionText: '选好柱形图/折线图/饼图，填好“图表标题”、“分类标签区域”和“数据区域”，点击「生成图表」。',
        highlightControl: 'chart_area',
        tip: '所有区域范围中的冒号都要用英文冒号 :。',
        stageState: { rangeBox: 'A2:D5', showChart: true },
      },
    ],
  },
  {
    id: 'excel_sort',
    category: 'excel',
    label: 'Excel 数据排序（升序 / 降序）',
    summary: '先单击目标排序列中的任意一个单元格，再点击「升序」或「降序」按钮。',
    pitfall: '很多同学直接点「降序」却排错了列，因为当前选中单元格还停在 A1！一定要先点中要排的那一列（如 D3）。',
    frames: [
      {
        title: '第 1 步：先单击要排序的那一列里的单元格',
        actionText: '用鼠标点中需要排序的列（例如总分 D 列的 D3 单元格）。',
        highlightControl: 'cell_D3',
        tip: '不要整表全选，只需点中目标列里面的任意一个数据格即可。',
        stageState: { rangeBox: 'D3', sortedDesc: false },
      },
      {
        title: '第 2 步：点击「升序」或「降序」按钮',
        actionText: '点击上方工具栏的「降序」（从高到低）或「升序」（从低到高），整行数据会自动联动重排。',
        highlightControl: 'btn_sort',
        tip: '排序后检查对应列的数字是否已按要求从大到小（或从小到大）排列。',
        stageState: { rangeBox: 'D3', sortedDesc: true },
      },
    ],
  },
  {
    id: 'excel_filter',
    category: 'excel',
    label: 'Excel 条件筛选',
    summary: '先单击要筛选列中的任意单元格，点「筛选」并输入关键词应用筛选。',
    pitfall: '一定要先选中需要筛选的那一列，再点「筛选」弹窗。',
    frames: [
      {
        title: '第 1 步：点中需要筛选的列，点击「筛选」',
        actionText: '单击目标列（如 B 列）中的一个单元格，然后点击工具栏的「筛选」按钮。',
        highlightControl: 'btn_filter',
        tip: '查看弹窗顶部确认当前正在筛选的是否为目标列。',
        stageState: { rangeBox: 'B3', filtered: false },
      },
      {
        title: '第 2 步：输入关键词并应用筛选',
        actionText: '在弹窗输入筛选关键词，点击「应用筛选」，表格即只显示符合条件的行。',
        highlightControl: 'excel_toolbar',
        tip: '如需恢复全部数据，可再次打开筛选清除条件。',
        stageState: { rangeBox: 'B3', filtered: true },
      },
    ],
  },

  // ================= WEB =================
  {
    id: 'web_file',
    category: 'web',
    label: '网页制作：新建 HTML / CSS 文件',
    summary: '点击文件标签栏的「+ 新建文件」，输入带完整扩展名（如 style.css）的文件名。',
    pitfall: '必须连同扩展名（.html 或 .css）一起输入，不能只写 style！',
    frames: [
      {
        title: '第 1 步：点击「+ 新建文件」',
        actionText: '在代码编辑区上方标签栏，点击「+ 新建文件」按钮。',
        highlightControl: 'btn_new_web_file',
        tip: '先看清当前已有文件标签，避免重复创建。',
        stageState: { activeFile: 'index.html', filesList: ['index.html'] },
      },
      {
        title: '第 2 步：输入含扩展名的完整文件名',
        actionText: '输入完整文件名（如 style.css）并创建，标签栏出现新文件即可切过去写代码。',
        highlightControl: 'web_tabs',
        tip: '注意文件名全部用英文小写字母，不要加空格。',
        stageState: {
          activeFile: 'style.css',
          filesList: ['index.html', 'style.css'],
          codeSnippet: '/* 在此编写 CSS 样式 */',
        },
      },
    ],
  },
  {
    id: 'web_html',
    category: 'web',
    label: '网页制作：编写 HTML 标签与属性',
    summary: '选中 index.html 标签，使用快捷插入按钮或手动写出成对 HTML 标签，并在右侧实时预览效果。',
    pitfall: '① HTML 标签必须成对闭合（如 <h1>标题</h1>）；② 属性值必须使用英文双引号 "..." 包裹。',
    frames: [
      {
        title: '第 1 步：切换到 index.html 并定位到 <body> 内部',
        actionText: '点击顶部文件标签「index.html」，找到 <body> 和 </body> 之间的位置。',
        highlightControl: 'web_tabs',
        tip: '网页可见内容都要写在 <body>...</body> 标签里面。',
        stageState: {
          activeFile: 'index.html',
          filesList: ['index.html', 'style.css'],
          codeSnippet: '<body>\n  <!-- 在这里添加标签 -->\n</body>',
          previewHeading: '',
        },
      },
      {
        title: '第 2 步：用快捷按钮或手写插入 HTML 标签',
        actionText: '可点击工具栏「+ h1」「+ img」等快捷按钮插入模板，再把里面的文字或属性改成题目要求。',
        highlightControl: 'web_quick_btns',
        tip: '插入图片或链接时注意 src="..." / href="..." 引号要用英文双引号。',
        stageState: {
          activeFile: 'index.html',
          filesList: ['index.html', 'style.css'],
          codeSnippet: '<body>\n  <h1>校园科技节</h1>\n</body>',
          previewHeading: '校园科技节',
        },
      },
    ],
  },
  {
    id: 'web_css',
    category: 'web',
    label: '网页制作：编写 CSS 样式规则',
    summary: '在 CSS 文件（或 <style> 内）按「选择器 { 属性: 值; }」规范编写样式，并查看右侧实时预览。',
    pitfall: '大括号 { }、冒号 : 和末尾分号 ; 都必须使用英文半角符号，且别忘了在 HTML 中用 <link> 引入外部 CSS。',
    frames: [
      {
        title: '第 1 步：切换到 CSS 文件（或 HTML 的 <style> 区）',
        actionText: '点击顶部标签切换到 style.css（若题要求内嵌样式，则留在 index.html 的 <style> 标签内）。',
        highlightControl: 'web_tabs',
        tip: '如果样式写在独立 style.css 中，记得确认 index.html 的 <head> 里有引入它的 <link> 标签。',
        stageState: {
          activeFile: 'style.css',
          filesList: ['index.html', 'style.css'],
          codeSnippet: 'h1 {\n  \n}',
          previewHeading: '校园科技节',
          previewStyled: false,
        },
      },
      {
        title: '第 2 步：输入 CSS 属性与分号并预览效果',
        actionText: '写出完整规则如 h1 { color: #1d4ed8; text-align: center; }，右侧预览立即生效。',
        highlightControl: 'web_preview',
        tip: '每条 CSS 属性末尾一定要加上英文分号 ;。',
        stageState: {
          activeFile: 'style.css',
          filesList: ['index.html', 'style.css'],
          codeSnippet: 'h1 {\n  color: #1d4ed8;\n  text-align: center;\n}',
          previewHeading: '校园科技节',
          previewStyled: true,
        },
      },
    ],
  },

  // ================= FILE =================
  {
    id: 'file_create',
    category: 'file',
    label: '文件管理：进入指定目录并新建',
    summary: '先在左侧「目录导航」打开目标父文件夹（核对地址栏路径），再点击「新建文件夹」或「新建文件」。',
    pitfall: '新手最常犯的错：没进入目标文件夹就直接点新建，结果新建到了 D:/ 根目录！务必先看上方地址栏。',
    frames: [
      {
        title: '第 1 步：先进入题目指定的目标文件夹',
        actionText: '在左侧「目录导航」点击目标文件夹，确认上方灰色地址栏路径已经变成题目要求的目录。',
        highlightControl: 'file_tree',
        tip: '地址栏显示当前你在哪个文件夹里，比如 D:/作业资料。',
        stageState: {
          currentPath: 'D:/作业资料',
          filesInDir: [{ name: '素材.txt', kind: 'file' }],
        },
      },
      {
        title: '第 2 步：点击「新建文件夹」或「新建文件」',
        actionText: '在工具栏点击对应的新建按钮，输入题目要求的准确名称（文件需含扩展名）并确认。',
        highlightControl: 'btn_file_new',
        tip: '名称中的英文字母、点号和扩展名都要和题目完全一致。',
        stageState: {
          currentPath: 'D:/作业资料',
          selectedFile: '期末作品',
          filesInDir: [
            { name: '期末作品', kind: 'folder' },
            { name: '素材.txt', kind: 'file' },
          ],
        },
      },
    ],
  },
  {
    id: 'file_move_copy',
    category: 'file',
    label: '文件管理：移动（剪切/粘贴）、复制与重命名',
    summary: '先单击选中原文件 → 点「剪切」或「复制」 → 切换到目标文件夹 → 点「粘贴」。',
    pitfall: '题目要求“移动”文件时，必须用「剪切 + 粘贴」（不要用复制，否则原目录还会留着旧文件）。',
    frames: [
      {
        title: '第 1 步：选中原文件并点击「剪切」（移动）',
        actionText: '在原文件夹单击选中要移动的文件（变成蓝底高亮），点击工具栏「剪切」按钮。',
        highlightControl: 'btn_file_cut',
        tip: '如果是“复制”保留原文件，才点「复制」；如果是“移动”，一定要点「剪切」。',
        stageState: {
          currentPath: 'D:/待整理',
          selectedFile: '成绩表.xlsx',
          filesInDir: [{ name: '成绩表.xlsx', kind: 'file' }],
          clipboardNotice: '已剪切：成绩表.xlsx',
        },
      },
      {
        title: '第 2 步：切换到目标文件夹并点击「粘贴」',
        actionText: '左侧「目录导航」点进目标文件夹，点击工具栏「粘贴」按钮完成移动。',
        highlightControl: 'btn_file_paste',
        tip: '如题目还要求改名，可继续选中该文件点击「重命名」。',
        stageState: {
          currentPath: 'D:/归档/表格',
          selectedFile: '成绩表.xlsx',
          filesInDir: [{ name: '成绩表.xlsx', kind: 'file' }],
        },
      },
    ],
  },
  {
    id: 'file_properties',
    category: 'file',
    label: '文件管理：设置只读与隐藏属性',
    summary: '单击选中目标文件 → 点击「属性」按钮 → 勾选“只读”或“隐藏” → 保存属性。',
    pitfall: '勾选“隐藏”并保存后，如果上方没勾选“显示隐藏项目”，文件会暂时从列表里隐藏不见，属正常现象。',
    frames: [
      {
        title: '第 1 步：选中文件并点击「属性」',
        actionText: '进入文件所在目录，单击选中目标文件，点击工具栏「属性」按钮。',
        highlightControl: 'btn_file_props',
        tip: '请先确保选中了正确的文件（蓝底高亮）。',
        stageState: {
          currentPath: 'D:/作业资料',
          selectedFile: '重要说明.txt',
          filesInDir: [{ name: '重要说明.txt', kind: 'file' }],
          propsModal: false,
        },
      },
      {
        title: '第 2 步：勾选对应属性并点击「保存属性」',
        actionText: '在属性弹窗中勾选题目要求的“只读”或“隐藏”，点击「保存属性」。',
        highlightControl: 'props_modal',
        tip: '保存后文件旁会出现“只读/隐藏”标记（需开启“显示隐藏项目”才可见隐藏文件）。',
        stageState: {
          currentPath: 'D:/作业资料',
          selectedFile: '重要说明.txt',
          filesInDir: [{ name: '重要说明.txt', kind: 'file', badge: '只读' }],
          propsModal: true,
        },
      },
    ],
  },
  {
    id: 'file_shortcut',
    category: 'file',
    label: '文件管理：创建快捷方式',
    summary: '选中源文件点击「创建快捷方式」，若题目指定了存放文件夹或名称，再用剪切/粘贴或重命名处理。',
    pitfall: '快捷方式文件通常带有 .lnk 后缀，创建后注意核对它的存放路径是否符合题目要求。',
    frames: [
      {
        title: '第 1 步：选中源文件并点击「创建快捷方式」',
        actionText: '在文件列表中单击选中源文件，点击上方工具栏「创建快捷方式」。',
        highlightControl: 'btn_file_shortcut',
        tip: '快捷方式只是指向原文件的入口，图标旁会有“快捷方式”标识。',
        stageState: {
          currentPath: 'D:/软件',
          selectedFile: '练习工具.exe',
          filesInDir: [{ name: '练习工具.exe', kind: 'file' }],
        },
      },
      {
        title: '第 2 步：移动或重命名快捷方式（如题目要求）',
        actionText: '若题目要求放到其它文件夹（如桌面），选中生成的 .lnk 文件「剪切」后到目标目录「粘贴」。',
        highlightControl: 'file_list',
        tip: '名称和所在目录都核对一遍，防止放错位置。',
        stageState: {
          currentPath: 'D:/软件',
          selectedFile: '练习工具.exe - 快捷方式.lnk',
          filesInDir: [
            { name: '练习工具.exe', kind: 'file' },
            { name: '练习工具.exe - 快捷方式.lnk', kind: 'shortcut', badge: '快捷方式' },
          ],
        },
      },
    ],
  },
];

interface Props {
  topicId?: string;
  stepNumber?: number;
  questionTitle?: string;
  stepInstruction?: string;
  allowTopicSwitch?: boolean;
  onSelectTopic?: (topicId: string) => void;
}

const CATEGORY_META: Array<{ id: QuestionType; label: string; icon: typeof FileText }> = [
  { id: 'word', label: 'Word 文字处理', icon: FileText },
  { id: 'excel', label: 'Excel 电子表格', icon: FileSpreadsheet },
  { id: 'web', label: '网页制作 (HTML/CSS)', icon: FileCode2 },
  { id: 'file', label: '文件与文件夹管理', icon: FolderOpen },
];

export default function StepGuideShowcase({
  topicId,
  stepNumber,
  questionTitle,
  stepInstruction,
  allowTopicSwitch = true,
  onSelectTopic,
}: Props) {
  const initialTopic = useMemo(
    () => GUIDE_TOPICS.find((t) => t.id === topicId) || GUIDE_TOPICS[0],
    [topicId]
  );

  const [selectedId, setSelectedId] = useState(initialTopic.id);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (topicId && GUIDE_TOPICS.some((t) => t.id === topicId)) {
      Promise.resolve().then(() => {
        setSelectedId(topicId);
        setFrameIndex(0);
        setPlaying(true);
      });
    }
  }, [topicId]);

  const currentTopic = useMemo(
    () => GUIDE_TOPICS.find((t) => t.id === selectedId) || GUIDE_TOPICS[0],
    [selectedId]
  );

  const safeFrameIndex = Math.min(frameIndex, currentTopic.frames.length - 1);
  const currentFrame = currentTopic.frames[safeFrameIndex];

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setFrameIndex((prev) =>
        prev + 1 >= currentTopic.frames.length ? 0 : prev + 1
      );
    }, 3200);
    return () => clearInterval(timer);
  }, [playing, currentTopic.frames.length, currentTopic.id]);

  const selectTopic = (id: string) => {
    setSelectedId(id);
    setFrameIndex(0);
    setPlaying(true);
    onSelectTopic?.(id);
  };

  return (
    <div className="space-y-4">
      {/* Contextual Question Banner when opened from an active exam step */}
      {(questionTitle || stepInstruction) && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-900">
            <Lightbulb className="w-4 h-4 text-sky-600 shrink-0" />
            <span>
              当前需要完成的任务{stepNumber ? `（第 ${stepNumber} 步）` : ''}
              {questionTitle ? ` · ${questionTitle}` : ''}
            </span>
          </div>
          {stepInstruction && (
            <p className="text-xs text-slate-700 leading-relaxed pl-6">
              题目要求：{stepInstruction}
            </p>
          )}
        </div>
      )}

      {/* Optional Topic Directory Switcher */}
      {allowTopicSwitch && (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
          <div className="text-xs font-semibold text-slate-700">
            选择操作题型与动画演示主题：
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {CATEGORY_META.map((cat) => {
              const Icon = cat.icon;
              const items = GUIDE_TOPICS.filter((t) => t.category === cat.id);
              const isCatActive = currentTopic.category === cat.id;
              return (
                <div
                  key={cat.id}
                  className={`rounded-lg border p-2.5 space-y-1.5 ${
                    isCatActive
                      ? 'border-sky-300 bg-sky-50/40'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Icon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>{cat.label}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectTopic(item.id)}
                        className={`text-left text-[11px] px-2 py-1 rounded transition-colors ${
                          item.id === currentTopic.id
                            ? 'bg-sky-600 text-white font-medium'
                            : 'text-slate-600 hover:bg-slate-200/70'
                        }`}
                      >
                        {item.label.replace(/^[^：:]+[：:]?\s*/, '')}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Two-zone Educational Simulation Stage (Viewport-contained) */}
      <div className="grid lg:grid-cols-12 gap-4 items-start">
        {/* Left/Top: Animated Mock Simulator Canvas + Playback Controls */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {currentTopic.label}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {currentTopic.summary}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setFrameIndex((prev) =>
                    prev === 0 ? currentTopic.frames.length - 1 : prev - 1
                  );
                }}
                aria-label="上一步演示"
                className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100 flex items-center"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-1"
              >
                {playing ? (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>暂停</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    <span>自动演示</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setFrameIndex((prev) =>
                    prev + 1 >= currentTopic.frames.length ? 0 : prev + 1
                  );
                }}
                aria-label="下一步演示"
                className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100 flex items-center"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setFrameIndex(0);
                  setPlaying(true);
                }}
                aria-label="重播"
                className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">重播</span>
              </button>
            </div>
          </div>

          {/* Interactive Mock Simulator Canvas */}
          <div className="p-4 bg-slate-100/80 min-h-[290px] flex flex-col justify-between">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentTopic.id}-${safeFrameIndex}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <MockSimulatorStage
                  category={currentTopic.category}
                  frame={currentFrame}
                />
              </motion.div>
            </AnimatePresence>

            {/* Step Progress Bar inside Canvas Footer */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                {currentTopic.frames.map((f, idx) => (
                  <button
                    key={f.title}
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setFrameIndex(idx);
                    }}
                    className={`h-6 px-2.5 rounded-md font-medium tabular-nums transition-colors ${
                      idx === safeFrameIndex
                        ? 'bg-sky-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    步骤 {idx + 1}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {safeFrameIndex + 1} / {currentTopic.frames.length}
              </span>
            </div>
          </div>
        </div>

        {/* Right/Bottom: Step-by-Step Beginner Instructions & Pitfall Callout */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <div className="text-xs font-semibold text-slate-900">
              小白分步操作讲解
            </div>
            <div className="space-y-2">
              {currentTopic.frames.map((frame, idx) => {
                const isActive = idx === safeFrameIndex;
                const isDone = idx < safeFrameIndex;
                return (
                  <button
                    key={frame.title}
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setFrameIndex(idx);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-colors space-y-1 ${
                      isActive
                        ? 'bg-sky-50 border-sky-300'
                        : isDone
                          ? 'bg-teal-50/40 border-teal-200'
                          : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          isActive
                            ? 'text-sky-800'
                            : isDone
                              ? 'text-teal-800'
                              : 'text-slate-800'
                        }`}
                      >
                        {frame.title}
                      </span>
                      {isDone && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {frame.actionText}
                    </p>
                    {isActive && (
                      <div className="text-[11px] text-sky-700 pt-1">
                        操作要点：{frame.tip}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-950">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-semibold">常见扣分坑点提醒</div>
              <p className="leading-relaxed text-amber-900">
                {currentTopic.pitfall}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PointerHint({ label }: { label: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-bold shadow-sm whitespace-nowrap"
    >
      <MousePointerClick className="w-3 h-3" />
      <span>{label}</span>
    </motion.span>
  );
}

function MockSimulatorStage({
  category,
  frame,
}: {
  category: QuestionType;
  frame: DemoFrame;
}) {
  const hc = frame.highlightControl;
  const st = frame.stageState;

  if (category === 'word') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden text-xs">
        {/* Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`px-2 py-1 rounded border text-[11px] ${
              hc === 'toolbar_style'
                ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            {st.paraStyled ? '黑体 · 18pt · B · 居中' : '宋体 · 12pt · 左对齐'}
          </span>
          <span
            className={`px-2 py-1 rounded border text-[11px] ${
              hc === 'btn_add_para'
                ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            新增段落
          </span>
          <span
            className={`px-2 py-1 rounded border text-[11px] ${
              hc === 'btn_table'
                ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            插入表格
          </span>
          <span
            className={`px-2 py-1 rounded border text-[11px] ${
              hc === 'btn_image'
                ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            插入图片
          </span>
          <span
            className={`px-2 py-1 rounded border text-[11px] ${
              hc === 'btn_find'
                ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            查找替换
          </span>
          <span
            className={`px-2 py-1 rounded border text-[11px] ${
              hc === 'btn_page_setup'
                ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            页面设置
          </span>
          {hc.startsWith('btn_') || hc === 'toolbar_style' ? (
            <PointerHint label="点这里" />
          ) : null}
        </div>

        {/* Find & replace bar */}
        {st.showFindBar && (
          <div className="bg-sky-50 border-b border-sky-200 px-3 py-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 bg-white border border-sky-200 rounded">
              查找内容：信息技述
            </span>
            <span className="px-2 py-0.5 bg-white border border-sky-200 rounded">
              替换为：信息技术
            </span>
            <span
              className={`px-2.5 py-0.5 rounded bg-sky-600 text-white font-medium ${
                hc === 'find_bar_btn' ? 'ring-2 ring-amber-400' : ''
              }`}
            >
              全部替换
            </span>
            {hc === 'find_bar_btn' && <PointerHint label="点击全部替换" />}
          </div>
        )}

        {/* White paper page */}
        <div className="p-4 space-y-2.5 bg-white">
          <div
            className={`border border-dashed rounded px-2 py-1 text-[11px] flex items-center justify-between ${
              hc === 'header_box'
                ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200 text-sky-900'
                : 'border-slate-300 text-slate-400'
            }`}
          >
            <span>
              {st.headerEdited ? '页眉：高一信息技术学业练习' : '点击此处编辑页眉...'}
            </span>
            {hc === 'header_box' && <PointerHint label="点进页眉" />}
          </div>

          <div
            className={`p-2 rounded transition-colors ${
              st.selectedPara === 0
                ? 'border border-dashed border-sky-500 bg-sky-50/40'
                : 'border border-transparent'
            } ${
              st.paraStyled
                ? 'text-center font-bold text-sm text-slate-900'
                : 'text-left text-xs text-slate-700'
            }`}
          >
            校园信息技术活动周通知
            {hc === 'para_0' && (
              <span className="ml-2">
                <PointerHint label="选中第1段" />
              </span>
            )}
          </div>

          <div
            className={`p-2 rounded text-[11px] leading-relaxed ${
              st.selectedPara === 1
                ? 'border border-dashed border-sky-500 bg-sky-50/40'
                : 'border border-transparent'
            } text-slate-600`}
          >
            {st.replacedText
              ? '为提升同学们的信息技术实践能力，学校将于本周五举办活动。'
              : '为提升同学们的信息技述实践能力，学校将于本周五举办活动。'}
            {hc === 'para_1' && (
              <span className="ml-2">
                <PointerHint label="核对正文" />
              </span>
            )}
          </div>

          {st.hasTable && (
            <div
              className={`rounded border p-2 ${
                hc === 'table_area'
                  ? 'border-sky-500 ring-2 ring-sky-200'
                  : 'border-slate-200'
              }`}
            >
              <table className="w-full border-collapse text-[11px]">
                <tbody>
                  <tr className="bg-slate-100 font-semibold">
                    <td className="border border-slate-300 px-2 py-1">项目名称</td>
                    <td className="border border-slate-300 px-2 py-1">负责班级</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 px-2 py-1">
                      {st.tableFilled ? '网页设计展示' : '（点此输入）'}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      {st.tableFilled ? '高一(2)班' : '（点此输入）'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {st.hasImage && (
            <div
              className={`rounded border p-2.5 bg-slate-50 flex items-center justify-between ${
                hc === 'image_area'
                  ? 'border-sky-500 ring-2 ring-sky-200'
                  : 'border-slate-200'
              }`}
            >
              <span className="text-[11px] text-slate-700">
                [已插入图片] alt=&quot;活动海报&quot; · 宽度 260px
              </span>
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
            </div>
          )}

          {st.pageSetupApplied && (
            <div className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded px-2.5 py-1.5">
              已应用页面设置：纸张方向与页边距参数已保存
            </div>
          )}
        </div>
      </div>
    );
  }

  if (category === 'excel') {
    const rows = st.sortedDesc
      ? [
          { name: '李华', b: '95', c: '92', d: st.cellValue || '187' },
          { name: '王明', b: '88', c: '90', d: '178' },
        ]
      : st.filtered
        ? [{ name: '李华', b: '95', c: '92', d: '187' }]
        : [
            { name: '王明', b: '88', c: '90', d: st.cellValue || '' },
            { name: '李华', b: '95', c: '92', d: '187' },
          ];

    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden text-xs">
        {/* Excel Toolbar */}
        <div
          className={`bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap items-center gap-1.5 ${
            hc === 'excel_toolbar' ? 'ring-2 ring-sky-300 bg-sky-50/40' : ''
          }`}
        >
          <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-bold">
            B
          </span>
          <span className="px-2 py-0.5 rounded border border-slate-200 bg-white text-[11px]">
            居中
          </span>
          <span className="px-2 py-0.5 rounded border border-slate-200 bg-white text-[11px]">
            数字格式
          </span>
          <span
            className={`px-2 py-0.5 rounded border text-[11px] ${
              hc === 'btn_merge'
                ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            合并/取消
          </span>
          <span
            className={`px-2 py-0.5 rounded border text-[11px] ${
              hc === 'btn_sort'
                ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            升序 / 降序
          </span>
          <span
            className={`px-2 py-0.5 rounded border text-[11px] ${
              hc === 'btn_filter'
                ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            筛选
          </span>
          <span
            className={`px-2 py-0.5 rounded border text-[11px] ${
              hc === 'btn_chart'
                ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            插入图表
          </span>
          {['btn_merge', 'btn_sort', 'btn_filter', 'btn_chart', 'excel_toolbar'].includes(hc) && (
            <PointerHint label="点这里" />
          )}
        </div>

        {/* Formula Bar */}
        <div className="px-2.5 py-1.5 border-b border-slate-200 flex items-center gap-2 bg-white">
          <div
            className={`px-2 py-0.5 rounded border text-[11px] font-mono tabular-nums min-w-[60px] text-center ${
              hc === 'range_box'
                ? 'border-sky-500 bg-sky-50 text-sky-900 font-bold ring-2 ring-sky-200'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {st.rangeBox || 'D2'}
          </div>
          <span className="text-slate-400 font-serif italic text-xs">fx</span>
          <div
            className={`flex-1 px-2 py-0.5 rounded border font-mono text-[11px] min-h-[24px] flex items-center justify-between ${
              hc === 'fx_bar'
                ? 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-200'
                : 'border-slate-200 bg-slate-50/50 text-slate-700'
            }`}
          >
            <span>{st.formulaBar || '（在此输入内容或以 = 开头的公式）'}</span>
            {hc === 'fx_bar' && <PointerHint label="输入后按Enter" />}
          </div>
        </div>

        {/* Grid */}
        <div className="p-2.5 bg-white">
          <table className="w-full border-collapse text-[11px] tabular-nums">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="border border-slate-300 w-7 py-1" />
                <th className="border border-slate-300 py-1">A</th>
                <th className="border border-slate-300 py-1">B</th>
                <th className="border border-slate-300 py-1">C</th>
                <th className="border border-slate-300 py-1">D</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 bg-slate-100 text-center text-slate-500 py-1">
                  1
                </td>
                {st.mergedTitle ? (
                  <td
                    colSpan={4}
                    className="border border-slate-300 bg-sky-50 text-center font-bold py-1 text-slate-900"
                  >
                    {st.cellValue || '高一信息技术会考成绩表（已合并居中）'}
                  </td>
                ) : (
                  <>
                    <td
                      className={`border border-slate-300 px-2 py-1 ${
                        hc === 'cell_A1' ? 'ring-2 ring-sky-500 bg-sky-50 font-semibold' : ''
                      }`}
                    >
                      {st.cellValue || '成绩表'}
                    </td>
                    <td className="border border-slate-300 px-2 py-1" />
                    <td className="border border-slate-300 px-2 py-1" />
                    <td className="border border-slate-300 px-2 py-1" />
                  </>
                )}
              </tr>
              <tr className={st.styledHeader ? 'bg-sky-100 font-bold text-center' : 'bg-slate-50/60'}>
                <td className="border border-slate-300 bg-slate-100 text-center text-slate-500 py-1">
                  2
                </td>
                <td className="border border-slate-300 px-2 py-1">姓名</td>
                <td className="border border-slate-300 px-2 py-1">笔试</td>
                <td className="border border-slate-300 px-2 py-1">上机</td>
                <td
                  className={`border border-slate-300 px-2 py-1 ${
                    hc === 'cell_D2' ? 'ring-2 ring-sky-500 bg-sky-50 font-semibold' : ''
                  }`}
                >
                  {rows[0].d ? rows[0].d : '总分'}
                </td>
              </tr>
              {rows.map((r, i) => (
                <tr key={r.name}>
                  <td className="border border-slate-300 bg-slate-100 text-center text-slate-500 py-1">
                    {i + 3}
                  </td>
                  <td className="border border-slate-300 px-2 py-1">{r.name}</td>
                  <td className="border border-slate-300 px-2 py-1">{r.b}</td>
                  <td className="border border-slate-300 px-2 py-1">{r.c}</td>
                  <td
                    className={`border border-slate-300 px-2 py-1 ${
                      i === 0 && hc === 'cell_D3' ? 'ring-2 ring-sky-500 bg-sky-50 font-semibold' : ''
                    }`}
                  >
                    {r.d || '待计算'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {st.showChart && (
            <div className="mt-2.5 p-2.5 rounded-lg border border-teal-200 bg-teal-50/60 flex items-center justify-between text-[11px] text-teal-900">
              <span>统计图表已生成（柱形图 · 成绩对比分析）</span>
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (category === 'web') {
    const files = st.filesList || ['index.html', 'style.css'];
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden text-xs">
        <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap items-center justify-between gap-2">
          <div
            className={`flex items-center gap-1.5 ${
              hc === 'web_tabs' ? 'ring-2 ring-sky-300 rounded p-0.5' : ''
            }`}
          >
            {files.map((f) => (
              <span
                key={f}
                className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                  st.activeFile === f
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {f}
              </span>
            ))}
            <span
              className={`px-2 py-1 rounded border text-[11px] ${
                hc === 'btn_new_web_file'
                  ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              + 新建文件
            </span>
          </div>
          <div
            className={`flex items-center gap-1 ${
              hc === 'web_quick_btns' ? 'ring-2 ring-sky-300 rounded p-0.5 bg-sky-50' : ''
            }`}
          >
            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono">
              + h1
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono">
              + img
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono">
              + a
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] whitespace-pre-wrap min-h-[140px]">
            {st.codeSnippet || '<body>\n  <h1>网页标题</h1>\n</body>'}
          </div>
          <div
            className={`p-3 bg-white min-h-[140px] ${
              hc === 'web_preview' ? 'ring-2 ring-inset ring-sky-300' : ''
            }`}
          >
            <div className="text-[10px] text-slate-400 mb-2">实时页面预览</div>
            {st.previewHeading ? (
              <div
                className={`text-base font-bold ${
                  st.previewStyled ? 'text-blue-700 text-center' : 'text-slate-900'
                }`}
              >
                {st.previewHeading}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">
                （在左侧输入 HTML/CSS 后，这里会实时显示网页效果）
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // File manager
  const dirFiles = st.filesInDir || [{ name: '示例文件.txt', kind: 'file' }];
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden text-xs">
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`px-2 py-0.5 rounded border text-[11px] ${
            hc === 'btn_file_new'
              ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          新建文件夹 / 文件
        </span>
        <span
          className={`px-2 py-0.5 rounded border text-[11px] ${
            hc === 'btn_file_cut'
              ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          剪切
        </span>
        <span
          className={`px-2 py-0.5 rounded border text-[11px] ${
            hc === 'btn_file_paste'
              ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          粘贴
        </span>
        <span
          className={`px-2 py-0.5 rounded border text-[11px] ${
            hc === 'btn_file_shortcut'
              ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          创建快捷方式
        </span>
        <span
          className={`px-2 py-0.5 rounded border text-[11px] ${
            hc === 'btn_file_props'
              ? 'bg-sky-100 border-sky-500 text-sky-900 font-semibold ring-2 ring-sky-300'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          属性
        </span>
        {hc.startsWith('btn_file_') && <PointerHint label="点这里" />}
      </div>

      {/* Address bar */}
      <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-100/70 flex items-center justify-between text-[11px]">
        <span className="font-mono text-slate-700">
          当前位置：{st.currentPath || 'D:/'}
        </span>
        {st.clipboardNotice && (
          <span className="text-sky-700 font-medium">{st.clipboardNotice}</span>
        )}
      </div>

      <div className="grid sm:grid-cols-3 min-h-[140px]">
        <div
          className={`p-2.5 border-r border-slate-200 bg-slate-50/50 space-y-1 text-[11px] ${
            hc === 'file_tree' ? 'ring-2 ring-inset ring-sky-300 bg-sky-50/40' : ''
          }`}
        >
          <div className="text-[10px] font-semibold text-slate-500">目录导航</div>
          <div className="text-slate-700">D:/</div>
          <div className="pl-2 font-medium text-sky-700">
            └ {(st.currentPath || 'D:/作业资料').replace('D:/', '')}
          </div>
        </div>
        <div
          className={`sm:col-span-2 p-2.5 space-y-1.5 ${
            hc === 'file_list' ? 'ring-2 ring-inset ring-sky-300' : ''
          }`}
        >
          {dirFiles.map((item) => (
            <div
              key={item.name}
              className={`px-2.5 py-1.5 rounded border flex items-center justify-between text-[11px] ${
                st.selectedFile === item.name
                  ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <span>
                {item.kind === 'folder' ? '[文件夹] ' : ''}
                {item.name}
              </span>
              {item.badge && (
                <span className="text-[10px] text-teal-700 font-medium">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
          {st.propsModal && (
            <div className="mt-2 p-2 rounded border border-teal-200 bg-teal-50 text-[11px] text-teal-900">
              属性设置已保存：只读 / 隐藏状态已更新
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

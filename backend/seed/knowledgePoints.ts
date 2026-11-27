import type { QuestionType } from '../types';

export interface SeedKnowledgePoint {
  id: string;
  type: QuestionType;
  chapter: string;
  name: string;
}

/**
 * 安徽省普通高中信息技术学业水平考试（会考）核心操作考点全集
 * 保留原有 kp-*-1..6 ID 兼容历史数据，补充高频细分考点
 */
export const BUILTIN_KNOWLEDGE_POINTS: SeedKnowledgePoint[] = [
  // ==================== Word 文字处理（11 项） ====================
  { id: 'kp-word-1', type: 'word', chapter: '字体与段落排版', name: '字符与段落格式（字体/字号/颜色/加粗）' },
  { id: 'kp-word-7', type: 'word', chapter: '字体与段落排版', name: '段落对齐方式（左/居中/右/两端对齐）' },
  { id: 'kp-word-8', type: 'word', chapter: '字体与段落排版', name: '行距调整（1.0/1.25/1.5/2.0倍）' },
  { id: 'kp-word-9', type: 'word', chapter: '字体与段落排版', name: '首行缩进（缩进2字符）' },
  { id: 'kp-word-10', type: 'word', chapter: '字体与段落排版', name: '项目符号与编号列表' },
  { id: 'kp-word-5', type: 'word', chapter: '文档编辑与修订', name: '查找与全部替换' },
  { id: 'kp-word-11', type: 'word', chapter: '文档编辑与修订', name: '正文文本修改与新增段落' },
  { id: 'kp-word-2', type: 'word', chapter: '表格与图文混排', name: '插入表格与单元格填写' },
  { id: 'kp-word-3', type: 'word', chapter: '表格与图文混排', name: '图文混排（插图与替代文本）' },
  { id: 'kp-word-4', type: 'word', chapter: '版面与页面设计', name: '页面设置（纸张方向与页边距）' },
  { id: 'kp-word-6', type: 'word', chapter: '版面与页面设计', name: '页眉与页脚设置' },

  // ==================== Excel 电子表格（16 项） ====================
  { id: 'kp-excel-4', type: 'excel', chapter: '表格修饰与格式', name: '单元格格式（边框/底纹/对齐/加粗）' },
  { id: 'kp-excel-7', type: 'excel', chapter: '表格修饰与格式', name: '合并单元格与标题居中' },
  { id: 'kp-excel-8', type: 'excel', chapter: '表格修饰与格式', name: '数字格式（2位小数/百分比/货币）' },
  { id: 'kp-excel-9', type: 'excel', chapter: '公式与常用函数', name: '基础四则运算公式（+ - * /）' },
  { id: 'kp-excel-1', type: 'excel', chapter: '公式与常用函数', name: '求和与平均值（SUM / AVERAGE）' },
  { id: 'kp-excel-10', type: 'excel', chapter: '公式与常用函数', name: '最值与计数（MAX / MIN / COUNT / COUNTA）' },
  { id: 'kp-excel-11', type: 'excel', chapter: '公式与常用函数', name: '条件判断函数（IF）' },
  { id: 'kp-excel-12', type: 'excel', chapter: '公式与常用函数', name: '条件计数函数（COUNTIF）' },
  { id: 'kp-excel-6', type: 'excel', chapter: '公式与常用函数', name: '排名与四舍五入（RANK / ROUND）' },
  { id: 'kp-excel-13', type: 'excel', chapter: '公式与常用函数', name: '绝对引用与相对引用（$锁定区域）' },
  { id: 'kp-excel-2', type: 'excel', chapter: '数据分析与管理', name: '数据排序（升序/降序）' },
  { id: 'kp-excel-14', type: 'excel', chapter: '数据分析与管理', name: '条件筛选（按列关键词筛选）' },
  { id: 'kp-excel-5', type: 'excel', chapter: '数据分析与管理', name: '分类汇总与分组统计' },
  { id: 'kp-excel-3', type: 'excel', chapter: '数据可视化图表', name: '柱形图制作（对比分析）' },
  { id: 'kp-excel-15', type: 'excel', chapter: '数据可视化图表', name: '折线图制作（变化趋势）' },
  { id: 'kp-excel-16', type: 'excel', chapter: '数据可视化图表', name: '饼图制作（比例分布）' },

  // ==================== 网页制作 HTML/CSS（13 项） ====================
  { id: 'kp-web-6', type: 'web', chapter: '站点与页面结构', name: '新建 HTML / CSS 文件' },
  { id: 'kp-web-7', type: 'web', chapter: '站点与页面结构', name: '网页基本结构与标题（head / title / body）' },
  { id: 'kp-web-1', type: 'web', chapter: 'HTML 常用标签', name: '标题与段落标签（h1~h6 / p）' },
  { id: 'kp-web-8', type: 'web', chapter: 'HTML 常用标签', name: '图片插入与属性（img src / alt / width）' },
  { id: 'kp-web-2', type: 'web', chapter: 'HTML 常用标签', name: '超链接制作（a href / target）' },
  { id: 'kp-web-9', type: 'web', chapter: 'HTML 常用标签', name: '无序与有序列表（ul / ol / li）' },
  { id: 'kp-web-3', type: 'web', chapter: 'HTML 常用标签', name: '网页表格（table / tr / th / td）' },
  { id: 'kp-web-4', type: 'web', chapter: 'HTML 常用标签', name: '交互表单元素（form / input / button）' },
  { id: 'kp-web-10', type: 'web', chapter: 'HTML 常用标签', name: '页面区块划分（header / nav / main / footer / div）' },
  { id: 'kp-web-5', type: 'web', chapter: 'CSS 层叠样式表', name: '外部样式表引入（link）与内嵌 style' },
  { id: 'kp-web-11', type: 'web', chapter: 'CSS 层叠样式表', name: 'CSS 选择器（标签/类.class/ID#id）' },
  { id: 'kp-web-12', type: 'web', chapter: 'CSS 层叠样式表', name: '文字与段落 CSS（color / font-size / text-align）' },
  { id: 'kp-web-13', type: 'web', chapter: 'CSS 层叠样式表', name: '背景与盒模型（background / padding / margin / border）' },

  // ==================== 文件与文件夹管理（10 项） ====================
  { id: 'kp-file-1', type: 'file', chapter: '目录与文件创建', name: '新建文件夹与多级目录结构' },
  { id: 'kp-file-6', type: 'file', chapter: '目录与文件创建', name: '新建文本/网页等文件及扩展名规范' },
  { id: 'kp-file-7', type: 'file', chapter: '目录与文件创建', name: '文件与文件夹重命名' },
  { id: 'kp-file-2', type: 'file', chapter: '文件组织与整理', name: '复制与粘贴（保留原文件）' },
  { id: 'kp-file-8', type: 'file', chapter: '文件组织与整理', name: '移动文件（剪切与粘贴）' },
  { id: 'kp-file-9', type: 'file', chapter: '文件组织与整理', name: '删除指定冗余或临时文件' },
  { id: 'kp-file-3', type: 'file', chapter: '快捷方式与检索', name: '创建快捷方式（.lnk）与位置调整' },
  { id: 'kp-file-4', type: 'file', chapter: '快捷方式与检索', name: '按文件名/扩展名搜索并分类整理' },
  { id: 'kp-file-5', type: 'file', chapter: '文件属性控制', name: '设置文件“只读”属性' },
  { id: 'kp-file-10', type: 'file', chapter: '文件属性控制', name: '设置文件“隐藏”属性与查看隐藏项目' },

  // ==================== Python 程序设计（12 项 · 新课标《数据与计算》） ====================
  { id: 'kp-python-1', type: 'python', chapter: '输入输出与基础语法', name: '输入输出与数据类型转换（input / int / float / print）' },
  { id: 'kp-python-2', type: 'python', chapter: '输入输出与基础语法', name: '算术运算与格式化输出（// / % / ** / f-string）' },
  { id: 'kp-python-3', type: 'python', chapter: '输入输出与基础语法', name: '关系与逻辑表达式（and / or / not）' },
  { id: 'kp-python-4', type: 'python', chapter: '程序控制结构', name: '选择分支结构（if / elif / else）' },
  { id: 'kp-python-5', type: 'python', chapter: '程序控制结构', name: '计数循环结构（for ... in range(...)）' },
  { id: 'kp-python-6', type: 'python', chapter: '程序控制结构', name: '条件循环与控制（while / break / continue）' },
  { id: 'kp-python-7', type: 'python', chapter: '组合数据类型', name: '字符串处理与切片（len / split / 切片）' },
  { id: 'kp-python-8', type: 'python', chapter: '组合数据类型', name: '列表创建、遍历与统计（append / sum / max / min）' },
  { id: 'kp-python-9', type: 'python', chapter: '组合数据类型', name: '字典与集合基础应用（键值对统计与去重）' },
  { id: 'kp-python-10', type: 'python', chapter: '函数与常用算法', name: '自定义函数（def / 参数传递 / return）' },
  { id: 'kp-python-11', type: 'python', chapter: '函数与常用算法', name: '经典枚举与数值算法（累加累乘 / 素数 / 水仙花数 / 排序）' },
  { id: 'kp-python-12', type: 'python', chapter: '函数与常用算法', name: '常用标准库模块（math / random）' },

  // ==================== 数据库与 SQL 查询（8 项 · 新课标《数据管理与信息系统》） ====================
  { id: 'kp-db-1', type: 'database', chapter: '数据表基础查询', name: '基础投影查询与去重（SELECT / DISTINCT / AS 别名）' },
  { id: 'kp-db-2', type: 'database', chapter: '数据表基础查询', name: '条件过滤与模糊匹配（WHERE / AND / OR / LIKE / BETWEEN）' },
  { id: 'kp-db-3', type: 'database', chapter: '数据表基础查询', name: '查询结果排序与限量（ORDER BY ASC / DESC / LIMIT）' },
  { id: 'kp-db-4', type: 'database', chapter: '统计与分组聚合', name: '常用聚合统计函数（COUNT / SUM / AVG / MAX / MIN）' },
  { id: 'kp-db-5', type: 'database', chapter: '统计与分组聚合', name: '分组聚合统计与筛选（GROUP BY / HAVING）' },
  { id: 'kp-db-6', type: 'database', chapter: '数据记录增删改', name: '插入新数据记录（INSERT INTO ... VALUES）' },
  { id: 'kp-db-7', type: 'database', chapter: '数据记录增删改', name: '按条件更新数据记录（UPDATE ... SET ... WHERE）' },
  { id: 'kp-db-8', type: 'database', chapter: '数据记录增删改', name: '按条件删除数据记录（DELETE FROM ... WHERE）' },
];


import type { QuestionType, SubjectId } from '../types';
import { getSubjectForType } from '../../lib/subjects';

export interface SeedKnowledgePoint {
  id: string;
  subjectId?: SubjectId;
  type: QuestionType;
  chapter: string;
  name: string;
}

const RAW_KNOWLEDGE_POINTS: SeedKnowledgePoint[] = [
  // ==================== 高中信息技术 (it) ====================
  // Word 文字处理（11 项）
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

  // Excel 电子表格（16 项）
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

  // 网页制作 HTML/CSS（13 项）
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

  // 文件与文件夹管理（10 项）
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

  // Python 程序设计（12 项）
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

  // 数据库与 SQL 查询（8 项）
  { id: 'kp-db-1', type: 'database', chapter: '数据表基础查询', name: '基础投影查询与去重（SELECT / DISTINCT / AS 别名）' },
  { id: 'kp-db-2', type: 'database', chapter: '数据表基础查询', name: '条件过滤与模糊匹配（WHERE / AND / OR / LIKE / BETWEEN）' },
  { id: 'kp-db-3', type: 'database', chapter: '数据表基础查询', name: '查询结果排序与限量（ORDER BY ASC / DESC / LIMIT）' },
  { id: 'kp-db-4', type: 'database', chapter: '统计与分组聚合', name: '常用聚合统计函数（COUNT / SUM / AVG / MAX / MIN）' },
  { id: 'kp-db-5', type: 'database', chapter: '统计与分组聚合', name: '分组聚合统计与筛选（GROUP BY / HAVING）' },
  { id: 'kp-db-6', type: 'database', chapter: '数据记录增删改', name: '插入新数据记录（INSERT INTO ... VALUES）' },
  { id: 'kp-db-7', type: 'database', chapter: '数据记录增删改', name: '按条件更新数据记录（UPDATE ... SET ... WHERE）' },
  { id: 'kp-db-8', type: 'database', chapter: '数据记录增删改', name: '按条件删除数据记录（DELETE FROM ... WHERE）' },

  // ==================== 高中通用技术 (gt) ====================
  // 1. 三视图与技术草图绘制（10 项 · 《技术与设计1》）
  { id: 'kp-gt-sketch-1', type: 'sketch3view', chapter: '三视图投影基础', name: '正投影原理与“长对正、高平齐、宽相等”规律' },
  { id: 'kp-gt-sketch-2', type: 'sketch3view', chapter: '三视图投影基础', name: '主视图、俯视图、左视图方位关系与补线判读' },
  { id: 'kp-gt-sketch-3', type: 'sketch3view', chapter: '工程图线规范', name: '可见轮廓线（粗实线）补齐绘制' },
  { id: 'kp-gt-sketch-4', type: 'sketch3view', chapter: '工程图线规范', name: '不可见轮廓线（细虚线）判断与绘制' },
  { id: 'kp-gt-sketch-5', type: 'sketch3view', chapter: '工程图线规范', name: '对称中心线与孔槽轴线（点画线）绘制' },
  { id: 'kp-gt-sketch-6', type: 'sketch3view', chapter: '典型形体读图', name: '台阶面与凹槽切割组合体缺线补画' },
  { id: 'kp-gt-sketch-7', type: 'sketch3view', chapter: '典型形体读图', name: '通孔与半圆孔结构三视图补线分析' },
  { id: 'kp-gt-sketch-8', type: 'sketch3view', chapter: '尺寸标注规范', name: '机械加工图线性尺寸、直径(Φ)与半径(R)标注' },
  { id: 'kp-gt-sketch-9', type: 'sketch3view', chapter: '尺寸标注规范', name: '尺寸界线、尺寸线与常见错标/漏标/重复标识别' },
  { id: 'kp-gt-sketch-10', type: 'sketch3view', chapter: '设计草图表达', name: '网格草图规范与多视图空间对应检验' },

  // 2. 电子控制电路连线与调试（10 项 · 《电子控制技术》）
  { id: 'kp-gt-circuit-1', type: 'circuit', chapter: '电子元器件识别', name: '直流电源 VCC/GND 回路规范与限流电阻作用' },
  { id: 'kp-gt-circuit-2', type: 'circuit', chapter: '传感与信号采集', name: '光敏传感器暗亮特性与光线阈值调试' },
  { id: 'kp-gt-circuit-3', type: 'circuit', chapter: '传感与信号采集', name: '热敏传感器（NTC/PTC）温度阈值控制应用' },
  { id: 'kp-gt-circuit-4', type: 'circuit', chapter: '传感与信号采集', name: '手动开关、微动开关与干簧管输入控制' },
  { id: 'kp-gt-circuit-5', type: 'circuit', chapter: '放大与开关控制', name: 'NPN 型三极管放大与开关状态（基极 B 触发导通）' },
  { id: 'kp-gt-circuit-6', type: 'circuit', chapter: '放大与开关控制', name: '多级耦合与串联/并联逻辑控制回路搭建' },
  { id: 'kp-gt-circuit-7', type: 'circuit', chapter: '执行器件驱动', name: '电磁继电器线圈驱动与常开触点 (COM-NO) 负载切换' },
  { id: 'kp-gt-circuit-8', type: 'circuit', chapter: '执行器件驱动', name: '发光二极管 (LED) 与蜂鸣器报警输出回路连接' },
  { id: 'kp-gt-circuit-9', type: 'circuit', chapter: '电路调试与排错', name: '断路、短路排查与多工况光照/温度动态验证' },
  { id: 'kp-gt-circuit-10', type: 'circuit', chapter: '电路调试与排错', name: '电子控制系统输入—控制—输出完整电路设计' },

  // 3. 结构设计与受力稳定实验（10 项 · 《技术与设计2》第一单元）
  { id: 'kp-gt-structure-1', type: 'structure', chapter: '结构与受力分析', name: '构件五种基本受力（受拉/受压/受弯/受剪/受扭）' },
  { id: 'kp-gt-structure-2', type: 'structure', chapter: '结构与受力分析', name: '实体结构、框架结构与壳体结构特点对比' },
  { id: 'kp-gt-structure-3', type: 'structure', chapter: '结构稳定性影响因素', name: '三角形稳定性原理与四边形框架斜撑加固' },
  { id: 'kp-gt-structure-4', type: 'structure', chapter: '结构稳定性影响因素', name: '结构重心高低与支撑面大小对稳定性的影响' },
  { id: 'kp-gt-structure-5', type: 'structure', chapter: '结构强度影响因素', name: '结构材料选型（木材/铝合金/钢材）与抗压对比' },
  { id: 'kp-gt-structure-6', type: 'structure', chapter: '结构强度影响因素', name: '连接方式（铰连接与刚连接）对强度和变形的影响' },
  { id: 'kp-gt-structure-7', type: 'structure', chapter: '结构强度影响因素', name: '构件截面形状与整体几何构型优化' },
  { id: 'kp-gt-structure-8', type: 'structure', chapter: '结构设计实验', name: '典型支架/桁架桥梁增设斜拉杆件抗载设计' },
  { id: 'kp-gt-structure-9', type: 'structure', chapter: '结构设计实验', name: '结构安全系数计算与抗倾倒试验评估' },
  { id: 'kp-gt-structure-10', type: 'structure', chapter: '经典结构赏析', name: '技术与文化视角下的典型稳固结构评估' },

  // 4. 控制系统框图与分析（10 项 · 《技术与设计2》第四单元）
  { id: 'kp-gt-control-1', type: 'control', chapter: '控制手段与分类', name: '人工控制与自动控制特点对比' },
  { id: 'kp-gt-control-2', type: 'control', chapter: '开环控制系统', name: '开环控制系统组成（输入→控制器→执行器→被控对象→输出）' },
  { id: 'kp-gt-control-3', type: 'control', chapter: '开环控制系统', name: '典型开环控制案例识别（定时路灯/电风扇开关/自动门）' },
  { id: 'kp-gt-control-4', type: 'control', chapter: '闭环控制系统', name: '闭环控制系统组成（比较器、检测装置与反馈环节）' },
  { id: 'kp-gt-control-5', type: 'control', chapter: '闭环控制系统', name: '反馈机理与误差修正过程分析' },
  { id: 'kp-gt-control-6', type: 'control', chapter: '控制要素辨析', name: '给定量（设定值）与被控量（实际输出）精准区分' },
  { id: 'kp-gt-control-7', type: 'control', chapter: '控制要素辨析', name: '控制器（决策核心）与执行器（动作部件）识别选配' },
  { id: 'kp-gt-control-8', type: 'control', chapter: '控制要素辨析', name: '被控对象确定与主要干扰因素分析' },
  { id: 'kp-gt-control-9', type: 'control', chapter: '系统设计与优化', name: '开环控制升级改造为闭环稳态控制系统' },
  { id: 'kp-gt-control-10', type: 'control', chapter: '系统设计与优化', name: '恒温箱/自动水位/智能大棚闭环控制框图绘制' },

  // 5. 工艺流程与加工测量（10 项 · 《技术与设计1》&《技术与设计2》）
  { id: 'kp-gt-craft-1', type: 'craft', chapter: '工艺与时序逻辑', name: '流程的环节与时序概念（不可颠倒工序排序）' },
  { id: 'kp-gt-craft-2', type: 'craft', chapter: '金工加工工艺', name: '金属加工通用流程（划线→锯割→锉削→钻孔→装配）' },
  { id: 'kp-gt-craft-3', type: 'craft', chapter: '金工加工工艺', name: '划线与冲眼工具选用（划针/钢直尺/角尺/样冲）' },
  { id: 'kp-gt-craft-4', type: 'craft', chapter: '金工加工工艺', name: '锯割、锉削与台虎钳夹持方法及工量具匹配' },
  { id: 'kp-gt-craft-5', type: 'craft', chapter: '金工加工工艺', name: '金属钻孔定位、平口钳夹持与表面防锈处理' },
  { id: 'kp-gt-craft-6', type: 'craft', chapter: '木工与表面工艺', name: '木工下料、刨削、榫卯装配及砂纸打磨工艺流程' },
  { id: 'kp-gt-craft-7', type: 'craft', chapter: '加工安全规范', name: '台钻钻孔严禁戴手套及护目镜/防尘安全守则' },
  { id: 'kp-gt-craft-8', type: 'craft', chapter: '精密尺寸测量', name: '游标卡尺主尺整毫米数与游标对齐格数读数方法' },
  { id: 'kp-gt-craft-9', type: 'craft', chapter: '精密尺寸测量', name: '直角尺平面度与垂直度误差检验方法' },
  { id: 'kp-gt-craft-10', type: 'craft', chapter: '流程优化设计', name: '工序并行、工艺优化与工期/质量平衡设计' },
];

export const BUILTIN_KNOWLEDGE_POINTS: SeedKnowledgePoint[] =
  RAW_KNOWLEDGE_POINTS.map((kp) => ({
    ...kp,
    subjectId: kp.subjectId || getSubjectForType(kp.type),
  }));

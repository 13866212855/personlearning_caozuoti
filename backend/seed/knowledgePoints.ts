import type { QuestionType } from '../types';

export interface SeedKnowledgePoint {
  id: string;
  type: QuestionType;
  chapter: string;
  name: string;
}

export const BUILTIN_KNOWLEDGE_POINTS: SeedKnowledgePoint[] = [
  // Word
  { id: 'kp-word-1', type: 'word', chapter: '字体与段落排版', name: '字符与段落格式' },
  { id: 'kp-word-2', type: 'word', chapter: '表格制作', name: '表格' },
  { id: 'kp-word-3', type: 'word', chapter: '图文混排', name: '图文混排' },
  { id: 'kp-word-4', type: 'word', chapter: '版面设计', name: '页面设置' },
  { id: 'kp-word-5', type: 'word', chapter: '文档编辑', name: '查找替换' },
  { id: 'kp-word-6', type: 'word', chapter: '版面设计', name: '页眉页脚' },

  // Excel
  { id: 'kp-excel-1', type: 'excel', chapter: '数据计算', name: '公式与函数' },
  { id: 'kp-excel-2', type: 'excel', chapter: '数据管理', name: '排序筛选' },
  { id: 'kp-excel-3', type: 'excel', chapter: '数据可视化', name: '图表' },
  { id: 'kp-excel-4', type: 'excel', chapter: '表格修饰', name: '单元格格式' },
  { id: 'kp-excel-5', type: 'excel', chapter: '数据汇总', name: '分类汇总' },
  { id: 'kp-excel-6', type: 'excel', chapter: '数据计算', name: 'RANK函数与条件格式' },

  // Web
  { id: 'kp-web-1', type: 'web', chapter: 'HTML 基础', name: 'HTML 标签' },
  { id: 'kp-web-2', type: 'web', chapter: 'HTML 基础', name: '超链接' },
  { id: 'kp-web-3', type: 'web', chapter: '页面结构', name: '表格' },
  { id: 'kp-web-4', type: 'web', chapter: '交互元素', name: '表单' },
  { id: 'kp-web-5', type: 'web', chapter: '层叠样式表', name: 'CSS 样式' },

  // File
  { id: 'kp-file-1', type: 'file', chapter: '文件基础操作', name: '新建/重命名' },
  { id: 'kp-file-2', type: 'file', chapter: '文件组织', name: '复制移动' },
  { id: 'kp-file-3', type: 'file', chapter: '高级操作', name: '快捷方式' },
  { id: 'kp-file-4', type: 'file', chapter: '文件管理', name: '搜索' },
  { id: 'kp-file-5', type: 'file', chapter: '属性设置', name: '只读与隐藏属性' },
];

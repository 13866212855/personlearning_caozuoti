export type QuestionType = 'word' | 'excel' | 'web' | 'file';
export type DifficultyLevel = '基础' | '中等' | '提高';

export interface WordParagraph {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  indent: number;
  listType: 'none' | 'bullet' | 'number';
}

export interface WordTable {
  id: string;
  rows: string[][];
  headerBg?: string;
}

export interface WordImage {
  id: string;
  src: string;
  alt: string;
  width: number;
  align: 'left' | 'center' | 'right';
}

export interface WordState {
  paragraphs: WordParagraph[];
  tables: WordTable[];
  images: WordImage[];
  headerText: string;
  footerText: string;
  pageSetup: {
    orientation: 'portrait' | 'landscape';
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
  };
}

export interface ExcelCell {
  value: string;
  formula?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
  border?: boolean;
  numberFormat?: 'general' | 'number2' | 'percent' | 'currency';
}

export interface ExcelChart {
  id: string;
  type: 'column' | 'line' | 'pie';
  title: string;
  labelRange: string;
  dataRange: string;
}

export interface ExcelState {
  cells: Record<string, ExcelCell>;
  merges: string[];
  charts: ExcelChart[];
  sortInfo?: { column: string; order: 'asc' | 'desc' };
  filterInfo?: { column: string; keyword: string };
}

export interface WebFile {
  path: string;
  name: string;
  type: 'html' | 'css' | 'image';
  content: string;
}

export interface WebState {
  files: WebFile[];
}

export interface VirtualFileItem {
  id: string;
  path: string;
  name: string;
  type: 'folder' | 'file' | 'shortcut';
  parentPath: string;
  content?: string;
  targetPath?: string;
  readOnly?: boolean;
  hidden?: boolean;
  size?: number;
}

export interface FileState {
  items: VirtualFileItem[];
}

export type SimulatorState = WordState | ExcelState | WebState | FileState;

export interface QuestionStep {
  index: number;
  instruction: string;
  score: number;
}

export interface QuestionAsset {
  name: string;
  url: string;
  note?: string;
}

export interface ClientQuestion {
  id: string;
  title: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  knowledgePoints: string[];
  scenario: string;
  totalScore: number;
  materials: {
    description: string;
    assets?: QuestionAsset[];
    initialState: SimulatorState;
  };
  steps: QuestionStep[];
  source: 'seed' | 'ai';
}

export interface CheckpointResult {
  checkpointId: string;
  stepIndex: number;
  description: string;
  maxScore: number;
  earnedScore: number;
  passed: boolean;
  feedback: string;
  gradedByAi?: boolean;
}

export interface SubmitResponse {
  submissionId: string;
  autoScore: number;
  hintPenalty: number;
  hintsUsedCount: number;
  finalScore: number;
  maxScore: number;
  checkpointResults: CheckpointResult[];
  gradedByAi: boolean;
  referenceAnswer: SimulatorState;
  analysis: string[];
  commonMistakes: string[];
}

export interface StudentProfile {
  id: string;
  username: string;
  realName: string;
  grade: string;
  className: string;
}

export const TYPE_LABELS: Record<QuestionType, string> = {
  word: 'Word 文字处理',
  excel: 'Excel 电子表格',
  web: '网页制作 (HTML/CSS)',
  file: '文件与文件夹管理',
};

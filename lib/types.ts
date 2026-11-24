export type UserRole = 'super_admin' | 'teacher' | 'student';
export type QuestionType = 'word' | 'excel' | 'web' | 'file';
export type DifficultyLevel = '基础' | '中等' | '提高';
export type QuestionVisibility = 'private' | 'shared' | 'public';

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
  hint?: string;
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
  knowledgePointIds?: string[];
  scenario: string;
  totalScore: number;
  materials: {
    description: string;
    assets?: QuestionAsset[];
    initialState: SimulatorState;
  };
  steps: QuestionStep[];
  source: 'seed' | 'ai';
  visibility?: QuestionVisibility;
}

export interface FullQuestion extends ClientQuestion {
  checkpoints: Array<{
    id: string;
    stepIndex: number;
    description: string;
    score: number;
    ruleType: string;
    params: Record<string, unknown>;
  }>;
  referenceAnswer: SimulatorState;
  analysis: string[];
  commonMistakes: string[];
  status: 'draft' | 'published';
  ownerId: string;
  ownerName?: string;
  isOwner?: boolean;
  visibility: QuestionVisibility;
  createdAt: string;
  updatedAt: string;
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

export interface ExamQuestionResult {
  questionId: string;
  title: string;
  type: QuestionType;
  maxScore: number;
  autoScore: number;
  finalScore: number;
  checkpointResults: CheckpointResult[];
  gradedByAi: boolean;
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

export interface PortalUser {
  id: string;
  username: string;
  role: UserRole;
  realName: string;
  grade: string;
  className: string;
  studentNo?: string;
  teacherId?: string;
  teacherName?: string;
  classId?: string;
  mustChangePassword: boolean;
  unreadNotifications?: number;
}

export interface StudentExamCard {
  id: string;
  title: string;
  description: string;
  teacherName: string;
  questionCount: number;
  totalScore: number;
  duration: number;
  startTime: string;
  endTime: string;
  maxAttempts: number;
  attemptsUsed: number;
  scorePolicy: 'highest' | 'latest';
  showScoreImmediately: boolean;
  showAnswerPolicy: 'immediate' | 'after_end' | 'never';
  answerVisible: boolean;
  antiCheatSwitch: boolean;
  allowLate: boolean;
  examStatus: string;
  canEnter: boolean;
  statusReason: string;
  hasInProgress: boolean;
  inProgressSubmissionId: string | null;
  remainingSeconds: number | null;
  displayScore: number | null;
  lastSubmittedAt: string | null;
  isPastDeadline: boolean;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

export interface ClassItem {
  id: string;
  name: string;
  grade: string;
  inviteCode?: string;
  studentCount: number;
  isDefaultRegistration?: boolean;
  createdAt: string;
}

export interface KnowledgePointItem {
  id: string;
  type: QuestionType;
  chapter: string;
  name: string;
  isSystem: boolean;
}

export interface TeacherExamSummary {
  id: string;
  title: string;
  description: string;
  duration: number;
  startTime: string;
  endTime: string;
  status: 'draft' | 'published' | 'ended';
  runtimeStatus: string;
  questionCount: number;
  totalScore: number;
  targetSummary: string;
  assignedCount: number;
  submittedCount: number;
  avgScore: number | null;
  createdAt: string;
}

export const TYPE_LABELS: Record<QuestionType, string> = {
  word: 'Word 文字处理',
  excel: 'Excel 电子表格',
  web: '网页制作 (HTML/CSS)',
  file: '文件与文件夹管理',
};

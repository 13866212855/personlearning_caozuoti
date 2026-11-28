export type UserRole = 'super_admin' | 'teacher' | 'student';
export type SubjectId = 'it' | 'gt';

export type QuestionType =
  | 'word'
  | 'excel'
  | 'web'
  | 'file'
  | 'python'
  | 'database'
  | 'sketch3view'
  | 'circuit'
  | 'structure'
  | 'control'
  | 'craft';

export type DifficultyLevel = '基础' | '中等' | '提高';
export type QuestionStatus = 'draft' | 'published';
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

export interface PythonState {
  code: string;
  customInput?: string;
  lastOutput?: string;
  lastError?: string;
}

export interface DatabaseTable {
  name: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
}

export interface DatabaseState {
  tables: DatabaseTable[];
  sql: string;
  lastColumns?: string[];
  lastRows?: Array<Array<string | number | null>>;
  lastChanges?: number;
  lastError?: string;
}

// ==================== 高中通用技术 (gt) 仿真状态模型 ====================

export type SketchViewName = 'front' | 'top' | 'left';
export type SketchLineStyle = 'solid' | 'dashed' | 'center';

export interface SketchLine {
  view: SketchViewName;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  style: SketchLineStyle;
}

export interface SketchDimension {
  id: string;
  view: SketchViewName;
  label: string;
  value: string;
}

export interface Sketch3ViewState {
  partTitle?: string;
  gridCols: number;
  gridRows: number;
  givenLines: SketchLine[];
  lines: SketchLine[];
  dimensions?: SketchDimension[];
}

export type CircuitComponentType =
  | 'vcc'
  | 'gnd'
  | 'switch'
  | 'resistor'
  | 'sensor_light'
  | 'sensor_temp'
  | 'transistor_npn'
  | 'relay'
  | 'led'
  | 'buzzer';

export interface CircuitComponent {
  id: string;
  type: CircuitComponentType;
  label: string;
  x: number;
  y: number;
  pins: string[];
  value?: string;
  closed?: boolean;
}

export interface CircuitWire {
  from: string; // e.g. "vcc.out"
  to: string; // e.g. "r1.a"
}

export interface CircuitState {
  title?: string;
  components: CircuitComponent[];
  wires: CircuitWire[];
  powered: boolean;
  lightLevel?: number; // 0-100 lux %
  tempC?: number; // 0-100 °C
}

export interface StructureNode {
  id: string;
  x: number;
  y: number;
  label?: string;
  fixed?: boolean;
}

export interface StructureMember {
  from: string;
  to: string;
  material: 'wood' | 'steel' | 'aluminum';
}

export interface StructureState {
  taskTitle?: string;
  nodes: StructureNode[];
  baseMembers: StructureMember[];
  members: StructureMember[];
  jointType: 'rigid' | 'hinged';
  supportBaseWidth: number;
  testLoadN: number;
}

export interface ControlSystemState {
  systemTitle?: string;
  mode: 'open' | 'closed';
  availableOptions: string[];
  slots: {
    input: string;
    comparator?: string;
    controller: string;
    actuator: string;
    plant: string;
    sensor?: string;
    output: string;
  };
  hasFeedbackEdge: boolean;
  disturbance?: string;
}

export interface CraftProcessState {
  taskTitle?: string;
  availableSteps: string[];
  orderedSteps: string[];
  availableTools: string[];
  selectedTools: Record<string, string>;
  safetyOptions: string[];
  safetyChecks: string[];
  caliperMainMm?: number;
  caliperVernierDiv?: number;
  caliperReading?: string;
}

export type SimulatorState =
  | WordState
  | ExcelState
  | WebState
  | FileState
  | PythonState
  | DatabaseState
  | Sketch3ViewState
  | CircuitState
  | StructureState
  | ControlSystemState
  | CraftProcessState;

export interface QuestionStep {
  index: number;
  instruction: string;
  score: number;
  hint?: string;
}

export interface Checkpoint {
  id: string;
  stepIndex: number;
  description: string;
  score: number;
  ruleType: string;
  params: Record<string, unknown>;
}

export interface QuestionMaterials {
  description: string;
  assets?: Array<{ name: string; url: string; note?: string }>;
  initialState: SimulatorState;
}

export interface Question {
  id: string;
  subjectId?: SubjectId;
  title: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  knowledgePoints: string[];
  knowledgePointIds?: string[];
  scenario: string;
  totalScore: number;
  materials: QuestionMaterials;
  steps: QuestionStep[];
  checkpoints: Checkpoint[];
  referenceAnswer: SimulatorState;
  analysis: string[];
  commonMistakes: string[];
  status: QuestionStatus;
  source: 'seed' | 'ai';
  ownerId?: string;
  visibility?: QuestionVisibility;
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

export interface GradeResult {
  autoScore: number;
  maxScore: number;
  checkpointResults: CheckpointResult[];
  gradedByAi: boolean;
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

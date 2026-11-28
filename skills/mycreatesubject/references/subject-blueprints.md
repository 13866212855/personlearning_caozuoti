# 学科定制层设计指南与跨学科推演蓝图

将本系统迁移到任意新学科时，最核心的设计原则是：**把该学科的“实操动作”抽象为可编辑的结构化 JSON 状态（`SimulatorState`），再基于状态属性编写 100% 确定性的 `ruleType` 检查点。**

---

## 一、如何将新学科转化为「仿真器 + 判分器」

设计新学科的 `QuestionType` 时，按下面四步检查是否具备工程可落地性：

1. **交互载体明确**：学生在电脑屏幕前操作什么？（如画板网格、电路面包板、结构桁架搭建画布、控制框图节点编辑器、工艺卡片排序台、实验器材操作台、数据分析工作表等）。
2. **状态纯结构化**：整个操作结果能否序列化为干净的 JSON？（例如节点列表 `nodes`、连线列表 `edges`、元器件参数 `components`、工步顺序 `sequence`、读数答案 `readings`）。
3. **规则无歧义**：每一个得分点都对应 1~N 个确定的 `ruleType` + `params`（例如：某两个引脚是否连通、某个开关是否闭合、某条三视图关键投影线是否存在、某道工序是否排在另一道之前、数值误差是否在允许公差 `tolerance` 内）。
4. **AI 与模板双引擎同构**：AI 出题的 `typeSpecs` 与本地 `templateQuestionGenerator.ts` 输出完全一致的 `SimulatorState` 与 `ruleType`，两者共用同一个 `gradeAnswerDeterministic` 自检函数。

---

## 二、完整推演蓝图：「高中通用技术」实操练习与测评系统

以下为依据 `mycreatesubject` 对 **「高中通用技术」**（普通高中课程标准《技术与设计1》《技术与设计2》及电子控制技术/学业水平合格考）的完整映射方案，可直接作为实施模板。

### 1. 学科品牌与全局替换规划

- **应用名称**：`高中通用技术会考·实践操作练习系统`
- **默认班级邀请码前缀**：`GT2026`
- **学科图标**：全部选用 `lucide-react` 图标（如 `Compass`, `Cpu`, `Wrench`, `Layers`, `GitBranch`, `Ruler`），彻底移除原学科相关文档/表格术语。

### 2. 题型矩阵设计（5 大实操核心模块）

| `QuestionType` | 中文名称 (`TYPE_LABELS`) | 对应的交互式仿真器 (`components/simulators/`) | 典型考查能力 |
| :--- | :--- | :--- | :--- |
| `sketch3view` | 三视图与技术草图绘制 | `ThreeViewSketchSimulator.tsx`：主/俯/左三视图正交网格画布，支持切换**粗实线（可见轮廓）**、**虚线（不可见轮廓）**、**细点画线（中心轴线）**与橡皮擦，支持“长对正、高平齐、宽相等”对齐辅助参考线 | 读懂立体零件图补全三视图缺线、辨析虚实线与尺寸标注规范 |
| `circuit` | 电子控制电路连接与调试 | `CircuitSimulator.tsx`：面包板/原理图交互工作台，内置电源、开关、电阻、电容、光敏/热敏传感器、三极管、继电器、555 定时模块与发光二极管；支持点击引脚建立导线连接、调节电阻/电位器阻值并点击「通电仿真」观察实时亮灭/电平 | 传感器输入→控制处理→执行器输出电路连线、三极管开关条件判断与故障排查 |
| `structure` | 结构设计与受力稳定性实验 | `StructureSimulator.tsx`：支架/桥梁/台架选材与节点装配工作台，可配置杆件长度、截面/材料（木材/钢材/铝合金）、连接方式（刚连接/铰连接）、支撑方式（三角形斜撑）及加载重物观察形变与是否失稳 | 影响结构强度的因素、重心与支撑面积对稳定性的影响、三角形结构加固 |
| `control` | 控制系统框图与流程设计 | `ControlSystemSimulator.tsx`：开环/闭环控制系统方框图画板，支持向输入端、控制器、执行器、被控对象、检测装置、比较器等槽位拖放/选择模块，设定给定值与干扰因素并模拟运行输出曲线 | 辨别开环与闭环控制、正确填写方框图各环节、分析反馈路径与抗干扰能力 |
| `craft` | 金工/木工工艺流程与工具操作 | `CraftProcessSimulator.tsx`：工艺工步卡片拖拽/上下移动排序台 + 加工工具（手锯/锉刀/台钻/丝锥/划针/游标卡尺）选型与安全规范勾选 + 游标卡尺/千分尺放大读数交互面板 | 制定合理加工流程图、区分并行与串行工序、选择正确工具与安全操作要领 |

### 3. 结构化 `SimulatorState` 定义示例（节选）

```ts
// 1) 三视图绘制
export interface Sketch3ViewState {
  gridSize: { cols: number; rows: number }; // 如 12x12
  lines: Array<{
    view: 'front' | 'top' | 'left';
    x1: number; y1: number; x2: number; y2: number;
    style: 'solid' | 'dashed' | 'center';
  }>;
  dimensions?: Array<{ view: 'front' | 'top' | 'left'; label: string; value: number }>;
}

// 2) 电子控制电路
export interface CircuitState {
  components: Array<{
    id: string; type: 'vcc' | 'gnd' | 'resistor' | 'sensor_light' | 'transistor_npn' | 'relay' | 'led' | 'switch';
    label: string; value?: string; state?: 'on' | 'off';
  }>;
  wires: Array<{ from: string; to: string }>; // 如 "sensor_light.out" -> "transistor_npn.b"
  powered: boolean;
  measuredOutputs?: Record<string, string | number | boolean>;
}

// 3) 控制系统框图
export interface ControlSystemState {
  mode: 'open' | 'closed';
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
}

// 4) 工艺流程与工具操作
export interface CraftProcessState {
  orderedSteps: string[];
  selectedTools: Record<string, string>; // 工步 -> 工具名称
  safetyChecks: string[];
  caliperReading?: number; // 游标卡尺读数 (mm)
}
```

### 4. 确定性 `ruleType` 判分字典示例

| 题型 | `ruleType` | `params` 核心字段 | 判分逻辑 |
| :--- | :--- | :--- | :--- |
| `sketch3view` | `sketch_line_exists` | `{ view, x1, y1, x2, y2, style }` | 标准化线段端点方向后比对目标视图与线型（实线/虚线/点画线） |
| `sketch3view` | `sketch_line_not_exists` | `{ view, x1, y1, x2, y2 }` | 确认错误投影线或多余轮廓线已被擦除 |
| `circuit` | `circuit_wire_connected` | `{ pinA, pinB }` | 无向连通图判断 `pinA` 与 `pinB` 是否连通（支持串联中间节点等价判定） |
| `circuit` | `circuit_component_value` | `{ componentId, expectedValue }` | 检查电位器/电阻设定值是否满足题目要求 |
| `circuit` | `circuit_sim_output` | `{ componentId, expectedState }` | 后端基于电路图运行拓扑求值，校验发光二极管/继电器动作状态 |
| `structure` | `structure_member_exists` | `{ fromNode, toNode, material? }` | 核对关键斜撑/拉杆与材料选型是否形成稳定三角形 |
| `structure` | `structure_load_safe` | `{ minLoadN, maxDeflectionMm }` | 运行简化静力稳定校验，判断是否承受住额定荷载且不倾覆 |
| `control` | `control_slot_match` | `{ slot, keywords }` | 核对控制器/执行器/被控对象/检测装置填入概念是否正确 |
| `control` | `control_feedback_valid` | `{ requiredMode: 'closed' }` | 检查闭环模式与反馈连线是否正确闭合 |
| `craft` | `craft_order_before` | `{ stepA, stepB }` | 校验关键加工工序先后次序（如“划线”必须在“锯割/钻孔”之前） |
| `craft` | `craft_tool_match` | `{ step, expectedTool }` | 核对指定工序选用的工具是否规范（如内螺纹攻丝用“丝锥与铰杠”） |
| `craft` | `craft_reading_approx` | `{ expectedMm, tolerance }` | 校验游标卡尺读数误差在允许范围内（如 `tolerance: 0.02`） |

### 5. 「分步实时纠错 + 小白图文演示」对应设计

- **`stepGuidance.ts` 映射示例**：
  - 当 `sketch_line_exists` 提示缺失俯视图虚线时：`concreteSteps` 明确指导“① 在左上方切换当前画板为「俯视图」；② 在工具栏点击「虚线（不可见轮廓）」；③ 按「长对正」参考线在对应网格起点到终点单击连线”，`pitfallTip` 提醒“看不到的内部凹槽轮廓必须画虚线，画成粗实线会扣分”，`demoTopic: 'sketch_hidden_line'`。
  - 当 `circuit_wire_connected` 未连通传感器至三极管基极时：`concreteSteps` 逐步指出起点引脚圆点与终点引脚圆点颜色，提醒“三极管开关电路中基极 B 需先串联限流电阻或接分压点，不可直接短路电源”。
- **`StepGuideShowcase.tsx` 专题覆盖**：为 `sketch_3view`、`sketch_hidden_line`、`circuit_wiring`、`circuit_sensor_switch`、`structure_triangle`、`control_closed_loop`、`craft_metal_order`、`craft_caliper_read` 等专题编写清晰的小白分步视觉示意图（完全使用标准 UI 卡片、边框高亮与 `lucide-react` 图标）。

### 6. 知识点树规划（建议 50~70 个课标考点）

- **技术与设计1**：技术与人的关系、技术设计一般过程、设计原则（实用/创新/经济/美观/道德/技术规范/可持续发展）、人机关系、草图绘制与三视图（长对正/高平齐/宽相等）、尺寸标注、材料与工艺（金工/木工工具与安全操作）、设计评价。
- **技术与设计2**：结构与受力（拉力/压力/剪切/弯曲/扭转）、结构强度与稳定性因素、典型结构赏析、流程与时序/环节、流程优化（工期/工艺/成本/技术优化）、系统基本特性（整体/相关/目的/动态/环境适应性）、系统分析原则、开环与闭环控制系统、干扰与反馈。
- **电子控制技术（选修必考拓展）**：常见传感器（光敏/热敏/磁敏/声敏）、三极管开关状态、继电器控制直流/交流负载、数字电路基础逻辑门（与/或/非）、555 定时电路应用、电子控制调试与常见故障排查。

---

## 三、其他学科快速适配参照表

若后续将本技能用于除「通用技术」外的其他学科，只需替换下表对应的仿真器与核心判分模式，其余平台底座完全复用：

| 目标学科 | 建议 `QuestionType` 矩阵（3~5 类） | 确定性判分核心抓手 |
| :--- | :--- | :--- |
| **高中物理实验** | 力学打点计时器(`ticker_tape`)、伏安法电学电路连接(`electric_lab`)、光学成像光具座(`optics_bench`)、游标卡尺/螺旋测微器读数(`gauge_read`) | 接线拓扑连通性与量程选择校验、实验数据代入计算（逐差法/斜率）、读数公差判定、故障现象推演 |
| **高中化学实验** | 实验装置组装与气密性检查(`chem_apparatus`)、试剂鉴别与滴定操作(`chem_titration`)、离子检验流程图(`chem_flow`)、实验安全与废液处理(`chem_safety`) | 仪器连接顺序（发生→除杂→干燥→收集→尾气吸收）、滴定终态/颜色/体积读数、实验步骤先后顺序校验 |
| **初中信息技术** | 文档基础排版(`word_basic`)、电子表格统计(`excel_basic`)、演示文稿动画与母版(`ppt_basic`)、Python 龟画图/基础流程(`python_turtle`) | 复刻现有 6 类引擎并降维为初中课标难度（减少复杂嵌套函数，强化 Turtle/基础排版） |
| **职业技能/电工电子** | 继电接触器控制接线(`plc_relay`)、万用表测量排故(`multimeter`)、网络拓扑配置(`net_topo`) | 回路自锁/互锁拓扑检验、档位与表笔极性校验、子网划分与路由表匹配 |

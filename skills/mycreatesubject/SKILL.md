---
name: mycreatesubject
description: >
  End-to-end blueprint and engineering methodology for cloning and adapting
  this practical-exam & simulation-based learning platform to ANY new academic
  subject (e.g., 高中通用技术, 高中物理实验, 高中化学实验, 初中信息技术, 职业技能实操).
  Use whenever the user asks to generate, clone, or adapt a subject-specific
  interactive simulation practice & exam web application modeled on this project.
---

# `mycreatesubject` — 学科实操练习与测评系统通用生成技能

本技能沉淀自「高中信息技术会考·操作题练习系统」的完整工程实践与真实线上踩坑经验。只要给定一个**目标学科**（如：`高中通用技术`、`高中物理实验操作`、`高中化学实验`、`职业技能实操`等），即可按本技能的固定底座 + 学科定制双层架构，高保真复刻出一套完整可用的实操训练与自动测评系统。

---

## 1. 触发时机与所需输入参数

当用户要求“参考本项目为【某学科】创建/生成一套实操练习与考试系统”时触发本技能。开始编码前，先确认或合理推导以下输入参数（若用户未逐项指定，按该学科国家课程标准 / 省级学业水平合格考标准自动补全）：

| 参数项 | 说明 | 示例（以「高中通用技术」为例） |
| :--- | :--- | :--- |
| `subjectName` | 学科全称 | 高中通用技术 |
| `gradeLevel` | 学段与年级 | 高中（高一 / 高二） |
| `examContext` | 对标考试或课程目标 | 普通高中学业水平合格性考试（通用技术实践操作） |
| `questionTypes` | 3~6 个可交互核心实操题型 | 三视图绘制(`sketch3view`)、电子控制电路(`circuit`)、结构设计与受力(`structure`)、控制系统框图(`control`)、金工/木工工艺流程(`craft`) |
| `authMode` | 账号体系模式 | 支持 `local`（本地注册登录）与 `platform`（外部学习平台 SSO 对接）双模式 |

---

## 2. 架构边界：固定平台底座 vs 学科定制层

执行任何新学科生成时，**严禁推翻已经验证稳定的平台骨架**，必须严格区分复用层与替换层：

### A. 固定复用的平台底座（Platform Core Skeleton）

以下能力保持结构一致，仅替换品牌文案或配置默认值：

1. **技术栈与同端口部署**：Next.js 15（App Router）+ Express 5 + SQLite（`better-sqlite3` 开启 `WAL` 与外键约束）+ Tailwind CSS + `lucide-react` 图标，通过自定义 `server.ts` 在 `3000` 端口统一对外提供页面与 `/api/*`。
2. **三端权限与页面隔离**：
   - **学生端**：首页/登录/注册（`/login`、`/register`、`/sso`）、模拟考试作答与实时分步检查（`/exam/[id]`）、错题本（`/mistakes`）、小白图文演示中心（`/guide`）、个人资料（`/profile`）。
   - **教师端（`/teacher`）**：工作台概览、班级与学生管理（含邀请码与学生密码重置）、出题中心与个人题库（AI 智能出题 + 标准模板快速出题 + 仿真试做验证 + 一键分配给学生）、考试管理（手动/按知识点智能抽题组卷 + 限时/重考/答案公开策略）、成绩学情统计。
   - **超级管理员端（`/admin`）**：独立 JWT（`ADMIN_JWT_SECRET`）与隔离登录入口，负责教师与学生管理、默认新注册学生归属教师/班级设置、大模型接口配置（`llm_configs` 含小写默认模型名及在线测试）、操作审计日志。
3. **双模式账号对接**：保留 `AUTH_MODE=local|platform`、`PLATFORM_*` 配置与平台镜像字段，确保既能独立运行又能接入外部学习平台。
4. **并发限流与高可用机制**：
   - 全班同机房共享出口 IP 并发注册限流（`max: 500`, `skipFailedRequests: true`）与基于 `Forwarded`/IP 的客户端地址解析。
   - 新生注册自动绑定后台配置的默认教师与班级，并自动继承该班已发布的试卷分配记录。
5. **AI 出题容错与兜底双引擎**：
   - 使用 `jsonrepair` + `response_format: { type: 'json_object' }`（兼容不支持该参数的网关自动回退）+ 字段规范化 + 自检满分校验；
   - 对 HTTP 401/403/404/429 快速中断并返回清晰中文诊断；
   - 配套**零外部依赖的「会考标准模板快速出题」引擎**及错误框内一键切换按钮。

> 详细表结构、中间件与真实踩坑修复方案见 [`references/architecture-and-pitfalls.md`](./references/architecture-and-pitfalls.md)。

### B. 必须按新学科重写的定制层（Subject-Specific Layer）

切换新学科时，以下模块**必须 100% 重新设计与实现**，严禁残留原学科逻辑：

1. **学科类型与状态模型**（`backend/types.ts`、`lib/types.ts`）：
   - 重新定义 `QuestionType` 联合枚举与 `TYPE_LABELS` 中文标签；
   - 为每类题型设计独立且无歧义的结构化 `SimulatorState`（仅保存确定性可判分的核心状态数据，不写多余的 `kind` 字段污染接口类型）。
2. **学科专属交互式仿真器**（`components/simulators/*` + `SimulatorRenderer.tsx`）：
   - 每类 `QuestionType` 对应一个可直接在浏览器中完成全部操作步骤的受控 React 仿真器组件（`state` + `onChange` 受控更新 + 撤销/重置或快捷提示），绝不使用纯文本框凑数。
3. **确定性状态机判分引擎**（`backend/grader/index.ts`）：
   - 为每类题型设计清晰的 `ruleType` 列表与 `params` 字典；
   - **强约束**：任何操作步得分必须能由 `gradeAnswerDeterministic(type, checkpoints, answerState)` 纯代码 100% 确定性判分，对空数组/缺省字段做好防御保护。
4. **每步实时检查 + 小白图文操作演示系统**（`backend/utils/stepGuidance.ts` + `components/guide/StepGuideShowcase.tsx` + `/app/guide/page.tsx`）：
   - 学生每做完一步点击检查或实时校验失败时，精准给出：① 当前步具体的 `concreteSteps` 操作步骤；② 针对该规则的 `pitfallTip` 易错提醒；③ 跳转 `/guide?topic=...&step=...` 的直达演示链接，打开后呈现零基础学生也能看懂的分步界面示意图与动作拆解。
5. **学科知识点树 + 种子题库 + 标准模板出题引擎**：
   - `backend/seed/knowledgePoints.ts`：覆盖新学科课标/会考高频考点的完整分级知识点树（建议 ≥ 50 个知识点，按模块与章节组织）；
   - `backend/seed/questions.ts`：覆盖所有新学科题型的精品种子操作题 + `seedSampleExam` 示例仿真试卷（确保 `gradeAnswerDeterministic(refAnswer) === 100%`）；
   - `backend/utils/templateQuestionGenerator.ts`：覆盖全部新学科题型的参数化本地出题模板，支持自定义主题、难度、步骤数（3~8 步）、总分（10~200）且通过整数分值均分与自检满分验证；
   - `backend/services/llm.ts`：`buildQuestionPrompt` 中的 `typeSpecs` 与 `ensureState` 必须完整切换为新学科的 `SimulatorState` 与 `ruleType` 说明书。
6. **学科全局品牌、配图资源与文案**（`metadata.json`、`app/layout.tsx`、公共 SVG 素材、页面标题与提示语）。

> 各典型学科（含「高中通用技术」完整 5 大模块推演）的具体数据结构、规则字典与界面设计蓝图见 [`references/subject-blueprints.md`](./references/subject-blueprints.md)。

---

## 3. 创建新学科应用的 7 步标准执行流水线

收到“用 `mycreatesubject` 生成【目标学科】应用”的指令后，严格按以下顺序推进：

### Step 1：学科实操维度拆解与题型矩阵设计
1. 依据目标学科的课程标准与合格考要求，提炼 **3~6 类具备清晰操作动作与可量化结果的实操题型**（避免把纯背诵简答题硬塞成仿真器）。
2. 为每类题型确立「核心交互对象 → 用户操作动作 → 最终产物结构 → 判分依据」闭环。
3. 编写完整的 `knowledgePoints` 知识点树，覆盖全部题型及高频考点，并在出题中心配置每类题型的「高频考点一键组合」预设（`KP_PRESETS`）。

### Step 2：定义共享类型与确定性判分器
1. 同步更新 `backend/types.ts` 与 `lib/types.ts` 的 `QuestionType`、`SimulatorState`、`TYPE_LABELS`。
2. 在 `backend/grader/index.ts` 实现全部学科 `ruleType` 的判分分支，对所有数组和嵌套字段做 `Array.isArray(...)` 防护。
3. 如涉及表达式/公式/数值读数/仿真电路求解等计算（类比信息技术的 `excelFormula.ts` / `pythonRunner.ts` / `sqlRunner.ts`），抽离为 `backend/utils/*` 独立纯函数或受限沙箱工具并单独测试。

### Step 3：实现交互式仿真器与小白分步演示系统
1. 为每种 `QuestionType` 编写独立仿真器组件，并在 `SimulatorRenderer.tsx` 注册分发。
2. 保证仿真器在学生端作答页、教师「试做验证」弹窗、错题本详情与参考答案对照视图中均可正常渲染（支持 `readOnly` 只读展示）。
3. 在 `backend/utils/stepGuidance.ts` 为每一个 `ruleType` 编写具体可执行的 `concreteSteps`、`pitfallTip` 与 `demoTopic`。
4. 在 `components/guide/StepGuideShowcase.tsx` 实现覆盖全部 `demoTopic` 的图文交互步骤卡片与高亮示意区，确保零基础学生点开即懂。

### Step 4：建设种子题库、模板出题引擎与 AI Prompt
1. 编写 `backend/seed/questions.ts`（每类题型至少 1~2 道典型种子题）与 `seedSampleExam`（涵盖全学科题型的综合仿真示范卷）。
2. 编写 `backend/utils/templateQuestionGenerator.ts`，实现全部题型的本地模板生成与 `gradeAnswerDeterministic` 自检校验；注意分步权重分配函数 `distributeIntScores` 的下限必须是 `1` 而不是 `10`，避免多步骤时单步检查点总分被拉高溢出。
3. 更新 `backend/services/llm.ts` 中的 `typeSpecs` 与 `ensureState`，保留 `jsonrepair` 容错、`json_object` 兼容回退及 401/403/404/429 快速中文提示。

### Step 5：联动三端页面与教师分配闭环
1. 更新教师出题中心（`TeacherQuestionStudioTab.tsx`）、考试管理、学情统计与学生端页面的题型筛选列表、考点统计映射（`kpCountByType`）及初始化空白状态构造器（`createEmptySimulatorState`）。
2. 确认以下端到端教师-学生链路畅通：
   - 管理员新建教师并设为默认注册归属 → 新学生注册自动绑定该教师与默认班级；
   - 教师出题后可一键「入库并分配给学生」，或在考试管理中按班级/学生定向发布试卷；
   - 学生登录后即可看到所属班级与个人的全部练习/仿真试卷。

### Step 6：去旧换新扫描与并发安全审查
1. 全局搜索检查项目文件（`app/`、`components/`、`backend/`、`lib/`、`public/`、`metadata.json`、`README.md`、`.env.example`），确认不存在原学科残留词汇（例如将“信息技术”“Word/Excel”等彻底替换为新学科术语）。
2. 核对关键安全与并发项：前后端响应体不使用 `.json().catch(() => ({}))` 吞错；所有 `.map()` 均有数组兜底；`login`/`register` 限流与 `bcrypt` 耗时合理；所有图标均来自 `lucide-react`。

### Step 7：编译、Lint 与全题型 100 分实测验收
1. 并行执行 `compile_applet` 与 `lint_applet`，确保 0 编译错误、0 ESLint 错误。
2. 重启服务后运行自动化验证脚本：
   - 对每类题型的种子题、`templateQuestionGenerator`（分别测试 `stepCount=3, 5, 8` 与不同 `totalScore`）逐一执行 `gradeAnswerDeterministic(refAnswer)`，必须全部达到 **100% 满分**；
   - 验证 `/api/exams/[id]/check-step` 返回正确的 `concreteSteps`、`pitfallTip` 与 `/guide` 对应 `demoTopic`；
   - 验证 `/teacher`、`/admin`、`/guide` 与三端关键 API 均返回预期状态码。

---

## 4. 参考文件索引

- [`references/architecture-and-pitfalls.md`](./references/architecture-and-pitfalls.md) — 平台固定底座明细、SQLite 表设计、双模式认证及 10 大真实线上踩坑与防御规范。
- [`references/subject-blueprints.md`](./references/subject-blueprints.md) — 学科题型矩阵转化方法论与「高中通用技术」等跨学科完整蓝图推演。

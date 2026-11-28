# 平台固定底座与真实工程避坑清单

本文档沉淀「高中信息技术会考·操作题练习系统」在真实教学与机房并发测试中打磨出的核心工程结构与避坑规范。使用 `mycreatesubject` 生成任何新学科应用时，以下底座设计与防御规则应原样继承。

---

## 1. 核心数据表底座（`backend/db.ts`）

SQLite 数据库开启 `PRAGMA journal_mode = WAL` 与 `PRAGMA foreign_keys = ON`，使用 `hasColumn()` 检测增量无损迁移列，不破坏已有数据。

| 表名 | 职责 | 关键字段约定 |
| :--- | :--- | :--- |
| `users` | 三端用户与平台镜像 | `role` (`super_admin`/`teacher`/`student`), `teacher_id`, `class_id`, `platform_user_id`, `platform_status` |
| `classes` | 班级与邀请码 | `teacher_id`, `invite_code`（6位无歧义字符）, `grade` |
| `knowledge_points` | 学科知识点树 | `id`, `type`, `chapter`, `name`, `is_system`, `owner_id` |
| `questions` | 学科操作题库 | `type`, `difficulty`, `knowledge_points_json`, `knowledge_point_ids_json`, `materials_json`, `steps_json`, `checkpoints_json`, `reference_answer_json`, `analysis_json`, `common_mistakes_json`, `owner_id`, `visibility` (`private`/`shared`/`public`) |
| `exams` / `exam_questions` / `exam_assignments` | 仿真组卷与定向分配 | `exam_assignments(target_type='class'|'student', target_id)` 决定学生端可见性 |
| `drafts` | 作答草稿自动保存 | `UNIQUE(student_id, question_id, exam_id)` |
| `submissions` / `exam_submissions` | 提交与自动判分留痕 | `auto_score`, `final_score`, `checkpoint_results_json`, `graded_by_ai` |
| `llm_configs` | 后台大模型配置 | 单行表 `id=1`，`base_url`, `api_key`, `text_model`, `image_model`, `teacher_daily_ai_limit` |
| `ai_generation_logs` | 教师每日 AI 额度审计 | `user_id`, `count`, `created_at` |
| `system_settings` | 全局系统配置键值 | 如 `default_registration_teacher_id`、`default_registration_class_id` |
| `admin_logs` / `notifications` | 审计日志与站内通知 | 管理员动作追溯、教师批改或分配提醒 |

---

## 2. 十条真实线上踩坑与必做防御

### 坑点 1：全班机房同时注册触发限流（"注册操作过于频繁"）与转圈卡顿
- **原因**：学校机房共享同一个公网出口 IP，若按默认窄窗口或低阈值限流，第 20 个之后的学生全部报错；同时 `bcrypt` salt rounds 过高会拉慢并发注册。
- **规范**：
  - `registerRateLimiter` 使用 `windowMs: 10 * 60 * 1000`、`max: 500`、`skipFailedRequests: true`；
  - `extractClientIp` 正确解析标准 `Forwarded: for=...` 与 `req.ip`；
  - 学生注册哈希采用 `bcrypt.hash(password, 8)` 兼顾安全与机房并发响应速度；前端按钮做好提交防抖与加载态切换。

### 坑点 2：新建教师设为默认归属后，学生登录看不到试题与试卷
- **原因**：种子试卷只挂在初始演示教师/班级下；新创建的教师名下没有默认班级或未将题目/试卷分配给该班。
- **规范**：
  - 在 `/admin` 创建教师或设置「默认新注册学生归属教师」时，若该教师暂无班级，自动创建一个默认班级并将 `default_registration_teacher_id`、`default_registration_class_id` 写入 `system_settings`；
  - 学生注册时读取该设置绑定 `teacher_id` 与 `class_id`；
  - 出题中心支持一键「入库并分配给学生」，试卷管理支持按班级或具体学生定向发布，**新加入该班级的学生自动继承班级试卷**。

### 坑点 3：纯文字步骤提示看不懂，零基础学生做错后仍不会操作
- **原因**：仅返回 `passed: false` 或简短扣分理由，学生不知道去界面哪里点什么按钮。
- **规范**：
  - 在 `backend/routes/exams.ts` 提供步骤检查接口，调用 `buildStepGuidance(qType, step, checkpoints, checkpointResults)`；
  - 对每个未通过的检查点返回具体工具栏定位与操作顺序（`concreteSteps`）、高频踩坑提醒（`pitfallTip`），以及带参数的演示直达链接 `/guide?topic=...&step=...&title=...&instruction=...`；
  - 在 `components/guide/StepGuideShowcase.tsx` 提供可切换专题的小白图文分步演示卡片，展示模拟工具栏高亮位置与分步示例。

### 坑点 4：大模型出题接口返回 403/404/429 拖慢重试或模型名大小写错误
- **原因**：部分网关对模型名区分大小写（例如 `agnes-2.5-flash` 与 `agnes-image-2.1-flash` 必须全小写），或账号受限返回 HTTP 403 时，后端仍盲目重试 3 次导致长达数十秒等待。
- **规范**：
  - `backend/config.ts`、`.env.example` 与 `db.ts` 迁移均采用准确的默认小写模型名（如 `agnes-2.5-flash`、`agnes-image-2.1-flash`）；
  - `callChatCompletions` 遇到 HTTP `401 / 403 / 404 / 429` 抛出带 `NON_RETRYABLE:` 前缀的清晰中文提示，`generateQuestionWithAi` 捕获后立即中止重试；
  - 单次请求超时限定在合理范围（8s~40s），前端出题类接口请求超时设为 `120000ms`。

### 坑点 5：大模型返回复杂 JSON 含未转义引号、尾逗号或换行导致 `JSON.parse` 报错
- **原因**：操作题 JSON 内部常嵌套 HTML、CSS、代码或带引号的操作说明，模型容易漏转义双引号或留尾逗号。
- **规范**：
  - 请求大模型出题时开启 `response_format: { type: 'json_object' }`（若上游返回 400/422 不支持该字段，自动回退为普通请求）；
  - 引入 `jsonrepair` 封装 `parseLlmJson`，按「直接 `JSON.parse` → `jsonrepair` 修复 → 去除 markdown 围栏再修复 → 解包 `{ question: ... }` 或 `[ {...} ]`」四级容错解析；
  - Schema 解析前先执行 `normalizeRawGeneratedQuestion` 对缺省字段和数字字符串做温和补全；
  - **必须保留「标准模板快速出题」兜底模式**，并在 AI 错误提示框内放一键切换按钮「改用会考标准模板立即生成」（不消耗每日 AI 额度）。

### 坑点 6：`Cannot read properties of undefined (reading 'map')` 前端崩溃
- **原因**：`lib/api.ts` 若使用 `.json().catch(() => ({}))` 吞掉非 JSON 响应体，会使页面拿到 `{}` 后直接调用 `res.questions.map(...)`；同时部分大模型生成结果缺少嵌套数组。
- **规范**：
  - `portalFetch` 与 `adminFetch` 先读取 `await resp.text()` 再显式 `JSON.parse`，若 `resp.ok` 但不是合法 JSON，直接抛出清晰错误而不是返回 `{}`；
  - 前端渲染前统一过一遍 `normalizeFullQuestion`，对 `steps`、`checkpoints`、`knowledgePoints`、`analysis`、`commonMistakes` 及后端 `grader` 中的嵌套数组全部用 `Array.isArray(...)` 防御。

### 坑点 7：模板出题多步骤权重分配超出单题总分
- **原因**：`distributeIntScores` 若统一把最小值夹在 `10`，当单题有 6~8 个步骤时单步可能只分到 `8` 分，子检查点再夹成 `10` 分就会导致整题总分变成 `102/100`。
- **规范**：`distributeIntScores` 内部最小保底设为 `Math.max(1, Math.round(totalScore))`，仅对外层整题总分限制 `>= 10`。

### 坑点 8：Express 5 + Next.js 15 开发期缓存错乱 (`Unexpected token '<'`)
- **原因**：Express 5 不再支持 `*` 裸字符串通配符；开发模式下浏览器或代理缓存旧 HTML 后会请求不存在的 `_next/static` chunk 而拿到 HTML 404 页面。
- **规范**：
  - `server.ts` 必须使用 `server.all(/.*/, ...)` 正则通配；
  - 开发环境对非 `/_next/` 的 GET 页面请求设置 `Cache-Control: no-store`。

### 坑点 9：新增学科题型后老数据库看不到新种子题
- **原因**：若只靠 `SELECT COUNT(*) = 0` 判断是否初始化题库，老数据库升级后不会补入新增题型与知识点。
- **规范**：
  - `knowledge_points` 使用 `ON CONFLICT(id) DO UPDATE ... WHERE is_system = 1` 幂等同步；
  - `questions` 使用 `INSERT OR IGNORE` 同步内置种子题；
  - `seedSampleExam` 对已有示范卷只做幂等补充，不覆盖教师人工修改内容。

### 坑点 10：自定义代码/实验沙箱安全与执行隔离
- **规范**：若新学科包含代码运行或公式求值，必须通过 AST/正则黑名单禁用系统模块（`os`/`sys`/`subprocess`/`builtins`/`inspect`/`gc`/`__dict__`/`__mro__` 等），限制运行内存、输出长度与超时时间，并显式传入受控环境变量（含 `NODE_ENV`）。

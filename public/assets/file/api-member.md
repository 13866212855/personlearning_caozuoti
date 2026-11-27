# 个性化学习平台 · 成员模块对接文档

> **文档版本：** 2026-11-18（依据后端源码逐接口核实生成）
> **读者：** 负责改造第三方应用的智能体 / 开发者
> **目标：** 将一个原本使用本地 SQLite 管理成员的应用，改造为使用本平台的成员系统（注册、登录、认证、成员增删改查、角色管理）

---

## 0. 文档范围

**覆盖：** 认证与账号生命周期（`/api/auth`）、教师端成员管理（`/api/teacher/students*`）、管理员成员管理（`/api/admin` 下成员相关接口）、JWT 机制、数据迁移指引。

**不覆盖：** 题库、练习、作业、问卷、签到、AI 辅导等业务模块（如需请参考项目根目录 `api.md`）。

**改造的本质：** 删除第三方应用中对本地成员表的读写，把"我是谁、我能不能登录、我的账号信息"全部交给本平台回答。第三方应用**不直接接触平台的数据库**，只通过 HTTP API 访问。

---

## 1. 集成架构与前提

### 1.1 推荐调用拓扑

```
┌──────────────────────┐         ┌─────────────────────────┐
│   第三方应用           │         │   个性化学习平台后端        │
│                      │  HTTP   │   (Express, 默认:3000)    │
│  后端服务 ────────────┼────────>│   /api/auth/*            │
│  (持有服务账号token)   │         │   /api/teacher/*         │
│                      │         │   /api/admin/*           │
│  前端 ──> 自己的后端 ──┤         │                          │
│  (不直连平台，免CORS)  │         │   JWT 校验 / 单会话管控    │
└──────────────────────┘         └─────────────────────────┘
```

**强烈建议由第三方应用的后端集中调用平台 API**（前端不直连），这样完全避开 CORS 限制，token 也不暴露在浏览器中。

如果应用前端必须直连平台（例如学生端直接用平台登录接口换 token），则需要平台管理员把前端页面域名加入后端环境变量 `CORS_WHITELIST`（逗号分隔），否则生产环境所有浏览器跨域请求会被拦截。开发环境（`NODE_ENV !== 'production'`）不限制。

### 1.2 服务账号策略（重要）

本平台**没有 API Key / 服务间签名机制**，所有接口认证都基于用户级 JWT。第三方应用后端要管理成员，需要平台管理员预先创建一个**专用服务账号**并告知其用户名密码：

| 需求场景 | 建议账号角色 | 能做什么 |
|---------|------------|---------|
| 只管理自己班的学生（建/改/删/查/批量） | `teacher`（班主任，绑定到目标班级） | 教师端全部成员接口；权限最小，**推荐** |
| 跨班级管理、设置班主任/学科教师/家长关系、审批角色申请、重置任意学生密码 | `admin` | 管理员全部成员接口 |

注意：

- 服务账号若是教师角色，**教师也是多端在线的**（不受单会话限制），同一账号可被多个服务实例同时使用；但要避免与他人共用。
- 管理接口 `requireAdmin` 中间件实际允许 `admin` **或** `teacher` 角色通过，但不要依赖这一点做越权设计——按"教师账号只走教师接口、管理员账号才走管理接口"使用。
- **不要**把平台的 `JWT_SECRET` 当作共享密钥签发自制 token——token 必须来自真实登录接口。

### 1.3 平台方需预先准备

1. 平台服务地址（下文记作 `BASE_URL`，形如 `http://<host>:3000`，以实际部署为准）
2. 服务账号（见 1.2）
3. 基础数据就绪：目标班级已创建且知道 `class_id`、学科已创建且知道 `subject_id`（可通过 4.9/4.10 的公开接口查询）
4. **注册闸门已开放**：平台有"年级注册闸门"机制——目标年级的任课教师未开放注册时，一切新学生注册都会被拒绝（错误码 `GRADE_REGISTRATION_CLOSED`）。迁移/注册前必须由教师在平台端打开对应年级的开关。
5. （可选）确认目标班级的"班级禁止重名"开关状态，它会影响同名学生能否注册。

---

## 2. 通用约定

### 2.1 认证方式

除特别标注"公开接口"外，所有接口都需要在请求头携带 JWT：

```
Authorization: Bearer <token>
```

- token 由登录/注册接口返回，payload 为 `{ userId, sessionId? }`
- 有效期默认 **24 小时**（服务端 `JWT_EXPIRES_IN` 可调），**没有刷新接口**，过期后重新登录即可
- **学生账号是单会话**：新登录会使该学生所有旧 token 立即失效；教师/管理员 token 支持多端并存

### 2.2 响应格式（务必按此实现，勿凭空假设）

**本项目没有全局 `success` 字段。判断成败只看 HTTP 状态码。**

成功响应有三种形态并存（不同接口不同）：

| 形态 | 样子 | 典型接口 |
|------|------|---------|
| 裸对象 | `{ token, user }` | 登录、注册 |
| data 包装 | `{ data: { students: [...], total } }` | 管理员学生列表 |
| message + data | `{ message: "...", data: {...} }` | 教师端成员接口 |

错误响应统一为：

```json
{ "error": { "code": "SOME_CODE", "message": "中文描述", "details": "可选" } }
```

### 2.3 HTTP 状态码语义

| 状态码 | 含义 |
|--------|------|
| 200 / 201 | 成功 |
| 400 | 参数缺失或非法（看 `error.code`） |
| 401 | 未认证：无 token / token 无效 / token 过期 / 学生单会话被顶下线 |
| 403 | 有 token 但权限不足，或被业务规则拦截（注册闸门、申请待审等） |
| 404 | 资源不存在 |
| 409 | 冲突：用户名已存在、班级禁止重名 |
| 500 | 服务器内部错误 |

### 2.4 401 错误码细分（token 失效时的处理依据）

| error.code | 含义 | 建议处理 |
|-----------|------|---------|
| `NO_TOKEN` | 未携带 token | 引导登录 |
| `INVALID_TOKEN` | token 无效 | 重新登录 |
| `TOKEN_EXPIRED` | token 已过期 | 重新登录 |
| `USER_NOT_FOUND` | token 对应的用户已被删除 | 重新登录（账号已不存在） |
| `SESSION_REPLACED` | 学生账号在其他设备登录，本机被顶下线 | 提示用户"账号已在别处登录"，重新登录 |

### 2.5 分页参数

成员类接口统一用 `page` + `limit`（注意不是 `pageSize`）。个别接口支持 `all=true` 或 `limit=0` 返回全量。

---

## 3. 成员数据模型

### 3.1 用户（users 表）核心字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int | 主键 |
| `username` | string(50) | 全局唯一，仅中文/英文字母/数字；长度加权（中文=2，英文数字=1）须在 2~20 |
| `password_hash` | string | bcrypt 加密存储，接口层永不返回 |
| `name` | string(100) | 真实姓名 |
| `role` | enum | `student` / `teacher`(班主任) / `subject_teacher` / `parent` / `admin` |
| `grade` | enum | 学段：`kindergarten` / `primary` / `middle` / `high`（学生/教师填写） |
| `grade_level` | string(20) | 年级中文字符串：`一年级`…`初三`/`九年级`（`初一`与`七年级`视为同一年级） |
| `class_id` | int | 所属班级（学生、班主任） |
| `current_subject_id` | int | 当前/主学科 ID |
| `subject_id` | int | 学科教师所教学科 ID |
| `teacher_class_ids` | text(JSON) | 学科教师所带班级 ID 数组，如 `[101,102]` |
| `remark` | text | 备注 |
| `phone` / `email` / `avatar_url` | string | 联系方式（角色申请时收集） |
| `active_session_id` | string(64) | 学生当前有效会话 ID（单会话机制内部字段） |
| `last_login_ip` / `last_ip_at` | | 学生最近登录 IP 与时间（平台教师端展示用） |
| `createdAt` / `updatedAt` | date | 时间戳 |

### 3.2 关联实体

- **班级 Class**：`id`、`class_name`、`grade`、`grade_level`、`is_active`（是否为当前激活班级）、`invite_code`、`active_subject_id`
- **学科 Subject**：`id`、`name`、`sort_order`、`is_active`
- **学生-学科关联**：多对多，带 `is_primary` 标记（注册时主学科自动建立）
- **家长-子女关系**：平台内部维护，通过管理员接口"设置家长的子女"配置

### 3.3 典型 SQLite 成员表 → 平台字段映射建议

| 第三方应用常见字段 | 平台对应 | 迁移说明 |
|------------------|---------|---------|
| `id` | `id`（平台生成） | 旧 ID 建议存入 `remark`（如 `migrated_from:12`）以便回溯 |
| `username` / `account` | `username` | **必须先校验平台用户名规则**（见 3.1），不合规需做映射（如 `app1_zhangsan`） |
| `password`（哈希或明文） | ⚠️ **不可迁移** | bcrypt 盐随机，跨系统哈希无法互通。迁移策略见第 8 章 |
| `name` / `real_name` | `name` | |
| `role` | `role` | 平台注册接口只能建学生；教师/家长须走角色申请审批（4.11）或管理员设置（7.5） |
| `grade`（"初一"等字符串） | `grade`（枚举）+ `grade_level`（字符串） | 需拆分：`初一` → grade=`middle`，grade_level=`初一` |
| `class` / `class_name` | `class_id` | 需先拿到平台班级 ID（用 4.9 公开班级列表查询） |
| `email` / `phone` | `email` / `phone` | |

---

## 4. 认证与账号接口详解（/api/auth）

> 以下接口除标注 🔒 外均为公开接口（无需 token）。
> 路由前缀：`BASE_URL + /api/auth`

### 4.1 注册 🔒→🔑 `POST /register`

注册成功即返回 token（自动登录）。**一律创建学生账号**，请求体中的 `role` 会被服务端忽略。

**请求体：**

```json
{
  "username": "zhangsan",
  "password": "任意非空字符串",
  "name": "张三",
  "grade": "middle",
  "gradeLevel": "初一",
  "subjectId": 1,
  "classId": 101
}
```

- 学生必填：`grade`、`gradeLevel`、`subjectId`（`classId` 可选，提供则入班）
- 全部不传班级/学段信息时：自动落到平台当前激活班级及其年级、激活学科
- 密码注册时**无强度要求**（修改密码时才要求 ≥6 位）

**成功 201：**

```json
{
  "token": "...",
  "user": { "id": 123, "username": "zhangsan", "name": "张三", "role": "student",
            "grade": "middle", "gradeLevel": "初一", "subject": { "id": 1, "name": "数学" } }
}
```

**错误（按校验顺序）：**

| 状态码 | error.code | 条件 |
|--------|-----------|------|
| 400 | `MISSING_FIELDS` | 缺 username/password/name；学生缺 grade/gradeLevel/subjectId |
| 400 | `INVALID_USERNAME` | 用户名不合法（含符号/超长等，message 有具体原因） |
| 400 | `INVALID_SUBJECT` | subjectId 不存在 |
| 409 | `USERNAME_EXISTS` | 用户名已存在 |
| 409 | `DUPLICATE_NAME_IN_CLASS` | 目标班级开启禁止重名且已有同名学生 |
| 403 | `GRADE_REGISTRATION_CLOSED` | 年级注册闸门未开放（见 1.3 第 4 条） |

### 4.2 登录 🔒→🔑 `POST /login`

**请求体：** `{ "username": "...", "password": "..." }`

**成功 200：**

```json
{
  "token": "...",
  "user": { "id": 123, "username": "...", "name": "...", "role": "student",
            "class_id": 101, "grade": "middle", "grade_level": "初一", "current_subject_id": 1 },
  "nameConflict": { "...仅当该班禁止重名且存在同名同学时出现" }
}
```

**错误：** 400 `MISSING_FIELDS`；401 `INVALID_CREDENTIALS`（附 `hasSecurityQuestions` 布尔，提示能否走密保找回）；403 `APPLICATION_PENDING` / `APPLICATION_REJECTED`（该用户名存在待审/被拒的角色申请——**第三方应用自己的教师账号若用了和别人角色申请相同的用户名会遇到**）。

### 4.3 登录或注册（推荐用于迁移期）🔒→🔑 `POST /login-or-register`

用户名存在 → 行为等同登录（密码错返回 401 `INVALID_PASSWORD`）；不存在 → 自动注册为**学生**（同样受注册闸门与禁止重名限制）。

**请求体：** `{ username, password, name?, inviteCode?|classId?, subjectId?, grade?, gradeLevel? }`
（`inviteCode` 可以是班级 ID 数字字符串，也可以是班级邀请码）

**成功 200：** `{ "action": "login"|"register", "message": "...", "token": "...", "user": {...} }`

**迁移期用法：** 旧用户首次登录第三方应用时，用其原凭据调用本接口——老用户直接登录（但密码对不上会 401，见第 8 章迁移策略），新用户自动在平台建档。

### 4.4 获取当前用户 🔒 `GET /me`

**成功 200：** `{ "user": { "id", "username", "name", "role" } }`
用于校验 token 是否仍有效（单会话被顶下线时此处返回 401 `SESSION_REPLACED`）。

### 4.5 检查用户名 🔒 `GET /check-username/:username`

**成功 200：** `{ "exists": true|false, "message": "..." }`
**错误：** 400（缺参数）。迁移前批量为旧用户名调用此接口，可提前发现命名冲突。

### 4.6 验证班级邀请码 🔒 `GET /validate-invite/:code`

`code` 支持班级 ID 或邀请码。**成功：** `{ "valid": true, "classInfo": { id, className, grade, gradeLevel }, "subjectId": ..., ... }`；**无效时** `{ "valid": false, ... }`。

### 4.7 获取默认注册班级 🔒 `GET /active-class`

返回平台当前激活班级信息（注册页默认落点）。`GRADE_REGISTRATION_CLOSED` 时返回提示。

### 4.8 公开学科/班级列表 🔒

- `GET /public/subjects?grade=middle&gradeLevel=初一` → `{ "subjects": [{id, name, ...}] }`
- `GET /public/classes?grade=middle&gradeLevel=初一` → `{ "classes": [...] }`

迁移前用它把应用里的班级名映射成平台 `class_id`。

### 4.9 检查班级同名 🔒 `POST /check-duplicate-name`

**请求体：** `{ "name": "张三", "classId": 101 }` → `{ "exists": bool, "similarNames": [...] }`

### 4.10 密保找回密码 🔒 `POST /recover-password`

**请求体：** `{ username, answer1, answer2, newPassword }`（新密码 ≥6 位）
**错误：** 400 `WEAK_PASSWORD` / `NO_SECURITY_QUESTIONS` / `WRONG_ANSWERS`；404 `USER_NOT_FOUND`

### 4.11 角色申请（教师/家长账号的产生方式）🔒 `POST /apply-role`

**请求体（全部必填：** `username, password, name, phone, email, requestedRole`）：

```json
{
  "username": "teacher_wang", "password": "...", "name": "王老师",
  "phone": "138...", "email": "...", "requestedRole": "teacher",
  "grade": "middle", "gradeLevel": "初一", "classId": 101
}
```

- `requestedRole` 只能是 `teacher` / `subject_teacher` / `parent`
- 班主任申请必填 `grade+gradeLevel+classId`；学科教师申请必填 `grade+gradeLevel+subjectId+classIds`（数组）
- **错误：** 400 `MISSING_FIELDS` / `INVALID_ROLE`
- **成功 201：** `{ "message": "...", "application": { id, ... } }`
- 提交后：用该用户名登录会得到 403 `APPLICATION_PENDING`；管理员审批通过后账号才创建（见 7.6）。查询进度：`GET /application-status/:username`

### 4.12 修改密码 🔒 `PUT /profile/password`

需登录。**请求体：** `{ "oldPassword": "...", "newPassword": "..." }`（≥6 位）
**成功：** `{ "message": "密码修改成功，请重新登录" }`（旧 token 仍有效到过期，但建议改密后强制重新登录）
**错误：** 400 `WEAK_PASSWORD` / `INVALID_PASSWORD`（旧密码错误）

### 4.13 密保状态与设置 🔒

- `GET /profile/security-status` → 是否已设置密保
- `PUT /profile/security-answers` → 设置密保答案（供 4.10 找回用）

### 4.14 班级同名冲突处理 🔒（学生）

登录响应含 `nameConflict` 时：`POST /resolve-name-conflict`（确认删除本班其他同名账号）或 `POST /decline-name-conflict`（拒绝并通知教师）。第三方应用可在收到 `nameConflict` 字段时提示学生选择。

---

## 5. 教师端成员接口（/api/teacher）

> 认证：`teacher`（班主任）/ `subject_teacher`（学科教师）/ `admin` 均可通过 `requireTeacher`。
> 数据范围自动限定为教师自己管理的班级（`class_id` ∪ `teacher_class_ids`）。**服务账号推荐用班主任角色走这组接口。**

### 5.1 学生列表 `GET /students`

**查询参数：** `search?`（姓名/用户名模糊）、`page`、`limit`

**成功 200：**

```json
{
  "message": "获取学生列表成功",
  "data": {
    "students": [
      { "id": 10, "username": "...", "name": "...", "grade": "middle", "grade_level": "初一",
        "created_at": "...", "last_login_ip": "...", "last_ip_at": "...",
        "completedChapters": 5, "lastPracticeAt": "..." }
    ],
    "total": 45, "page": 1, "limit": 20, "totalPages": 3
  }
}
```

### 5.2 创建学生 `POST /students`

**请求体：** `{ "name": "必填", "username?": "不传自动生成 s_日期_随机串", "password?": "不传默认 111111", "remark?": "备注" }`

- **班级由服务端确定**（教师自己的 `class_id`，否则 `teacher_class_ids` 第一个），不能传 grade/classId
- 错误：400 `NO_CLASS`（教师未带班）/ `MISSING_NAME` / `CLASS_NOT_FOUND`；409 `USERNAME_EXISTS` / `DUPLICATE_NAME_IN_CLASS`

**成功 200：** `{ "message": "学生添加成功", "data": { "id": 10, "username": "...", "name": "...", "grade": "...", "grade_level": "...", "class_id": 101, "password": "最终生效的密码" } }`

### 5.3 批量创建学生 `POST /students/batch`

**请求体：** `{ "students": [ { "name": "...", "username?": "...", "password?": "..." }, ... ] }`（**单次 ≤50 人**，超出 400 `TOO_MANY`）

**成功 200：**

```json
{
  "message": "批量添加完成：成功 48 人，失败 2 人",
  "data": {
    "success": [ { "id": 11, "username": "...", "name": "...", "password": "..." } ],
    "failed": [ { "name": "某人", "reason": "用户名 xxx 已存在" } ]
  }
}
```

单个学生失败不影响其余——**迁移脚本应以此接口为主力，并检查 `failed` 数组做重试**。

### 5.4 学生详情 / 更新 / 删除

- `GET /students/:id` → 详情
- `PUT /students/:id`，请求体可含 `{ name, grade, grade_level, class_id, remark }`
- `DELETE /students/:id`
- 三个接口都经 `checkClassAccess` 校验目标学生是否属于该教师管理的班级，越权返回 403 `ACCESS_DENIED`

### 5.5 学习数据（教师视角）

- `GET /students/:id/progress` → 学习进度
- `GET /students/:id/practices` → 练习记录

---

## 6. 管理员成员接口（/api/admin 成员部分）

> 认证：`requireAdmin`（`admin` 或 `teacher` 角色可过）。服务账号为 admin 时可用。

### 6.1 全量用户列表 `GET /students`

**查询参数（下划线风格）：** `page`, `limit`（默认 50，上限 1000，`limit=0` 或 `all=true` 全量）, `search?`, `role?`, `grade?`, `grade_level?`, `class_id?`, `studentId?`, `startDate?`, `endDate?`, `sort_by?`(id/name/username/created_at), `sort_order?`(ASC/DESC)

**成功 200：** `{ "data": { "students": [ { ...用户字段, "class": {...}, "subjects": [...], "teacherClasses": [...] } ], "total": 120, "page": 1, "limit": 50 } }`

### 6.2 单个用户 `GET /users/:userId`

返回 `{ ... }` 含 id/username/name/role/grade/grade_level/remark/created_at。

### 6.3 更新用户 `PUT /users/:userId`

**请求体：** `{ "name?": "...", "remark?": "...", "class_id?": 101, "grade?": "middle", "grade_level?": "初一" }`
（grade 非法值 400 `INVALID_STAGE`；404 `USER_NOT_FOUND`）

### 6.4 删除用户 `DELETE /users/:userId`

### 6.5 批量删除 `DELETE /users/batch`

**请求体：** `{ "ids": [1,2,3] }`（空列表 400 `EMPTY_IDS`；不存在的 ID 与管理员自动跳过，返回成功/失败明细）

### 6.6 重置密码 `PUT /users/:userId/reset-password`

**不接受自定义密码**——一律重置为 `111111`。管理员账号不可被重置（403 `CANNOT_RESET_ADMIN_PASSWORD`）。
**成功 200：** `{ "message": "密码重置成功", "userId": 10 }`

### 6.7 学生-学科管理

- `GET /students/by-subject/:subjectId`、`GET /students/:userId/subjects`
- `POST /students/:userId/subjects`，请求体 `{ "subjectId": 2 }`
- `DELETE /students/:userId/subjects/:subjectId`
- `PUT /students/:userId/primary-subject`，请求体 `{ "subjectId": 1 }`

### 6.8 学科管理 `GET|POST /subjects`、`PUT|DELETE /subjects/:id`

创建/更新请求体：`{ "name": "物理", "sort_order": 3 }`

### 6.9 班主任 / 学科教师 / 家长 角色管理

| 操作 | 接口 | 请求体 |
|------|------|--------|
| 设班主任 | `POST /teachers/set-role` | `{ "userId": 5, "classId": 101, "grade": "middle", "grade_level": "初一" }` |
| 移除班主任 | `POST /teachers/remove-role` | `{ "userId": 5 }` |
| 班主任列表 | `GET /teachers` | —（返回 `{data:[{id, userId, user:{...}, class:{...}}]}`） |
| 设学科教师 | `POST /subject-teachers/set-role` | `{ "userId": 6, "subjectId": 1, "grade": "middle", "grade_level": "初一", "classIds": [101,102] }` |
| 移除学科教师 | `POST /subject-teachers/remove-role` | `{ "userId": 6 }` |
| 改所带班级 | `POST /subject-teachers/update-classes` | `{ "userId": 6, "classIds": [101,102,103] }` |
| 学科教师列表 | `GET /subject-teachers` | — |
| 设家长 | `POST /parents/set-role` / `POST /parents/remove-role` | `{ "userId": 7 }` |
| 设家长子女 | `PUT /parents/:parentId/children` | `{ "childIds": [10,11] }` |
| 家长列表/详情 | `GET /parents`、`GET /parents/:id` | — |

### 6.10 角色申请审批

- `GET /role-applications?status=pending&page=1&limit=20`、`GET /role-applications/stats`
- `GET /role-applications/:id`
- `POST /role-applications/:id/approve` → **审批通过即创建账号**，返回 `{ "message": "申请已批准，用户账号已创建", "application": {...}, "user": { id, username, name, role } }`
- `POST /role-applications/:id/reject`

---

## 7. Token 生命周期与单会话专题

### 7.1 服务账号的自动续期（第三方后端必做）

token 24 小时过期且无刷新接口。第三方应用后端应封装一个"自动重登"的请求函数：

```javascript
// Node.js 示例：服务账号 token 管理器
const BASE_URL = process.env.PLATFORM_BASE_URL; // 如 http://192.168.1.10:3000
const SERVICE_ACCOUNT = {
  username: process.env.PLATFORM_SERVICE_USER, // 平台管理员分配
  password: process.env.PLATFORM_SERVICE_PASS,
};

let cached = { token: null, expiresAt: 0 };

async function platformLogin() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SERVICE_ACCOUNT),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`平台登录失败: ${body.error?.code} ${body.error?.message}`);
  cached.token = body.token;
  // 保守起见提前 10 分钟视为过期（实际 24h）
  cached.expiresAt = Date.now() + 23.5 * 3600 * 1000;
  return cached.token;
}

async function platformFetch(path, options = {}) {
  if (!cached.token || Date.now() > cached.expiresAt) await platformLogin();
  const doFetch = () => fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cached.token}`,
      ...(options.headers || {}),
    },
  });
  let res = await doFetch();
  if (res.status === 401) {          // token 失效（过期/被顶）→ 重登一次再试
    await platformLogin();
    res = await doFetch();
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error?.message || `平台接口错误 ${res.status}`);
    err.code = body.error?.code;
    err.status = res.status;
    throw err;
  }
  return body;
}
```

要点：401 时只重登**一次**（防止密码错误时无限循环）；服务账号是教师/管理员角色，不存在单会话互踢问题。

### 7.2 学生单会话的影响与对策

场景：第三方应用的页面里嵌了"学生登录"。学生登录第三方应用 → 平台签发新 token 并作废旧 token：

- 如果学生**同时**开着平台网页端做练习 → 平台端被顶下线。反之亦然。**同一学生不能两边同时在线。**
- 第三方应用**不要长期缓存学生 token**：正确做法是每次会话开始时登录，收到 401 `SESSION_REPLACED` / `TOKEN_EXPIRED` 时重新登录或引导用户重新登录。

如果第三方应用只需要"验证身份"而不需要保持平台会话，建议每次都即时登录校验，不落地 token。

---

## 8. 从 SQLite 迁移成员数据

### 8.1 密码必须重建，不能迁移

平台用 bcrypt 存 `password_hash`，且你拿到的通常只是旧库的哈希——**无法把旧哈希导入平台**。三种可行策略：

| 策略 | 做法 | 适用 |
|------|------|------|
| A. 初始密码批量重建（推荐） | 用 5.3 批量接口建号，统一初始密码（如 `111111` 或按学号），通知学生首次登录后修改 | 学生规模迁移 |
| B. 首登透明迁移 | 不预建号；旧用户在第三方应用登录时，后端拿 `username+原密码` 调 `login-or-register`——新用户自动建号（密码就是原密码） | 用户量小、用户名合规、注册闸门已开 |
| C. 保持双系统 | 第三方应用仍校验旧密码，仅用 4.2 登录接口同步验证 | 不推荐：密码改不同步，且用户名体系割裂 |

策略 B 的隐患：注册受年级闸门（1.3-4）与用户名规则限制，且若用户名在平台已存在而密码不同，会 401。**生产迁移建议 A，辅以 B 兜底。**

### 8.2 迁移脚本骨架

```javascript
// 伪代码：从 SQLite 读出成员 → 批量重建到平台
const students = db.prepare('SELECT id, username, name FROM members WHERE role=?').all('student');

for (let i = 0; i < students.length; i += 50) {
  const chunk = students.slice(i, i + 50).map(s => ({
    name: s.name,
    username: toValidUsername(s.username),   // 按 3.1 规则映射，冲突时加前缀
    password: '111111',
    remark: `migrated_from:${s.id}`,         // 旧 ID 记入备注便于回溯
  }));
  const res = await platformFetch('/api/teacher/students/batch', {
    method: 'POST',
    body: JSON.stringify({ students: chunk }),
  });
  if (res.data.failed.length) console.warn('失败项:', res.data.failed); // 记录重试
}
```

迁移后对账：`GET /api/teacher/students?limit=1000` 分页拉全量，比对 `total` 与旧库人数；抽样用初始密码调 `POST /api/auth/login` 验证可登录。

### 8.3 用户名映射规则（迁移前必须处理）

- 只允许中文/英文字母/数字；空格、`_`、`-`、`@`、`.` 等**都不合法**
- 加权长度 2~20（中文=2，英文数字=1；如 `zhangsan`=8 合法，`a`=1 不合法）
- 全平台唯一（不只是你们应用内唯一）——先 `GET /api/auth/check-username/:name` 预检，冲突时统一加前缀（如 `myapp_`，注意前缀也计入长度）
- 中文用户名是允许的（如 `张三`），但注意 URL 传参时需 encode

---

## 9. 集成自检清单

改造完成后，逐项验证：

- [ ] 应用中已无任何对本地成员表的读写（登录、注册、改密、找密保全部改走平台接口）
- [ ] 响应解析基于 HTTP 状态码，而不是假设 `success` 字段
- [ ] 错误处理覆盖 `error.code` 分支：`INVALID_CREDENTIALS`、`USERNAME_EXISTS`、`DUPLICATE_NAME_IN_CLASS`、`GRADE_REGISTRATION_CLOSED`、`APPLICATION_PENDING`、`SESSION_REPLACED`
- [ ] 服务账号登录封装了 24h 过期自动重登（7.1）
- [ ] 学生 token 不落盘、不长期缓存；401 时有重登/重提示逻辑（7.2）
- [ ] 分页参数用 `page`+`limit`（不是 `pageSize`）；管理员学生列表参数是下划线风格 `class_id`/`grade_level`
- [ ] 目标年级注册闸门已由教师在平台端开放；服务账号已绑定正确班级
- [ ] 迁移对账完成：人数一致、抽样登录成功、旧 ID 已记录在 remark
- [ ] 确认应用前端没有直连平台（或已申请加入 CORS_WHITELIST）

---

## 附：成员模块完整错误码速查

| error.code | HTTP | 出现接口 | 含义 |
|-----------|------|---------|------|
| `MISSING_FIELDS` | 400 | 注册/登录/申请等 | 必填项缺失 |
| `INVALID_USERNAME` | 400 | 注册/login-or-register | 用户名格式不合法 |
| `INVALID_SUBJECT` | 400 | 注册 | 学科不存在 |
| `INVALID_STAGE` | 400 | 管理员更新用户 | 学段枚举值非法 |
| `INVALID_ROLE` | 400 | 角色申请 | requestedRole 非法 |
| `INVALID_INVITE_CODE` | 400 | login-or-register | 邀请码/班级 ID 无效 |
| `WEAK_PASSWORD` | 400 | 改密/找回 | 新密码 <6 位 |
| `INVALID_PASSWORD` | 400/401 | 改密/login-or-register | 旧密码/登录密码错误 |
| `INVALID_CREDENTIALS` | 401 | 登录 | 用户名或密码错误 |
| `NO_CLASS` | 400 | 教师建学生 | 教师未分配班级 |
| `MISSING_NAME` | 400 | 教师建学生 | 缺姓名 |
| `CLASS_NOT_FOUND` | 400 | 教师建学生 | 班级不存在 |
| `EMPTY_LIST` / `TOO_MANY` | 400 | 批量建学生 | 列表为空 / 超过 50 人 |
| `EMPTY_IDS` | 400 | 批量删除 | ids 为空 |
| `USERNAME_EXISTS` | 409 | 注册/建学生 | 用户名已存在 |
| `DUPLICATE_NAME_IN_CLASS` | 409 | 注册/建学生/批量 | 班级禁止重名且同名 |
| `GRADE_REGISTRATION_CLOSED` | 403 | 注册/login-or-register | 年级注册闸门未开放 |
| `APPLICATION_PENDING` | 403 | 登录 | 角色申请待审 |
| `APPLICATION_REJECTED` | 403 | 登录 | 角色申请被拒 |
| `CANNOT_RESET_ADMIN_PASSWORD` | 403 | 重置密码 | 不能重置管理员密码 |
| `ACCESS_DENIED` | 403 | 教师访问学生 | 学生不在该教师管理范围 |
| `FORBIDDEN` | 403 | 各受保护接口 | 角色权限不足 |
| `USER_NOT_FOUND` | 404 | 多处 | 用户不存在（401 时表示 token 对应账号已删除） |
| `CHILD_NOT_FOUND` | 404 | 家长相关 | 子女不存在 |
| `NO_TOKEN` / `INVALID_TOKEN` / `TOKEN_EXPIRED` / `SESSION_REPLACED` | 401 | 所有受保护接口 | 见 2.4 |
| `SERVER_ERROR` / `AUTH_ERROR` / `REGISTER_ERROR` / `LOGIN_ERROR` 等 | 500 | — | 服务器内部错误，看 `details` |


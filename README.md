# 高中信息技术会考·操作题练习系统

面向高中信息技术学业水平考试（会考）的操作题智能练习、模拟操作环境与确定性自动评分系统。

## 目录结构

- `server.ts`: 统一服务入口（挂载 Express RESTful API 与 Next.js 前端页面，监听 3000 端口）
- `backend/`: 服务端模块（与前端分离）
  - `backend/config.ts`: 环境变量与默认大模型配置
  - `backend/db.ts`: SQLite (`better-sqlite3`) 建表、WAL 持久化及首次启动初始化（含 8 道内置种子题）
  - `backend/middleware/auth.ts`: 学生与管理员完全隔离的 JWT 鉴权及登录限流保护
  - `backend/grader/index.ts`: Word / Excel / 网页(HTML+CSS) / 文件管理 确定性规则判分引擎
  - `backend/services/llm.ts`: OpenAI 兼容协议大模型接入（题目生成、JSON 校验重试、参考答案自检、图片生成落盘）
  - `backend/routes/`: `auth.ts`、`questions.ts`、`exams.ts`、`profile.ts`、`admin.ts`
- `app/` 与 `components/`: React + TypeScript + Tailwind CSS 前端页面与四大模拟操作环境组件

## 启动方式

```bash
npm install
npm run dev
```

生产构建与启动：

```bash
npm run build
npm start
```

## 环境变量说明

参考 `.env.example`：
- `PORT`: 服务监听端口（默认 `3000`）
- `STUDENT_JWT_SECRET` / `ADMIN_JWT_SECRET`: 学生端与后台管理端独立 JWT 密钥
- `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_TEXT_MODEL` / `LLM_IMAGE_MODEL`: 首次启动写入数据库的默认大模型配置，启动后可在管理后台动态修改与测试。

## Docker 部署

本项目提供生产级多阶段 `Dockerfile`（同步备份为 `Dockerbak.txt`）及 Windows 一键部署脚本：

- **构建方案**：采用多阶段构建，自动安装 `better-sqlite3` 编译依赖并基于 `package-lock.json` 通过 `npm ci --legacy-peer-deps` 精确安装依赖。
- **更新/重建锁文件**：若修改了 `package.json` 或删除过 `package-lock.json`，部署前必须先执行以下命令刷新锁文件（必须保留 `--legacy-peer-deps`）：

```bash
npm install --legacy-peer-deps --package-lock-only
```

- **本地一键部署 (`redeploy.bat`)**：构建镜像并启动容器 `personlearning_caozuoti`，映射宿主机端口 `7901 -> 3000`，持久化数据目录挂载至 `D:\docker\personlearning_caozuoti\data`，访问 `http://localhost:7901`。
- **平台对接（2026-11-27）**：`redeploy.bat` 默认以 `AUTH_MODE=platform` 运行，教师与学生使用个性化学习平台（personlearning）账号登录，容器加入平台的 `mynet` 网络；首次运行会在 `D:\docker\personlearning_caozuoti\.env` 自动生成随机 JWT 密钥。把脚本里的 `AUTH_MODE` 改回 `local` 重新运行即可回滚。入口、配置与存量账号迁移说明见 `成员验证对接平台-设计文档.md`。
- **切换前试运行 (`deploy\trial-7902.bat`)**：用数据目录的副本在 `7902` 端口起一个测试容器联调，不影响 `7901` 的正式容器。
- **远程一键部署 (`upload2remote.bat`)**：本地构建镜像导出 tar 包并上传至远程服务器加载运行，持久化目录为 `/bak/docker/personlearning_caozuoti/data`，映射外部端口 `7901`。

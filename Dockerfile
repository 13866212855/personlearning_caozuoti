############################################################
# 阶段 1：构建阶段 —— 安装依赖并编译 Next.js 生产版本
############################################################
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# npm 走国内镜像 + 大幅增强网络重试，应对下载中断
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    NPM_CONFIG_FETCH_RETRIES=8 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=15000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=180000 \
    NPM_CONFIG_FETCH_TIMEOUT=600000 \
    NPM_CONFIG_MAXSOCKETS=3 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NEXT_TELEMETRY_DISABLED=1

# better-sqlite3 原生模块需要编译工具链
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

# 只复制依赖清单，充分利用 Docker 层缓存
COPY package.json package-lock.json ./

# 按锁文件精确安装；若锁文件与 package.json 不同步（EUSAGE），自动回退为 npm install
# --legacy-peer-deps：跳过 peer 依赖校验
# cache mount 缓存已下载的包，即使失败重试也能续传
RUN --mount=type=cache,target=/root/.npm \
    ok=0; \
    for i in 1 2 3; do \
      echo "== npm ci attempt $i =="; \
      if npm ci --legacy-peer-deps --no-audit --no-fund --maxsockets=3 2>/tmp/npm.err; then \
        ok=1; break; \
      fi; \
      cat /tmp/npm.err; \
      if grep -q "EUSAGE" /tmp/npm.err; then \
        echo "== Lockfile out of sync (EUSAGE), falling back to npm install =="; \
        npm install --legacy-peer-deps --no-audit --no-fund --maxsockets=3 && ok=1 && break; \
      fi; \
      sleep 5; \
    done; \
    rm -f /tmp/npm.err; \
    [ "$ok" = "1" ] || (echo "npm dependency install failed after 3 attempts" && exit 1)

# 复制源码并构建 Next.js 生产产物
COPY . .
RUN npm run build

############################################################
# 阶段 2：运行阶段 —— 保留运行所需的最小文件集
############################################################
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# 安装 python3 用于 Python 程序设计题沙盒运行与判分
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*

# 以非 root 用户运行，更安全
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# 复制运行 Express + Next.js + SQLite 自定义服务所需产物
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/backend ./backend
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# 数据目录（宿主机挂载卷会覆盖此目录，用于持久化 SQLite 与上传图片）
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["./node_modules/.bin/tsx", "server.ts"]

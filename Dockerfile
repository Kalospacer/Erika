# syntax=docker/dockerfile:1

# ---- deps: install all workspace dependencies ----
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/playground/package.json apps/playground/
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/providers/package.json packages/providers/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# ---- build: compile all packages + playground ----
FROM deps AS build
COPY . .
RUN pnpm -r build \
    && pnpm --filter @erika/api deploy --prod /out/app

# ---- runtime: pruned API + assets + playground dist ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    ERIKA_TEMPLATES_DIR=/app/packages/templates \
    ERIKA_FONTS_DIR=/app/packages/templates/fonts \
    ERIKA_PRESETS_PATH=/app/apps/api/presets/presets.json \
    ERIKA_PLAYGROUND_DIST=/app/apps/playground/dist
WORKDIR /app

# pnpm deploy 产物：/out/app = apps/api + 生产依赖（含 @erika/core 等）。
# REPO_ROOT 由 @erika/core/dist/templates.js 的位置推导为 /app，
# 因此资源目录按仓库同构布局放置：
#   /app/packages/templates        模板 + 字体 + 图标资产
#   /app/apps/api/presets          项目预设
#   /app/apps/playground/dist      Playground 静态产物（同源托管）
COPY --from=build /out/app ./
COPY --from=build /build/packages/templates ./packages/templates
COPY --from=build /build/apps/api/presets ./apps/api/presets
COPY --from=build /build/apps/playground/dist ./apps/playground/dist

EXPOSE 8787
USER node
CMD ["node", "dist/index.js"]

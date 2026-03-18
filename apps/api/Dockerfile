# ==============================================================================
# Stage 1: base - pnpm をインストールしたベースイメージ
# ==============================================================================
FROM node:20-slim AS base

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ==============================================================================
# Stage 2: builder - 依存インストール & ビルド
# ==============================================================================
FROM base AS builder

WORKDIR /app

# モノレポ設定ファイルをコピー
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# 各パッケージの package.json をコピー
COPY apps/api/package.json ./apps/api/
COPY packages/schema/package.json ./packages/schema/

# 依存インストール
RUN pnpm install --frozen-lockfile

# ソースコードをコピー
COPY packages/schema/tsconfig.json ./packages/schema/
COPY packages/schema/src/ ./packages/schema/src/
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/src/ ./apps/api/src/

# 共有スキーマパッケージをビルド → API をビルド
RUN pnpm --filter @repo/api-schema build

# Prisma Client を生成
RUN cd apps/api && pnpm exec prisma generate --schema=src/prisma/schema.prisma

# API をビルド
RUN pnpm --filter api build

# 本番用依存のみを抽出
RUN pnpm deploy --filter api --prod /app/deploy

# ==============================================================================
# Stage 3: runner - 本番実行用の軽量イメージ
# ==============================================================================
FROM node:20-slim AS runner

WORKDIR /app

# non-root ユーザーを作成
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs appuser

# deploy ステージから本番依存をコピー
COPY --from=builder /app/deploy/node_modules ./node_modules
COPY --from=builder /app/deploy/package.json ./package.json

# ビルド済みコードをコピー
COPY --from=builder /app/apps/api/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

USER appuser

CMD ["node", "dist/index.js"]

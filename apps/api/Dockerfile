# ==============================================================================
# Stage 1: base - pnpm をインストールしたベースイメージ
# ==============================================================================
FROM node:20-slim AS base

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ==============================================================================
# Stage 2: pruner - turbo prune で api に必要な workspace だけを抽出
#
# turbo prune --docker は以下を生成する:
#   out/json/  package.json と pnpm-lock.yaml のみ (install caching 用)
#   out/full/  ソース全部 (build 用)
#   out/pnpm-lock.yaml
#
# これにより新規 package を追加しても Dockerfile を更新する必要が無い。
# turbo が依存グラフを解析して必要なものだけを抽出してくれる。
# ==============================================================================
FROM base AS pruner

WORKDIR /app

# 依存解析に必要な最小ファイルだけコピー
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

# turbo を実行するために devDependencies をインストール
RUN pnpm install --frozen-lockfile --ignore-scripts

# api が必要とする workspace だけを out/ に抽出
RUN pnpm turbo prune api --docker

# ==============================================================================
# Stage 3: installer - 抽出された workspace で依存インストール & ビルド
# ==============================================================================
FROM base AS installer

WORKDIR /app

# Step 1: package.json + lock だけ先にコピーして install (キャッシュ効率化)
COPY --from=pruner /app/out/json/ ./
RUN pnpm install --frozen-lockfile

# Step 2: ソース全部をコピー
COPY --from=pruner /app/out/full/ ./

# Step 3: Prisma Client を生成 (packages/db で実行)
RUN pnpm --filter @repo/db db:generate

# Step 4: API をビルド (turbo の dependsOn で packages/* も先にビルドされる)
RUN pnpm --filter api build

# Step 5: 本番用依存のみを抽出
RUN pnpm deploy --filter api --prod /app/deploy

# ==============================================================================
# Stage 4: runner - 本番実行用の軽量イメージ
# ==============================================================================
FROM node:20-slim AS runner

# tini: Node.js を PID 1 で直接実行すると SIGTERM 等のシグナルを正しく処理できず、
# SIGKILL による強制削除が起きてしまうため軽量 init プロセスとして tini を使用。
# ECS Fargate では docker --init が使えないため必須。
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# installer ステージから本番依存をコピー
COPY --chown=node:node --from=installer /app/deploy/node_modules ./node_modules
COPY --chown=node:node --from=installer /app/deploy/package.json ./package.json

# ビルド済みコードをコピー
COPY --chown=node:node --from=installer /app/apps/api/dist ./dist

EXPOSE 8080

# ENTRYPOINT: コンテナ起動時に必ず実行されるコマンド。CMD の内容が引数として渡される。
# 実行されるコマンド: /usr/bin/tini -- node dist/index.js
ENTRYPOINT ["/usr/bin/tini", "--"]

# root で実行すると脆弱性を突かれた際にホストへの影響が大きいため、非特権ユーザーで実行
USER node

CMD ["node", "dist/index.js"]

# @repo/db

DB のスキーマ / マイグレーション / client factory を一元管理する共有パッケージ。**全 server-side app (api / cron / worker...) は本パッケージ越しに DB へアクセスする**。

ORM / マイグレーションツールは Drizzle（`drizzle-orm` / `drizzle-kit`）を使う。Drizzle を選んだ理由（Prisma から移った理由）と、マイグレーション・接続・`CHECK` 制約・リードレプリカの挙動は [`docs/tech-stack/drizzle.md`](../../docs/tech-stack/drizzle.md) にまとめている。

## 目次

- [ディレクトリ構成](#ディレクトリ構成)
- [コマンド](#コマンド)
  - [ローカル DB の作り直し](#ローカル-db-の作り直し)
- [client の生成と DI](#client-の生成と-di)

## ディレクトリ構成

```
packages/db/
├── drizzle/
│   ├── drizzle.config.ts   # drizzle-kit の設定
│   ├── migrations/         # db:generate の出力。db:migrate で適用する
│   └── seed.ts             # 開発用ユーザーの投入
└── src/
    ├── connection-string.ts  # DATABASE_URL + DB_NAME から接続文字列を作る（client / drizzle-kit 共通）
    ├── drizzle/
    │   ├── client.ts         # createDrizzleClient
    │   └── schema/           # テーブル定義（1 テーブル 1 ファイル）
    └── index.ts
```

## コマンド

`packages/db` で実行する。`apps/api` からは `pnpm --filter api db:migrate` のように実行すると `.env.local` を読み込んでから委譲する。

| コマンド | 実体 | 用途 |
| --- | --- | --- |
| `db:generate` | `drizzle-kit generate` | スキーマの差分からマイグレーション SQL を作る（DB 接続は不要） |
| `db:migrate` | `drizzle-kit migrate` | 未適用のマイグレーションを適用する。ローカル / CI / 本番の migration イメージで共通 |
| `db:push` | `drizzle-kit push` | マイグレーションを作らずにスキーマを DB へ直接反映する（ローカルでの試行錯誤用） |
| `db:seed` | `tsx drizzle/seed.ts` | 開発用ユーザー（alice / bob）を投入する。何度流してもよい |
| `db:studio` | `drizzle-kit studio` | Drizzle Studio を起動する。画面は `https://local.drizzle.studio` から読み込まれるが、DB への接続はローカルのまま |

`DB_NAME=project-template_test` を付けると、接続先の DB 名だけをテスト用に差し替えられる（client / drizzle-kit とも同じ規則）。

テーブルを変えるときは `src/drizzle/schema/` を変えて `db:generate` し、生成された SQL を確認してから `db:migrate` する（[マイグレーションの挙動](../../docs/tech-stack/drizzle.md#マイグレーション)）。

### ローカル DB の作り直し

ローカルの dev / test DB を空から作り直す手順（中のデータは消える）。マイグレーションの適用履歴と DB の中身がずれて `db:migrate` が `relation "users" already exists` などで失敗するときに使う。

dev DB には ClickHouse の CDC（replication slot）が繋がっていて、そのままでは `DROP DATABASE` できないので、先に CDC を外して最後に張り直す。

```bash
# 1. ClickHouse の CDC を外す（Postgres 側の replication slot / publication も一緒に消える）
docker exec project-template-clickhouse clickhouse-client --query "DROP DATABASE IF EXISTS pg_cdc"

# 2. dev / test DB を作り直す（WITH (FORCE) は起動中の api などの接続を切ってから消す）
docker exec project-template-postgres psql -U postgres \
  -c 'DROP DATABASE IF EXISTS "project-template_dev" WITH (FORCE)' -c 'CREATE DATABASE "project-template_dev"' \
  -c 'DROP DATABASE IF EXISTS "project-template_test" WITH (FORCE)' -c 'CREATE DATABASE "project-template_test"'

# 3. マイグレーションと seed を流す
pnpm --filter api db:migrate
pnpm --filter api db:seed

# 4. CDC を張り直す（ClickHouse の migration は CDC を毎回作り直す）
pnpm --filter @repo/data-warehouse dwh:migrate
```

test DB は `pnpm --filter api test` が実行のたびにマイグレーションを流すので、作り直した後は空のままでよい。

## client の生成と DI

- **factory だけを export し、singleton は持たない。** 接続は各 app の `src/index.ts`（cron は `src/task/*.ts`）で 1 回だけ生成し、Repository に DI する。
- テーブル定義（`memos` / `users` …）とクエリ演算子（`eq` / `and` …）も `@repo/db` から import する。使ってよいのは各 app の `src/repository/**` だけ（`@repo/eslint-config/db-boundary` が lint で強制）。
- `onError` に各 app の logger を渡す。

```ts
/** 利用側 (apps/*/src/index.ts): factory で 1 回だけ生成し Repository に DI する */
import { createDrizzleClient } from "@repo/db"

const db = createDrizzleClient({
  onError: (error) => {
    logger.error("db idle client error", error)
  },
})
const memoRepository = new DrizzleMemoRepository(db)

process.on("SIGTERM", async () => {
  await db.$disconnect()
})
```

```ts
/** Repository 実装 (apps/*/src/repository/drizzle/): 行の型はテーブル定義から導出する */
import { DrizzleClient, eq, memos } from "@repo/db"

type MemoRow = typeof memos.$inferSelect

const [row] = await this._db.select().from(memos).where(eq(memos.id, id))
```

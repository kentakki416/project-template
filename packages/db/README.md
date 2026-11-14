# @repo/db

DB のスキーマ / マイグレーション / client factory を一元管理する共有パッケージ。**全 server-side app (api / cron / worker...) は本パッケージ越しに DB へアクセスする**。

ORM / マイグレーションツールは Drizzle（`drizzle-orm` / `drizzle-kit`）を使う。Drizzle を選んだ理由（Prisma から移った理由）と、マイグレーション・接続・`CHECK` 制約・リードレプリカの挙動は [`docs/tech-stack/drizzle.md`](../../docs/tech-stack/drizzle.md) にまとめている。

## 目次

- [ディレクトリ構成](#ディレクトリ構成)
- [コマンド](#コマンド)
- [client の生成と DI](#client-の生成と-di)

## ディレクトリ構成

```
packages/db/
├── drizzle/
│   ├── drizzle.config.ts   # drizzle-kit の設定
│   ├── migrations/         # db:generate の出力。db:migrate で適用する
│   │   └── {name}/
│   │       ├── migration.sql  # 1 トランザクションで流す文
│   │       └── online.sql     # トランザクションの外で流す文（CREATE INDEX CONCURRENTLY。ある場合だけ）
│   └── seed.ts             # 開発用ユーザーの投入
├── migrate/                # db:generate / db:migrate の実体（drizzle-kit の前後の処理）
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
| `db:generate` | `drizzle-kit generate` + 後処理 | スキーマの差分からマイグレーション SQL を作る（DB 接続は不要）。`CREATE INDEX CONCURRENTLY` は `online.sql` に移す |
| `db:migrate` | `drizzle-kit migrate` + `online.sql` の適用 | 未適用のマイグレーションを適用する。ローカル / CI / 本番の migration イメージで共通 |
| `db:push` | `drizzle-kit push` | マイグレーションを作らずにスキーマを DB へ直接反映する（ローカルでの試行錯誤用） |
| `db:seed` | `tsx drizzle/seed.ts` | 開発用ユーザー（alice / bob）を投入する。何度流してもよい |
| `db:studio` | `drizzle-kit studio` | Drizzle Studio を起動する。画面は `https://local.drizzle.studio` から読み込まれるが、DB への接続はローカルのまま |

`DB_NAME=project-template_test` を付けると、接続先の DB 名だけをテスト用に差し替えられる（client / drizzle-kit とも同じ規則）。

テーブルを変えるときは `src/drizzle/schema/` を変えて `db:generate` し、生成された SQL を確認してから `db:migrate` する（[マイグレーションの挙動](../../docs/tech-stack/drizzle.md#マイグレーション)）。行数の多いテーブルに index を足すときは、index に `.concurrently()` を付ける（[行数の多いテーブルの index は online.sql で作る](../../docs/tech-stack/drizzle.md#行数の多いテーブルの-index-は-onlinesql-で作る)）。

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

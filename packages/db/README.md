# @repo/db

DB のスキーマ / マイグレーション / client factory を一元管理する共有パッケージ。**全 server-side app (api / cron / worker...) は本パッケージ越しに DB へアクセスする**。

ORM / マイグレーションツールは Drizzle（`drizzle-orm` / `drizzle-kit`）を使う。Drizzle を選んだ理由（Prisma から移った理由）と、マイグレーション・接続・`CHECK` 制約・リードレプリカの挙動は [`docs/tech-stack/drizzle.md`](../../docs/tech-stack/drizzle.md) にまとめている。

## 目次

- [ディレクトリ構成](#ディレクトリ構成)
- [コマンド](#コマンド)
- [マイグレーション](#マイグレーション)
  - [`db:generate` が生成するファイル](#dbgenerate-が生成するファイル)
  - [`online.sql` の役割](#onlinesql-の役割)
- [コーディング規約](#コーディング規約)

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

## マイグレーション

テーブルを変えるときは、スキーマを変えてマイグレーションを作り、適用する。

1. `src/drizzle/schema/` のテーブル定義を変える
2. `pnpm --filter api db:generate --name=<変更の名前>` でマイグレーションを作る
3. `drizzle/migrations/<日時>_<名前>/`配下に以下のファイルが生成される
    - `migration.sql`
    - `online.sql` ※ .concurrently()をつけたindexの差分がある時だけ生成される
    - `snapshot.json`
4. `pnpm --filter api db:migrate` でローカルの DB に適用する
5. スキーマとマイグレーションのフォルダを一緒にコミットする（dev / prd には deploy の migrate ジョブが適用する）

### `db:generate` が生成するファイル

| ファイル | 流し方 | 中身 |
| --- | --- | --- |
| `migration.sql` | 未適用分をまとめて 1 トランザクション。途中で失敗すると全部ロールバックされる | テーブル・カラム・制約の変更 |
| `online.sql`（ある場合だけ） | `migration.sql` の適用後に、トランザクションの外で 1 文ずつ | `CREATE INDEX CONCURRENTLY`（書き込みを止めずに index を作る） |
| `snapshot.json` | 流さない | その時点のスキーマ。drizzle-kit が次の差分を出すのに使う |

`db:migrate` はこの順に両方を流す。ローカル・テスト・CI・本番で同じコマンドを使う。

### `online.sql` の役割

通常の `CREATE INDEX` は、作成が終わるまで対象テーブルへの書き込みを止める。行数の多いテーブルでは、スキーマの index に `.concurrently()` を付けて、書き込みを止めない `CREATE INDEX CONCURRENTLY` で作る。

ただし `CREATE INDEX CONCURRENTLY` は、Postgres の制約でトランザクションの中では実行できない。Drizzle は `migration.sql` を 1 つのトランザクションで流すので、この文だけを `online.sql` に分け、`migration.sql` の後にトランザクションの外で流す。

```ts
(table) => [index("auth_accounts_user_id_idx").on(table.userId).concurrently()]
```


## コーディング規約

- **factory だけを export し、singleton は持たない。** 
  - 接続は各 app の `src/index.ts`（cron は `src/task/*.ts`）で 1 回だけ生成し、Repository に DI する。
- テーブル定義（`memos` / `users` …）とクエリ演算子（`eq` / `and` …）も `@repo/db` から import する。
  - 使ってよいのは各 app の `src/repository/**` だけ（`@repo/eslint-config/db-boundary` が lint で強制）。
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

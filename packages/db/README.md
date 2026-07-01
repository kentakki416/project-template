# @repo/db

Prisma schema / migrations / generated client を一元管理する共有パッケージ。**全 server-side app (api / cron / worker...) は本パッケージ越しに DB へアクセスする**。

## 目次

- [設計の意図と役割](#設計の意図と役割)
- [公開 API](#公開-api)
- [リードレプリカの仕様](#リードレプリカの仕様)
- [コマンド](#コマンド)
## 設計の意図と役割

- `prisma/schema.prisma` を **唯一の正本** として保有し、migration / generate / seed コマンドを 1 箇所に集約
- **`createPrismaClient()` factory のみ export / singleton は持たない。** 接続は各 app の `src/index.ts` で 1 回だけ生成し、Repository に DI する
- ドメイン型（`User` / `Memo` 等）は **型としてのみ** re-export する

> 💡 **なぜ「型だけ」re-export しているか**
> `export *` にすると `PrismaClient` クラス本体（runtime の値）まで公開され、app 側で `new PrismaClient()` と書けて factory を迂回できてしまう。値は factory だけ出し、型は `export type` で出すことで、**そもそも `@repo/db` から `PrismaClient` を `new` できない**ようにしている。

```ts
/** src/index.ts ── 値は factory だけ export、ドメイン型は export type で出す */
export { createPrismaClient } from "./client"
export type { Memo, Prisma, PrismaClient, User } from "../generated/client"
```

```ts
/** 利用側 (apps/*/src/index.ts): factory で 1 回だけ生成し Repository に DI する */
import { createPrismaClient, type PrismaClient } from "@repo/db"

const prisma = createPrismaClient()                    // PrismaClient は型なので new 不可
const memoRepository = new PrismaMemoRepository(prisma)

process.on("SIGTERM", async () => {
  await prisma.$disconnect()
})
```

## 公開 API

```ts
import { createPrismaClient, type PrismaClient, type User, type Memo } from "@repo/db"
```

| Export | 用途 |
| --- | --- |
| `createPrismaClient(options?)` | PrismaClient を生成する factory。`url` と `replicaUrl` を任意指定可 |
| Prisma 生成型 (`User` / `Memo` ...) | re-export されたドメイン型 |

### `createPrismaClient` のオプション

| key | デフォルト | 説明 |
| --- | --- | --- |
| `url` | `process.env.DATABASE_URL` (+ `DB_NAME` 上書き) | 接続文字列 |
| `replicaUrl` | `process.env.DATABASE_REPLICA_URL` | read replica の接続文字列。指定時は `@prisma/extension-read-replicas` で read/write を自動振り分け |

## リードレプリカの仕様

`replicaUrl`（または `DATABASE_REPLICA_URL`）を指定すると、`@prisma/extension-read-replicas` が read / write を自動で振り分ける。**未指定なら replica は使わず、primary が read / write の両方を担う**。

### 自動振り分けルール

| 操作 | 振り分け先 |
| --- | --- |
| `findMany` / `findUnique` / `count` / `aggregate` などの read | replica |
| `create` / `update` / `delete` / `$transaction` / `$executeRaw` | primary |

### 強整合性が必要な read（read-after-write）

replica は primary からの **レプリケーション遅延** があるため、直前に primary へ書き込んだ内容が replica にまだ反映されていないことがある（＝書いた直後に read すると古い値が返りうる）。

「書き込み直後に必ず最新を読みたい」ケースでは、`$primary()` で primary からの read を明示的に強制する。

```ts
/** replica を経由せず primary から read（最新が保証される） */
const fresh = await prisma.$primary().user.findUnique({ where: { id } })
```

**Repository 規約**: 強整合が必須のメソッドは名前の末尾に `FromPrimary` を付け、`$primary()` 経由であることを呼び出し側に明示する（例: `findByIdFromPrimary`）。

## コマンド

すべて `pnpm --filter @repo/db <cmd>` で実行（各 app からは `dotenvx` ラッパー経由で叩く）。

```bash
pnpm --filter @repo/db db:generate         # Prisma Client を生成
pnpm --filter @repo/db db:migrate          # マイグレーション作成（開発）
pnpm --filter @repo/db db:migrate:deploy   # マイグレーション適用（本番）
pnpm --filter @repo/db db:seed             # シード投入
pnpm --filter @repo/db db:studio           # Prisma Studio 起動
```

`postinstall` で `prisma generate` が自動実行されるため、新規 clone / CI install 時に generated client が必ず揃う。
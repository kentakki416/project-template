# @repo/domain

api / cron / worker が共有する **ドメイン型** を置くパッケージ。

## 目次

- [なぜ共有するのか](#なぜ共有するのか)
- [3 つの表現の使い分け](#3-つの表現の使い分け)
- [置くもの / 置かないもの](#置くもの--置かないもの)
- [app 固有の絞り込み](#app-固有の絞り込み)
- [使い方](#使い方)

## なぜ共有するのか

`apps/api` / `apps/cron` / `apps/worker` は独立したサービスではなく、**1 つの DB と 1 つの Prisma schema を共有する単一アプリの 3 つの実行形態**（HTTP / 定期実行 / Queue 消費）。DB schema が既に 3 app を結合しているため、domain 型を app ごとに複製しても独立性は得られず、片方だけ更新される drift のリスクだけが増える。

## 3 つの表現の使い分け

同じ概念が境界ごとに異なる形を持つのは意図的な設計であり、統合してはいけない。

| 層 | 定義場所 | 例（`Memo.createdAt`） |
| --- | --- | --- |
| DB row | `packages/db/generated/`（Prisma が生成） | `createdAt: Date`（列は `created_at`） |
| **domain** | **`packages/domain`（このパッケージ）** | `createdAt: Date` |
| API 契約 | `packages/schema/src/api-schema/` | `created_at: string`（JSON 直列化 + snake_case） |

Repository 実装が「DB row → domain」を変換し、Controller が「domain → API 契約」を変換する。

## 置くもの / 置かないもの

| 置く | 置かない |
| --- | --- |
| ドメイン型（`Memo` / `User` / `AuthAccount`） | ❌ Repository interface |
| ドメインの不変条件を表す純粋関数（例: `isMemoExpired(memo, now)`） | ❌ Prisma の型 / `PrismaClient` |
| ドメインエラー | ❌ logger / env / I/O / 外部通信 |

**Repository interface を置いてはいけない。** 必要な操作は app ごとに異なる（api は CRUD 5 メソッド / cron は `deleteOlderThan` のみ / worker は `findById` のみ）ため、共有 interface を作ると不要なメソッドが各 app に漏れ出す。interface は各 app の `src/repository/` に残す。

**依存ゼロを保つ。** `dependencies` は空のまま維持する。型と純粋関数だけなので runtime 依存は不要で、これが「どの app からでも安全に import できる」根拠になる。

## app 固有の絞り込み

app が一部のフィールドしか使わない場合は、共有型から派生させる。

```typescript
import type { Memo } from "@repo/domain"

/** 一覧表示では id と title しか使わない */
export type MemoSummary = Pick<Memo, "id" | "title">
```

## 使い方

```typescript
import type { Memo, User } from "@repo/domain"
```

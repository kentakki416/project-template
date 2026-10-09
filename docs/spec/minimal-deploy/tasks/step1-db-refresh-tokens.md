# step1-db-refresh-tokens

`REFRESH_TOKEN_STORE=database` のときに refresh token を保存する `refresh_tokens` テーブルを追加する。この step ではテーブルを作るだけで、アプリからはまだ使わない（prd / dev の挙動は変わらない）。

設計: [`../README.md`](../README.md#refresh-token-の保存先) / [必要な DB 設計](../README.md#必要な-db-設計)

## 対応内容

### Drizzle スキーマ（正本）

`packages/db/src/drizzle/schema/refresh-token.ts` を新規作成する。FK と index の書き方は `auth-account.ts` に合わせる。

```typescript
/** packages/db/src/drizzle/schema/refresh-token.ts */
import { foreignKey, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { timestamps } from "./columns"
import { users } from "./user"

/**
 * Refresh Token（REFRESH_TOKEN_STORE=database のときだけ使う）
 *
 * Redis 実装の `refresh_token:{jti}` キーと同じ役割で、jti から userId を引く。
 * Redis の TTL は expires_at で表し、期限切れの行は読み取りで無視する。
 * 期限切れの行の掃除は repository の save が行う（掃除用の cron を増やさないため）。
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    expiresAt: timestamp("expires_at", { mode: "date", precision: 3 }).notNull(),
    /**
     * JWT ID
     */
    jti: text("jti").primaryKey(),
    userId: integer("user_id").notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "refresh_tokens_user_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("refresh_tokens_expires_at_idx").on(table.expiresAt),
    index("refresh_tokens_user_id_idx").on(table.userId),
  ],
)
```

`packages/db/src/drizzle/schema/index.ts` にファイル名順で追加する。

```typescript
export * from "./auth-account"
export * from "./memo"
export * from "./refresh-token"
export * from "./user"
```

期限切れ判定で `gt` を使うため、`packages/db/src/index.ts` の演算子の re-export に足す。

```typescript
export { and, desc, eq, gt, lt, sql } from "drizzle-orm"
```

### マイグレーション

```bash
cd packages/db
pnpm db:generate
```

`drizzle/migrations/<timestamp>_<name>/migration.sql` が生成される。次の 3 点を目で確認してからコミットする。

- `CREATE TABLE "refresh_tokens"` に `jti text PRIMARY KEY` / `expires_at timestamp(3) NOT NULL` / `user_id integer NOT NULL` / `created_at` / `updated_at` がある
- `refresh_tokens_user_id_fkey` が `ON DELETE cascade ON UPDATE cascade` になっている
- `refresh_tokens_expires_at_idx` / `refresh_tokens_user_id_idx` が作られる

### Prisma モデル（切り替え先の実装用）

`packages/db/README.md`「併存の方針」に従い、`prisma/schema.prisma` を Drizzle と同じ形に合わせる。`prisma/migrations/` には追加しない（適用するのは Drizzle のマイグレーションだけ）。

```prisma
model RefreshToken {
    /// JWT ID
    jti       String   @id
    userId    Int      @map("user_id")
    expiresAt DateTime @map("expires_at")
    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([expiresAt])
    @@index([userId])
    @@map("refresh_tokens")
}
```

`model User` にリレーションを足す。

```prisma
    accounts      AuthAccount[]
    refreshTokens RefreshToken[]
```

```bash
cd packages/db
pnpm prisma:generate
```

## 動作確認

```bash
pnpm --filter api db:migrate
docker exec project-template-postgres psql -U postgres -d project-template_dev -c '\d refresh_tokens'
pnpm --filter api test
```

- [ ] `\d refresh_tokens` で列・PK・FK・index 2 つが設計どおりに出る
- [ ] 既存のテスト（`pnpm --filter api test`）がすべて通る（テスト DB にも新しいマイグレーションが流れる）
- [ ] `pnpm build` が通る（Prisma Client の再生成を含む）
- [ ] `pnpm lint:fix` 後に lint エラーが無い

# step2-api-refresh-token-store

refresh token を Postgres に保存する repository 実装を追加し、`REFRESH_TOKEN_STORE` で Redis 実装と切り替えられるようにする。既定値は `redis` なので、prd / dev の挙動は変わらない。

設計: [`../README.md`](../README.md#refresh-token-の保存先)

前提: [step1-db-refresh-tokens](./step1-db-refresh-tokens.md)（`refresh_tokens` テーブルと `gt` の re-export）

## 対応内容

### Repository 実装（Drizzle）

interface（`src/repository/refresh-token-repository.ts`）は変えない。Redis 実装（`IoRedisRefreshTokenRepository`）と同じ振る舞いになるよう、次の 3 点を守る。

- **同じ jti の `save` は上書きする**（Redis の `SET` と同じ）。`onConflictDoUpdate` を使う
- **期限切れの行は `findUserId` で返さない**（Redis の TTL 切れと同じ）
- **`findUserId` は primary から読む。** ログアウト（`delete`）直後に replica から古い行を読むと、失効させたトークンが使えてしまうため。interface は保存先を問わない契約で、Redis は常に強整合なので、メソッド名に `FromPrimary` は付けずに実装の内側で primary を強制する（`packages/db/README.md`「強整合性が必要な read」の例外として、理由をコメントに残す）

```typescript
/** apps/api/src/repository/drizzle/refresh-token-repository.ts */
import { and, DrizzleClient, eq, gt, lt, refreshTokens } from "@repo/db"

import type { RefreshTokenRepository } from "../refresh-token-repository"

/**
 * Drizzle 実装の Refresh Token リポジトリ（REFRESH_TOKEN_STORE=database のときに使う）
 *
 * Redis 実装の TTL を expires_at で表す。期限切れの行は findUserId で返さず、
 * save のたびにまとめて消す（掃除用の cron とスケジュールを増やさないため）。
 */
export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  private _db: DrizzleClient

  constructor(db: DrizzleClient) {
    this._db = db
  }

  public async save(jti: string, userId: number, ttlSeconds: number): Promise<void> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)

    await this._db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, now))
    await this._db
      .insert(refreshTokens)
      .values({ expiresAt, jti, userId })
      .onConflictDoUpdate({
        set: { expiresAt, userId },
        target: refreshTokens.jti,
      })
  }

  /**
   * ログアウト直後に replica の古い行を読むと失効済みのトークンが通ってしまうため、
   * primary から読む。Redis 実装は常に強整合なので、interface の契約もそれに合わせる。
   */
  public async findUserId(jti: string): Promise<number | null> {
    const [row] = await this._db.$primary
      .select({ userId: refreshTokens.userId })
      .from(refreshTokens)
      .where(and(eq(refreshTokens.jti, jti), gt(refreshTokens.expiresAt, new Date())))
    return row?.userId ?? null
  }

  public async delete(jti: string): Promise<void> {
    await this._db.delete(refreshTokens).where(eq(refreshTokens.jti, jti))
  }
}
```

### Repository 実装（Prisma、切り替え先）

`apps/api/CLAUDE.md` の規約どおり Prisma にも実装する。Prisma の read replica 拡張は batch transaction を primary で実行するので、`findUserId` は `$transaction([...])` で包んで primary に寄せる（`$primary()` は型が付かず `any` キャストが要るため使わない）。

```typescript
/** apps/api/src/repository/prisma/refresh-token-repository.ts */
import { PrismaClient } from "@repo/db"

import type { RefreshTokenRepository } from "../refresh-token-repository"

/**
 * Prisma 実装の Refresh Token リポジトリ（Drizzle 実装と同じ振る舞い）
 */
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  public async save(jti: string, userId: number, ttlSeconds: number): Promise<void> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)

    await this._prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } })
    await this._prisma.refreshToken.upsert({
      create: { expiresAt, jti, userId },
      update: { expiresAt, userId },
      where: { jti },
    })
  }

  /**
   * batch transaction は primary で実行されるため、replica の遅延の影響を受けない
   */
  public async findUserId(jti: string): Promise<number | null> {
    const [row] = await this._prisma.$transaction([
      this._prisma.refreshToken.findFirst({
        select: { userId: true },
        where: { expiresAt: { gt: new Date() }, jti },
      }),
    ])
    return row?.userId ?? null
  }

  public async delete(jti: string): Promise<void> {
    await this._prisma.refreshToken.deleteMany({ where: { jti } })
  }
}
```

`delete` は存在しない jti でも throw しないよう `deleteMany` にする（Redis の `DEL` と同じ）。

両ディレクトリのバレル（`drizzle/index.ts` / `prisma/index.ts`）にファイル名順で `export * from "./refresh-token-repository"` を追加する。

### env

`apps/api/src/env.ts` に追加する（キーはアルファベット順の位置に置く）。

```typescript
  /**
   * refresh token の保存先。
   * minimal 構成は Redis を持たないため database（Postgres の refresh_tokens テーブル）を使う。
   * 既定値の redis は prd / dev の現在の挙動。
   */
  REFRESH_TOKEN_STORE: z.enum(["database", "redis"]).default("redis"),
```

### DI（`src/index.ts`）

refresh token repository の生成だけを env で分岐する。この step では Redis の接続は従来どおり常に作る（BullMQ がまだ Redis を使うため。Redis を条件付きにするのは step4）。

```typescript
import {
  DrizzleAuthAccountRepository,
  DrizzleDatabaseHealthRepository,
  DrizzleMemoRepository,
  DrizzleRefreshTokenRepository,
  DrizzleTransactionRunner,
  DrizzleUserRepository,
} from "./repository/drizzle"

/**
 * refresh token の保存先は REFRESH_TOKEN_STORE で選ぶ。
 * service は RefreshTokenRepository の interface しか知らないので、ここ以外は変わらない。
 */
const refreshTokenRepository = env.REFRESH_TOKEN_STORE === "database"
  ? new DrizzleRefreshTokenRepository(db)
  : new IoRedisRefreshTokenRepository(redis)
```

## 動作確認

```bash
pnpm --filter api test
```

### 契約テスト

`test/repository/refresh-token-repository.test.ts` を新規作成し、**Drizzle / Prisma / Redis の 3 実装**を `describe.each` で同じテストにかける（既存の `user-repository.test.ts` の形に合わせる）。`beforeEach` で `cleanupTestData()` と `cleanupTestRedis()` を呼ぶ。`users` への FK があるので、各テストの前にユーザーを 1 件作る。

```typescript
const implementations: [string, RefreshTokenRepository][] = [
  ["Drizzle", new DrizzleRefreshTokenRepository(testDb)],
  ["Prisma", new PrismaRefreshTokenRepository(testPrisma)],
  ["Redis", new IoRedisRefreshTokenRepository(testRedis)],
]
```

- [ ] 正常系: `save` した jti を `findUserId` で取得できる
- [ ] 正常系: 同じ jti を別の userId で `save` し直すと、後の userId が返る（上書き）
- [ ] 正常系: `delete` した jti は `findUserId` で `null` になる
- [ ] 異常系: 存在しない jti の `findUserId` は `null`、`delete` は throw しない
- [ ] 異常系（境界値）: `ttlSeconds = 1` で `save` し、1.1 秒待つと `findUserId` が `null` になる（3 実装とも）

DB 実装だけの振る舞いは、Drizzle / Prisma の 2 実装で別の `describe.each` にする。

- [ ] 期限切れの行を `testDb` で直接 insert しておき、別の jti を `save` すると期限切れの行が消えている（`testDb` で `refresh_tokens` を select して最終状態まで確認する）
- [ ] 期限内の他の行は `save` で消えない

### 既存テスト

- [ ] `test/controller/auth/*.test.ts`（Redis 実装を DI している）がそのまま通る
- [ ] ローカルで `REFRESH_TOKEN_STORE=database pnpm --filter api dev` として起動し、dev-login → `POST /api/auth/refresh` → `POST /api/auth/logout` が成功し、`refresh_tokens` の行が増減することを確認する（`.env.local` は書き換えない）

# @repo/redis

ioredis の接続クライアントを生成する **factory + 型 re-export** を提供する共有パッケージ。**全 server-side app (api / cron / worker) で利用する**。

## 目次

- [設計の意図](#設計の意図)
- [役割](#役割)
- [公開 API](#公開-api)
- [使い方](#使い方)
- [環境変数](#環境変数)

## 設計の意図

**factory のみ export / パッケージ側で singleton は持たない。** 用途ごと（cache / BullMQ / Pub-Sub）に接続を分けたいので、各 app で `createRedisClient()` を必要な回数だけ呼ぶ。

> 💡 **値のスキーマ（型）は持たない**
> 提供するのは接続（factory）と ioredis 由来の型（`Redis` / `RedisOptions`）だけ。Redis の戻り値は string blob で、保存する値の形は app 固有（キー設計 / TTL / シリアライズ）。値の `JSON.parse` + 型付けは各 app の Repository が担い、共有層に値スキーマを漏らさない。

> 💡 **用途ごとに接続インスタンスを分ける**
> 1 つの接続を使い回さず、用途別に `createRedisClient()` を複数回呼ぶ。理由は 2 つ:
> - **接続オプションが用途で異なる**（例: BullMQ の Queue / Worker は `maxRetriesPerRequest: null` が必須）
> - **subscribe するとその接続は通常コマンド（GET / SET 等）が使えなくなる**ため、Pub/Sub の subscriber は cache 用とは別接続にする

> 💡 **なぜ factory が必ず `error` リスナを張るか（ioredis 固有の事情）**
> ioredis は常駐接続を保ち、瞬断・再接続失敗時に `error` イベントを emit する。Node の EventEmitter 規約で `error` にリスナが 1 つも無いと throw され、常駐プロセスが落ちる。そのため factory 内で必ず `error` リスナを登録する（`onError` 省略時も `console.error` でフォールバック）。
> Prisma はエラーをクエリの Promise reject で返すのでこの対策は不要。**Redis（ioredis）固有の事情**。

```ts
/** factory 内部（抜粋）: onError 省略時も必ず error リスナを張る */
client.on("error", params.onError ?? ((e) => console.error("[redis]", e.message)))

/** 利用側: app の logger を注入してログに残す */
const redis = createRedisClient({
  onError: (e) => logger.error("redis connection error", e),
})
```

## 役割

- `createRedisClient()` factory のみ export（パッケージ側では singleton を持たない）
- ioredis の型 (`Redis` / `RedisOptions`) を re-export し、利用側は本パッケージ経由で参照
- 1 app で複数 Redis 接続が必要なケース（BullMQ / Pub/Sub）にも factory を複数回呼ぶだけで対応

## 公開 API

```ts
import { createRedisClient, type Redis, type RedisOptions } from "@repo/redis"
```

| Export | 用途 |
| --- | --- |
| `createRedisClient(options?)` | ioredis client を生成 |
| `Redis` / `RedisOptions` | ioredis の型 re-export |

### `createRedisClient` のオプション

| key | デフォルト | 説明 |
| --- | --- | --- |
| `url` | `process.env.REDIS_URL`、無ければ `REDIS_HOST` 等から組み立て | 接続文字列 |
| `options` | `{}` | `ioredis` の `RedisOptions` をそのまま渡す |

## 使い方

### 通常用途（cache / session）

```ts
// apps/api/src/index.ts
import { createRedisClient } from "@repo/redis"

const redis = createRedisClient()
const refreshTokenRepository = new IoRedisRefreshTokenRepository(redis)

process.on("SIGTERM", async () => {
  await redis.quit()
})
```

### BullMQ Queue / Worker 用（別接続必須）

```ts
import { createRedisClient } from "@repo/redis"

/** BullMQ の要件で maxRetriesPerRequest: null が必須 */
const bullConnection = createRedisClient({
  options: { maxRetriesPerRequest: null },
})
```

### Pub/Sub subscriber 用（別接続必須）

```ts
const subscriber = createRedisClient()
await subscriber.subscribe("user-events")
subscriber.on("message", (channel, message) => { /* ... */ })
```

> subscribe するとその接続は通常コマンド不可になるため、cache 用とは **必ず別接続** にする。

## 環境変数

各 app の `src/env.ts` で宣言・検証する（本パッケージは `process.env` を直接読む）。

| 変数 | 説明 |
| --- | --- |
| `REDIS_URL` | `redis://[:password@]host:port[/db]`。未設定時は `redis://localhost:6379`（local 開発用デフォルト） |

接続は **`REDIS_URL` 一本**（DB 番号は URL 末尾の `/1` 等で指定する）。

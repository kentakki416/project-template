# step4-api-queue-type-and-readiness

api の Queue 実装を `QUEUE_TYPE` で選べるようにし、Redis を使わない設定（`QUEUE_TYPE=sqs` かつ `REFRESH_TOKEN_STORE=database`）では Redis に接続せずに起動できるようにする。あわせて readiness の `services.redis` を optional にする。既定値は現在の挙動なので、prd / dev の挙動は変わらない。

設計: [`../README.md`](../README.md#環境変数による実装の切り替え) / [readiness チェック](../README.md#readiness-チェック)

前提: [step2-api-refresh-token-store](./step2-api-refresh-token-store.md) / [step3-queue-sqs](./step3-queue-sqs.md)

## 対応内容

### env

`apps/api/src/env.ts` に追加する（キーはアルファベット順の位置に置く）。組み合わせの検証のため、スキーマ全体に `superRefine` を足す。

```typescript
  /**
   * Queue の実装。minimal 構成は Redis を持たないため sqs を使う。
   * 既定値の bullmq は prd / dev の現在の挙動。
   */
  QUEUE_TYPE: z.enum(["bullmq", "sqs"]).default("bullmq"),

  /**
   * SQS の queue URL から queue 名を除いた部分（末尾は "-" まで）。
   * queue 名（TRACK_EVENT_QUEUE_NAME 等）を後ろに付けると queue の URL になる。
   * queue ごとに env を増やさないため、prefix だけを渡す。QUEUE_TYPE=sqs のとき必須。
   */
  SQS_QUEUE_URL_PREFIX: z.string().url().optional(),
```

```typescript
const apiEnvSchema = z
  .object({
    /** ...既存のキー... */
  })
  .superRefine((env, ctx) => {
    if (env.QUEUE_TYPE === "sqs" && !env.SQS_QUEUE_URL_PREFIX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SQS_QUEUE_URL_PREFIX is required when QUEUE_TYPE is 'sqs'",
        path: ["SQS_QUEUE_URL_PREFIX"],
      })
    }
  })
```

### DI（`src/index.ts`）

Redis の接続は、使う実装があるときだけ作る。`redis` が `undefined` になりうるので、実装の選択は「`redis` がある **かつ** Redis 実装が選ばれている」で書き、型を絞り込む。

```typescript
import { BullMQJobQueue, TRACK_EVENT_QUEUE_NAME } from "@repo/queue"
/** ↓ */
import { createJobQueue, type JobQueueConfig, TRACK_EVENT_QUEUE_NAME, type TrackEventJobData } from "@repo/queue"

/**
 * Redis は BullMQ（QUEUE_TYPE=bullmq）か refresh token（REFRESH_TOKEN_STORE=redis）が
 * 使うときだけ接続する。minimal 構成はどちらも使わないので、接続自体を作らない。
 */
const shouldUseRedis = env.QUEUE_TYPE === "bullmq" || env.REFRESH_TOKEN_STORE === "redis"
const redis = shouldUseRedis
  ? createRedisClient({
    onError: (error) => {
      logger.error("redis connection error", error)
    },
  })
  : undefined

const redisHealthRepository = redis ? new IoRedisHealthRepository(redis) : undefined
const refreshTokenRepository = redis && env.REFRESH_TOKEN_STORE === "redis"
  ? new IoRedisRefreshTokenRepository(redis)
  : new DrizzleRefreshTokenRepository(db)

/**
 * Queue の実装は QUEUE_TYPE で選ぶ。SQS_QUEUE_URL_PREFIX の有無は env.ts が検証済み。
 */
const jobQueueConfig: JobQueueConfig = redis && env.QUEUE_TYPE === "bullmq"
  ? { redis, type: "bullmq" }
  : { queueUrlPrefix: env.SQS_QUEUE_URL_PREFIX ?? "", type: "sqs" }

/** enqueue するだけ。ClickHouse への書き込みは apps/worker が行う */
const eventTracker = new QueueEventTracker(
  createJobQueue<TrackEventJobData>(jobQueueConfig, TRACK_EVENT_QUEUE_NAME),
)
```

graceful shutdown の切断も optional にする。

```typescript
    await Promise.all([
      db.$disconnect(),
      redis?.quit(),
    ])
```

### readiness

**スキーマ**（`packages/schema/src/api-schema/health.ts`）: `services.redis` を optional にする。prd のレスポンスは従来どおり `redis` を含む。

```typescript
/**
 * Readiness チェックのレスポンススキーマ
 * 外部サービス（DB等）への接続状態を確認する。
 * Redis を使わない構成（minimal）では services.redis を省略する。
 */
export const healthReadinessResponseSchema = z.object({
  services: z.object({
    database: serviceStatusSchema,
    redis: serviceStatusSchema.optional(),
  }),
  status: z.enum(["ok", "degraded"]),
})
```

スキーマを変えたら `cd packages/schema && pnpm build` する。

**Service**（`src/service/health-service.ts`）: `redisHealthRepository` を optional にし、無ければ確認しない。

```typescript
export type ReadinessResult = {
  database: ServiceStatus
  redis?: ServiceStatus
}

/**
 * Readiness チェック
 * 外部サービス（DB, Redis）への接続状態を並列で確認する。
 * Redis を使わない構成では redisHealthRepository が渡されず、結果からも redis を省く。
 * 個別サービスの失敗は "error" ステータスとして結果に含め、業務エラーにはしない
 */
export const checkReadiness = async (
  repo: {
    databaseHealthRepository: DatabaseHealthRepository
    redisHealthRepository?: RedisHealthRepository
  },
): Promise<Result<ReadinessResult>> => {
  const [database, redis] = await Promise.all([
    checkService("Database", repo.databaseHealthRepository),
    repo.redisHealthRepository ? checkService("Redis", repo.redisHealthRepository) : undefined,
  ])

  return ok(redis ? { database, redis } : { database })
}
```

**Controller**（`src/controller/health/readiness.ts`）: コンストラクタの `_redisHealthRepository` を optional にし、全体の `status` は「存在するサービスがすべて ok なら ok」で判定する。

```typescript
    const { database, redis } = result.value
    const statuses = redis ? [database.status, redis.status] : [database.status]
    const overallStatus = statuses.every((status) => status === "ok") ? "ok" : "degraded"
```

`logger.warn("Readiness degraded", ...)` のメタデータも `redis: redis?.status` にする。

## 動作確認

```bash
cd packages/schema && pnpm build
pnpm --filter api test
```

### テスト

- [ ] `test/service/health-service`（ユニット）: `redisHealthRepository` を渡さないと、結果が `{ database }` だけになり Redis の ping が呼ばれない
- [ ] 同上: 渡した場合は従来どおり `{ database, redis }` が返る（既存テストがそのまま通る）
- [ ] `test/controller/health`（インテグレーション）: Redis 無しで組み立てた readiness が `200` と `{ services: { database: { latency_ms: expect.any(Number), status: "ok" } }, status: "ok" }` を返す（`toEqual` で `redis` キーが無いことまで確認する）
- [ ] 同上: Redis ありの既存テストのレスポンスが変わらない

### Redis 無しでの起動

ローカルの Redis を止めた状態で、minimal と同じ組み合わせで起動する。SQS の URL はダミーでよい（AWS の認証情報が無いので enqueue は失敗する）。

```bash
docker compose stop redis
QUEUE_TYPE=sqs \
REFRESH_TOKEN_STORE=database \
SQS_QUEUE_URL_PREFIX=https://sqs.ap-northeast-1.amazonaws.com/000000000000/project-template-local- \
  pnpm --filter api dev
```

- [ ] 起動ログに Redis の接続エラーが出ない
- [ ] `GET /api/health/ready` が `200` で、`services` に `redis` が無い
- [ ] dev-login → メモ作成が成功する。イベントの enqueue 失敗は `failed to enqueue events` の error ログになるだけで、リクエストは成功する（送出の失敗をユーザーのリクエストに伝播させない、が守られている）
- [ ] `QUEUE_TYPE=sqs` だけを付けて `SQS_QUEUE_URL_PREFIX` を付けないと、起動時に env エラーで exit 1 する
- [ ] 確認後に `docker compose start redis` で戻し、env を付けずに起動すると従来どおり BullMQ + Redis で動く

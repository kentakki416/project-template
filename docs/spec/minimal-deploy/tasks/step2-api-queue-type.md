# step2-api-queue-type

api の Queue 実装を `QUEUE_TYPE` で選べるようにする。既定値は現在の挙動（BullMQ）なので、prd / dev の挙動は変わらない。Redis の接続は refresh token が使うため、`QUEUE_TYPE` に関係なく今までどおり作る。

設計: [`../README.md`](../README.md#環境変数による実装の切り替え)

前提: [step1-queue-sqs](./step1-queue-sqs.md)

## 対応内容

### env

`apps/api/src/env.ts` に追加する（キーはアルファベット順の位置に置く）。組み合わせの検証のため、スキーマ全体に `superRefine` を足す。

```typescript
  /**
   * Queue の実装。minimal 構成は worker を Lambda で動かすため sqs を使う
   * （BullMQ は常駐 worker が Redis を待ち受ける前提で、Lambda では動かない）。
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

Queue の実装だけを `QUEUE_TYPE` で選ぶ。Redis の接続（`redis`）、refresh token、readiness の組み立ては変えない。

```typescript
import { BullMQJobQueue, TRACK_EVENT_QUEUE_NAME } from "@repo/queue"
/** ↓ */
import { createJobQueue, type JobQueueConfig, TRACK_EVENT_QUEUE_NAME, type TrackEventJobData } from "@repo/queue"

/**
 * Queue の実装は QUEUE_TYPE で選ぶ。SQS_QUEUE_URL_PREFIX の有無は env.ts が検証済み。
 */
const jobQueueConfig: JobQueueConfig = env.QUEUE_TYPE === "bullmq"
  ? { redis, type: "bullmq" }
  : { queueUrlPrefix: env.SQS_QUEUE_URL_PREFIX ?? "", type: "sqs" }

/** enqueue するだけ。ClickHouse への書き込みは apps/worker が行う */
const eventTracker = new QueueEventTracker(
  createJobQueue<TrackEventJobData>(jobQueueConfig, TRACK_EVENT_QUEUE_NAME),
)
```

`createRedisClient` の上のコメントは、Queue が Redis を使わない構成があることに合わせて直す。

```typescript
/**
 * onError を渡さないと factory 既定の console.error に落ち、構造化ログに乗らない。
 * Redis は refresh token と queue（QUEUE_TYPE=bullmq のとき）を載せているため、障害は error として残す。
 */
```

## 動作確認

```bash
pnpm --filter api test
```

### テスト

- [ ] 既存のテストがそのまま通る（DI の既定値は BullMQ のまま。`createJobQueue` の選択は step1 のユニットテストで確認済み）

### SQS 設定での起動

ローカルで minimal と同じ Queue 設定にして起動する。SQS の URL はダミーでよい（AWS の認証情報が無いので enqueue は失敗する）。Redis は refresh token が使うので止めない。

```bash
QUEUE_TYPE=sqs \
SQS_QUEUE_URL_PREFIX=https://sqs.ap-northeast-1.amazonaws.com/000000000000/project-template-local- \
  pnpm --filter api dev
```

- [ ] `GET /api/health/ready` が `200` で、`services` に `database` と `redis` の両方がある（レスポンスは今と同じ）
- [ ] dev-login → メモ作成が成功する。イベントの enqueue 失敗は `failed to enqueue events` の error ログになるだけで、リクエストは成功する（送出の失敗をユーザーのリクエストに伝播させない、が守られている）
- [ ] dev-login → `POST /api/auth/refresh` が成功する（refresh token は Redis のまま）
- [ ] `QUEUE_TYPE=sqs` だけを付けて `SQS_QUEUE_URL_PREFIX` を付けないと、起動時に env エラーで exit 1 する
- [ ] env を付けずに起動すると、従来どおり BullMQ で動く（worker が `track-event` を処理する）

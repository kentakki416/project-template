# step1-queue-sqs

`packages/queue` に SQS 実装を追加する。producer 用の `SqsJobQueue<T>` と `QUEUE_TYPE` で実装を選ぶ `createJobQueue()`、consumer（Lambda）用に SQS のバッチを `JobProcessor` へ渡す `handleSqsEvent()` を作る。この step ではどの app からも使わない（prd / dev の挙動は変わらない）。

設計: [`../README.md`](../README.md#worker-を-sqs-と-lambda-で動かす)

## 対応内容

### 依存

```bash
pnpm --filter @repo/queue add @aws-sdk/client-sqs
pnpm --filter @repo/queue add -D aws-sdk-client-mock
```

### producer: `SqsJobQueue<T>`

```typescript
/** packages/queue/src/sqs-queue.ts */
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs"

import type { EnqueueOptions, JobQueue } from "./types"

/** SQS の DelaySeconds の上限（15 分） */
const MAX_DELAY_SECONDS = 900

/**
 * delayMs を SQS の DelaySeconds に変換する。
 * 上限を超える指定は黙って短くせず throw する（意図しない時刻に実行されるのを防ぐため）。
 */
export const convertDelayMsToSeconds = (delayMs: number | undefined): number | undefined => {
  if (delayMs === undefined) return undefined
  const seconds = Math.ceil(delayMs / 1000)
  if (seconds > MAX_DELAY_SECONDS) {
    throw new Error(`SQS cannot delay a message longer than ${MAX_DELAY_SECONDS} seconds (got ${seconds})`)
  }
  return seconds
}

/**
 * SQS 実装の JobQueue
 *
 * `jobId` は SQS 標準キューに重複排除の仕組みが無いので使わない
 * （EnqueueOptions の「実装によっては一部が無視される」の範囲内。ハンドラは冪等である前提）。
 * client は queue ごとに持ち、close() で破棄する。
 */
export class SqsJobQueue<T> implements JobQueue<T> {
  private _client: SQSClient
  private _queueUrl: string

  constructor(queueUrl: string, client: SQSClient = new SQSClient({})) {
    this._client = client
    this._queueUrl = queueUrl
  }

  public async enqueue(data: T, options?: EnqueueOptions): Promise<void> {
    await this._client.send(new SendMessageCommand({
      DelaySeconds: convertDelayMsToSeconds(options?.delayMs),
      MessageBody: JSON.stringify(data),
      QueueUrl: this._queueUrl,
    }))
  }

  public async close(): Promise<void> {
    this._client.destroy()
  }
}
```

`SQSClient({})` のリージョンと認証情報は実行環境から取る（Lambda は `AWS_REGION` と実行ロールを自動で渡す）。

### consumer: `handleSqsEvent()`

LWA が `POST /events` で渡す SQS イベントを処理し、失敗したメッセージだけを `batchItemFailures` で返す。`@types/aws-lambda` には依存せず、使う項目だけを型にする。

```typescript
/** packages/queue/src/sqs-queue.ts（続き） */
import { logger } from "@repo/logger"

import type { JobMessage, JobProcessor } from "./types"

/**
 * 1 メッセージを何回まで受信させるか。Terraform の redrive policy（maxReceiveCount）と揃える。
 * BullMQ 実装の `attempts: 3` と同じ回数にしている。
 */
export const SQS_MAX_RECEIVE_COUNT = 3

/** Lambda に渡される SQS イベントのうち、使う項目だけを型にしたもの */
export type SqsEvent = {
  Records: SqsRecord[]
}

export type SqsRecord = {
  attributes: { ApproximateReceiveCount: string }
  body: string
  eventSourceARN: string
  messageId: string
}

/** ReportBatchItemFailures 形式のレスポンス。ここに載せたメッセージだけが再試行される */
export type SqsBatchResponse = {
  batchItemFailures: { itemIdentifier: string }[]
}

/** queue 名と、その queue のメッセージを処理する JobProcessor の組 */
export type SqsConsumer = {
  processor: JobProcessor<unknown>
  queueName: string
}

/**
 * queue 名と JobProcessor<T> を組にする。
 * 型の異なる processor を 1 つの配列に入れるため、T をここで消す。
 * body は enqueue 側が JSON.stringify した T なので、BullMQ 実装と同じく検証はしない。
 */
export const createSqsConsumer = <T>(queueName: string, processor: JobProcessor<T>): SqsConsumer => ({
  processor: (message) => processor(message as JobMessage<T>),
  queueName,
})

/**
 * `https://sqs.<region>.amazonaws.com/<account>/project-template-min-` から
 * queue 名の接頭辞（`project-template-min-`）を取り出す
 */
export const extractQueueNamePrefix = (queueUrlPrefix: string): string =>
  new URL(queueUrlPrefix).pathname.split("/").at(-1) ?? ""

/** `arn:aws:sqs:<region>:<account>:project-template-min-track-event` → `track-event` */
const resolveQueueName = (eventSourceArn: string, queueNamePrefix: string): string =>
  (eventSourceArn.split(":").at(-1) ?? "").slice(queueNamePrefix.length)

const processSqsRecord = async (
  record: SqsRecord,
  options: { consumers: SqsConsumer[]; queueNamePrefix: string },
): Promise<void> => {
  const queueName = resolveQueueName(record.eventSourceARN, options.queueNamePrefix)
  const consumer = options.consumers.find((c) => c.queueName === queueName)
  if (!consumer) {
    throw new Error(`no consumer is registered for queue "${queueName}"`)
  }

  await consumer.processor({
    attemptsMade: Number(record.attributes.ApproximateReceiveCount) - 1,
    data: JSON.parse(record.body),
    id: record.messageId,
  })
}

/**
 * SQS のバッチを並列に処理し、失敗したメッセージだけを batchItemFailures で返す。
 *
 * 失敗のログは BullMQ 実装と同じく 2 段階に分ける。まだ再試行されるものは warn、
 * 受信回数が上限に達して DLQ に移るものだけを error にしてアラートの対象を絞る。
 */
export const handleSqsEvent = async (
  event: SqsEvent,
  options: { consumers: SqsConsumer[]; queueNamePrefix: string },
): Promise<SqsBatchResponse> => {
  const results = await Promise.allSettled(
    event.Records.map((record) => processSqsRecord(record, options)),
  )

  const batchItemFailures = results.flatMap((result, i) => {
    if (result.status === "fulfilled") return []

    const record = event.Records[i]
    const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason))
    const receiveCount = Number(record.attributes.ApproximateReceiveCount)
    const metadata = {
      eventSourceArn: record.eventSourceARN,
      maxReceiveCount: SQS_MAX_RECEIVE_COUNT,
      messageId: record.messageId,
      receiveCount,
    }
    if (receiveCount >= SQS_MAX_RECEIVE_COUNT) {
      logger.error("[queue] job failed permanently", error, metadata)
    } else {
      logger.warn("[queue] job failed, will retry", { ...metadata, reason: error.message })
    }
    return [{ itemIdentifier: record.messageId }]
  })

  return { batchItemFailures }
}
```

### 実装を選ぶ factory: `createJobQueue()`

producer（api）が `QUEUE_TYPE` に応じて実装を選ぶための factory。queue の URL は `queueUrlPrefix + queueName` で組み立てる。

```typescript
/** packages/queue/src/create-job-queue.ts */
import type { Redis } from "@repo/redis"

import { BullMQJobQueue } from "./bullmq-queue"
import { SqsJobQueue } from "./sqs-queue"
import type { JobQueue } from "./types"

export type JobQueueConfig =
  | { redis: Redis; type: "bullmq" }
  | { queueUrlPrefix: string; type: "sqs" }

/**
 * Queue の実装を選ぶのはここだけ。呼び出し側は JobQueue<T> の interface しか受け取らない。
 */
export const createJobQueue = <T>(config: JobQueueConfig, queueName: string): JobQueue<T> =>
  config.type === "sqs"
    ? new SqsJobQueue<T>(`${config.queueUrlPrefix}${queueName}`)
    : new BullMQJobQueue<T>(config.redis, queueName)
```

`src/index.ts` のバレルにファイル名順で追加する。

```typescript
export * from "./bullmq-queue"
export * from "./create-job-queue"
export * from "./jobs"
export * from "./sqs-queue"
export * from "./types"
```

### ドキュメント

- `bullmq-queue.ts` 冒頭の「別実装に切り替えるときは…」のコメントを、`createJobQueue()` で選ぶ形に合わせて更新する
- `packages/queue/README.md` に SQS 実装と、BullMQ との振る舞いの違い（[README の表](../README.md#worker-を-sqs-と-lambda-で動かす)へのリンク）を追記する

## 動作確認

```bash
pnpm --filter @repo/queue test
```

SQS は AWS のマネージドサービスでローカルに実体を持たないため、`aws-sdk-client-mock` で `SQSClient` をモックする（S3 と同じ扱い）。テストは `test/sqs-queue.test.ts` に置き、`describe` を「正常系」「異常系」で分ける。

### `SqsJobQueue`

- [ ] 正常系: `enqueue` で `SendMessageCommand` が 1 回送られ、`QueueUrl` が渡した URL、`MessageBody` が `JSON.stringify(data)` になる
- [ ] 正常系: `delayMs: 1500` で `DelaySeconds: 2`（切り上げ）、`delayMs` 省略で `DelaySeconds` が `undefined`
- [ ] 正常系: `jobId` を渡しても送信内容に含まれない
- [ ] 異常系（境界値）: `delayMs: 900_000` は送信でき、`delayMs: 900_001` は throw して送信されない
- [ ] 異常系: `SendMessageCommand` が reject すると `enqueue` も reject する（`QueueEventTracker` が catch する前提）

### `createJobQueue`

- [ ] `type: "sqs"` で `SqsJobQueue` が、`type: "bullmq"` で `BullMQJobQueue` が返る
- [ ] `type: "sqs"` の queue URL が `queueUrlPrefix + queueName` になる（`enqueue` した `QueueUrl` で確認）

### `handleSqsEvent`

fake の `JobProcessor`（`vi.fn()`）を `createSqsConsumer` で登録して検証する。

- [ ] 正常系: 2 つの queue のレコードが、`eventSourceARN` に対応する processor に振り分けられる
- [ ] 正常系: processor に渡る `JobMessage` が `{ attemptsMade: ApproximateReceiveCount - 1, data: JSON.parse(body), id: messageId }` になる
- [ ] 正常系: 全件成功なら `batchItemFailures` が空配列
- [ ] 異常系: 3 件中 1 件が throw すると、その `messageId` だけが `batchItemFailures` に入る
- [ ] 異常系: 登録されていない queue のレコードは失敗扱いになる
- [ ] 異常系: `body` が JSON として壊れているレコードは失敗扱いになり、他のレコードは処理される
- [ ] 異常系（境界値）: `ApproximateReceiveCount` が 2 なら warn、3 なら error が出る（`logger` をスパイして呼ばれたメソッドだけを確認し、文言は assertion しない）

### `extractQueueNamePrefix`

- [ ] `https://sqs.ap-northeast-1.amazonaws.com/123456789012/project-template-min-` → `project-template-min-`

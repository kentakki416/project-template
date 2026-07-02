# @repo/queue

ジョブキューの **型定義・キューへの追加（enqueue）・pickup（取り出し → ハンドラ起動）を抽象化** した共通パッケージ。キューに積むのは「何をするか」のデータ（ペイロード）だけで、実処理（`JobProcessor` の中身）はパッケージに持たず worker 側が実装・注入する。

## 目次

- [設計の意図](#設計の意図)
- [役割](#役割)
- [設計の核](#設計の核)
- [公開 API](#公開-api)
- [使い方](#使い方)
- [関連](#関連)

## 設計の意図

**`JobQueue<T>` / `JobProcessor<T>` を interface で抽象化し、実装を差し替え可能にする。** デフォルトは BullMQ だが、producer もジョブハンドラも interface しか knows しないため、SQS / Cloud Tasks 等へ乗り換えても **ハンドラ無変更** で実装だけ入れ替えられる（Strategy / 依存性逆転）。

> 💡 **なぜ Factory ではなく Strategy か**
> producer（enqueue）と consumer（dequeue）で生成の仕方が異なり、必要なクライアントも実装ごとに redis / SQS / Cloud Tasks とバラバラ。これらを 1 つの生成関数にまとめる Factory は無理があるため、生成は各 app の composition root に任せ、利用側を interface に依存させる Strategy にしている。

> 💡 **BullMQ 実装では `error` リスナが必須**
> BullMQ の `Queue` / `Worker` は EventEmitter で、Redis 障害時に `error` を emit する。リスナが無いと Node 規約で throw → プロセスが落ちるため、本パッケージ内で必ず登録している（[@repo/redis](../redis/README.md) の `error` 対策と同根）。

```ts
/** bullmq-queue.ts ── Queue / Worker いずれにも error リスナを必ず登録する */
this._queue.on("error", (err) => logger.error("[queue] producer error", err, { queueName }))
worker.on("error", (err) => logger.error("[queue] worker error", err, { queueName }))
```

## 役割

- Producer (api / cron 等) と Worker (apps/worker) が **同じ Job 型・同じ Queue 名** を共有
- BullMQ への依存を本パッケージに閉じ込め、**ジョブハンドラ側は実装を knows しない**
- 将来 SQS / Cloud Tasks / pg-boss / Inngest 等に乗り換える際、**ハンドラ無変更** で実装だけ差し替え可能

## 設計の核
### コンポーネント間の関係性

```
┌────────────────────┐        ┌──────────────────┐
│  apps/api (producer) │ ──▶ │ JobQueue<T>      │ ◀── 実装は BullMQ / SQS / ...
└────────────────────┘        │  .enqueue(...)   │
                              └──────────────────┘
                                       │
                                       ▼
┌────────────────────┐        ┌──────────────────┐
│ apps/worker (jobs/) │ ◀──── │ JobProcessor<T>  │ ◀── 実装に依存しない純粋関数
└────────────────────┘        │  (msg) => Promise │
                              └──────────────────┘
```

### 全体の流れ
```
[api / cron]                    [Redis]                 [worker プロセス]
queue.enqueue({memoId:42}) ──▶  process-memo  ──pull──▶  new Worker のループ
                                  キューに積む            │ job 受信
                                                         ▼
                                                  processor({ data:{memoId:42} })
                                                         ▼
                                                  processMemo ハンドラ
                                                  = memoRepository.findById + ログ
```

## 公開 API

```ts
import {
  // ===== Queue 抽象 =====
  type JobQueue,
  type JobProcessor,
  type JobConsumer,
  type JobMessage,
  type EnqueueOptions,
  type StartWorkerOptions,

  // ===== BullMQ 実装 =====
  BullMQJobQueue,        // class, Producer 用
  startBullMQWorker,     // function, Consumer 用

  // ===== Job 型 + Queue 名 =====
  PROCESS_MEMO_QUEUE_NAME,
  type ProcessMemoJobData,
  buildProcessMemoJobId,
} from "@repo/queue"
```

### 抽象型

| 型 | 役割 |
| --- | --- |
| `JobQueue<T>` | Producer 側の interface。`enqueue(data, opts?)` / `close()` |
| `JobProcessor<T>` | `(msg: JobMessage<T>) => Promise<void>` の純粋関数 |
| `JobConsumer` | Worker のハンドル。`close()` で graceful shutdown |
| `JobMessage<T>` | Worker が受け取る最小情報（`id` / `data` / `attemptsMade`） |

### 含まれる Job

| Queue 名 | ペイロード | 用途 |
| --- | --- | --- |
| `process-memo` | `{ memoId: number }` | memo を id で fetch してログ出力（メール送信 / 通知への差し替えの起点） |

## 使い方

### Producer 側（api / cron から enqueue）

```ts
import {
  BullMQJobQueue,
  PROCESS_MEMO_QUEUE_NAME,
  buildProcessMemoJobId,
  type ProcessMemoJobData,
} from "@repo/queue"
import { createRedisClient } from "@repo/redis"

const redis = createRedisClient({ options: { maxRetriesPerRequest: null } })
const queue: JobQueue<ProcessMemoJobData> = new BullMQJobQueue(
  redis,
  PROCESS_MEMO_QUEUE_NAME,
)

await queue.enqueue(
  { memoId: 42 },
  { jobId: buildProcessMemoJobId(42) },  // 決定的 ID で重複 enqueue を防ぐ
)
```

### Consumer 側（apps/worker）

```ts
// apps/worker/src/jobs/process-memo.ts ─ 実装に依存しない純粋関数
import type { JobProcessor, ProcessMemoJobData } from "@repo/queue"

export const processMemo = (deps: Deps): JobProcessor<ProcessMemoJobData> =>
  async (msg) => {
    const memo = await deps.memoRepository.findById(msg.data.memoId)
    deps.logger.info("memo processed", { memoId: msg.data.memoId })
  }

// apps/worker/src/workers/process-memo-worker.ts ─ 結線
import { startBullMQWorker, PROCESS_MEMO_QUEUE_NAME } from "@repo/queue"

/** 常駐リスナーを起動。index.ts で起動時に 1 回だけ呼ぶ（以降 enqueue ごとにハンドラが自動実行される） */
export const startProcessMemoWorker = (args) =>
  startBullMQWorker(args.redis, {
    concurrency: args.concurrency,
    processor: processMemo({ ... }),
    queueName: PROCESS_MEMO_QUEUE_NAME,
  })
```

## 関連

- [apps/worker/README.md](../../apps/worker/README.md) / [apps/worker/CLAUDE.md](../../apps/worker/CLAUDE.md)
- [docs/tool/bullMQ.md](../../docs/tool/bullMQ.md) — デフォルト Queue 実装 BullMQ の概要・特徴

# @repo/queue

ジョブキューの interface（`JobQueue<T>` / `JobProcessor<T>` / `JobConsumer`）と、その BullMQ 実装。
producer（api / cron）と worker が同じ Queue 名・同じジョブの型を共有し、どちらも BullMQ を直接触らない。

BullMQ の採用理由と挙動（at-least-once・`jobId` による重複の防止・失敗とリトライ・差し替えの方針）は [`docs/tech-stack/bullmq.md`](../../docs/tech-stack/bullmq.md) にまとめている。

## 構成

```
packages/queue/src/
├── types.ts          実装に依存しない interface と型。ジョブハンドラはこれだけを import する
├── bullmq-queue.ts   BullMQ の実装（BullMQJobQueue / startBullMQWorker）
└── jobs/             ジョブごとの Queue 名・ペイロードの型・jobId の作り方
```

## 使い方

producer（api / cron）は `BullMQJobQueue` を作って enqueue する。

```ts
import {
  BullMQJobQueue,
  PROCESS_MEMO_QUEUE_NAME,
  buildProcessMemoJobId,
  type JobQueue,
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

worker 側でジョブを処理する手順（新しい Queue の追加）は [`apps/worker/CLAUDE.md`](../../apps/worker/CLAUDE.md)。

## 関連

- [`docs/tech-stack/bullmq.md`](../../docs/tech-stack/bullmq.md) — BullMQ の採用理由と挙動
- [`apps/worker/CLAUDE.md`](../../apps/worker/CLAUDE.md) — ジョブハンドラの書き方・冪等性・graceful shutdown
- [`packages/redis/README.md`](../redis/README.md) — Redis の接続

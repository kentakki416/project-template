# step6-worker-lambda-entry

worker に Lambda 用の入口（`src/lambda-server.ts`）を追加する。Lambda Web Adapter（LWA）が SQS のイベントを `POST /events` として渡すので、`handleSqsEvent()` に流して `batchItemFailures` を返す。ジョブハンドラ（`src/jobs/*.ts`）は変更しない。常駐用の入口（`src/index.ts`）は既定値のまま BullMQ で動くので、prd / dev の挙動は変わらない。

設計: [`../README.md`](../README.md#worker-を-sqs-と-lambda-で動かす)

前提: [step3-queue-sqs](./step3-queue-sqs.md)

## 対応内容

### env（`apps/worker/src/env.ts`）

`QUEUE_TYPE` / `SQS_QUEUE_URL_PREFIX` / `PORT` を足し、`REDIS_URL` の必須条件を「BullMQ を使うとき」に絞る。

```typescript
    /** Lambda 用の入口（lambda-server.ts）が待ち受けるポート。常駐の入口は使わない */
    PORT: z.coerce.number().int().positive().default(8080),
    /**
     * Queue の実装。常駐の入口（index.ts）は bullmq、Lambda の入口（lambda-server.ts）は sqs で動かす。
     * 既定値の bullmq は prd / dev の現在の挙動。
     */
    QUEUE_TYPE: z.enum(["bullmq", "sqs"]).default("bullmq"),
    /** Redis 接続 URL (BullMQ 用)。QUEUE_TYPE=bullmq かつ NODE_ENV !== "test" のときは必須 */
    REDIS_URL: z.string().optional(),
    /**
     * SQS の queue URL から queue 名を除いた部分。QUEUE_TYPE=sqs のとき必須。
     * Lambda の入口はここから queue 名の接頭辞を取り出し、イベントの送信元 ARN と突き合わせる
     */
    SQS_QUEUE_URL_PREFIX: z.string().url().optional(),
```

```typescript
    if (env.NODE_ENV !== "test" && env.QUEUE_TYPE === "bullmq" && !env.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "REDIS_URL is required when QUEUE_TYPE is 'bullmq'",
        path: ["REDIS_URL"],
      })
    }
    if (env.QUEUE_TYPE === "sqs" && !env.SQS_QUEUE_URL_PREFIX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SQS_QUEUE_URL_PREFIX is required when QUEUE_TYPE is 'sqs'",
        path: ["SQS_QUEUE_URL_PREFIX"],
      })
    }
```

### 依存の組み立てを 2 つの入口で共有する

DB / データウェアハウス / Repository の生成は常駐・Lambda の両方で同じなので、`src/dependencies.ts` に切り出す。**どのデータウェアハウスを使うかを決めるのは引き続きこの 1 か所だけ**になる（`apps/worker/CLAUDE.md` の記述を `src/index.ts` から `src/dependencies.ts` に更新する）。

```typescript
/** apps/worker/src/dependencies.ts */
import { createDataWarehouse, type DataWarehouse } from "@repo/data-warehouse"
import { createDrizzleClient, type DrizzleClient } from "@repo/db"
import { logger } from "@repo/logger"

import { env } from "./env"
import type { EventRepository, MemoRepository } from "./repository"
import { DataWarehouseEventRepository } from "./repository/data-warehouse"
import { DrizzleMemoRepository } from "./repository/drizzle"

export type WorkerDependencies = {
  dataWarehouse: DataWarehouse
  db: DrizzleClient
  eventRepository: EventRepository
  memoRepository: MemoRepository
}

/**
 * 常駐（index.ts）と Lambda（lambda-server.ts）の両方の入口が使う依存を組み立てる。
 * Queue の実装には依存しない（Queue との結線は各入口と workers/ が持つ）。
 */
export const createDependencies = (): WorkerDependencies => {
  /** ...src/index.ts から db / dataWarehouse / Repository の生成をそのまま移す... */
}
```

`src/index.ts` は `createDependencies()` を呼び、Redis と BullMQ の Worker を起動する部分だけを残す。

### workers/ に SQS 用の結線を足す

`apps/worker/CLAUDE.md` のとおり、Queue 実装とジョブハンドラの結線は `workers/<name>-worker.ts` に置く。既存の `startXxxWorker`（BullMQ）の隣に、SQS 用の `createXxxSqsConsumer` を足す。

```typescript
/** apps/worker/src/workers/process-memo-worker.ts（追加分） */
import { createSqsConsumer, PROCESS_MEMO_QUEUE_NAME, type SqsConsumer } from "@repo/queue"

export type CreateProcessMemoSqsConsumerArgs = {
  memoRepository: MemoRepository
}

/**
 * `process-memo` の SQS（Lambda）用の結線。ハンドラは BullMQ 版と同じ processMemo。
 */
export const createProcessMemoSqsConsumer = (
  args: CreateProcessMemoSqsConsumerArgs,
): SqsConsumer =>
  createSqsConsumer(PROCESS_MEMO_QUEUE_NAME, processMemo({ memoRepository: args.memoRepository }))
```

`track-event-worker.ts` にも同じ形で `createTrackEventSqsConsumer({ eventRepository })` を足す。

### Lambda 用の HTTP ハンドラ

テストしやすいように、HTTP の処理は `src/runtime/lambda-request-listener.ts` に分け、入口ファイルは組み立てと `listen` だけにする。

```typescript
/** apps/worker/src/runtime/lambda-request-listener.ts */
import type { IncomingMessage, RequestListener } from "node:http"

import { logger } from "@repo/logger"
import { handleSqsEvent, type SqsConsumer, type SqsEvent } from "@repo/queue"

const readRequestBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString("utf8")
}

/**
 * Lambda Web Adapter から呼ばれる HTTP ハンドラ。
 *
 * - `GET /healthz`: LWA の起動判定（AWS_LWA_READINESS_CHECK_PATH）
 * - `POST /events`: LWA が SQS のイベントをそのまま渡してくる（AWS_LWA_PASS_THROUGH_PATH）。
 *   レスポンスの JSON が Lambda の戻り値になり、batchItemFailures のメッセージだけが再試行される
 *
 * イベント自体が読めない（JSON でない）ときは 500 を返し、バッチ全体を再試行させる。
 */
export const createLambdaRequestListener = (
  options: { consumers: SqsConsumer[]; queueNamePrefix: string },
): RequestListener =>
  (req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200).end("ok")
      return
    }
    if (req.method !== "POST" || req.url !== "/events") {
      res.writeHead(404).end()
      return
    }

    void readRequestBody(req)
      .then(async (body) => handleSqsEvent(JSON.parse(body) as SqsEvent, options))
      .then((response) => {
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(response))
      })
      .catch((err: unknown) => {
        logger.error(
          "[lambda] failed to handle sqs event",
          err instanceof Error ? err : new Error(String(err)),
        )
        res.writeHead(500).end()
      })
  }
```

### Lambda 用の入口

```typescript
/** apps/worker/src/lambda-server.ts */
import { createServer } from "node:http"

import { logger } from "@repo/logger"
import { extractQueueNamePrefix } from "@repo/queue"

import { createDependencies } from "./dependencies"
import { env } from "./env"
import { createLambdaRequestListener } from "./runtime/lambda-request-listener"
import { setupGracefulShutdown } from "./runtime/graceful-shutdown"
import { createProcessMemoSqsConsumer } from "./workers/process-memo-worker"
import { createTrackEventSqsConsumer } from "./workers/track-event-worker"

/**
 * apps/worker の Lambda 用エントリポイント（minimal 構成）。
 *
 * 常駐の入口（index.ts）と違い、ジョブの取得は Lambda（SQS イベントソース）が行う。
 * ここは依存の組み立てと HTTP サーバーの起動だけを持つ。
 * 新しい queue を足したら、consumers に createXxxSqsConsumer を追加する。
 */
const main = (): void => {
  const deps = createDependencies()

  const consumers = [
    createProcessMemoSqsConsumer({ memoRepository: deps.memoRepository }),
    createTrackEventSqsConsumer({ eventRepository: deps.eventRepository }),
  ]

  const server = createServer(createLambdaRequestListener({
    consumers,
    queueNamePrefix: extractQueueNamePrefix(env.SQS_QUEUE_URL_PREFIX ?? ""),
  }))

  /** in-flight の処理は Lambda が管理するので、閉じるのは接続だけ */
  setupGracefulShutdown({ consumers: [], dataWarehouse: deps.dataWarehouse, db: deps.db })

  server.listen(env.PORT, () => {
    logger.info("worker (lambda) started", {
      port: env.PORT,
      queues: consumers.map((c) => c.queueName),
    })
  })
}

main()
```

`setupGracefulShutdown` の `ShutdownDeps.redis` を optional（`redis?: Redis`）にし、`deps.redis?.quit()` にする。

### Dockerfile に LWA を入れる（`apps/worker/Dockerfile`）

api と同じく runner ステージに 1 行足す（バージョンは api と揃える）。`CMD` は変えない。Lambda 側で起動コマンドを `node dist/lambda-server.js` に上書きする（Terraform の `image_config.command`。step7）。

```dockerfile
# Lambda Web Adapter: minimal 構成（Lambda）で SQS のイベントを HTTP（POST /events）として受けるための extension。
# Lambda の実行環境だけが /opt/extensions を読むので、ECS では起動せず何もしない。
# 設計: docs/spec/minimal-deploy/README.md「worker を SQS と Lambda で動かす」
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
```

### ドキュメント

`apps/worker/CLAUDE.md` を更新する。

- 冒頭: 「BullMQ からジョブを取り出す常駐型 worker」に、minimal では SQS + Lambda（`src/lambda-server.ts`）で動くことを追記
- 「レイヤード設計のルール」: `src/dependencies.ts` を追加し、データウェアハウスを決める場所をここに更新
- 「環境変数」の表: `QUEUE_TYPE` / `SQS_QUEUE_URL_PREFIX` / `PORT` を追加し、`REDIS_URL` の必須条件を更新
- 「新 Queue の追加」: 手順に「`workers/<name>-worker.ts` に `createXxxSqsConsumer` を足し、`src/lambda-server.ts` の `consumers` に追加する」「`env/min` の SQS（`modules/sqs-queue`）に queue を足す」を追加

## 動作確認

```bash
pnpm --filter worker test
```

### テスト

- [ ] `createProcessMemoSqsConsumer` / `createTrackEventSqsConsumer` の `queueName` がそれぞれ `PROCESS_MEMO_QUEUE_NAME` / `TRACK_EVENT_QUEUE_NAME` で、`processor` を呼ぶと対応するハンドラが Repository を呼ぶ（Repository は既存テストと同じく fake）
- [ ] `test/runtime/lambda-request-listener.test.ts`: `createServer(listener).listen(0)` で起動し、`fetch` で次を確認する
  - [ ] 正常系: `GET /healthz` が `200`
  - [ ] 正常系: SQS イベントの JSON を `POST /events` すると `200` と `{ batchItemFailures: [] }` が返り、processor が呼ばれる
  - [ ] 異常系: processor が throw したレコードの `messageId` だけが `batchItemFailures` に入る
  - [ ] 異常系: JSON でないボディは `500`
  - [ ] 異常系: 未知のパス・メソッドは `404`
- [ ] env（手動）: `NODE_ENV=production QUEUE_TYPE=sqs` で `REDIS_URL` が無くても起動でき、`SQS_QUEUE_URL_PREFIX` が無いと env エラーで exit 1 する。`QUEUE_TYPE` を付けずに `REDIS_URL` が無いと従来どおり exit 1 する（`env.ts` は import 時に `process.exit` するので、ユニットテストではなく起動で確認する）

### ローカルでの起動

```bash
QUEUE_TYPE=sqs \
SQS_QUEUE_URL_PREFIX=https://sqs.ap-northeast-1.amazonaws.com/000000000000/project-template-local- \
  pnpm --filter worker exec tsx src/lambda-server.ts
```

SQS イベントを模した JSON（`eventSourceARN` は `arn:aws:sqs:ap-northeast-1:000000000000:project-template-local-process-memo`、`body` は `{"memoId":<存在する id>}`）を `curl -X POST localhost:8080/events -d @event.json` で送る。

- [ ] `200` と `{"batchItemFailures":[]}` が返り、`process-memo` ハンドラのログが出る
- [ ] 存在しない memoId など、ハンドラが失敗する入力では、その `messageId` が `batchItemFailures` に入る
- [ ] env を付けずに `pnpm --filter worker dev` で起動すると、従来どおり BullMQ の常駐 worker として動く

### Docker イメージ

- [ ] `docker build -f apps/worker/Dockerfile .` が通り、`/opt/extensions/lambda-adapter` が存在する
- [ ] Lambda の外（docker run）で従来どおり `node dist/index.js`（BullMQ の常駐 worker）として起動する

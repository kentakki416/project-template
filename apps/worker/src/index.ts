import { createDataWarehouse } from "@repo/data-warehouse"
import { createPrismaClient } from "@repo/db"
import { logger } from "@repo/logger"
import { createRedisClient } from "@repo/redis"

import { env } from "./env"
import { DataWarehouseEventRepository } from "./repository/data-warehouse"
import { PrismaMemoRepository } from "./repository/prisma"
import { setupGracefulShutdown } from "./runtime/graceful-shutdown"
import { startProcessMemoWorker } from "./workers/process-memo-worker"
import { startTrackEventWorker } from "./workers/track-event-worker"

/**
 * apps/worker のエントリポイント。
 *
 * 各 Worker は `startXxxWorker(...)` で起動し、返り値の `JobConsumer` を
 * graceful shutdown に登録する。新しい queue を増やすときは:
 *   1. `packages/queue` に Job 型と queue 名を追加
 *   2. `src/jobs/<name>.ts` に純粋なハンドラを書く
 *   3. `src/workers/<name>-worker.ts` で組み立てる
 *   4. ここで `startXxxWorker(...)` を呼んで `consumers` に push
 */
const main = (): void => {
  const prisma = createPrismaClient({ url: env.DATABASE_URL })
  /**
   * BullMQ Worker は `maxRetriesPerRequest: null` の Redis 接続が必須 (BullMQ 5.x 要件)
   */
  const redis = createRedisClient({
    onError: (error) => {
      logger.error("redis connection error", error)
    },
    options: { maxRetriesPerRequest: null },
    url: env.REDIS_URL,
  })

  /**
   * どのデータウェアハウスを使うかを決めるのはここだけ。
   * Repository 以降は DataWarehouse 抽象にしか依存しない。
   */
  const dataWarehouse = createDataWarehouse({
    database: env.DATA_WAREHOUSE_DATABASE,
    password: env.DATA_WAREHOUSE_PASSWORD,
    type: "clickhouse",
    url: env.DATA_WAREHOUSE_URL ?? "",
    username: env.DATA_WAREHOUSE_USER,
  })

  const memoRepository = new PrismaMemoRepository(prisma)
  const eventRepository = new DataWarehouseEventRepository(dataWarehouse)

  const consumers = [
    startProcessMemoWorker({
      concurrency: env.WORKER_CONCURRENCY,
      memoRepository,
      redis,
    }),
    startTrackEventWorker({
      concurrency: env.WORKER_CONCURRENCY,
      eventRepository,
      redis,
    }),
  ]

  setupGracefulShutdown({ consumers, dataWarehouse, prisma, redis })

  logger.info("worker started", {
    concurrency: env.WORKER_CONCURRENCY,
    queues: ["process-memo"],
  })
}

main()

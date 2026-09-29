import { randomUUID } from "node:crypto"

import { logger } from "@repo/logger"
import type { JobQueue, TrackEventJobData } from "@repo/queue"

import type { TrackEventInput } from "./event"
import type { EventTracker } from "./tracker"

/**
 * queue へ enqueue するだけの EventTracker
 *
 * enqueue を await せず、失敗しても呼び出し元に伝播させない。
 * Redis が落ちていてもユーザーのリクエストは成功させるため。
 *
 * eventId は **ここで採番する**。BullMQ は at-least-once で同じジョブが
 * 再配信されうるが、worker 側で採番すると再配信のたびに別 ID になり
 * ClickHouse の ReplacingMergeTree が重複を畳めなくなる。
 */
export class QueueEventTracker implements EventTracker {
  private readonly _queue: JobQueue<TrackEventJobData>

  constructor(queue: JobQueue<TrackEventJobData>) {
    this._queue = queue
  }

  public track(input: TrackEventInput): void {
    this.trackAll([input])
  }

  public trackAll(inputs: TrackEventInput[]): void {
    if (inputs.length === 0) return

    const occurredAt = new Date().toISOString()
    void this._queue
      .enqueue({
        events: inputs.map((input) => ({
          eventId: randomUUID(),
          name: input.name,
          occurredAt,
          properties: input.properties ?? {},
          source: input.source,
          userId: input.userId,
        })),
      })
      .catch((err: unknown) => {
        logger.warn("failed to enqueue events", {
          count: inputs.length,
          reason: err instanceof Error ? err.message : String(err),
        })
      })
  }
}

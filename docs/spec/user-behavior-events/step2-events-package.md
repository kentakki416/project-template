# step2-events-package

イベントの型定義と送出抽象 `@repo/events` を用意する。ClickHouse 実装はここに置き、service 層は interface にだけ依存させる。

## 対応内容

### イベント定義

```typescript
/** packages/events/src/event.ts */

/** イベントの送出元 */
export type EventSource = "admin" | "api" | "mobile" | "web"

/**
 * 記録するイベントの一覧
 *
 * 新しいイベントを足すときはここに追加する。文字列リテラルにしているのは、
 * 定義されていないイベント名をコンパイル時に弾くため。
 */
export const EVENT_NAMES = [
  "memo_created",
  "memo_deleted",
  "memo_updated",
  "memo_viewed",
] as const

export type EventName = (typeof EVENT_NAMES)[number]

/**
 * 記録する 1 件のイベント
 *
 * event_id / received_at は送出側では埋めず、EventTracker の実装が付与する。
 */
export type TrackedEvent = {
  name: EventName
  occurredAt: Date
  properties: Record<string, number | string>
  source: EventSource
  userId: number
}
```

### EventTracker 抽象

```typescript
/** packages/events/src/tracker.ts */
import type { TrackedEvent } from "./event"

/**
 * 行動イベントの送出抽象
 *
 * **呼び出し元は送出の成否を知らない。** 戻り値を void にしているのは、
 * 分析用のイベントがユーザーのリクエストを失敗させてはいけないため。
 * 実装側で catch してログに落とす。
 *
 * 将来 Queue 経由の配送に切り替えるときはこの interface の実装を差し替える
 * （docs/spec/user-behavior-events/deferred-event-delivery.md）。
 */
export interface EventTracker {
  track(event: TrackedEvent): void
  trackAll(events: TrackedEvent[]): void
}
```

### ClickHouse 実装

```typescript
/** packages/events/src/clickhouse-tracker.ts */
import type { ClickHouseClient } from "@repo/clickhouse"
import { logger } from "@repo/logger"

import type { TrackedEvent } from "./event"
import type { EventTracker } from "./tracker"

const SCHEMA_VERSION = 1

/**
 * ClickHouse へ直接書く EventTracker
 *
 * fire-and-forget。insert を await せず、失敗しても呼び出し元に伝播させない。
 * ClickHouse が落ちていてもユーザーのリクエストは成功させるため。
 */
export class ClickHouseEventTracker implements EventTracker {
  constructor(private readonly _client: ClickHouseClient) {}

  public track(event: TrackedEvent): void {
    this.trackAll([event])
  }

  public trackAll(events: TrackedEvent[]): void {
    if (events.length === 0) return

    const receivedAt = new Date()
    void this._client
      .insert({
        format: "JSONEachRow",
        table: "events",
        values: events.map((e) => this._toRow(e, receivedAt)),
      })
      .catch((err: unknown) => {
        logger.warn("failed to track events", {
          count: events.length,
          reason: err instanceof Error ? err.message : String(err),
        })
      })
  }

  private _toRow(event: TrackedEvent, receivedAt: Date): Record<string, unknown> {
    return {
      event_id: crypto.randomUUID(),
      event_name: event.name,
      occurred_at: event.occurredAt.getTime(),
      properties: JSON.stringify(event.properties),
      received_at: receivedAt.getTime(),
      schema_version: SCHEMA_VERSION,
      source: event.source,
      user_id: event.userId,
    }
  }
}
```

### テスト用の fake

テストで ClickHouse を立てずに済むよう、記録内容を配列に貯めるだけの実装を同梱する。

```typescript
/** packages/events/src/fake-tracker.ts */
import type { TrackedEvent } from "./event"
import type { EventTracker } from "./tracker"

/** テスト用。送出されたイベントを配列に貯めるだけ */
export class FakeEventTracker implements EventTracker {
  public readonly events: TrackedEvent[] = []

  public track(event: TrackedEvent): void {
    this.events.push(event)
  }

  public trackAll(events: TrackedEvent[]): void {
    this.events.push(...events)
  }
}
```

### lint 境界の確認

`@repo/events` は `@repo/clickhouse` と `@repo/logger` に依存するため **フロントから import させてはいけない**。`@repo/eslint-config/frontend-boundary` の許可リストは `@repo/api-schema` のみなので、**設定変更なしで自動的に禁止される**（fail-closed）。

## 動作確認

```bash
pnpm --filter @repo/events build
pnpm --filter @repo/events test
```

- [ ] `ClickHouseEventTracker.trackAll()` が `insert` を呼び、`event_id` / `received_at` / `schema_version` を付与している
- [ ] `insert` が reject しても `trackAll()` が throw しないこと（fire-and-forget の検証）
- [ ] 空配列を渡したとき `insert` が呼ばれないこと
- [ ] フロントから `@repo/events` を import すると lint error になること（`apps/web` に一時ファイルを置いて確認し、検証後に削除）

# step4-web-emit

web からフロント起点のイベント（`memo_viewed`）を送出する。

## 対応内容

### 送出ヘルパ

フロントは `@repo/events` を import できない（`frontend-boundary` の lint 境界）。`@repo/api-schema` の型だけを使い、API を叩く薄いヘルパを web 側に置く。

```typescript
/** apps/web/src/libs/track-event.ts */
import type { CreateEventRequest } from "@repo/api-schema"

type EventInput = CreateEventRequest["events"][number]

/**
 * 行動イベントを API に送る
 *
 * **await しない前提で呼ぶ。** 分析のためにユーザー操作を待たせない。
 * 送信に失敗しても握りつぶす（行動イベントは欠落を許容する）。
 */
export const trackEvent = (event: Omit<EventInput, "occurredAt">): void => {
  void fetch("/api/events", {
    body: JSON.stringify({
      events: [{ ...event, occurredAt: new Date().toISOString() }],
    }),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    /** 分析イベントの失敗はユーザーに影響させない */
  })
}
```

`keepalive: true` にしているのは、画面遷移や離脱の直後でも送信を完了させるため。

### memo_viewed の送出

メモ詳細ページで、表示時に 1 回だけ送る。

- **Client Component から呼ぶ**（`useEffect` で 1 回）。Server Component から呼ぶとページのレンダリングを待たせるうえ、キャッシュヒット時に発火しない
- 依存配列に `memoId` を入れ、同じメモを開き直したときだけ再送する
- React Strict Mode の二重実行に注意する。開発時に 2 件送られても分析上は許容するか、`useRef` でガードする

### 他 app への展開

`apps/admin` / `apps/mobile` も同じ形で `track-event.ts` を置けば送出できる。`source` は server 側で判定するのでクライアントは送らない。

## 動作確認

```bash
pnpm --filter web lint
pnpm --filter web exec tsc --noEmit
```

- [ ] メモ詳細ページを開くと `POST /api/events` が 1 回発火する（DevTools の Network で確認）
- [ ] 同じページをリロードすると再度 1 回発火する
- [ ] API を停止した状態でページを開いても、**画面が正常に表示される**（送出失敗が UI に影響しないこと）
- [ ] ClickHouse に `memo_viewed` が入っていること

```sql
SELECT event_name, user_id, properties, occurred_at
FROM events
WHERE event_name = 'memo_viewed'
ORDER BY occurred_at DESC
LIMIT 10
```

- [ ] `apps/web` から `@repo/events` を import すると lint error になること（境界が効いていることの確認。検証後に削除）

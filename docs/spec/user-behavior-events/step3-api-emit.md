# step3-api-emit

API から memo のイベントを送出し、フロントからのイベントを受け取る `POST /api/events` を実装する。

## 対応内容

### DI の組み立て

`apps/api/src/index.ts` で ClickHouse client と tracker を 1 回だけ生成し、service に渡す。

```typescript
const clickhouse = createClickHouseClient()
const eventTracker = new ClickHouseEventTracker(clickhouse)
```

graceful shutdown で `clickhouse.close()` を呼ぶ。

### service 層からの送出

service は `repo` と同じく **オブジェクト引数** で受け取る。既存の Repository 引数の流儀に合わせる。

```typescript
/** apps/api/src/service/memo-service.ts */
export const deleteMemo = async (
  id: number,
  repo: { memoRepository: MemoRepository },
  deps: { eventTracker: EventTracker; userId: number },
): Promise<Result<void>> => {
  const memo = await repo.memoRepository.findById(id)
  if (!memo) return err(notFoundError("メモが見つかりません"))

  await repo.memoRepository.deleteById(id)

  /** 物理削除なので DB からは復元できない。ここで記録しないと永久に失われる */
  deps.eventTracker.track({
    name: "memo_deleted",
    occurredAt: new Date(),
    properties: { memo_id: id },
    source: "api",
    userId: deps.userId,
  })

  return ok(undefined)
}
```

`memo_created` / `memo_updated` も同様に送出する。**送出は `await` しない**（`EventTracker.track` の戻り値は `void`）。

### POST /api/events

フロントからのイベントを受け取る。

`@repo/api-schema` にスキーマを定義する（命名規則は `packages/schema/CLAUDE.md`）。

```typescript
/** packages/schema/src/api-schema/event.ts */
export const createEventRequestSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.enum(["memo_created", "memo_deleted", "memo_updated", "memo_viewed"]),
        occurredAt: z.string().datetime(),
        properties: z.record(z.union([z.number(), z.string()])).default({}),
      }),
    )
    .min(1)
    .max(50),
})

export const createEventResponseSchema = z.object({
  accepted: z.number(),
})
```

Controller の要点:

- **`user_id` はリクエストボディから受け取らない。** 認証済みユーザーから server 側で解決する（他人の ID を詐称させないため）
- **`source` も server 側で決める**（`web` / `admin` / `mobile` を Origin か専用ヘッダで判定する）
- **壊れたイベントがあっても 4xx にしない。** 捨てて残りを受理し、`accepted` に実際の件数を返す。分析のためにユーザー体験を壊さないため
- `received_at` は tracker 側で付与するので Controller では触らない

Router は `src/routes/event-router.ts` を新設して `/api/events` にマッピングする。

### 認証

`POST /api/events` は認証必須。`PUBLIC_PATHS` に追加しない。

## 動作確認

```bash
pnpm --filter api test
```

- [ ] `deleteMemo` のユニットテスト: `FakeEventTracker` を渡し、`memo_deleted` が `memo_id` 付きで 1 件記録されること
- [ ] `deleteMemo` のユニットテスト: メモが存在しない（`notFound`）ときイベントが記録されないこと
- [ ] `createMemo` / `updateMemo` も同様に検証する
- [ ] **tracker が throw してもリクエストが成功すること**（fire-and-forget の検証。`track` が例外を投げる fake を渡す）
- [ ] `POST /api/events` のインテグレーションテスト: 認証なしで 401
- [ ] `POST /api/events` のインテグレーションテスト: ボディに `userId` を混ぜても**無視され**、認証済みユーザーの ID が使われること
- [ ] `POST /api/events` のインテグレーションテスト: 50 件を超えると 400、壊れたイベントが混ざっても 200 で `accepted` が正しいこと

テストケースは `describe` を「正常系」「異常系」で分類する（`apps/api/CLAUDE.md`）。

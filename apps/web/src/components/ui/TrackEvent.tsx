"use client"

import { useEffect, useRef } from "react"

import { trackEvent, type EventInput } from "@/libs/event-tracker"

type Props = {
  name: EventInput["name"]
  properties?: EventInput["properties"]
}

/**
 * マウント時に行動イベントを 1 回送出する汎用コンポーネント。
 *
 * **イベントごとに専用コンポーネントを作らない。** 種類が増えてもこれ 1 つを使う。
 *
 * ```tsx
 * <TrackEvent name="memo_viewed" properties={{ memo_id: memo.id }} />
 * ```
 *
 * Server Component の JSX に置ける Client Component にしているのは、
 * hook では Server Component から呼べないため。Server Component 側で送ると
 * プリフェッチやキャッシュヒットでも記録され、実際には見ていない閲覧が混入する。
 *
 * イベントハンドラの中など **命令的に送りたい場合は `trackEvent()` を直接呼ぶ**。
 * このコンポーネントは「画面に到達したら送る」ケース専用。
 */
export function TrackEvent({ name, properties }: Props) {
  /**
   * name と properties から作るキー。これが変わったときだけ送る。
   *
   * React Strict Mode は開発時に useEffect を 2 回実行するため、
   * ref でガードしないと同じイベントが 2 件記録される。
   */
  const key = JSON.stringify({ name, properties })
  const sentKey = useRef<string | null>(null)

  useEffect(() => {
    if (sentKey.current === key) return
    sentKey.current = key
    trackEvent(JSON.parse(key) as Omit<EventInput, "occurredAt">)
  }, [key])

  return null
}

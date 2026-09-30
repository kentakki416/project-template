import type { CreateEventRequest } from "@repo/api-schema"

/** API が受け取る 1 件のイベント。イベント名の union もここから派生する */
export type EventInput = CreateEventRequest["events"][number]

/** バッファがこの件数に達したら即座に送る */
const FLUSH_THRESHOLD = 10

/** 操作が止まってもこの間隔で送る */
const FLUSH_INTERVAL_MS = 5000

const EVENTS_ENDPOINT = "/api/events"

let buffer: EventInput[] = []
let timer: ReturnType<typeof setTimeout> | null = null

/**
 * バッファのイベントを送信する。
 *
 * 離脱時は通常の fetch が中断されうるため sendBeacon を優先する。
 * 送信に失敗しても握りつぶす（行動イベントは欠落を許容する方針）。
 */
const flushEvents = (): void => {
  if (buffer.length === 0) return

  const payload = JSON.stringify({ events: buffer })
  buffer = []
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }

  const blob = new Blob([payload], { type: "application/json" })
  if (navigator.sendBeacon?.(EVENTS_ENDPOINT, blob)) return

  void fetch(EVENTS_ENDPOINT, {
    body: payload,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    /** 分析イベントの失敗はユーザーに影響させない */
  })
}

/**
 * 行動イベントをバッファに積む。
 *
 * **await しない前提で呼ぶ。** 分析のためにユーザー操作を待たせない。
 * 1 件ずつ送ると 1 セッションで数十回 API を叩くため、
 * 10 件 / 5 秒 / タブが hidden のいずれかで flush する。
 */
export const trackEvent = (event: Omit<EventInput, "occurredAt">): void => {
  buffer.push({ ...event, occurredAt: new Date().toISOString() })

  if (buffer.length >= FLUSH_THRESHOLD) {
    flushEvents()
    return
  }
  timer ??= setTimeout(flushEvents, FLUSH_INTERVAL_MS)
}

/**
 * ページが隠れる / 破棄されるタイミングで flush する。
 *
 * アプリのルートで 1 回呼び、返り値をクリーンアップに使う。
 * これが無いとタブを閉じた瞬間のバッファが失われる。
 *
 * **visibilitychange と pagehide の両方を購読する。** iOS Safari は
 * アプリ切り替えやタブ破棄で visibilitychange が発火しないことがあり、
 * これだけに頼るとモバイル閲覧のバッファを取りこぼす。
 * flushEvents はバッファが空なら即 return するので、両方発火しても
 * 二重送信にはならない。
 */
export const setupEventFlushOnHide = (): (() => void) => {
  const flushWhenHidden = (): void => {
    if (document.visibilityState === "hidden") flushEvents()
  }
  document.addEventListener("visibilitychange", flushWhenHidden)
  window.addEventListener("pagehide", flushEvents)
  return () => {
    document.removeEventListener("visibilitychange", flushWhenHidden)
    window.removeEventListener("pagehide", flushEvents)
  }
}

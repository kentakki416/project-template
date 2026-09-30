"use client"

import { useEffect } from "react"

import { setupEventFlushOnHide } from "@/libs/event-tracker"

/**
 * タブが hidden になったときにイベントバッファを flush する。
 *
 * ルートレイアウトに 1 つだけ置く。これが無いとタブを閉じた瞬間の
 * バッファが失われる。
 */
export function EventFlushOnHide() {
  useEffect(() => setupEventFlushOnHide(), [])
  return null
}

import React from "react"

import "@/components/demo/demo.css"

/**
 * デモの画面の layout。デモだけが使う CSS（カレンダー・グラフ・地図など）を読み込む
 */
export default async function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

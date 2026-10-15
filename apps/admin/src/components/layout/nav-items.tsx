import React from "react"

import { GridIcon } from "@/icons"

/**
 * サイドバーの項目。path か subItems のどちらかを持つ
 */
export type NavItem = {
  icon: React.ReactNode
  name: string
  path?: string
  subItems?: { name: string; path: string }[]
}

/**
 * サイドバーのセクション（見出し + 項目）
 */
export type NavSection = {
  items: NavItem[]
  title: string
}

/**
 * 土台のメニュー。プロジェクトの画面はここに足す
 */
export const mainNavSection: NavSection = {
  items: [{ icon: <GridIcon />, name: "ホーム", path: "/" }],
  title: "メニュー",
}

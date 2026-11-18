import React from "react"

import { GridIcon, GroupIcon } from "@/icons"

/**
 * path か subItems のどちらかを持つ
 */
export type NavItem = {
  icon: React.ReactNode
  name: string
  path?: string
  subItems?: { name: string; path: string }[]
}

export type NavSection = {
  items: NavItem[]
  title: string
}

/**
 * プロジェクトの画面はここに足す
 */
export const mainNavSection: NavSection = {
  items: [
    { icon: <GridIcon />, name: "ホーム", path: "/" },
    { icon: <GroupIcon />, name: "ユーザー管理", path: "/users" },
  ],
  title: "メニュー",
}

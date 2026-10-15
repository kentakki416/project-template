import React from "react"

import AdminShell from "@/components/layout/AdminShell"
import { adminApi } from "@/features/admin/admin.api"
import { markAllAsReadAction } from "@/features/notification/notification.actions"
import { notificationApi } from "@/features/notification/notification.api"

/**
 * サイドバー付きの画面の枠。サインイン中の admin と通知を取ってシェルに渡す。
 *
 * proxy は cookie の期限しか見ないので、ここで api の /api/admin/me を呼ぶことで、全画面の描画のたびに
 * api が token を確かめる。api の 401 は api-client が /api/auth/signout に送る（cookie を消して /signin へ）
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [admin, notifications] = await Promise.all([
    adminApi.getMe(),
    notificationApi.getList(),
  ])

  return (
    <AdminShell
      admin={admin}
      markAllAsReadAction={markAllAsReadAction}
      notifications={notifications}
      search={{ action: "/users", placeholder: "ユーザーを検索" }}
    >
      {children}
    </AdminShell>
  )
}

"use server"

import { redirect } from "next/navigation"

import { apiClient } from "@/libs/api-client"
import { clearAuthCookies, getRefreshToken } from "@/libs/auth"

/**
 * ログアウト。api の refresh token を無効にしてから cookie を消し、サインイン画面に送る。
 * ヘッダーのユーザーメニュー（全画面）から呼ぶので features/auth に置く
 */
export const logoutAction = async () => {
  const refreshToken = await getRefreshToken()
  if (refreshToken) {
    try {
      await apiClient.post("/api/admin/auth/logout", { refresh_token: refreshToken })
    } catch {
      /**
       * api が失敗しても cookie は消す（手元のセッションは必ず終える）
       */
    }
  }
  await clearAuthCookies()
  redirect("/signin")
}

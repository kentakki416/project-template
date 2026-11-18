"use server"

import { redirect } from "next/navigation"

import { clearAuthCookies, getRefreshToken } from "@/libs/auth"

import { authApi } from "./auth.api"

/**
 * api の refresh token を無効にしてから cookie を消し、サインイン画面に送る
 */
export const logoutAction = async () => {
  const refreshToken = await getRefreshToken()
  if (refreshToken) {
    try {
      await authApi.logout(refreshToken)
    } catch {
      /**
       * api が失敗しても cookie は消す（手元のセッションは必ず終える）
       */
    }
  }
  await clearAuthCookies()
  redirect("/signin")
}

"use server"

import { redirect } from "next/navigation"

import { clearAuthCookies, getRefreshToken } from "@/libs/auth"

import { authApi } from "./auth.api"

export const logoutAction = async () => {
  const refreshToken = await getRefreshToken()
  if (refreshToken) {
    try {
      await authApi.logout(refreshToken)
    } catch {
      /**
       * API 失敗時も Cookie はクリアする
       */
    }
  }
  await clearAuthCookies()
  redirect("/sign-in")
}

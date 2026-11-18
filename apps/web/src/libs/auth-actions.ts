"use server"

import { redirect } from "next/navigation"

import { authApi } from "@/features/auth/auth.api"

import { clearAuthCookies, getRefreshToken } from "./auth"

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

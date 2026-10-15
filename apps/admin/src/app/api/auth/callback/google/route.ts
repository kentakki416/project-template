import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

import { adminAuthGoogleResponseSchema } from "@repo/api-schema"

import { env } from "@/env"
import { GOOGLE_REDIRECT_URI } from "@/libs/app-origin"
import { setAuthCookies } from "@/libs/auth"
import { OAUTH_REDIRECT_COOKIE, OAUTH_STATE_COOKIE } from "@/libs/auth-cookies"
import { resolveSafeRedirectPath } from "@/libs/safe-redirect"

const redirectToSignInWithError = (req: NextRequest, error: string): NextResponse =>
  NextResponse.redirect(new URL(`/signin?error=${error}`, req.url))

/**
 * Google OAuth の callback。api の admin の Google 認証で code を検証し、
 * access / refresh token を cookie に保存して、サインイン前に開こうとしていた画面に戻す。
 * admins に登録されていない Google アカウント（api が 403）は、サインイン画面に権限が無い旨を出す
 */
export const GET = async (req: NextRequest) => {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  if (url.searchParams.get("error")) {
    return redirectToSignInWithError(req, "oauth_denied")
  }
  if (!code || !state) {
    return redirectToSignInWithError(req, "auth_failed")
  }

  const store = await cookies()
  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value
  store.delete(OAUTH_STATE_COOKIE)
  if (!expectedState || expectedState !== state) {
    return redirectToSignInWithError(req, "state_mismatch")
  }

  const apiRes = await fetch(`${env.API_URL}/api/admin/auth/google`, {
    /**
     * redirect_uri は startGoogleOAuth と同じ値にする（Google は完全一致で照合する）
     */
    body: JSON.stringify({ code, redirect_uri: GOOGLE_REDIRECT_URI }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

  if (apiRes.status === 403) {
    return redirectToSignInWithError(req, "not_admin")
  }
  if (!apiRes.ok) {
    return redirectToSignInWithError(req, "auth_failed")
  }

  const json = adminAuthGoogleResponseSchema.parse(await apiRes.json())
  await setAuthCookies(json.access_token, json.refresh_token)

  const redirectTo = resolveSafeRedirectPath(store.get(OAUTH_REDIRECT_COOKIE)?.value)
  store.delete(OAUTH_REDIRECT_COOKIE)
  return NextResponse.redirect(new URL(redirectTo, req.url))
}

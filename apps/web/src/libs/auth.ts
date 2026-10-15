import { cookies } from "next/headers"

export const ACCESS_TOKEN_COOKIE = "app_access_token"
export const REFRESH_TOKEN_COOKIE = "app_refresh_token"
export const OAUTH_STATE_COOKIE = "app_oauth_state"

const isProduction = process.env.NODE_ENV === "production"

const ACCESS_TOKEN_MAX_AGE = 60 * 15
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7

/**
 * access / refresh の cookie の属性。cookies()（Server Action / Route Handler）と
 * proxy の NextResponse の両方から同じ属性で書くために export する。
 *
 * sameSite="lax" を使う理由:
 * OAuth コールバック（google.com → /api/auth/callback/google → /）は cross-site 起点の
 * 連鎖ナビゲーションになるため、strict だと最終遷移先で cookie が送信されず
 * proxy が認証無しと判定してしまう。CSRF は state パラメータで対策済み。
 */
export const ACCESS_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: ACCESS_TOKEN_MAX_AGE,
  path: "/",
  sameSite: "lax",
  secure: isProduction,
} as const

export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: REFRESH_TOKEN_MAX_AGE,
  path: "/",
  sameSite: "lax",
  secure: isProduction,
} as const

/**
 * access token の期限がこの秒数を切っていたら「期限が近い」とみなす。
 * proxy が先に更新しておき、api に届くまでの間に期限が切れて 401 になるのを避けるため
 */
const ACCESS_TOKEN_REFRESH_MARGIN_SECONDS = 30

/**
 * access token の期限が近い（または読めない）か。proxy とサインイン画面が使う。
 * 署名は検証しない（検証は api が行う）。payload の exp を読むだけ
 */
export const isAccessTokenExpiringSoon = (token: string): boolean => {
  try {
    const payload = token.split(".")[1] ?? ""
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    const { exp } = JSON.parse(json) as { exp?: unknown }
    if (typeof exp !== "number") return true
    return exp - ACCESS_TOKEN_REFRESH_MARGIN_SECONDS <= Date.now() / 1000
  } catch {
    return true
  }
}

/**
 * Server Action / Route Handler から呼ぶ。Server Component の中では cookie を書けない
 */
export const setAuthCookies = async (accessToken: string, refreshToken: string) => {
  const store = await cookies()
  store.set(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_TOKEN_COOKIE_OPTIONS)
  store.set(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS)
}

export const clearAuthCookies = async () => {
  const store = await cookies()
  store.delete(ACCESS_TOKEN_COOKIE)
  store.delete(REFRESH_TOKEN_COOKIE)
}

export const getAccessToken = async (): Promise<string | null> => {
  const store = await cookies()
  return store.get(ACCESS_TOKEN_COOKIE)?.value ?? null
}

export const getRefreshToken = async (): Promise<string | null> => {
  const store = await cookies()
  return store.get(REFRESH_TOKEN_COOKIE)?.value ?? null
}

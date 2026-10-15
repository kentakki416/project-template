import { NextRequest, NextResponse } from "next/server"

import { authRefreshResponseSchema } from "@repo/api-schema"

import { env } from "@/env"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  isAccessTokenExpiringSoon,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from "@/libs/auth"

/**
 * production 以外でのみ公開する dev 専用パス
 * `/api/dev/login?as=alice` を踏むだけでログイン状態にできる開発支援機能
 */
const DEV_ONLY_PUBLIC_PATHS = process.env.NODE_ENV !== "production"
  ? ["/api/dev/login"]
  : []

/** memo はユーザー非依存で、Express 側も `/api/memo` を公開にしている */
const PUBLIC_PATHS = [
  "/memos",
  "/api/memos",
  /** リダイレクトすると sendBeacon がサインインページの HTML を受け取ってしまう */
  "/api/events",
  "/sign-in",
  "/api/auth/callback/google",
  "/api/auth/signout",
  ...DEV_ONLY_PUBLIC_PATHS,
]

/**
 * token の更新をしないパス。どれも自分で cookie を書き換える（ログイン・ログアウト）ので、
 * proxy が先に更新すると、書き換える前の古い refresh token を無効にしてしまう
 */
const SKIP_REFRESH_PATHS = [
  "/api/auth/callback/google",
  "/api/auth/signout",
  ...DEV_ONLY_PUBLIC_PATHS,
]

/**
 * 完全一致 or path セグメント境界での prefix 一致をチェックする。
 *
 * 単純な `pathname.startsWith(p)` は `/sign-in` が `/sign-in-foo` も通してしまうため、
 * 登録されたページと意図しないパスが衝突するリスクがある。`/` 区切り
 * (= path segment 境界) で一致するもののみ通す。
 *
 * 例 (p = "/sign-in"):
 * - "/sign-in"           → true (完全一致)
 * - "/sign-in/google"    → true (segment 境界の prefix)
 * - "/sign-in-foo"       → false (segment 境界ではない)
 */
const matchesPathPrefix = (pathname: string, p: string): boolean =>
  pathname === p || pathname.startsWith(`${p}/`)

type RefreshResult =
  | { accessToken: string; refreshToken: string; status: "refreshed" }
  | { status: "unauthorized" }
  | { status: "failed" }

/**
 * api に refresh token を渡して、新しい access / refresh token を受け取る。
 * 401（refresh token が無効・使用済み）と、それ以外の失敗（api の障害など）を分けて返す
 */
const requestTokenRefresh = async (refreshToken: string): Promise<RefreshResult> => {
  try {
    const res = await fetch(`${env.API_URL}/api/auth/refresh`, {
      body: JSON.stringify({ refresh_token: refreshToken }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
    if (res.status === 401) return { status: "unauthorized" }
    if (!res.ok) return { status: "failed" }
    const json = authRefreshResponseSchema.parse(await res.json())
    return { accessToken: json.access_token, refreshToken: json.refresh_token, status: "refreshed" }
  } catch {
    return { status: "failed" }
  }
}

const redirectToSignIn = (req: NextRequest): NextResponse => {
  const url = new URL("/sign-in", req.url)
  url.searchParams.set("redirect", req.nextUrl.pathname)
  return NextResponse.redirect(url)
}

/**
 * 認証ガードと access token の更新を行う。
 *
 * **更新（refresh）はここでだけ行う。** Server Component の中では cookie を書けないため、
 * api-client で refresh すると api 側だけ refresh token が作り直され、cookie は古いままになる。
 * ここなら、レスポンスに新しい cookie を付けると同時に、同じリクエストの Cookie ヘッダーも
 * 書き換えて先に渡せるので、その画面の Server Component が新しい access token で api を呼べる。
 *
 * 公開パスでも、refresh token があれば更新する（ログイン中のユーザーの行動イベントに
 * userId を付けるため）。更新に失敗しても公開パスはそのまま通す。
 */
export const proxy = async (req: NextRequest) => {
  const { pathname } = req.nextUrl
  const isPublicPath = PUBLIC_PATHS.some(p => matchesPathPrefix(pathname, p))
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value

  const shouldRefresh = refreshToken !== undefined
    && (accessToken === undefined || isAccessTokenExpiringSoon(accessToken))
    && !SKIP_REFRESH_PATHS.some(p => matchesPathPrefix(pathname, p))

  if (shouldRefresh) {
    const result = await requestTokenRefresh(refreshToken)

    if (result.status === "refreshed") {
      req.cookies.set(ACCESS_TOKEN_COOKIE, result.accessToken)
      req.cookies.set(REFRESH_TOKEN_COOKIE, result.refreshToken)
      const res = NextResponse.next({ request: { headers: req.headers } })
      res.cookies.set(ACCESS_TOKEN_COOKIE, result.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS)
      res.cookies.set(REFRESH_TOKEN_COOKIE, result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS)
      return res
    }

    if (isPublicPath) {
      return NextResponse.next()
    }

    /**
     * 401 でも cookie は消さない。同時に来た別のリクエスト（画面の先読みなど）が先に更新に
     * 成功していると、この refresh token はもう使用済みになっている。ここで消すと、
     * 成功した側が付けた新しい cookie まで消える。サインイン画面は有効な access の cookie が
     * あればトップに戻す。
     *
     * api の障害など（failed）で access token も無いときも、cookie を消さずにサインイン画面に送る。
     * そのまま通すと画面の api 呼び出しが 401 になり、api-client が cookie を消してしまう
     * （一時的な障害でログアウトされる）。サインイン画面を開き直せば、もう一度更新を試みる。
     */
    if (result.status === "unauthorized" || accessToken === undefined) {
      return redirectToSignIn(req)
    }

    /**
     * failed で access token はまだ残っている（期限まで 30 秒を切っただけ）ときは、そのまま通す
     */
    return NextResponse.next()
  }

  if (isPublicPath || accessToken !== undefined) {
    return NextResponse.next()
  }

  return redirectToSignIn(req)
}

export const config = {
  /** _next, _next/static, _next/image, favicon, public 配下を除外 */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}

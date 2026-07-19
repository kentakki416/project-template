import { env } from "@/env"

import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "./auth"

const API_BASE_URL = env.API_URL

/**
 * apiClient が non-2xx レスポンスを受けたときに投げるエラー型
 *
 * 元の status と （取得できれば）レスポンスボディを保持することで、
 * 呼び出し側（Route Handler 等）が `instanceof ApiClientError` で判別して
 * 元の status / error メッセージをそのままクライアントに返せる。
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(`API error: ${status}`)
    this.name = "ApiClientError"
  }
}

/**
 * fetch 用のヘッダを組み立てる。access token があれば Authorization: Bearer を付け、
 * Content-Type は既定で application/json（必要なら extra で上書きできる）。
 */
const buildHeaders = async (extra?: HeadersInit): Promise<HeadersInit> => {
  const token = await getAccessToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
    ...extra,
  }
}

/**
 * refresh token で access/refresh token を再発行し、cookie を更新する。
 *
 * 成功時 true / 失敗時 false を返す。refresh token が無ければ何もせず false、
 * refresh API が non-2xx を返したら cookie をクリアして false（＝要再ログイン）にする。
 */
const tryRefresh = async (): Promise<boolean> => {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return false
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    body: JSON.stringify({ refresh_token: refreshToken }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })
  if (!res.ok) {
    await clearAuthCookies()
    return false
  }
  const json = await res.json() as { access_token: string; refresh_token: string }
  await setAuthCookies(json.access_token, json.refresh_token)
  return true
}

/**
 * 認証付きで API を叩く内部 fetch ラッパー。
 *
 * - buildHeaders で Authorization: Bearer を付与してからリクエストする。
 * - access token 切れ（401）を検知したら tryRefresh で 1 回だけ自動更新し、
 *   成功したときのみ再試行する。再試行は retry=false で呼ぶことで再帰を 1 段に制限し、
 *   「refresh しても 401」のケースでも無限ループにならないようにしている。
 *
 * cookie（httpOnly の token）を読む auth に依存するため実質サーバー専用で、
 * Server Component / Server Action / Route Handler から呼ばれる。
 */
const fetchWithAuth = async (input: string, init: RequestInit, retry = true): Promise<Response> => {
  const headers = await buildHeaders(init.headers)
  const res = await fetch(`${API_BASE_URL}${input}`, { ...init, headers })
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh()
    if (refreshed) return fetchWithAuth(input, init, false)
  }
  return res
}

/**
 * non-2xx の Response を ApiClientError として throw する
 * （ボディは JSON でなければ undefined）
 */
const throwApiError = async (res: Response): Promise<never> => {
  const body = await res.json().catch(() => undefined)
  throw new ApiClientError(res.status, body)
}

/**
 * web（BFF）から Express API（apps/api）へサーバー間通信するための HTTP クライアント。
 *
 * - get / post / put / delete の薄いラッパー。すべて fetchWithAuth 経由なので、
 *   認証ヘッダ付与・401 時の自動 refresh・再試行が透過的に効く。
 * - non-2xx のときは ApiClientError（status とボディを保持）を throw する。
 *   呼び出し側は try/catch で status を見て 4xx / 5xx を出し分けられる。
 * - 戻り値はレスポンス JSON を型 T として返すだけでランタイム検証はしない。
 *   スキーマ検証が要る場面では呼び出し側で @repo/api-schema の zod を使う。
 *
 * 「ブラウザから Express を直接叩かない」原則の実体。cookies() に依存するため
 * Server Component / Server Action / Route Handler からのみ利用する。
 */
export const apiClient = {
  delete: async <T = unknown>(path: string): Promise<T> => {
    const res = await fetchWithAuth(path, { method: "DELETE" })
    if (!res.ok) await throwApiError(res)
    return res.json() as Promise<T>
  },
  get: async <T>(path: string): Promise<T> => {
    const res = await fetchWithAuth(path, { method: "GET" })
    if (!res.ok) await throwApiError(res)
    return res.json() as Promise<T>
  },
  post: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetchWithAuth(path, { body: JSON.stringify(body), method: "POST" })
    if (!res.ok) await throwApiError(res)
    return res.json() as Promise<T>
  },
  put: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetchWithAuth(path, { body: JSON.stringify(body), method: "PUT" })
    if (!res.ok) await throwApiError(res)
    return res.json() as Promise<T>
  },
}

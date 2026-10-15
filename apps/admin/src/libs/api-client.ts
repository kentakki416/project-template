import "server-only"

import { redirect } from "next/navigation"

import { env } from "../env"

import { getAccessToken } from "./auth"

/**
 * Express API を叩く server-side 専用クライアント。
 *
 * admin は DB を直接触らず必ず API を経由する。ブラウザから API を直接叩かないよう
 * `server-only` でガードしているので、client component からは import できない。
 * client 側からデータが必要な場合は Server Component か Route Handler を経由する。
 */
const API_BASE_URL = env.API_URL

const SIGN_OUT_PATH = "/api/auth/signout"

/**
 * status とボディを保持するので、呼び出し側が元の status をそのまま返せる
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

const buildHeaders = async (extra?: HeadersInit): Promise<HeadersInit> => {
  const token = await getAccessToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
    ...extra,
  }
}

/**
 * api を呼び、成功したレスポンスだけを返す。
 *
 * access token の更新（refresh）はここでは行わない。proxy が画面の描画の前に済ませている。
 * Server Component の中では cookie を書けないため、ここで refresh すると api 側だけ
 * refresh token が作り直され、cookie は古いままになってセッションが切れる。
 *
 * 401（proxy で更新した後でも弾かれた = 鍵の作り直しや admin の削除などで access token が無効）は、
 * cookie を消す Route Handler に redirect する。cookie を消さずにサインイン画面へ送ると、
 * サインイン画面が「有効な access の cookie がある」と見て元の画面に戻し、往復が止まらなくなる。
 * それ以外の失敗は ApiClientError を投げる。
 *
 * redirect は例外（NEXT_REDIRECT）で実現しているので、呼び出し側の try/catch が握りつぶすと遷移しない。
 * 認証必須の API の呼び出しを try/catch で囲むときは、catch の先頭で unstable_rethrow する
 * （ログアウトは、遷移せずに握りつぶしてよい）。
 */
const requestApi = async (path: string, init: RequestInit): Promise<Response> => {
  const headers = await buildHeaders(init.headers)
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (res.status === 401) {
    redirect(SIGN_OUT_PATH)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => undefined)
    throw new ApiClientError(res.status, body)
  }
  return res
}

/**
 * cookies() に依存するため Server Component / Server Action / Route Handler からのみ使う。
 * 戻り値はランタイム検証をしないので、`@repo/api-schema` のスキーマで parse する
 */
export const apiClient = {
  delete: async <T = unknown>(path: string): Promise<T> => {
    const res = await requestApi(path, { method: "DELETE" })
    return res.json() as Promise<T>
  },
  get: async <T>(path: string): Promise<T> => {
    const res = await requestApi(path, { method: "GET" })
    return res.json() as Promise<T>
  },
  post: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await requestApi(path, { body: JSON.stringify(body), method: "POST" })
    return res.json() as Promise<T>
  },
  put: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await requestApi(path, { body: JSON.stringify(body), method: "PUT" })
    return res.json() as Promise<T>
  },
}

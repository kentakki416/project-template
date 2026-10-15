import "server-only"

import type { GetUserResponse } from "@repo/api-schema"

import { apiClient } from "@/libs/api-client"

/**
 * 認証中ユーザー（自分自身）を Server 側で取得する。
 *
 * ブラウザから Express API を直接 fetch せず、server-only な apiClient 経由で
 * 取得する。apiClient が cookie の access token を付与する（期限が近ければ proxy が先に更新している）。
 * 401 のときは apiClient が cookie を消してサインイン画面に送る。
 */
export const getUser = async (): Promise<GetUserResponse> =>
  apiClient.get<GetUserResponse>("/api/user")

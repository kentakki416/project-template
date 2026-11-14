import "server-only"

import type { GetUserResponse } from "@repo/api-schema"

import { apiClient } from "@/libs/api-client"

/**
 * 認証中ユーザー（自分自身）を Server 側で取得する。
 *
 * apiClient が cookie の access token を付与する。
 */
export const getUser = async (): Promise<GetUserResponse> =>
  apiClient.get<GetUserResponse>("/api/user")

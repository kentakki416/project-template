import "server-only"

import type { GetUserResponse } from "@repo/api-schema"

import { apiClient } from "@/libs/api-client"

/**
 * ログイン中のユーザー自身を取得する
 */
export const getUser = async (): Promise<GetUserResponse> =>
  apiClient.get<GetUserResponse>("/api/user")

import "server-only"

import {
  GetAdminUserListQueryString,
  GetAdminUserListResponse,
  getAdminUserListResponseSchema,
  GetAdminUserResponse,
  getAdminUserResponseSchema,
} from "@repo/api-schema"

import { apiClient } from "@/libs/api-client"

import { buildAdminUserListSearchParams } from "./user-list-params"

/**
 * ユーザー管理の API 通信層
 */
export const userApi = {
  /**
   * ユーザーの詳細。無ければ api が 404 を返し、apiClient が ApiClientError を投げる
   */
  getDetail: async (id: number): Promise<GetAdminUserResponse> => {
    const raw = await apiClient.get<unknown>(`/api/admin/users/${id}`)
    return getAdminUserResponseSchema.parse(raw)
  },

  getList: async (query: GetAdminUserListQueryString): Promise<GetAdminUserListResponse> => {
    const raw = await apiClient.get<unknown>(`/api/admin/users?${buildAdminUserListSearchParams(query)}`)
    return getAdminUserListResponseSchema.parse(raw)
  },
}

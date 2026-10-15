import "server-only"

import { GetAdminMeResponse, getAdminMeResponseSchema } from "@repo/api-schema"

import { apiClient } from "@/libs/api-client"

/**
 * admin の API 通信層
 */
export const adminApi = {
  /**
   * サインイン中の admin。api が 401 を返したら apiClient が /api/auth/signout に送る
   */
  getMe: async (): Promise<GetAdminMeResponse> => {
    const raw = await apiClient.get<unknown>("/api/admin/me")
    return getAdminMeResponseSchema.parse(raw)
  },
}

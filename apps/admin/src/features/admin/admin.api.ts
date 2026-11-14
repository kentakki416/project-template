import "server-only"

import { GetAdminMeResponse, getAdminMeResponseSchema } from "@repo/api-schema"

import { apiClient } from "@/libs/api-client"

export const adminApi = {
  getMe: async (): Promise<GetAdminMeResponse> => {
    const raw = await apiClient.get<unknown>("/api/admin/me")
    return getAdminMeResponseSchema.parse(raw)
  },
}

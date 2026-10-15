import { z } from "zod"

import { AUTH_PROVIDERS } from "@repo/domain"

/**
 * ログイン方法のスキーマ。admin の絞り込みの選択肢は `authProviderSchema.options` から作る
 */
export const authProviderSchema = z.enum(AUTH_PROVIDERS)

// ========================================================
// GET /api/admin/users - ユーザー一覧（検索・絞り込み・ページング）
// ========================================================

/**
 * ユーザー一覧のクエリ文字列スキーマ
 *
 * created_from は以上、created_before は未満。日の区切り（タイムゾーン）は呼び出し側で決め、
 * オフセット付きの ISO 8601 で渡す
 */
export const getAdminUserListQueryStringSchema = z.object({
  created_before: z.string().datetime({ offset: true }).optional(),
  created_from: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  provider: authProviderSchema.optional(),
  q: z.string().trim().max(100).optional(),
})

export type GetAdminUserListQueryString = z.infer<typeof getAdminUserListQueryStringSchema>

/**
 * ユーザー一覧のレスポンススキーマ
 */
export const getAdminUserListResponseSchema = z.object({
  page: z.number(),
  per_page: z.number(),
  total_count: z.number(),
  users: z.array(z.object({
    id: z.number(),
    avatar_url: z.string().nullable(),
    email: z.string().nullable(),
    name: z.string().nullable(),
    providers: z.array(authProviderSchema),
    created_at: z.string(),
  })),
})

export type GetAdminUserListResponse = z.infer<typeof getAdminUserListResponseSchema>

// ========================================================
// GET /api/admin/users/:id - ユーザー詳細
// ========================================================

/**
 * ユーザー詳細のパスパラメータ `:id` を検証するスキーマ
 */
export const getAdminUserPathParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export type GetAdminUserPathParam = z.infer<typeof getAdminUserPathParamSchema>

/**
 * ユーザー詳細のレスポンススキーマ。ログイン方法（auth_accounts）を紐付けた順に含む。
 * provider_account_id（Google の ID）は画面で使わないので返さない
 */
export const getAdminUserResponseSchema = z.object({
  id: z.number(),
  auth_accounts: z.array(z.object({
    provider: authProviderSchema,
    created_at: z.string(),
  })),
  avatar_url: z.string().nullable(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type GetAdminUserResponse = z.infer<typeof getAdminUserResponseSchema>

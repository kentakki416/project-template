import { z } from "zod"

import { AUTH_PROVIDERS } from "@repo/domain"

/**
 * ログイン方法のスキーマ。admin の絞り込みの選択肢は `authProviderSchema.options` から作る
 */
export const authProviderSchema = z.enum(AUTH_PROVIDERS)

export type AuthProvider = z.infer<typeof authProviderSchema>

/**
 * ユーザー一覧の 1 ページの件数の既定と上限
 */
export const ADMIN_USER_LIST_DEFAULT_PER_PAGE = 20
export const ADMIN_USER_LIST_MAX_PER_PAGE = 100

/**
 * ユーザー一覧で指定できるページ番号の上限。offset（(page - 1) × per_page）が DB の int4 の範囲をあふれないように抑える
 */
export const ADMIN_USER_LIST_MAX_PAGE = Math.floor(2_147_483_647 / ADMIN_USER_LIST_MAX_PER_PAGE)

/**
 * ユーザー一覧の検索語の最大の長さ
 */
export const ADMIN_USER_LIST_MAX_QUERY_LENGTH = 100

/**
 * ユーザー ID の上限（DB の serial = int4 の最大値）。超える値を渡すと DB のエラーになる
 */
export const ADMIN_USER_ID_MAX = 2_147_483_647

/**
 * DB の timestamp に入れられる日時か（1970 年 1 月 1 日から 9999 年 12 月 31 日まで）。
 * 0001 年などは UTC にすると 0 年になり、Postgres が受け付けない
 */
const isStorableDateTime = (value: string): boolean => {
  const time = Date.parse(value)
  return time >= Date.UTC(1970, 0, 1) && time < Date.UTC(10000, 0, 1)
}

const storableDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .refine(isStorableDateTime, { message: "1970-01-01 から 9999-12-31 の日時にする" })

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
  created_before: storableDateTimeSchema.optional(),
  created_from: storableDateTimeSchema.optional(),
  page: z.coerce.number().int().positive().max(ADMIN_USER_LIST_MAX_PAGE).default(1),
  per_page: z.coerce.number().int().min(1).max(ADMIN_USER_LIST_MAX_PER_PAGE).default(ADMIN_USER_LIST_DEFAULT_PER_PAGE),
  provider: authProviderSchema.optional(),
  q: z.string().trim().max(ADMIN_USER_LIST_MAX_QUERY_LENGTH).optional(),
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
  id: z.coerce.number().int().positive().max(ADMIN_USER_ID_MAX),
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

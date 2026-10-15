import { authProviderSchema, GetAdminUserListQueryString } from "@repo/api-schema"

import { addOneDayToDate, convertDateToStartOfDayIso } from "@/libs/date"

/**
 * ユーザー一覧の 1 ページの件数の既定（api の既定と合わせる）と選択肢
 */
export const USER_LIST_DEFAULT_PER_PAGE = 20
export const USER_LIST_PAGE_SIZE_OPTIONS = [10, 20, 50]

/**
 * 検索語の最大の長さ（api の検証と合わせる）
 */
const MAX_QUERY_LENGTH = 100

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type SearchParams = Record<string, string | string[] | undefined>

/**
 * 検索パラメータの値を 1 つの文字列にする（同じ名前が複数あれば先頭）
 */
const pickFirstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

/**
 * `YYYY-MM-DD` の形で、実在する日付か
 */
const isValidDate = (value: string | undefined): value is string =>
  value !== undefined && DATE_PATTERN.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
  && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)

const parsePositiveInt = (value: string | undefined): number | undefined => {
  const parsed = Number(value)
  return value !== undefined && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * 画面の URL の検索パラメータ（q / provider / created_from / created_to / page / per_page）を、api のクエリにする。
 *
 * - 登録日は日付（両端を含む）で受け、設定のタイムゾーンの「開始日の始まり以上・終了日の翌日の始まり未満」にする
 * - 不正な値（page=abc、存在しない provider、日付の形でない文字列）は捨てて既定値にする。
 *   URL を手で書き換えられても api の 400 にしないため
 */
export const convertSearchParamsToUserListQuery = (searchParams: SearchParams): GetAdminUserListQueryString => {
  const query = pickFirstValue(searchParams.q)?.trim()
  const provider = authProviderSchema.safeParse(pickFirstValue(searchParams.provider))
  const createdFrom = pickFirstValue(searchParams.created_from)
  const createdTo = pickFirstValue(searchParams.created_to)
  const perPage = parsePositiveInt(pickFirstValue(searchParams.per_page))

  return {
    created_before: isValidDate(createdTo) ? convertDateToStartOfDayIso(addOneDayToDate(createdTo)) : undefined,
    created_from: isValidDate(createdFrom) ? convertDateToStartOfDayIso(createdFrom) : undefined,
    page: parsePositiveInt(pickFirstValue(searchParams.page)) ?? 1,
    per_page: perPage !== undefined && USER_LIST_PAGE_SIZE_OPTIONS.includes(perPage) ? perPage : USER_LIST_DEFAULT_PER_PAGE,
    provider: provider.success ? provider.data : undefined,
    q: query && query.length <= MAX_QUERY_LENGTH ? query : undefined,
  }
}

/**
 * api のクエリを検索パラメータの文字列にする。undefined の項目は入れない。
 * URLSearchParams で組み立てる（文字列をつなぐと `+09:00` の `+` が空白として届き、api が 400 を返す）
 */
export const buildAdminUserListSearchParams = (query: GetAdminUserListQueryString): string => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  return params.toString()
}

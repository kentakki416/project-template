import {
  ADMIN_USER_ID_MAX,
  ADMIN_USER_LIST_DEFAULT_PER_PAGE,
  ADMIN_USER_LIST_MAX_PAGE,
  ADMIN_USER_LIST_MAX_QUERY_LENGTH,
  authProviderSchema,
  GetAdminUserListQueryString,
} from "@repo/api-schema"

import { addOneDayToDate, convertDateToStartOfDayIso } from "@/libs/date"

/**
 * ユーザー一覧の 1 ページの件数の選択肢
 */
export const USER_LIST_PAGE_SIZE_OPTIONS = [10, 20, 50]

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * 絞り込みに使える登録日の年の範囲。api が受け付ける日時（1970〜9999 年）に、
 * 終了日の翌日とタイムゾーンのずれを足しても収まるように 1 年ずつ内側にする
 */
const MIN_FILTER_YEAR = 1971
const MAX_FILTER_YEAR = 9998

type SearchParams = Record<string, string | string[] | undefined>

/**
 * 検索パラメータの値を 1 つの文字列にする（同じ名前が複数あれば先頭）
 */
const pickFirstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

/**
 * `YYYY-MM-DD` の形で、実在し、絞り込みに使える範囲の日付か
 */
const isValidDate = (value: string | undefined): value is string => {
  if (value === undefined || !DATE_PATTERN.test(value)) return false
  const year = Number(value.slice(0, 4))
  if (year < MIN_FILTER_YEAR || year > MAX_FILTER_YEAR) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value)
}

const POSITIVE_INT_PATTERN = /^[1-9]\d*$/

/**
 * 10 進の正の整数として読む（`1e3` や `0x10` は読まない）。読めなければ undefined
 */
const parsePositiveInt = (value: string | undefined): number | undefined => {
  if (value === undefined || !POSITIVE_INT_PATTERN.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

/**
 * 詳細の URL の `[id]` をユーザー ID にする。10 進の正の整数で、DB の ID の範囲に収まらなければ null
 */
export const convertUserIdParamToNumber = (value: string): number | null => {
  const id = parsePositiveInt(value)
  return id !== undefined && id <= ADMIN_USER_ID_MAX ? id : null
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
    page: Math.min(parsePositiveInt(pickFirstValue(searchParams.page)) ?? 1, ADMIN_USER_LIST_MAX_PAGE),
    per_page: perPage !== undefined && USER_LIST_PAGE_SIZE_OPTIONS.includes(perPage) ? perPage : ADMIN_USER_LIST_DEFAULT_PER_PAGE,
    provider: provider.success ? provider.data : undefined,
    q: query && query.length <= ADMIN_USER_LIST_MAX_QUERY_LENGTH ? query : undefined,
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

/**
 * 画面の検索パラメータの page だけを差し替えた文字列（最後のページに移すとき）
 */
export const buildUserListPageSearchParams = (searchParams: SearchParams, page: number): string => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    const first = pickFirstValue(value)
    if (first !== undefined && key !== "page") params.set(key, first)
  }
  params.set("page", String(page))
  return params.toString()
}

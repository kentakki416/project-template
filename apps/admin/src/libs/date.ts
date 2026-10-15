import { appConfig } from "@/config/app"

const dateTimeFormatter = new Intl.DateTimeFormat(appConfig.locale, {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: appConfig.timeZone,
  year: "numeric",
})

/**
 * 日時を設定のタイムゾーンの `YYYY/MM/DD HH:mm` で表示する。
 * Server Component はサーバーのタイムゾーン（本番は UTC のことが多い）で動くので、toLocaleString を直接使わない
 */
export const formatDateTime = (value: string | Date): string =>
  dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value)

const timeZoneOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: appConfig.timeZone,
  timeZoneName: "longOffset",
})

/**
 * 設定のタイムゾーンの、ある時刻での UTC からのずれ（`+09:00`）
 */
const resolveTimeZoneOffsetAt = (time: number): string => {
  const name = timeZoneOffsetFormatter
    .formatToParts(new Date(time))
    .find((part) => part.type === "timeZoneName")?.value
  /**
   * longOffset は `GMT+09:00`。UTC は `GMT` だけになる
   */
  return name?.match(/[+-]\d{2}:\d{2}/)?.[0] ?? "+00:00"
}

/**
 * `+09:00` を分（540）にする
 */
const convertOffsetToMinutes = (offset: string): number => {
  const sign = offset.startsWith("-") ? -1 : 1
  const [hours, minutes] = offset.slice(1).split(":").map(Number)
  return sign * (hours * 60 + minutes)
}

/**
 * 設定のタイムゾーンで、その日の 0 時の UTC からのずれ。
 * UTC の 0 時のずれで見当を付け、その分ずらした時刻（＝その日の 0 時の近く）でもう一度取る（夏時間の切り替わる日に 1 時間ずれないように）
 */
const resolveTimeZoneOffset = (date: string): string => {
  const utcMidnight = Date.parse(`${date}T00:00:00Z`)
  const guess = convertOffsetToMinutes(resolveTimeZoneOffsetAt(utcMidnight))
  return resolveTimeZoneOffsetAt(utcMidnight - guess * 60 * 1000)
}

/**
 * 日付（`YYYY-MM-DD`）を、設定のタイムゾーンでのその日の始まりの ISO 8601（`2026-10-01T00:00:00+09:00`）にする
 */
export const convertDateToStartOfDayIso = (date: string): string =>
  `${date}T00:00:00${resolveTimeZoneOffset(date)}`

/**
 * 日付（`YYYY-MM-DD`）の翌日の日付
 */
export const addOneDayToDate = (date: string): string => {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat(appConfig.locale, { numeric: "auto" })

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 60 * 60
const SECONDS_PER_DAY = 60 * 60 * 24
/**
 * これより前は経過時間ではなく日時で出す
 */
const RELATIVE_TIME_LIMIT_DAYS = 30

/**
 * 今からの経過時間を「5 分前」「3 時間前」「昨日」の形で出す。30 日より前は日時で出す
 */
export const formatRelativeTime = (value: string | Date, now: Date = new Date()): string => {
  const date = typeof value === "string" ? new Date(value) : value
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))
  if (seconds < SECONDS_PER_MINUTE) return relativeTimeFormatter.format(0, "second")
  if (seconds < SECONDS_PER_HOUR) return relativeTimeFormatter.format(-Math.floor(seconds / SECONDS_PER_MINUTE), "minute")
  if (seconds < SECONDS_PER_DAY) return relativeTimeFormatter.format(-Math.floor(seconds / SECONDS_PER_HOUR), "hour")
  const days = Math.floor(seconds / SECONDS_PER_DAY)
  if (days < RELATIVE_TIME_LIMIT_DAYS) return relativeTimeFormatter.format(-days, "day")
  return formatDateTime(date)
}

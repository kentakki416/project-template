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

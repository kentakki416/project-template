"use server"

import { revalidatePath } from "next/cache"

import { notificationApi } from "./notification.api"

/**
 * 通知をすべて既読にする。ヘッダーは全画面にあるので feature の actions に置く
 */
export const markAllAsReadAction = async () => {
  await notificationApi.markAllAsRead()
  revalidatePath("/", "layout")
}

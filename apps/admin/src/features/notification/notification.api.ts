import "server-only"

import { AdminNotification } from "./notification.entity"

/**
 * 通知の API 通信層
 *
 * テンプレートでは通知の元を持たないため、常に空を返す。
 * プロジェクトで通知を作るときは、ここを API の呼び出しに差し替える（画面側は変えなくてよい）
 */
export const notificationApi = {
  getList: async (): Promise<AdminNotification[]> => [],

  markAllAsRead: async (): Promise<void> => {
    /**
     * テンプレートでは既読にする通知が無い
     */
  },
}

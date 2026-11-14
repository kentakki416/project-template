/**
 * 管理画面にサインインできる人（事前登録制。users とは関係を持たない）
 */
export type Admin = {
  id: number
  avatarUrl: string | null
  /**
   * 小文字にそろえた email（normalizeEmail）
   */
  email: string
  lastSignedInAt: Date | null
  name: string | null
  createdAt: Date
  updatedAt: Date
}

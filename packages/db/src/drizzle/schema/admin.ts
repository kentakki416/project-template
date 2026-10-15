import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { timestamps } from "./columns"

/**
 * 管理画面にサインインできる人（事前登録制。users とは関係を持たない）
 *
 * 行は admin:create コマンドで作る。サインインのたびに name / avatar_url（Google のもの）と
 * last_signed_in_at を更新する
 */
export const admins = pgTable(
  "admins",
  {
    id: serial("id").primaryKey(),
    avatarUrl: text("avatar_url"),
    /**
     * Google アカウントの email。小文字にそろえて保存する（@repo/domain の normalizeEmail）
     */
    email: text("email").notNull(),
    lastSignedInAt: timestamp("last_signed_in_at", { mode: "date", precision: 3 }),
    name: text("name"),
    ...timestamps,
  },
  (table) => [uniqueIndex("admins_email_key").on(table.email)],
)

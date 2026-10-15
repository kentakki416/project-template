import { sql } from "drizzle-orm"
import { check, foreignKey, index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core"

import { AUTH_PROVIDERS } from "@repo/domain"

import { timestamps } from "./columns"
import { users } from "./user"

/**
 * 認証アカウント（複数プロバイダー対応、 (provider, providerAccountId) で一意）
 *
 * OAuth プロバイダの access_token / refresh_token 等は本アプリでは保持しない
 * （プロバイダ側で発行・管理し、アプリは取得した user info を DB に保存後は内部 JWT で完結する）。
 */
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: serial("id").primaryKey(),
    /**
     * ログイン方法。値の集合は @repo/domain の AUTH_PROVIDERS（CHECK 制約もそこから作る）
     */
    provider: text("provider", { enum: AUTH_PROVIDERS }).notNull(),
    /**
     * プロバイダー側のユーザー ID
     */
    providerAccountId: text("provider_account_id").notNull(),
    userId: integer("user_id").notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "auth_accounts_provider_check",
      sql`${table.provider} IN (${sql.join(AUTH_PROVIDERS.map((provider) => sql`${provider}`), sql`, `)})`,
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "auth_accounts_user_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("auth_accounts_user_id_idx").on(table.userId),
    uniqueIndex("auth_accounts_provider_provider_account_id_key").on(table.provider, table.providerAccountId),
  ],
)

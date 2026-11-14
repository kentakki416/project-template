import { pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core"

import { timestamps } from "./columns"

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    avatarUrl: text("avatar_url"),
    email: text("email"),
    name: text("name"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_key").on(table.email)],
)

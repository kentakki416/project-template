/* eslint-disable no-console */
import { parseArgs } from "node:util"

import { normalizeEmail } from "@repo/domain"

import { createDrizzleClient } from "../src/drizzle/client"
import { admins } from "../src/drizzle/schema"

/**
 * email として受け付ける形（空白と @ を含まない文字列 @ 空白と @ を含まない文字列）
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/

/**
 * admins に email を登録する。既にあれば何もしない（何度流しても同じ結果になる）
 *
 * 名前とアイコンは、その email の Google アカウントで初めてサインインしたときに入る。
 *
 * 使い方: pnpm --filter @repo/db admin:create --email someone@example.com
 * 本番は .github/workflows/admin-create.yml から migration イメージで流す
 */
const main = async () => {
  const { values } = parseArgs({ options: { email: { type: "string" } } })
  if (!values.email || !EMAIL_PATTERN.test(values.email)) {
    throw new Error("Usage: admin:create --email <email>")
  }
  const email = normalizeEmail(values.email)

  const db = createDrizzleClient()
  try {
    const [created] = await db
      .insert(admins)
      .values({ email })
      .onConflictDoNothing({ target: admins.email })
      .returning({ id: admins.id })
    /** Actions のログに入力の email は残るが、コマンドの出力には重ねない */
    console.log(created ? `Created admin (id=${created.id})` : "Admin already exists")
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

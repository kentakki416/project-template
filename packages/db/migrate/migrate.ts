/* eslint-disable no-console */
import { Client } from "pg"

import { buildConnectionString } from "../src/connection-string"

import { readMigrationFolders, readSchemaIndexKeys } from "./migration-folders"
import { MIGRATIONS_DIR } from "./paths"
import { runDrizzleKit } from "./run-drizzle-kit"
import { runOnlineMigrations } from "./run-online-migrations"
import { verifyMigrationFiles } from "./verify-migration-files"

/**
 * db:migrate
 *
 * 1. マイグレーションのファイルを検査する（DB に触る前に止める）
 * 2. drizzle-kit migrate で migration.sql を適用する（未適用分をまとめて 1 トランザクション）
 * 3. 未適用の online.sql を、トランザクションの外で 1 文ずつ流す
 */
const main = async (): Promise<void> => {
  const folders = await readMigrationFolders(MIGRATIONS_DIR)
  const problems = verifyMigrationFiles(folders)
  if (problems.length > 0) {
    throw new Error(`invalid migration files:\n${problems.join("\n")}`)
  }

  await runDrizzleKit("migrate", process.argv.slice(2))

  if (folders.every((folder) => folder.onlineSql === undefined)) return

  const schemaIndexKeys = await readSchemaIndexKeys(MIGRATIONS_DIR)
  const client = new Client({ connectionString: buildConnectionString() })
  await client.connect()
  try {
    const appliedFolderNames = await runOnlineMigrations(
      { query: async (sql, params) => client.query(sql, params) },
      { folders, log: (message) => console.log(`[online] ${message}`), schemaIndexKeys },
    )
    console.log(`[online] applied ${appliedFolderNames.length} online migration(s)`)
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

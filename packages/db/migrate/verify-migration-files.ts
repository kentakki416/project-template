import type { MigrationFolder } from "./migration-folders"
import { updateOnlineIndexKeys } from "./online-index-keys"
import { buildIndexKey, DEFAULT_SCHEMA, IDENTIFIER, normalizeIdentifier, splitSqlStatements } from "./online-statement"

const CONCURRENTLY_PATTERN = /\bINDEX\s+CONCURRENTLY\b/i

const INDEX_CHANGE_PATTERN = new RegExp(
  String.raw`^(DROP|ALTER)\s+INDEX\s+(IF\s+EXISTS\s+)?(?:(${IDENTIFIER})\s*\.\s*)?(${IDENTIFIER})`,
  "i",
)

/**
 * DB に触る前に、マイグレーションのファイルを検査して問題の一覧を返す（問題が無ければ空）。
 *
 * drizzle-kit は未適用の migration.sql をまとめて 1 トランザクションで流し、online.sql はその後に流れる。
 * この順序で壊れる書き方を、適用の前に止める。
 */
export const verifyMigrationFiles = (folders: MigrationFolder[]): string[] => {
  const problems: string[] = []
  const onlineIndexKeys = new Set<string>()
  for (const folder of folders) {
    for (const statement of splitSqlStatements(folder.migrationSql)) {
      if (CONCURRENTLY_PATTERN.test(statement)) {
        problems.push(
          `${folder.name}/migration.sql has an INDEX CONCURRENTLY statement, which cannot run inside a transaction. Run db:generate to move it to online.sql`,
        )
        continue
      }
      const changed = INDEX_CHANGE_PATTERN.exec(statement)
      if (!changed) continue
      const [, command, ifExists, indexSchema, indexName] = changed
      const indexKey = buildIndexKey(indexSchema ? normalizeIdentifier(indexSchema) : DEFAULT_SCHEMA, normalizeIdentifier(indexName))
      if (!onlineIndexKeys.has(indexKey)) continue
      if (command.toUpperCase() === "ALTER") {
        problems.push(
          `${folder.name}/migration.sql alters the index ${indexKey}, which is created by an earlier online.sql and does not exist yet on a fresh database. `
          + "To rename it, drop and create it instead",
        )
      } else if (!ifExists) {
        problems.push(
          `${folder.name}/migration.sql drops the index ${indexKey}, which is created by an earlier online.sql and does not exist yet on a fresh database. `
          + "Run db:generate to add IF EXISTS",
        )
      }
    }
    try {
      updateOnlineIndexKeys(onlineIndexKeys, folder.onlineSql)
    } catch (error) {
      problems.push(`${folder.name}/online.sql: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return problems
}

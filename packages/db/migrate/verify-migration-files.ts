import type { MigrationFolder } from "./migration-folders"
import { addOnlineIndexKeys } from "./online-index-keys"
import { buildIndexKey, DEFAULT_SCHEMA, IDENTIFIER, normalizeIdentifier, removeSqlComments } from "./online-statement"

const CONCURRENTLY_PATTERN = /\bINDEX\s+CONCURRENTLY\b/i

const INDEX_CHANGE_PATTERN = new RegExp(
  String.raw`\b(?:DROP|ALTER)\s+INDEX\s+(?:IF\s+EXISTS\s+)?(?:(${IDENTIFIER})\s*\.\s*)?(${IDENTIFIER})`,
  "gi",
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
    const migrationSql = removeSqlComments(folder.migrationSql)
    if (CONCURRENTLY_PATTERN.test(migrationSql)) {
      problems.push(
        `${folder.name}/migration.sql has an INDEX CONCURRENTLY statement, which cannot run inside a transaction. Run db:generate to move it to online.sql`,
      )
    }
    for (const [, indexSchema, indexName] of migrationSql.matchAll(INDEX_CHANGE_PATTERN)) {
      const indexKey = buildIndexKey(indexSchema ? normalizeIdentifier(indexSchema) : DEFAULT_SCHEMA, normalizeIdentifier(indexName))
      if (onlineIndexKeys.has(indexKey)) {
        problems.push(
          `${folder.name}/migration.sql changes the index ${indexKey}, which is created by an earlier online.sql and does not exist yet on a fresh database. `
          + "Run db:generate to move DROP INDEX to online.sql. To rename it, drop and create it instead",
        )
      }
    }
    try {
      addOnlineIndexKeys(onlineIndexKeys, folder.onlineSql)
    } catch (error) {
      problems.push(`${folder.name}/online.sql: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return problems
}

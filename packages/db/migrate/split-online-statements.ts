import { writeFile } from "node:fs/promises"
import path from "node:path"

import { MIGRATION_FILE_NAME, ONLINE_FILE_NAME, readMigrationFolders } from "./migration-folders"
import { addOnlineIndexKeys } from "./online-index-keys"
import { buildIndexKey, DEFAULT_SCHEMA, IDENTIFIER, normalizeIdentifier } from "./online-statement"

const STATEMENT_BREAKPOINT = "--> statement-breakpoint"

const MOVED_NOTICE = "-- このマイグレーションの文は、トランザクションの外で流す online.sql に移した\n"

const CREATE_INDEX_CONCURRENTLY_PATTERN = /^(CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+)(?!IF\s+NOT\s+EXISTS\s)/i

const CREATE_INDEX_CONCURRENTLY_IF_NOT_EXISTS_PATTERN = /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s/i

const DROP_INDEX_PATTERN = new RegExp(
  String.raw`^DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?((?:(${IDENTIFIER})\s*\.\s*)?(${IDENTIFIER}))\s*;?$`,
  "i",
)

type SplitResult = {
  migrationSql: string
  onlineStatements: string[]
}

const terminateStatement = (statement: string): string => (statement.endsWith(";") ? statement : `${statement};`)

const convertToOnlineStatement = (statement: string, onlineIndexKeys: Set<string>): string | undefined => {
  if (CREATE_INDEX_CONCURRENTLY_IF_NOT_EXISTS_PATTERN.test(statement)) return terminateStatement(statement)
  if (CREATE_INDEX_CONCURRENTLY_PATTERN.test(statement)) {
    return terminateStatement(statement.replace(CREATE_INDEX_CONCURRENTLY_PATTERN, "$1IF NOT EXISTS "))
  }

  const dropped = DROP_INDEX_PATTERN.exec(statement)
  if (!dropped) return undefined
  const [, qualifiedName, indexSchema, indexName] = dropped
  const indexKey = buildIndexKey(indexSchema ? normalizeIdentifier(indexSchema) : DEFAULT_SCHEMA, normalizeIdentifier(indexName))
  return onlineIndexKeys.has(indexKey) ? `DROP INDEX CONCURRENTLY IF EXISTS ${qualifiedName};` : undefined
}

/**
 * drizzle-kit が生成した migration.sql から、トランザクションの外で流す文を取り出す。
 *
 * - CREATE INDEX CONCURRENTLY: IF NOT EXISTS を付けて移す
 * - online.sql が作った index の DROP INDEX: DROP INDEX CONCURRENTLY IF EXISTS にして移す
 *   （migration.sql に残すと、空の DB では index がまだ無く失敗する）
 */
export const splitOnlineStatements = (migrationSql: string, onlineIndexKeys: Set<string>): SplitResult => {
  const keptStatements: string[] = []
  const onlineStatements: string[] = []
  for (const chunk of migrationSql.split(STATEMENT_BREAKPOINT)) {
    const statement = chunk.trim()
    if (statement.length === 0) continue
    const onlineStatement = convertToOnlineStatement(statement, onlineIndexKeys)
    if (onlineStatement) {
      onlineStatements.push(onlineStatement)
    } else {
      keptStatements.push(statement)
    }
  }
  if (onlineStatements.length === 0) return { migrationSql, onlineStatements }

  return {
    migrationSql: keptStatements.length > 0 ? `${keptStatements.join(`${STATEMENT_BREAKPOINT}\n`)}\n` : MOVED_NOTICE,
    onlineStatements,
  }
}

/**
 * すべてのフォルダの migration.sql を見て、移す文があれば online.sql に書き足す。
 * 移した後の migration.sql には移す文が残らないので、何度実行しても同じ結果になる。
 */
export const moveOnlineStatements = async (migrationsDir: string): Promise<string[]> => {
  const onlineIndexKeys = new Set<string>()
  const changedFolderNames: string[] = []
  for (const folder of await readMigrationFolders(migrationsDir)) {
    const { migrationSql, onlineStatements } = splitOnlineStatements(folder.migrationSql, onlineIndexKeys)
    let onlineSql = folder.onlineSql
    if (onlineStatements.length > 0) {
      onlineSql = `${folder.onlineSql ?? ""}${onlineStatements.join("\n")}\n`
      await writeFile(path.join(migrationsDir, folder.name, MIGRATION_FILE_NAME), migrationSql)
      await writeFile(path.join(migrationsDir, folder.name, ONLINE_FILE_NAME), onlineSql)
      changedFolderNames.push(folder.name)
    }
    addOnlineIndexKeys(onlineIndexKeys, onlineSql)
  }
  return changedFolderNames
}

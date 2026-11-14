import { writeFile } from "node:fs/promises"
import path from "node:path"

import { MIGRATION_FILE_NAME, ONLINE_FILE_NAME, readMigrationFolders } from "./migration-folders"
import { updateOnlineIndexKeys } from "./online-index-keys"
import { buildIndexKey, DEFAULT_SCHEMA, IDENTIFIER, normalizeIdentifier } from "./online-statement"

const STATEMENT_BREAKPOINT = "--> statement-breakpoint"

const MOVED_NOTICE = "-- このマイグレーションの文は、トランザクションの外で流す online.sql に移した\n"

const CREATE_INDEX_CONCURRENTLY_PATTERN = /^(CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+)(?!IF\s+NOT\s+EXISTS\s)/i

const CREATE_INDEX_CONCURRENTLY_IF_NOT_EXISTS_PATTERN = /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s/i

const DROP_INDEX_PATTERN = new RegExp(String.raw`^(DROP\s+INDEX\s+)((?:(${IDENTIFIER})\s*\.\s*)?(${IDENTIFIER}))\s*;?$`, "i")

type SplitResult = {
  migrationSql: string
  onlineStatements: string[]
}

const terminateStatement = (statement: string): string => (statement.endsWith(";") ? statement : `${statement};`)

const convertToOnlineStatement = (statement: string): string | undefined => {
  if (CREATE_INDEX_CONCURRENTLY_IF_NOT_EXISTS_PATTERN.test(statement)) return terminateStatement(statement)
  if (CREATE_INDEX_CONCURRENTLY_PATTERN.test(statement)) {
    return terminateStatement(statement.replace(CREATE_INDEX_CONCURRENTLY_PATTERN, "$1IF NOT EXISTS "))
  }
  return undefined
}

/**
 * online.sql が作った index の DROP INDEX に IF EXISTS を付ける。
 *
 * online.sql は migration.sql がすべて流れた後に流れるので、空の DB ではこの時点で index がまだ無い。
 * online.sql には移さない（同じマイグレーションが同じ名前の index を migration.sql で作り直すとき、DROP が後になって失敗する）。
 */
const addIfExistsToOnlineIndexDrop = (statement: string, onlineIndexKeys: Set<string>): string => {
  const dropped = DROP_INDEX_PATTERN.exec(statement)
  if (!dropped) return statement
  const [, dropIndex, qualifiedName, indexSchema, indexName] = dropped
  const indexKey = buildIndexKey(indexSchema ? normalizeIdentifier(indexSchema) : DEFAULT_SCHEMA, normalizeIdentifier(indexName))
  return onlineIndexKeys.has(indexKey) ? `${dropIndex}IF EXISTS ${qualifiedName};` : statement
}

/**
 * drizzle-kit が生成した migration.sql を、トランザクション内で流す文と、外で流す文（CREATE INDEX CONCURRENTLY）に分ける
 */
const splitOnlineStatements = (migrationSql: string, onlineIndexKeys: Set<string>): SplitResult => {
  const keptStatements: string[] = []
  const onlineStatements: string[] = []
  let hasRewrittenDrop = false
  for (const chunk of migrationSql.split(STATEMENT_BREAKPOINT)) {
    const statement = chunk.trim()
    if (statement.length === 0) continue
    const onlineStatement = convertToOnlineStatement(statement)
    if (onlineStatement) {
      onlineStatements.push(onlineStatement)
      continue
    }
    const keptStatement = addIfExistsToOnlineIndexDrop(statement, onlineIndexKeys)
    hasRewrittenDrop ||= keptStatement !== statement
    keptStatements.push(keptStatement)
  }
  /**
   * 書き換える文が無いファイルは 1 文字も変えない（適用済みのマイグレーションを、空白の違いだけで書き換えない）
   */
  if (onlineStatements.length === 0 && !hasRewrittenDrop) return { migrationSql, onlineStatements }

  return {
    migrationSql: keptStatements.length > 0 ? `${keptStatements.join(`${STATEMENT_BREAKPOINT}\n`)}\n` : MOVED_NOTICE,
    onlineStatements,
  }
}

/**
 * すべてのフォルダの migration.sql を見て、書き換える文があれば migration.sql と online.sql を更新する。
 * 書き換えた後の migration.sql には書き換える文が残らないので、何度実行しても同じ結果になる。
 */
export const moveOnlineStatements = async (migrationsDir: string): Promise<string[]> => {
  const onlineIndexKeys = new Set<string>()
  const changedFolderNames: string[] = []
  for (const folder of await readMigrationFolders(migrationsDir)) {
    const { migrationSql, onlineStatements } = splitOnlineStatements(folder.migrationSql, onlineIndexKeys)
    let onlineSql = folder.onlineSql
    if (migrationSql !== folder.migrationSql) {
      await writeFile(path.join(migrationsDir, folder.name, MIGRATION_FILE_NAME), migrationSql)
      changedFolderNames.push(folder.name)
    }
    if (onlineStatements.length > 0) {
      onlineSql = `${folder.onlineSql ?? ""}${onlineStatements.join("\n")}\n`
      await writeFile(path.join(migrationsDir, folder.name, ONLINE_FILE_NAME), onlineSql)
    }
    updateOnlineIndexKeys(onlineIndexKeys, onlineSql)
  }
  return changedFolderNames
}

export const forTesting = { splitOnlineStatements }

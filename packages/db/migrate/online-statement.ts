export const IDENTIFIER = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`

const QUALIFIED_NAME = String.raw`(?:(${IDENTIFIER})\s*\.\s*)?(${IDENTIFIER})`

const CREATE_INDEX_PATTERN = new RegExp(
  String.raw`^CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+(${IDENTIFIER})\s+ON\s+(?:ONLY\s+)?${QUALIFIED_NAME}[\s(]`,
  "i",
)

const DROP_INDEX_PATTERN = new RegExp(String.raw`^DROP\s+INDEX\s+CONCURRENTLY\s+IF\s+EXISTS\s+${QUALIFIED_NAME}$`, "i")

const SQL_COMMENT = /--[^\n]*|\/\*[\s\S]*?\*\//g

export const DEFAULT_SCHEMA = "public"

const INVALID_STATEMENT_MESSAGE
  = "online.sql accepts only CREATE [UNIQUE] INDEX CONCURRENTLY IF NOT EXISTS and DROP INDEX CONCURRENTLY IF EXISTS"

export type OnlineStatement = {
  indexName: string
  kind: "createIndex" | "dropIndex"
  schema: string
  sql: string
}

/**
 * 引用符の無い識別子は Postgres が小文字にたたむ
 */
export const normalizeIdentifier = (identifier: string): string =>
  identifier.startsWith("\"") ? identifier.slice(1, -1).replace(/""/g, "\"") : identifier.toLowerCase()

export const quoteIdentifier = (identifier: string): string => `"${identifier.replace(/"/g, "\"\"")}"`

export const buildIndexKey = (schema: string, indexName: string): string => `${schema}.${indexName}`

export const removeSqlComments = (sql: string): string => sql.replace(SQL_COMMENT, "")

const parseStatement = (sql: string): OnlineStatement | undefined => {
  const created = CREATE_INDEX_PATTERN.exec(sql)
  if (created) {
    const [, indexName, tableSchema] = created
    return {
      indexName: normalizeIdentifier(indexName),
      kind: "createIndex",
      schema: tableSchema ? normalizeIdentifier(tableSchema) : DEFAULT_SCHEMA,
      sql,
    }
  }
  const dropped = DROP_INDEX_PATTERN.exec(sql)
  if (dropped) {
    const [, indexSchema, indexName] = dropped
    return {
      indexName: normalizeIdentifier(indexName),
      kind: "dropIndex",
      schema: indexSchema ? normalizeIdentifier(indexSchema) : DEFAULT_SCHEMA,
      sql,
    }
  }
  return undefined
}

/**
 * 書ける文を、何度流しても同じ結果になるものに限る（途中で失敗したフォルダを、先頭から流し直せるようにするため）
 */
export const parseOnlineSql = (onlineSql: string): OnlineStatement[] => {
  const statements = removeSqlComments(onlineSql)
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)

  const invalidStatements: string[] = []
  const parsed: OnlineStatement[] = []
  for (const statement of statements) {
    const onlineStatement = parseStatement(statement)
    if (onlineStatement) {
      parsed.push(onlineStatement)
    } else {
      invalidStatements.push(statement)
    }
  }
  if (invalidStatements.length > 0) {
    throw new Error(`${INVALID_STATEMENT_MESSAGE}:\n${invalidStatements.join("\n")}`)
  }
  return parsed
}

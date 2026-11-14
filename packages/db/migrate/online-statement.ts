export const IDENTIFIER = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`

const QUALIFIED_NAME = String.raw`(?:(${IDENTIFIER})\s*\.\s*)?(${IDENTIFIER})`

const CREATE_INDEX_PATTERN = new RegExp(
  String.raw`^CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+(${IDENTIFIER})\s+ON\s+(?:ONLY\s+)?${QUALIFIED_NAME}[\s(]`,
  "i",
)

const DROP_INDEX_PATTERN = new RegExp(String.raw`^DROP\s+INDEX\s+CONCURRENTLY\s+IF\s+EXISTS\s+${QUALIFIED_NAME}$`, "i")

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

/**
 * SQL をコメントを除いた文に分ける。
 *
 * 部分 index の WHERE に書いた文字列リテラルの中の `;` や `--` を、文の区切りやコメントと取り違えないよう、
 * 引用符の中かどうかを追いながら読む。
 */
export const splitSqlStatements = (sql: string): string[] => {
  const statements: string[] = []
  let current = ""
  let position = 0
  while (position < sql.length) {
    const char = sql[position]
    if (char === "'" || char === "\"") {
      const closing = findClosingQuote(sql, position)
      current += sql.slice(position, closing + 1)
      position = closing + 1
    } else if (sql.startsWith("--", position)) {
      const lineEnd = sql.indexOf("\n", position)
      position = lineEnd === -1 ? sql.length : lineEnd
    } else if (sql.startsWith("/*", position)) {
      const commentEnd = sql.indexOf("*/", position + 2)
      position = commentEnd === -1 ? sql.length : commentEnd + 2
    } else if (char === ";") {
      statements.push(current)
      current = ""
      position += 1
    } else {
      current += char
      position += 1
    }
  }
  statements.push(current)
  return statements.map((statement) => statement.trim()).filter((statement) => statement.length > 0)
}

/**
 * 引用符の中では、同じ引用符を 2 つ続けたものが 1 文字の引用符を表す
 */
const findClosingQuote = (sql: string, openingPosition: number): number => {
  const quote = sql[openingPosition]
  let position = openingPosition + 1
  while (position < sql.length) {
    if (sql[position] !== quote) {
      position += 1
    } else if (sql[position + 1] === quote) {
      position += 2
    } else {
      return position
    }
  }
  return sql.length - 1
}

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
  const invalidStatements: string[] = []
  const parsed: OnlineStatement[] = []
  for (const statement of splitSqlStatements(onlineSql)) {
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

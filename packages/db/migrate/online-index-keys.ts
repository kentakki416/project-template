import { buildIndexKey, parseOnlineSql } from "./online-statement"

/**
 * online.sql が作った index（後の online.sql で消したものを除く）を、フォルダの順に積み上げる
 */
export const addOnlineIndexKeys = (indexKeys: Set<string>, onlineSql: string | undefined): void => {
  if (onlineSql === undefined) return
  for (const statement of parseOnlineSql(onlineSql)) {
    const indexKey = buildIndexKey(statement.schema, statement.indexName)
    if (statement.kind === "createIndex") {
      indexKeys.add(indexKey)
    } else {
      indexKeys.delete(indexKey)
    }
  }
}

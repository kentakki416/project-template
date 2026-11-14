import { buildIndexKey, parseOnlineSql } from "./online-statement"

export const updateOnlineIndexKeys = (indexKeys: Set<string>, onlineSql: string | undefined): void => {
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

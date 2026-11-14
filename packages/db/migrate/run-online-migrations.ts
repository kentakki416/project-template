import type { MigrationFolder } from "./migration-folders"
import { buildIndexKey, type OnlineStatement, parseOnlineSql, quoteIdentifier } from "./online-statement"

const HISTORY_TABLE = "\"drizzle\".\"__online_migrations\""

export type SqlExecutor = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

type RunOnlineMigrationsParams = {
  folders: MigrationFolder[]
  log: (message: string) => void
  schemaIndexKeys: Set<string>
}

const createHistoryTable = async (executor: SqlExecutor): Promise<void> => {
  await executor.query("CREATE SCHEMA IF NOT EXISTS \"drizzle\"")
  await executor.query(
    `CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} ("name" text PRIMARY KEY, "applied_at" timestamptz NOT NULL DEFAULT now())`,
  )
}

const findAppliedFolderNames = async (executor: SqlExecutor): Promise<Set<string>> => {
  const { rows } = await executor.query(`SELECT "name" FROM ${HISTORY_TABLE}`)
  return new Set(rows.map((row) => String(row.name)))
}

/**
 * index があれば有効かどうかを返す。無ければ undefined
 */
const findIndexValidity = async (executor: SqlExecutor, statement: OnlineStatement): Promise<boolean | undefined> => {
  const { rows } = await executor.query(
    `SELECT index_state.indisvalid AS valid
     FROM pg_catalog.pg_index AS index_state
     JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index_state.indexrelid
     JOIN pg_catalog.pg_namespace AS index_namespace ON index_namespace.oid = index_class.relnamespace
     WHERE index_namespace.nspname = $1 AND index_class.relname = $2`,
    [statement.schema, statement.indexName],
  )
  return rows.length > 0 ? rows[0].valid === true : undefined
}

const createIndex = async (executor: SqlExecutor, statement: OnlineStatement, log: (message: string) => void): Promise<void> => {
  const qualifiedName = `${quoteIdentifier(statement.schema)}.${quoteIdentifier(statement.indexName)}`
  /**
   * CREATE INDEX CONCURRENTLY が途中で失敗すると無効な index が残り、IF NOT EXISTS はそれを「ある」とみなして何もしない
   */
  if (await findIndexValidity(executor, statement) === false) {
    log(`dropping invalid index ${qualifiedName} left by a failed build`)
    await executor.query(`DROP INDEX CONCURRENTLY IF EXISTS ${qualifiedName}`)
  }
  await executor.query(statement.sql)
  if (await findIndexValidity(executor, statement) !== true) {
    throw new Error(`index ${qualifiedName} is not valid after: ${statement.sql}`)
  }
}

type PlannedStatement = {
  folderName: string
  shouldRun: boolean
  statement: OnlineStatement
}

/**
 * すべての online.sql の文を順に並べ、今のスキーマに収束するのに要る文だけに印を付ける。
 *
 * drizzle-kit は migration.sql を先にすべて流すので、空の DB では、古い online.sql の対象のテーブルやカラムが
 * もう無いことがある。同じ index への最後の文だけを基準にすれば、空の DB も適用済みの DB も同じ状態になる。
 *
 * - CREATE: 同じ index への最後の文で、今のスキーマにその index があるときだけ流す
 * - DROP: 後で作り直すための DROP か、今のスキーマにその index が無いときだけ流す
 */
const planStatements = (folders: MigrationFolder[], schemaIndexKeys: Set<string>): PlannedStatement[] => {
  const statements = folders.flatMap((folder) =>
    folder.onlineSql === undefined ? [] : parseOnlineSql(folder.onlineSql).map((statement) => ({ folderName: folder.name, statement })),
  )
  const lastPositionByIndexKey = new Map<string, number>()
  statements.forEach(({ statement }, position) => {
    lastPositionByIndexKey.set(buildIndexKey(statement.schema, statement.indexName), position)
  })

  return statements.map(({ folderName, statement }, position) => {
    const indexKey = buildIndexKey(statement.schema, statement.indexName)
    const isLast = lastPositionByIndexKey.get(indexKey) === position
    const isInSchema = schemaIndexKeys.has(indexKey)
    return {
      folderName,
      shouldRun: statement.kind === "createIndex" ? isLast && isInSchema : !isLast || !isInSchema,
      statement,
    }
  })
}

/**
 * 未適用の online.sql を、フォルダの名前順に、トランザクションの外で 1 文ずつ流す。
 *
 * フォルダの全文が成功したら履歴に記録する。途中で失敗したフォルダは記録されず、次の実行で先頭から流し直す
 * （どの文も何度流しても同じ結果になる）。適用したフォルダの名前を返す。
 */
export const runOnlineMigrations = async (executor: SqlExecutor, params: RunOnlineMigrationsParams): Promise<string[]> => {
  const plannedStatements = planStatements(params.folders, params.schemaIndexKeys)

  await createHistoryTable(executor)
  const appliedFolderNames = await findAppliedFolderNames(executor)

  const newlyAppliedFolderNames: string[] = []
  for (const folder of params.folders) {
    if (folder.onlineSql === undefined || appliedFolderNames.has(folder.name)) continue

    for (const { shouldRun, statement } of plannedStatements.filter((planned) => planned.folderName === folder.name)) {
      if (!shouldRun) {
        params.log(`skipped (not needed to reach the current schema): ${statement.sql}`)
        continue
      }
      params.log(`running: ${statement.sql}`)
      if (statement.kind === "createIndex") {
        await createIndex(executor, statement, params.log)
      } else {
        await executor.query(statement.sql)
      }
    }
    await executor.query(`INSERT INTO ${HISTORY_TABLE} ("name") VALUES ($1) ON CONFLICT ("name") DO NOTHING`, [folder.name])
    newlyAppliedFolderNames.push(folder.name)
  }
  return newlyAppliedFolderNames
}

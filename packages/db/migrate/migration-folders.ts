import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { buildIndexKey } from "./online-statement"

export const MIGRATION_FILE_NAME = "migration.sql"

export const ONLINE_FILE_NAME = "online.sql"

const SNAPSHOT_FILE_NAME = "snapshot.json"

export type MigrationFolder = {
  migrationSql: string
  name: string
  onlineSql: string | undefined
}

const readFileIfExists = async (filePath: string): Promise<string | undefined> =>
  readFile(filePath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })

const readFolderNames = async (migrationsDir: string): Promise<string[]> => {
  const entries = await readdir(migrationsDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/**
 * マイグレーションのフォルダを、drizzle-kit が適用するのと同じ名前順で読む
 */
export const readMigrationFolders = async (migrationsDir: string): Promise<MigrationFolder[]> => {
  const names = await readFolderNames(migrationsDir)
  return Promise.all(
    names.map(async (name) => ({
      migrationSql: await readFile(path.join(migrationsDir, name, MIGRATION_FILE_NAME), "utf8"),
      name,
      onlineSql: await readFileIfExists(path.join(migrationsDir, name, ONLINE_FILE_NAME)),
    })),
  )
}

type SnapshotEntity = {
  entityType?: unknown
  name?: unknown
  schema?: unknown
}

/**
 * 最新の snapshot.json から、今のスキーマにある index を取り出す。
 *
 * snapshot.json は drizzle-kit の内部形式なので、読めない形なら黙って空にせず止める
 */
export const readSchemaIndexKeys = async (migrationsDir: string): Promise<Set<string>> => {
  const folderNames = await readFolderNames(migrationsDir)
  const latestName = folderNames[folderNames.length - 1]
  if (!latestName) return new Set()

  const snapshotPath = path.join(migrationsDir, latestName, SNAPSHOT_FILE_NAME)
  const snapshot: { ddl?: unknown } = JSON.parse(await readFile(snapshotPath, "utf8"))
  if (!Array.isArray(snapshot.ddl)) {
    throw new Error(`unsupported snapshot format (ddl is not an array): ${snapshotPath}`)
  }

  const indexKeys = new Set<string>()
  for (const entity of snapshot.ddl as SnapshotEntity[]) {
    if (entity.entityType !== "indexes") continue
    if (typeof entity.name !== "string" || typeof entity.schema !== "string") {
      throw new Error(`unsupported snapshot format (index without name / schema): ${snapshotPath}`)
    }
    indexKeys.add(buildIndexKey(entity.schema, entity.name))
  }
  return indexKeys
}

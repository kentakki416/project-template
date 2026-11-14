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

type Snapshot = {
  id: string
  indexKeys: Set<string>
  prevIds: string[]
}

type SnapshotEntity = {
  entityType?: unknown
  name?: unknown
  schema?: unknown
}

/**
 * snapshot.json は drizzle-kit の内部形式なので、読めない形なら黙って空にせず止める
 */
const readSnapshot = async (snapshotPath: string): Promise<Snapshot> => {
  const snapshot: { ddl?: unknown, id?: unknown, prevIds?: unknown } = JSON.parse(await readFile(snapshotPath, "utf8"))
  if (typeof snapshot.id !== "string" || !Array.isArray(snapshot.prevIds) || !Array.isArray(snapshot.ddl)) {
    throw new Error(`unsupported snapshot format (id / prevIds / ddl): ${snapshotPath}`)
  }

  const indexKeys = new Set<string>()
  for (const entity of snapshot.ddl as SnapshotEntity[]) {
    if (entity.entityType !== "indexes") continue
    if (typeof entity.name !== "string" || typeof entity.schema !== "string") {
      throw new Error(`unsupported snapshot format (index without name / schema): ${snapshotPath}`)
    }
    indexKeys.add(buildIndexKey(entity.schema, entity.name))
  }
  return { id: snapshot.id, indexKeys, prevIds: snapshot.prevIds.map(String) }
}

/**
 * 今のスキーマにある index を、snapshot.json から求める。
 *
 * 名前順で最後の snapshot だけを見ると、同じ時点から別々のブランチで作ったマイグレーションが並んだとき、
 * 最後の snapshot に、もう一方のブランチで足した index が入っていない。
 * そこで、各 snapshot が親（prevIds）から増やした・減らした index を、フォルダの順に積み上げる。
 */
export const readSchemaIndexKeys = async (migrationsDir: string): Promise<Set<string>> => {
  const folderNames = await readFolderNames(migrationsDir)
  const snapshots = await Promise.all(folderNames.map(async (name) => readSnapshot(path.join(migrationsDir, name, SNAPSHOT_FILE_NAME))))
  const snapshotsById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]))

  const schemaIndexKeys = new Set<string>()
  for (const snapshot of snapshots) {
    const parentIndexKeys = new Set(snapshot.prevIds.flatMap((prevId) => [...(snapshotsById.get(prevId)?.indexKeys ?? [])]))
    for (const indexKey of parentIndexKeys) {
      if (!snapshot.indexKeys.has(indexKey)) schemaIndexKeys.delete(indexKey)
    }
    for (const indexKey of snapshot.indexKeys) {
      if (!parentIndexKeys.has(indexKey)) schemaIndexKeys.add(indexKey)
    }
  }
  return schemaIndexKeys
}

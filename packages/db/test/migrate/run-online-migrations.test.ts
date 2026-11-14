import type { MigrationFolder } from "../../migrate/migration-folders"
import { runOnlineMigrations } from "../../migrate/run-online-migrations"

import { createFakeSqlExecutor } from "./support/fake-sql-executor"

const CREATE_OWNER_INDEX = "CREATE INDEX CONCURRENTLY IF NOT EXISTS \"items_owner_id_idx\" ON \"items\" (\"owner_id\")"
const CREATE_OWNER_INDEX_V2 = "CREATE INDEX CONCURRENTLY IF NOT EXISTS \"items_owner_id_idx\" ON \"items\" (\"owner_id\",\"name\")"
const DROP_OWNER_INDEX = "DROP INDEX CONCURRENTLY IF EXISTS \"items_owner_id_idx\""
const OWNER_INDEX_KEY = "public.items_owner_id_idx"

const buildFolder = (name: string, onlineStatements?: string[]): MigrationFolder => ({
  migrationSql: "SELECT 1;",
  name,
  onlineSql: onlineStatements ? `${onlineStatements.join(";\n")};\n` : undefined,
})

const run = (fake: ReturnType<typeof createFakeSqlExecutor>, folders: MigrationFolder[], schemaIndexKeys: string[]) =>
  runOnlineMigrations(fake.executor, { folders, log: () => {}, schemaIndexKeys: new Set(schemaIndexKeys) })

describe("runOnlineMigrations", () => {
  describe("正常系", () => {
    it("未適用の online.sql を流して index を作り、履歴に記録する", async () => {
      const fake = createFakeSqlExecutor()

      const applied = await run(fake, [buildFolder("0001_init"), buildFolder("0002_add", [CREATE_OWNER_INDEX])], [OWNER_INDEX_KEY])

      expect(applied).toEqual(["0002_add"])
      expect(fake.indexStatements()).toEqual([CREATE_OWNER_INDEX])
      expect(fake.indexes.get(OWNER_INDEX_KEY)).toBe(true)
      expect([...fake.appliedFolderNames]).toEqual(["0002_add"])
    })

    it("適用済みのフォルダは流さない", async () => {
      const fake = createFakeSqlExecutor({ appliedFolderNames: ["0002_add"], indexes: { [OWNER_INDEX_KEY]: true } })

      const applied = await run(fake, [buildFolder("0002_add", [CREATE_OWNER_INDEX])], [OWNER_INDEX_KEY])

      expect(applied).toEqual([])
      expect(fake.indexStatements()).toEqual([])
    })

    it("無効な index が残っていれば、消してから作り直す", async () => {
      const fake = createFakeSqlExecutor({ indexes: { [OWNER_INDEX_KEY]: false } })

      await run(fake, [buildFolder("0002_add", [CREATE_OWNER_INDEX])], [OWNER_INDEX_KEY])

      expect(fake.indexStatements()).toEqual([
        "DROP INDEX CONCURRENTLY IF EXISTS \"public\".\"items_owner_id_idx\"",
        CREATE_OWNER_INDEX,
      ])
      expect(fake.indexes.get(OWNER_INDEX_KEY)).toBe(true)
    })

    it("空の DB では、後のマイグレーションで消した index は作らず、DROP だけを流す", async () => {
      const fake = createFakeSqlExecutor()

      const applied = await run(fake, [buildFolder("0002_add", [CREATE_OWNER_INDEX]), buildFolder("0003_drop", [DROP_OWNER_INDEX])], [])

      expect(applied).toEqual(["0002_add", "0003_drop"])
      expect(fake.indexStatements()).toEqual([DROP_OWNER_INDEX])
      expect(fake.indexes.has(OWNER_INDEX_KEY)).toBe(false)
    })

    it("テーブルごと消えて今のスキーマに無い index は、DROP の文が無くても作らない", async () => {
      const fake = createFakeSqlExecutor()

      await run(fake, [buildFolder("0002_add", [CREATE_OWNER_INDEX])], [])

      expect(fake.indexStatements()).toEqual([])
      expect([...fake.appliedFolderNames]).toEqual(["0002_add"])
    })

    it("同じ名前で作り直した index は、適用済みの DB でも空の DB でも最後の定義になる", async () => {
      const folders = [
        buildFolder("0002_add", [CREATE_OWNER_INDEX]),
        buildFolder("0003_change", [DROP_OWNER_INDEX, CREATE_OWNER_INDEX_V2]),
      ]
      const migrated = createFakeSqlExecutor({ appliedFolderNames: ["0002_add"], indexes: { [OWNER_INDEX_KEY]: true } })
      const fresh = createFakeSqlExecutor()

      await run(migrated, folders, [OWNER_INDEX_KEY])
      await run(fresh, folders, [OWNER_INDEX_KEY])

      expect(migrated.indexStatements()).toEqual([DROP_OWNER_INDEX, CREATE_OWNER_INDEX_V2])
      expect(fresh.indexStatements()).toEqual([DROP_OWNER_INDEX, CREATE_OWNER_INDEX_V2])
    })

    it("migration.sql で作り直されて今のスキーマにある index は、古い DROP で消さない", async () => {
      const fake = createFakeSqlExecutor({ indexes: { [OWNER_INDEX_KEY]: true } })

      await run(fake, [buildFolder("0002_add", [CREATE_OWNER_INDEX]), buildFolder("0003_drop", [DROP_OWNER_INDEX])], [OWNER_INDEX_KEY])

      expect(fake.indexStatements()).toEqual([])
      expect(fake.indexes.get(OWNER_INDEX_KEY)).toBe(true)
    })
  })

  describe("異常系", () => {
    it("index の作成に失敗したら throw し、そのフォルダは履歴に記録しない", async () => {
      const fake = createFakeSqlExecutor({ failingIndexKeys: [OWNER_INDEX_KEY] })

      await expect(run(fake, [buildFolder("0002_add", [CREATE_OWNER_INDEX])], [OWNER_INDEX_KEY])).rejects.toThrow("could not create unique index")

      expect([...fake.appliedFolderNames]).toEqual([])
      expect(fake.indexes.get(OWNER_INDEX_KEY)).toBe(false)
    })

    it("作成後も index が無効なら throw する", async () => {
      const fake = createFakeSqlExecutor()
      const executor = {
        query: async (sql: string, params?: unknown[]) =>
          sql.includes("pg_catalog.pg_index") ? { rows: [{ valid: false }] } : fake.executor.query(sql, params),
      }

      await expect(
        runOnlineMigrations(executor, {
          folders: [buildFolder("0002_add", [CREATE_OWNER_INDEX])],
          log: () => {},
          schemaIndexKeys: new Set([OWNER_INDEX_KEY]),
        }),
      ).rejects.toThrow("is not valid after")
      expect([...fake.appliedFolderNames]).toEqual([])
    })

    it("online.sql に書けない文があれば、DB に触る前に throw する", async () => {
      const fake = createFakeSqlExecutor()

      await expect(run(fake, [buildFolder("0002_add", ["VACUUM \"items\""])], [])).rejects.toThrow("online.sql accepts only")

      expect(fake.indexStatements()).toEqual([])
      expect([...fake.appliedFolderNames]).toEqual([])
    })
  })
})

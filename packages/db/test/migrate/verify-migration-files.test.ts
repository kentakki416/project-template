import { verifyMigrationFiles } from "../../migrate/verify-migration-files"

const CREATE_ONLINE = "CREATE INDEX CONCURRENTLY IF NOT EXISTS \"items_owner_id_idx\" ON \"items\" (\"owner_id\");\n"

describe("verifyMigrationFiles", () => {
  describe("正常系", () => {
    it("online.sql に移してあれば問題なし", () => {
      expect(
        verifyMigrationFiles([
          { migrationSql: "ALTER TABLE \"items\" ADD COLUMN \"owner_id\" integer;", name: "0001_add", onlineSql: CREATE_ONLINE },
          { migrationSql: "DROP INDEX IF EXISTS \"items_owner_id_idx\";", name: "0002_drop", onlineSql: undefined },
        ]),
      ).toEqual([])
    })

    it("online.sql で作っていない index の DROP INDEX は問題なし", () => {
      expect(
        verifyMigrationFiles([{ migrationSql: "DROP INDEX \"items_plain_idx\";", name: "0001_drop", onlineSql: undefined }]),
      ).toEqual([])
    })

    it("コメントの中の INDEX CONCURRENTLY は問題にしない", () => {
      expect(
        verifyMigrationFiles([{ migrationSql: "-- CREATE INDEX CONCURRENTLY は online.sql に移した\nSELECT 1;", name: "0001", onlineSql: undefined }]),
      ).toEqual([])
    })
  })

  describe("異常系", () => {
    it("migration.sql に INDEX CONCURRENTLY が残っていれば問題を返す", () => {
      const problems = verifyMigrationFiles([
        { migrationSql: "CREATE INDEX CONCURRENTLY \"a_idx\" ON \"items\" (\"a\");", name: "0001_add", onlineSql: undefined },
      ])

      expect(problems).toEqual([expect.stringContaining("0001_add/migration.sql has an INDEX CONCURRENTLY statement")])
    })

    it("online.sql が作った index を、後の migration.sql が IF EXISTS 無しで DROP するか、ALTER していれば問題を返す", () => {
      const problems = verifyMigrationFiles([
        { migrationSql: "SELECT 1;", name: "0001_add", onlineSql: CREATE_ONLINE },
        { migrationSql: "DROP INDEX \"items_owner_id_idx\";", name: "0002_drop", onlineSql: undefined },
        { migrationSql: "ALTER INDEX \"items_owner_id_idx\" RENAME TO \"items_owner_idx\";", name: "0003_rename", onlineSql: undefined },
      ])

      expect(problems).toEqual([
        expect.stringContaining("0002_drop/migration.sql drops the index public.items_owner_id_idx"),
        expect.stringContaining("0003_rename/migration.sql alters the index public.items_owner_id_idx"),
      ])
    })

    it("online.sql に書けない文があれば問題を返す", () => {
      const problems = verifyMigrationFiles([
        { migrationSql: "SELECT 1;", name: "0001_add", onlineSql: "CREATE INDEX \"a_idx\" ON \"items\" (\"a\");" },
      ])

      expect(problems).toEqual([expect.stringContaining("0001_add/online.sql: online.sql accepts only")])
    })
  })
})

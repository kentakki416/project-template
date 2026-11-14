import { splitOnlineStatements } from "../../migrate/split-online-statements"

describe("splitOnlineStatements", () => {
  describe("正常系", () => {
    it("CREATE INDEX CONCURRENTLY に IF NOT EXISTS を付けて取り出し、ほかの文は残す", () => {
      const migrationSql = [
        "ALTER TABLE \"items\" ADD COLUMN \"owner_id\" integer;--> statement-breakpoint",
        "CREATE INDEX CONCURRENTLY \"items_owner_id_idx\" ON \"items\" (\"owner_id\");--> statement-breakpoint",
        "CREATE UNIQUE INDEX CONCURRENTLY \"items_name_key\" ON \"items\" (\"name\");--> statement-breakpoint",
        "CREATE INDEX \"items_plain_idx\" ON \"items\" (\"name\",\"owner_id\");",
      ].join("\n")

      expect(splitOnlineStatements(migrationSql, new Set())).toEqual({
        migrationSql: [
          "ALTER TABLE \"items\" ADD COLUMN \"owner_id\" integer;--> statement-breakpoint",
          "CREATE INDEX \"items_plain_idx\" ON \"items\" (\"name\",\"owner_id\");",
          "",
        ].join("\n"),
        onlineStatements: [
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS \"items_owner_id_idx\" ON \"items\" (\"owner_id\");",
          "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS \"items_name_key\" ON \"items\" (\"name\");",
        ],
      })
    })

    it("online.sql が作った index の DROP INDEX は、DROP INDEX CONCURRENTLY IF EXISTS にして取り出す", () => {
      const migrationSql = "DROP INDEX \"items_owner_id_idx\";--> statement-breakpoint\nDROP INDEX \"items_plain_idx\";"

      expect(splitOnlineStatements(migrationSql, new Set(["public.items_owner_id_idx"]))).toEqual({
        migrationSql: "DROP INDEX \"items_plain_idx\";\n",
        onlineStatements: ["DROP INDEX CONCURRENTLY IF EXISTS \"items_owner_id_idx\";"],
      })
    })

    it("すべての文を取り出したら、migration.sql にはコメントだけを残す", () => {
      const { migrationSql } = splitOnlineStatements("CREATE INDEX CONCURRENTLY \"a_idx\" ON \"items\" (\"a\");", new Set())

      expect(migrationSql).toMatch(/^-- [^\n]+\n$/)
    })

    it("取り出す文が無ければ、migration.sql を変えない", () => {
      const migrationSql = "CREATE TABLE \"items\" (\"id\" serial PRIMARY KEY);--> statement-breakpoint\nCREATE INDEX \"a_idx\" ON \"items\" (\"id\");"

      expect(splitOnlineStatements(migrationSql, new Set())).toEqual({ migrationSql, onlineStatements: [] })
    })

    it("取り出した後の migration.sql をもう一度渡しても、何も取り出さない", () => {
      const first = splitOnlineStatements(
        "ALTER TABLE \"items\" ADD COLUMN \"a\" integer;--> statement-breakpoint\nCREATE INDEX CONCURRENTLY \"a_idx\" ON \"items\" (\"a\");",
        new Set(),
      )

      expect(splitOnlineStatements(first.migrationSql, new Set()).onlineStatements).toEqual([])
    })
  })
})

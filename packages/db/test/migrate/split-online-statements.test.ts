import { forTesting } from "../../migrate/split-online-statements"

const { splitOnlineStatements } = forTesting

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

    it("online.sql が作った index の DROP INDEX は、migration.sql に残して IF EXISTS を付ける", () => {
      const migrationSql = "DROP INDEX \"items_owner_id_idx\";--> statement-breakpoint\nDROP INDEX \"items_plain_idx\";"

      expect(splitOnlineStatements(migrationSql, new Set(["public.items_owner_id_idx"]))).toEqual({
        migrationSql: "DROP INDEX IF EXISTS \"items_owner_id_idx\";--> statement-breakpoint\nDROP INDEX \"items_plain_idx\";\n",
        onlineStatements: [],
      })
    })

    it("online.sql が作った index を .concurrently() 無しで作り直すときは、DROP と CREATE を同じ migration.sql に残す", () => {
      const migrationSql = "DROP INDEX \"items_owner_id_idx\";--> statement-breakpoint\nCREATE INDEX \"items_owner_id_idx\" ON \"items\" (\"owner_id\",\"name\");"

      expect(splitOnlineStatements(migrationSql, new Set(["public.items_owner_id_idx"]))).toEqual({
        migrationSql: "DROP INDEX IF EXISTS \"items_owner_id_idx\";--> statement-breakpoint\nCREATE INDEX \"items_owner_id_idx\" ON \"items\" (\"owner_id\",\"name\");\n",
        onlineStatements: [],
      })
    })

    it("online.sql が作った index の定義を .concurrently() のまま変えるときは、DROP を残して CREATE だけを取り出す", () => {
      const migrationSql = "DROP INDEX \"items_owner_id_idx\";--> statement-breakpoint\nCREATE INDEX CONCURRENTLY \"items_owner_id_idx\" ON \"items\" (\"owner_id\",\"name\");"

      expect(splitOnlineStatements(migrationSql, new Set(["public.items_owner_id_idx"]))).toEqual({
        migrationSql: "DROP INDEX IF EXISTS \"items_owner_id_idx\";\n",
        onlineStatements: ["CREATE INDEX CONCURRENTLY IF NOT EXISTS \"items_owner_id_idx\" ON \"items\" (\"owner_id\",\"name\");"],
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

    it("書き換える文が無ければ、空白や改行が生成時と違っていても 1 文字も変えない", () => {
      const migrationSql = "\n\nCREATE TABLE \"items\" (\n\t\"id\" serial PRIMARY KEY\n);\n--> statement-breakpoint\n\nDROP INDEX \"items_plain_idx\";\n\n\n"

      expect(splitOnlineStatements(migrationSql, new Set(["public.items_owner_id_idx"])).migrationSql).toBe(migrationSql)
    })

    it("取り出した後の migration.sql をもう一度渡しても、何も取り出さない", () => {
      const first = splitOnlineStatements(
        "ALTER TABLE \"items\" ADD COLUMN \"a\" integer;--> statement-breakpoint\nCREATE INDEX CONCURRENTLY \"a_idx\" ON \"items\" (\"a\");",
        new Set(),
      )

      expect(splitOnlineStatements(first.migrationSql, new Set())).toEqual({ migrationSql: first.migrationSql, onlineStatements: [] })
    })

    it("IF EXISTS を付けた後の migration.sql をもう一度渡しても、変えない", () => {
      const first = splitOnlineStatements("DROP INDEX \"items_owner_id_idx\";", new Set(["public.items_owner_id_idx"]))

      expect(splitOnlineStatements(first.migrationSql, new Set(["public.items_owner_id_idx"]))).toEqual({
        migrationSql: first.migrationSql,
        onlineStatements: [],
      })
    })
  })
})

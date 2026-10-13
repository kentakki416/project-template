import {
  forTesting,
  verifyMigrationFileNames,
  verifyViewsMatchCdcTables,
} from "../../../clickhouse/migrate/definition-files"

const { parseCdcTablesJson } = forTesting

describe("verifyMigrationFileNames", () => {
  describe("正常系", () => {
    it("<版番号>_<説明>.sql の連番なら問題なし", () => {
      expect(verifyMigrationFileNames(["1_create_events.sql", "2_add_column.sql"])).toEqual([])
    })

    it("版番号の飛びは許す", () => {
      expect(verifyMigrationFileNames(["1_a.sql", "3_b.sql"])).toEqual([])
    })
  })

  describe("異常系", () => {
    it("同じ版番号のファイルを重複として返す（0 埋めの有無も同じ版番号とみなす）", () => {
      expect(verifyMigrationFileNames(["1_a.sql", "001_b.sql", "2_c.sql"])).toEqual([
        "duplicate migration version 1: 001_b.sql, 1_a.sql",
      ])
    })

    it("<版番号>_ で始まらないファイルを返す", () => {
      expect(verifyMigrationFileNames(["create_events.sql", "1-a.sql"])).toEqual([
        "invalid migration file name (expected <version>_<description>.sql): 1-a.sql",
        "invalid migration file name (expected <version>_<description>.sql): create_events.sql",
      ])
    })

    it("版番号 0 を返す（clickhouse-migrations が受け付けない）", () => {
      expect(verifyMigrationFileNames(["0_a.sql"])).toEqual([
        "invalid migration file name (expected <version>_<description>.sql): 0_a.sql",
      ])
    })

    it("UInt32 に収まらない版番号を返す（タイムスタンプ形式は桁あふれする）", () => {
      expect(verifyMigrationFileNames(["20261014120000_a.sql"])).toEqual([
        "migration version exceeds UInt32 (use sequential numbers): 20261014120000_a.sql",
      ])
    })
  })
})

describe("verifyViewsMatchCdcTables", () => {
  describe("正常系", () => {
    it("CDC の対象一覧と view のファイルが 1 対 1 なら問題なし", () => {
      expect(verifyViewsMatchCdcTables(["users", "memos"], ["memos", "users"])).toEqual([])
    })
  })

  describe("異常系", () => {
    it("一覧にあって view が無いテーブルを返す", () => {
      expect(verifyViewsMatchCdcTables(["users", "memos"], ["users"])).toEqual([
        "cdc table has no view (add views/memos.sql): memos",
      ])
    })

    it("view があって一覧に無いテーブルを返す", () => {
      expect(verifyViewsMatchCdcTables(["users"], ["users", "orders"])).toEqual([
        "view has no cdc table (add it to infra/clickhouse/cdc-tables.json): orders",
      ])
    })
  })
})

describe("parseCdcTablesJson", () => {
  describe("正常系", () => {
    it("テーブル名の配列を返す", () => {
      expect(parseCdcTablesJson("[\"users\", \"memos\"]")).toEqual(["users", "memos"])
    })
  })

  describe("異常系", () => {
    it("配列でなければ throw する", () => {
      expect(() => parseCdcTablesJson("{\"tables\": []}")).toThrow()
    })

    it("SQL に埋め込めない名前（識別子として不正）なら throw する", () => {
      expect(() => parseCdcTablesJson("[\"users; DROP TABLE x\"]")).toThrow()
    })

    it("重複していれば throw する", () => {
      expect(() => parseCdcTablesJson("[\"users\", \"users\"]")).toThrow()
    })
  })
})

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { readSchemaIndexKeys } from "../../migrate/migration-folders"

type SnapshotFixture = {
  id: string
  indexNames: string[]
  name: string
  prevIds: string[]
}

let migrationsDir: string

const writeSnapshots = async (snapshots: SnapshotFixture[]): Promise<void> => {
  for (const snapshot of snapshots) {
    await mkdir(path.join(migrationsDir, snapshot.name))
    await writeFile(
      path.join(migrationsDir, snapshot.name, "snapshot.json"),
      JSON.stringify({
        ddl: [
          { entityType: "tables", name: "items", schema: "public" },
          ...snapshot.indexNames.map((indexName) => ({ entityType: "indexes", name: indexName, schema: "public", table: "items" })),
        ],
        id: snapshot.id,
        prevIds: snapshot.prevIds,
      }),
    )
  }
}

beforeEach(async () => {
  migrationsDir = await mkdtemp(path.join(tmpdir(), "online-migrations-"))
})

afterEach(async () => {
  await rm(migrationsDir, { force: true, recursive: true })
})

describe("readSchemaIndexKeys", () => {
  describe("正常系", () => {
    it("一本道の履歴では、最後の snapshot の index を返す", async () => {
      await writeSnapshots([
        { id: "a", indexNames: ["a_idx"], name: "0001_init", prevIds: ["root"] },
        { id: "b", indexNames: ["b_idx"], name: "0002_change", prevIds: ["a"] },
      ])

      expect([...await readSchemaIndexKeys(migrationsDir)]).toEqual(["public.b_idx"])
    })

    it("別々のブランチで作ったマイグレーションが並んでも、片方で足した index を落とさない", async () => {
      await writeSnapshots([
        { id: "a", indexNames: ["a_idx"], name: "0001_init", prevIds: ["root"] },
        { id: "b", indexNames: ["a_idx", "b_idx"], name: "0002_add_index", prevIds: ["a"] },
        { id: "c", indexNames: ["a_idx"], name: "0003_other_branch", prevIds: ["a"] },
      ])

      expect([...await readSchemaIndexKeys(migrationsDir)].sort()).toEqual(["public.a_idx", "public.b_idx"])
    })

    it("別々のブランチで作ったマイグレーションが並んでも、片方で消した index を残さない", async () => {
      await writeSnapshots([
        { id: "a", indexNames: ["a_idx"], name: "0001_init", prevIds: ["root"] },
        { id: "b", indexNames: [], name: "0002_drop_index", prevIds: ["a"] },
        { id: "c", indexNames: ["a_idx"], name: "0003_other_branch", prevIds: ["a"] },
      ])

      expect([...await readSchemaIndexKeys(migrationsDir)]).toEqual([])
    })

    it("フォルダが無ければ空を返す", async () => {
      expect([...await readSchemaIndexKeys(migrationsDir)]).toEqual([])
    })
  })

  describe("異常系", () => {
    it("snapshot.json が読めない形なら throw する", async () => {
      await mkdir(path.join(migrationsDir, "0001_init"))
      await writeFile(path.join(migrationsDir, "0001_init", "snapshot.json"), JSON.stringify({ tables: {} }))

      await expect(readSchemaIndexKeys(migrationsDir)).rejects.toThrow("unsupported snapshot format")
    })
  })
})

import { authAccounts, users } from "@repo/db"
import { AuthProvider } from "@repo/domain"

import { DrizzleUserRepository } from "../../src/repository/drizzle/user-repository"
import { cleanupTestData, disconnectTestDb, disconnectTestRedis, testDb } from "../controller/setup"

const userRepository = new DrizzleUserRepository(testDb)

beforeEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
  await disconnectTestRedis()
})

describe("UserRepository", () => {
  describe("正常系", () => {
    it("create したユーザーを findById / findByEmail で取得できる", async () => {
      const created = await userRepository.create({
        avatarUrl: "https://example.com/avatar.jpg",
        email: "test@example.com",
        name: "Test User",
      })

      expect(await userRepository.findById(created.id)).toEqual(created)
      expect(await userRepository.findByEmail("test@example.com")).toEqual(created)
    })

    it("省略した項目は null で保存される", async () => {
      const created = await userRepository.create({})

      expect(created).toMatchObject({ avatarUrl: null, email: null, name: null })
    })
  })

  describe("異常系", () => {
    it("存在しない id / email では null を返す", async () => {
      expect(await userRepository.findById(999999)).toBeNull()
      expect(await userRepository.findByEmail("missing@example.com")).toBeNull()
    })

    it("email が重複すると throw する", async () => {
      await userRepository.create({ email: "dup@example.com" })

      await expect(userRepository.create({ email: "dup@example.com" })).rejects.toThrow()
    })
  })
})

/**
 * 検索のテスト用にユーザーを入れる。createdAt と providers を指定できる
 */
const insertUser = async (input: { createdAt?: Date; email?: string; name?: string; providers?: AuthProvider[] }) => {
  const [row] = await testDb
    .insert(users)
    .values({ createdAt: input.createdAt, email: input.email, name: input.name })
    .returning()
  for (const provider of input.providers ?? []) {
    await testDb.insert(authAccounts).values({ provider, providerAccountId: `${provider}-${row.id}`, userId: row.id })
  }
  return row
}

const BASE_SEARCH = { limit: 20, offset: 0 }

describe("UserRepository.search", () => {
  describe("正常系", () => {
    it("query は name / email の部分一致で、大文字小文字を区別しない", async () => {
      const alice = await insertUser({ email: "alice@example.com", name: "Alice" })
      const bob = await insertUser({ email: "bob@ALICE.dev", name: "Bob" })
      await insertUser({ email: "carol@example.com", name: "Carol" })

      const result = await userRepository.search({ ...BASE_SEARCH, query: "aLiC" })

      expect(result.users.map((user) => user.id).sort()).toEqual([alice.id, bob.id].sort())
      expect(result.totalCount).toBe(2)
    })

    it("query の % _ \\ は文字そのものとして扱う", async () => {
      const percent = await insertUser({ name: "100% user" })
      const underscore = await insertUser({ name: "under_score" })
      const backslash = await insertUser({ name: "back\\slash" })
      await insertUser({ name: "100 users underXscore backslash" })

      expect((await userRepository.search({ ...BASE_SEARCH, query: "%" })).users.map((user) => user.id)).toEqual([percent.id])
      expect((await userRepository.search({ ...BASE_SEARCH, query: "_" })).users.map((user) => user.id)).toEqual([underscore.id])
      expect((await userRepository.search({ ...BASE_SEARCH, query: "\\" })).users.map((user) => user.id)).toEqual([backslash.id])
    })

    it("provider で絞ると、そのログイン方法を持つユーザーだけを返す（複数持つユーザーはどれでも出る）", async () => {
      const both = await insertUser({ name: "Both", providers: ["google", "dev"] })
      const googleOnly = await insertUser({ name: "Google", providers: ["google"] })
      const devOnly = await insertUser({ name: "Dev", providers: ["dev"] })
      await insertUser({ name: "None" })

      const google = await userRepository.search({ ...BASE_SEARCH, provider: "google" })
      const dev = await userRepository.search({ ...BASE_SEARCH, provider: "dev" })

      expect(google.users.map((user) => user.id).sort()).toEqual([both.id, googleOnly.id].sort())
      expect(dev.users.map((user) => user.id).sort()).toEqual([both.id, devOnly.id].sort())
      expect(google.totalCount).toBe(2)
    })

    it("createdFrom ちょうどは含み、createdBefore ちょうどは含まない", async () => {
      const from = new Date("2026-10-01T00:00:00.000Z")
      const before = new Date("2026-10-02T00:00:00.000Z")
      await insertUser({ createdAt: new Date(from.getTime() - 1), name: "just before from" })
      const atFrom = await insertUser({ createdAt: from, name: "at from" })
      const justBeforeEnd = await insertUser({ createdAt: new Date(before.getTime() - 1), name: "just before end" })
      await insertUser({ createdAt: before, name: "at before" })

      const result = await userRepository.search({ ...BASE_SEARCH, createdBefore: before, createdFrom: from })

      expect(result.users.map((user) => user.id)).toEqual([justBeforeEnd.id, atFrom.id])
    })

    it("新しい順に並べ、同じ作成日時は id の降順にする", async () => {
      const createdAt = new Date("2026-10-01T00:00:00.000Z")
      const older = await insertUser({ createdAt: new Date("2026-09-01T00:00:00.000Z"), name: "older" })
      const first = await insertUser({ createdAt, name: "first" })
      const second = await insertUser({ createdAt, name: "second" })

      const result = await userRepository.search(BASE_SEARCH)

      expect(result.users.map((user) => user.id)).toEqual([second.id, first.id, older.id])
    })

    it("limit / offset で 1 ページ分を返し、totalCount は絞り込み後の全件数", async () => {
      const inserted = []
      for (let i = 0; i < 5; i++) {
        inserted.push(await insertUser({ createdAt: new Date(Date.UTC(2026, 9, 1 + i)), name: `match ${i}` }))
      }
      await insertUser({ name: "other" })

      const result = await userRepository.search({ limit: 2, offset: 2, query: "match" })

      expect(result.users.map((user) => user.id)).toEqual([inserted[2].id, inserted[1].id])
      expect(result.totalCount).toBe(5)
    })

    it("範囲外のページは users が空で、totalCount はそのまま", async () => {
      await insertUser({ name: "only" })

      const result = await userRepository.search({ limit: 20, offset: 20 })

      expect(result).toEqual({ totalCount: 1, users: [] })
    })

    it("各ユーザーに紐付くログイン方法を付けて返す", async () => {
      const row = await insertUser({ email: "alice@example.com", name: "Alice", providers: ["dev", "google"] })
      const none = await insertUser({ name: "None" })

      const result = await userRepository.search(BASE_SEARCH)

      expect(result.users).toEqual([
        {
          id: none.id,
          avatarUrl: null,
          email: null,
          name: "None",
          providers: [],
          createdAt: none.createdAt,
          updatedAt: none.updatedAt,
        },
        {
          id: row.id,
          avatarUrl: null,
          email: "alice@example.com",
          name: "Alice",
          providers: ["dev", "google"],
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      ])
    })
  })

  describe("異常系", () => {
    it("該当するユーザーがいなければ空で totalCount は 0", async () => {
      await insertUser({ name: "Alice" })

      expect(await userRepository.search({ ...BASE_SEARCH, query: "nobody" })).toEqual({ totalCount: 0, users: [] })
    })
  })
})

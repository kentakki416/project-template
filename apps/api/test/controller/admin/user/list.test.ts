import request from "supertest"

import { authAccounts, users } from "@repo/db"

import { AdminUserListController } from "../../../../src/controller/admin/user/list"
import { DrizzleUserRepository } from "../../../../src/repository/drizzle/user-repository"
import { adminRouter } from "../../../../src/routes/admin-router"
import { createAdminTestApp, createTestAdmin, createTestUser } from "../../helper"
import { cleanupTestData, disconnectTestDb, disconnectTestRedis, testDb } from "../../setup"

const app = createAdminTestApp(adminRouter({ userList: new AdminUserListController(new DrizzleUserRepository(testDb)) }))

beforeEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
  await disconnectTestRedis()
})

describe("GET /api/admin/users", () => {
  describe("正常系", () => {
    it("既定（page=1 / per_page=20）で新しい順に返し、ログイン方法を付ける", async () => {
      const { token } = await createTestAdmin()
      const [older] = await testDb
        .insert(users)
        .values({ createdAt: new Date("2026-10-01T00:00:00.000Z"), email: "alice@example.com", name: "Alice" })
        .returning()
      const [newer] = await testDb
        .insert(users)
        .values({ createdAt: new Date("2026-10-02T00:00:00.000Z"), email: "bob@example.com", name: "Bob" })
        .returning()
      await testDb.insert(authAccounts).values({ provider: "google", providerAccountId: "google-1", userId: older.id })

      const res = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        page: 1,
        per_page: 20,
        total_count: 2,
        users: [
          {
            id: newer.id,
            avatar_url: null,
            email: "bob@example.com",
            name: "Bob",
            providers: [],
            created_at: "2026-10-02T00:00:00.000Z",
          },
          {
            id: older.id,
            avatar_url: null,
            email: "alice@example.com",
            name: "Alice",
            providers: ["google"],
            created_at: "2026-10-01T00:00:00.000Z",
          },
        ],
      })
    })

    it("検索語・ログイン方法・登録日（オフセット付き）で絞り込み、ページングする", async () => {
      const { token } = await createTestAdmin()
      const [inRange] = await testDb
        .insert(users)
        .values({ createdAt: new Date("2026-10-01T00:00:00+09:00"), name: "Alice in range" })
        .returning()
      const [outOfRange] = await testDb
        .insert(users)
        .values({ createdAt: new Date("2026-10-02T00:00:00+09:00"), name: "Alice out of range" })
        .returning()
      await testDb.insert(authAccounts).values([
        { provider: "dev", providerAccountId: "dev-1", userId: inRange.id },
        { provider: "dev", providerAccountId: "dev-2", userId: outOfRange.id },
      ])

      const res = await request(app)
        .get("/api/admin/users")
        .query({
          created_before: "2026-10-02T00:00:00+09:00",
          created_from: "2026-10-01T00:00:00+09:00",
          page: 1,
          per_page: 10,
          provider: "dev",
          q: "alice",
        })
        .set("Authorization", `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ page: 1, per_page: 10, total_count: 1 })
      expect(res.body.users.map((user: { id: number }) => user.id)).toEqual([inRange.id])
    })
  })

  describe("異常系", () => {
    it.each([
      ["per_page が 100 を超える", { per_page: 101 }],
      ["page が 0", { page: 0 }],
      ["provider が AUTH_PROVIDERS に無い", { provider: "github" }],
      ["日時にオフセットが無い", { created_from: "2026-10-01T00:00:00" }],
      ["page が上限を超える", { page: 10_001 }],
      ["page が指数表記の大きな値", { page: "1e20" }],
      ["日時が 1970 年より前", { created_from: "0001-01-01T00:00:00+09:00" }],
      ["日時が 9999 年より後", { created_before: "+010000-01-01T00:00:00+09:00" }],
    ])("%s は 400", async (_label, query) => {
      const { token } = await createTestAdmin()

      const res = await request(app).get("/api/admin/users").query(query).set("Authorization", `Bearer ${token}`)

      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: expect.any(String), status_code: 400 })
    })

    it("admin のトークンなしは 401", async () => {
      const res = await request(app).get("/api/admin/users")

      expect(res.status).toBe(401)
    })

    it("一般ユーザーのトークンは 401", async () => {
      const { token } = await createTestUser()

      const res = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${token}`)

      expect(res.status).toBe(401)
    })
  })
})

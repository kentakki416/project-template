import request from "supertest"

import { authAccounts } from "@repo/db"

import { AdminUserDetailController } from "../../../../src/controller/admin/user/detail"
import { DrizzleAuthAccountRepository } from "../../../../src/repository/drizzle/auth-account-repository"
import { DrizzleUserRepository } from "../../../../src/repository/drizzle/user-repository"
import { adminRouter } from "../../../../src/routes/admin-router"
import { createAdminTestApp, createTestAdmin, createTestUser } from "../../helper"
import { cleanupTestData, disconnectTestDb, disconnectTestRedis, testDb } from "../../setup"

const app = createAdminTestApp(adminRouter({
  userDetail: new AdminUserDetailController(new DrizzleUserRepository(testDb), new DrizzleAuthAccountRepository(testDb)),
}))

beforeEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
  await disconnectTestRedis()
})

describe("GET /api/admin/users/:id", () => {
  describe("正常系", () => {
    it("ユーザーの詳細とログイン方法（紐付けた順）を返す", async () => {
      const { token } = await createTestAdmin()
      const { user } = await createTestUser({ email: "alice@example.com", name: "Alice" })
      await testDb.insert(authAccounts).values([
        { createdAt: new Date("2026-10-02T00:00:00.000Z"), provider: "google", providerAccountId: "google-1", userId: user.id },
        { createdAt: new Date("2026-10-01T00:00:00.000Z"), provider: "dev", providerAccountId: "dev-1", userId: user.id },
      ])

      const res = await request(app).get(`/api/admin/users/${user.id}`).set("Authorization", `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        id: user.id,
        auth_accounts: [
          { provider: "dev", created_at: "2026-10-01T00:00:00.000Z" },
          { provider: "google", created_at: "2026-10-02T00:00:00.000Z" },
        ],
        avatar_url: "https://example.com/avatar.jpg",
        email: "alice@example.com",
        name: "Alice",
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
      })
    })
  })

  describe("異常系", () => {
    it("存在しない ID は 404", async () => {
      const { token } = await createTestAdmin()

      const res = await request(app).get("/api/admin/users/999999").set("Authorization", `Bearer ${token}`)

      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: expect.any(String), status_code: 404 })
    })

    it.each([
      ["数値でない", "abc"],
      ["int4 の上限を超える", "2147483648"],
    ])("ID が%sなら 400", async (_label, id) => {
      const { token } = await createTestAdmin()

      const res = await request(app).get(`/api/admin/users/${id}`).set("Authorization", `Bearer ${token}`)

      expect(res.status).toBe(400)
    })

    it("一般ユーザーのトークンは 401", async () => {
      const { token, user } = await createTestUser()

      const res = await request(app).get(`/api/admin/users/${user.id}`).set("Authorization", `Bearer ${token}`)

      expect(res.status).toBe(401)
    })
  })
})

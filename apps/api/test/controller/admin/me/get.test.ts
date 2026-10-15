import request from "supertest"

import { AdminMeGetController } from "../../../../src/controller/admin/me/get"
import { generateAdminAccessToken } from "../../../../src/lib/admin-jwt"
import { generateAccessToken } from "../../../../src/lib/jwt"
import { DrizzleAdminRepository } from "../../../../src/repository/drizzle/admin-repository"
import { adminRouter } from "../../../../src/routes/admin-router"
import { createAdminTestApp, createTestAdmin } from "../../helper"
import { cleanupTestData, disconnectTestDb, disconnectTestRedis, testDb } from "../../setup"

const adminRepository = new DrizzleAdminRepository(testDb)

const app = createAdminTestApp(adminRouter({ meGet: new AdminMeGetController(adminRepository) }))

beforeEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
  await disconnectTestRedis()
})

describe("GET /api/admin/me", () => {
  describe("正常系", () => {
    it("admin の access token で 200 とサインイン中の admin を返す", async () => {
      const { admin, token } = await createTestAdmin({ email: "admin@example.com", name: "Admin" })

      const res = await request(app).get("/api/admin/me").set("Authorization", `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        id: admin.id,
        avatar_url: null,
        email: "admin@example.com",
        last_signed_in_at: null,
        name: "Admin",
        created_at: expect.any(String),
      })
    })
  })

  describe("異常系", () => {
    it("トークンなしは 401", async () => {
      const res = await request(app).get("/api/admin/me")

      expect(res.status).toBe(401)
    })

    it("一般ユーザーの access token は 401（大文字のパスでもすり抜けない）", async () => {
      for (const path of ["/api/admin/me", "/API/ADMIN/me", "/Api/Admin/me"]) {
        const res = await request(app).get(path).set("Authorization", `Bearer ${generateAccessToken(1)}`)
        expect(res.status).toBe(401)
      }
    })

    it("admins から消された admin のトークンは 401", async () => {
      const res = await request(app)
        .get("/api/admin/me")
        .set("Authorization", `Bearer ${generateAdminAccessToken(999999)}`)

      expect(res.status).toBe(401)
    })
  })
})

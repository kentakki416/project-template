import request from "supertest"

import { AdminAuthRefreshController } from "../../../../src/controller/admin/auth/refresh"
import { generateAdminRefreshToken, verifyAdminRefreshToken } from "../../../../src/lib/admin-jwt"
import { generateRefreshToken } from "../../../../src/lib/jwt"
import { DrizzleAdminRepository } from "../../../../src/repository/drizzle/admin-repository"
import { IoRedisRefreshTokenRepository } from "../../../../src/repository/redis"
import { adminRouter } from "../../../../src/routes/admin-router"
import { createAdminTestApp, createTestAdmin } from "../../helper"
import {
  cleanupTestData,
  cleanupTestRedis,
  disconnectTestDb,
  disconnectTestRedis,
  testDb,
  testRedis,
} from "../../setup"

const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7

const adminRepository = new DrizzleAdminRepository(testDb)
const adminRefreshTokenRepository = new IoRedisRefreshTokenRepository(testRedis, "admin_refresh_token")
const userRefreshTokenRepository = new IoRedisRefreshTokenRepository(testRedis)

const app = createAdminTestApp(adminRouter({
  authRefresh: new AdminAuthRefreshController(adminRepository, adminRefreshTokenRepository),
}))

beforeEach(async () => {
  await cleanupTestData()
  await cleanupTestRedis()
})

afterAll(async () => {
  await cleanupTestData()
  await cleanupTestRedis()
  await disconnectTestDb()
  await disconnectTestRedis()
})

describe("POST /api/admin/auth/refresh", () => {
  describe("正常系", () => {
    it("admin の refresh token でローテーションし、旧 jti を消して新 jti を保存する", async () => {
      const { admin } = await createTestAdmin()
      const { jti: oldJti, token } = generateAdminRefreshToken(admin.id)
      await adminRefreshTokenRepository.save(oldJti, admin.id, REFRESH_TTL_SECONDS)

      const res = await request(app).post("/api/admin/auth/refresh").send({ refresh_token: token })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ access_token: expect.any(String), refresh_token: expect.any(String) })
      expect(await adminRefreshTokenRepository.findUserId(oldJti)).toBeNull()
      const newPayload = verifyAdminRefreshToken(res.body.refresh_token)
      expect(await adminRefreshTokenRepository.findUserId(newPayload!.jti)).toBe(admin.id)
    })
  })

  describe("異常系", () => {
    it("一般ユーザーの refresh token は 401", async () => {
      const { jti, token } = generateRefreshToken(1)
      await userRefreshTokenRepository.save(jti, 1, REFRESH_TTL_SECONDS)

      const res = await request(app).post("/api/admin/auth/refresh").send({ refresh_token: token })

      expect(res.status).toBe(401)
      /** 一般ユーザーの jti には触らない */
      expect(await userRefreshTokenRepository.findUserId(jti)).toBe(1)
    })

    it("admins から消された admin の refresh token は 401 で、jti を消す", async () => {
      const { jti, token } = generateAdminRefreshToken(999999)
      await adminRefreshTokenRepository.save(jti, 999999, REFRESH_TTL_SECONDS)

      const res = await request(app).post("/api/admin/auth/refresh").send({ refresh_token: token })

      expect(res.status).toBe(401)
      expect(await adminRefreshTokenRepository.findUserId(jti)).toBeNull()
    })
  })
})

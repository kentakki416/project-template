import request from "supertest"

import { GoogleOAuthClient, IGoogleOAuthClient } from "../../../src/client/google-oauth"
import { AuthGoogleController } from "../../../src/controller/auth/google"
import { AuthGoogleCallbackController } from "../../../src/controller/auth/google-callback"
import { AuthMeController } from "../../../src/controller/auth/me"
import { generateToken } from "../../../src/lib/jwt"
import { PrismaUserRepository } from "../../../src/repository/mysql/user-repository"
import { authRouter } from "../../../src/routes/auth-router"
import { createTestApp } from "../helper"
import { cleanupTestData, disconnectTestDb, testPrisma } from "../setup"

const userRepository = new PrismaUserRepository(testPrisma)

const app = createTestApp()

// Google OAuth はモック
const mockGoogleOAuthClient: IGoogleOAuthClient = {
  generateAuthUrl: jest.fn(),
  getUserInfo: jest.fn(),
}

const dummyGoogleController = new AuthGoogleController(mockGoogleOAuthClient as GoogleOAuthClient)
const dummyCallbackController = new AuthGoogleCallbackController(
  { create: jest.fn(), findByProvider: jest.fn() },
  { createUserWithAuthAccountAndUserCharacterTx: jest.fn() },
  mockGoogleOAuthClient as GoogleOAuthClient,
)

const authMeController = new AuthMeController(userRepository)

app.use("/api/auth", authRouter(dummyGoogleController, dummyCallbackController, authMeController))

beforeEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
})

describe("GET /api/auth/me", () => {
  it("認証済みユーザーの場合、200 とユーザー情報を返す", async () => {
    const user = await testPrisma.user.create({
      data: {
        avatarUrl: "https://example.com/avatar.jpg",
        email: "test@example.com",
        name: "Test User",
      },
    })

    const token = generateToken(user.id)

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(user.id)
    expect(res.body.email).toBe("test@example.com")
    expect(res.body.name).toBe("Test User")
  })

  it("ユーザーが存在しない場合、404 を返す", async () => {
    const token = generateToken(999999)

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe("User not found")
  })

  it("トークンがない場合、401 を返す", async () => {
    const res = await request(app).get("/api/auth/me")

    expect(res.status).toBe(401)
    expect(res.body.error).toBe("No token provided")
  })

  it("無効なトークンの場合、401 を返す", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token")

    expect(res.status).toBe(401)
    expect(res.body.error).toBe("Invalid or expired token")
  })
})

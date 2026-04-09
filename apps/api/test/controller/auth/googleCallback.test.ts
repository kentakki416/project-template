import request from "supertest"

import { GoogleUserInfo, IGoogleOAuthClient } from "../../../src/client/google-oauth"
import { AuthGoogleCallbackController } from "../../../src/controller/auth/google-callback"
import { PrismaUserRegistrationRepository } from "../../../src/repository/mysql/aggregate/user-registration-repository"
import { PrismaAuthAccountRepository } from "../../../src/repository/mysql/auth-account-repository"
import { authRouter } from "../../../src/routes/auth-router"
import { createTestApp } from "../helper"
import { cleanupTestData, disconnectTestDb, seedTestData, testPrisma } from "../setup"

// Google OAuth はモック
const mockGetUserInfo = jest.fn<Promise<GoogleUserInfo>, [string]>()

const mockGoogleOAuthClient: IGoogleOAuthClient = {
  generateAuthUrl: jest.fn(),
  getUserInfo: mockGetUserInfo,
}

// リポジトリは実DB
const authAccountRepository = new PrismaAuthAccountRepository(testPrisma)
const userRegistrationRepository = new PrismaUserRegistrationRepository(testPrisma)

const app = createTestApp()

const callbackController = new AuthGoogleCallbackController(
  authAccountRepository,
  userRegistrationRepository,
  mockGoogleOAuthClient,
)

app.use("/api/auth", authRouter({ callback: callbackController }))

beforeAll(async () => {
  await seedTestData()
})

beforeEach(async () => {
  await cleanupTestData()
  jest.clearAllMocks()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
})

describe("GET /api/auth/google/callback", () => {
  it("既存ユーザーの場合、200 とユーザー情報・トークンを返す", async () => {
    // テスト用のユーザーとAuthAccountをDBに作成
    const user = await testPrisma.user.create({
      data: {
        avatarUrl: "https://example.com/avatar.jpg",
        email: "test@example.com",
        name: "Test User",
      },
    })
    await testPrisma.authAccount.create({
      data: {
        provider: "google",
        providerAccountId: "google-123",
        userId: user.id,
      },
    })

    mockGetUserInfo.mockResolvedValue({
      email: "test@example.com",
      id: "google-123",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
    })

    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "auth-code" })

    expect(res.status).toBe(200)
    expect(res.body.is_new_user).toBe(false)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.id).toBe(user.id)
    expect(res.body.user.email).toBe("test@example.com")
  })

  it("新規ユーザーの場合、200 と is_new_user: true を返す", async () => {
    mockGetUserInfo.mockResolvedValue({
      email: "new@example.com",
      id: "google-456",
      name: "New User",
      picture: "https://example.com/new-avatar.jpg",
    })

    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "auth-code" })

    expect(res.status).toBe(200)
    expect(res.body.is_new_user).toBe(true)
    expect(res.body.user.email).toBe("new@example.com")

    // DBにユーザーが実際に作成されていることを確認
    const createdUser = await testPrisma.user.findUnique({
      where: { email: "new@example.com" },
    })
    expect(createdUser).not.toBeNull()
  })

  it("codeパラメータがない場合、400 を返す", async () => {
    const res = await request(app)
      .get("/api/auth/google/callback")

    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Invalid request parameters")
  })

  it("Google認証エラー時、500 を返す", async () => {
    mockGetUserInfo.mockRejectedValue(new Error("Google authentication failed"))

    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "invalid-code" })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe("Google authentication failed")
  })
})

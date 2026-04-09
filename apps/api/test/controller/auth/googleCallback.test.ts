import request from "supertest"

import { GoogleUserInfo, IGoogleOAuthClient } from "../../../src/client/google-oauth"
import { AuthGoogleCallbackController } from "../../../src/controller/auth/google-callback"
import { AuthGoogleController } from "../../../src/controller/auth/google"
import { AuthMeController } from "../../../src/controller/auth/me"
import { AuthAccountRepository } from "../../../src/repository/mysql/auth-account-repository"
import { UserRegistrationRepository } from "../../../src/repository/mysql/aggregate/user-registration-repository"
import { authRouter } from "../../../src/routes/auth-router"
import { AuthAccountWithUser, User } from "../../../src/types/domain"
import { createTestApp } from "../helper"

// モック
const mockGetUserInfo = jest.fn<Promise<GoogleUserInfo>, [string]>()
const mockFindByProvider = jest.fn<Promise<AuthAccountWithUser | null>, [string, string]>()
const mockCreateUserWithAuthAccountAndUserCharacterTx = jest.fn<Promise<User>, [any]>()

const mockGoogleOAuthClient: IGoogleOAuthClient = {
  generateAuthUrl: jest.fn(),
  getUserInfo: mockGetUserInfo,
}

const mockAuthAccountRepository: AuthAccountRepository = {
  create: jest.fn(),
  findByProvider: mockFindByProvider,
}

const mockUserRegistrationRepository: UserRegistrationRepository = {
  createUserWithAuthAccountAndUserCharacterTx: mockCreateUserWithAuthAccountAndUserCharacterTx,
}

const app = createTestApp()

const callbackController = new AuthGoogleCallbackController(
  mockAuthAccountRepository,
  mockUserRegistrationRepository,
  mockGoogleOAuthClient as any,
)

// ダミーのコントローラー
const dummyGoogleController = new AuthGoogleController(mockGoogleOAuthClient as any)
const dummyMeController = new AuthMeController(
  { create: jest.fn(), findByEmail: jest.fn(), findById: jest.fn() },
)

app.use("/api/auth", authRouter(dummyGoogleController, callbackController, dummyMeController))

describe("GET /api/auth/google/callback", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("既存ユーザーの場合、200 とユーザー情報・トークンを返す", async () => {
    const mockGoogleUser: GoogleUserInfo = {
      email: "test@example.com",
      id: "google-123",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
    }

    const mockExistingUser: User = {
      avatarUrl: "https://example.com/avatar.jpg",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      email: "test@example.com",
      id: 1,
      name: "Test User",
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    }

    const mockExistingAccount: AuthAccountWithUser = {
      accessToken: null,
      createdAt: new Date(),
      expiresAt: null,
      id: 1,
      idToken: null,
      provider: "google",
      providerAccountId: "google-123",
      refreshToken: null,
      scope: null,
      tokenType: null,
      updatedAt: new Date(),
      user: mockExistingUser,
      userId: 1,
    }

    mockGetUserInfo.mockResolvedValue(mockGoogleUser)
    mockFindByProvider.mockResolvedValue(mockExistingAccount)

    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "auth-code" })

    expect(res.status).toBe(200)
    expect(res.body.is_new_user).toBe(false)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.id).toBe(1)
    expect(res.body.user.email).toBe("test@example.com")
  })

  it("新規ユーザーの場合、200 と is_new_user: true を返す", async () => {
    const mockGoogleUser: GoogleUserInfo = {
      email: "new@example.com",
      id: "google-456",
      name: "New User",
      picture: "https://example.com/new-avatar.jpg",
    }

    const mockNewUser: User = {
      avatarUrl: "https://example.com/new-avatar.jpg",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      email: "new@example.com",
      id: 2,
      name: "New User",
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    }

    mockGetUserInfo.mockResolvedValue(mockGoogleUser)
    mockFindByProvider.mockResolvedValue(null)
    mockCreateUserWithAuthAccountAndUserCharacterTx.mockResolvedValue(mockNewUser)

    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "auth-code" })

    expect(res.status).toBe(200)
    expect(res.body.is_new_user).toBe(true)
    expect(res.body.user.id).toBe(2)
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

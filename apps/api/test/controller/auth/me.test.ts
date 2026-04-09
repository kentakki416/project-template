import request from "supertest"

import { IGoogleOAuthClient } from "../../../src/client/google-oauth"
import { AuthGoogleCallbackController } from "../../../src/controller/auth/google-callback"
import { AuthGoogleController } from "../../../src/controller/auth/google"
import { AuthMeController } from "../../../src/controller/auth/me"
import { generateToken } from "../../../src/lib/jwt"
import { UserRepository } from "../../../src/repository/mysql/user-repository"
import { authRouter } from "../../../src/routes/auth-router"
import { User } from "../../../src/types/domain"
import { createTestApp } from "../helper"

// モック
const mockFindById = jest.fn<Promise<User | null>, [number]>()

const mockUserRepository: UserRepository = {
  create: jest.fn(),
  findByEmail: jest.fn(),
  findById: mockFindById,
}

const app = createTestApp()

// ダミーのコントローラー
const mockGoogleOAuthClient: IGoogleOAuthClient = {
  generateAuthUrl: jest.fn(),
  getUserInfo: jest.fn(),
}

const dummyGoogleController = new AuthGoogleController(mockGoogleOAuthClient as any)
const dummyCallbackController = new AuthGoogleCallbackController(
  { create: jest.fn(), findByProvider: jest.fn() },
  { createUserWithAuthAccountAndUserCharacterTx: jest.fn() },
  mockGoogleOAuthClient as any,
)

const authMeController = new AuthMeController(mockUserRepository)

app.use("/api/auth", authRouter(dummyGoogleController, dummyCallbackController, authMeController))

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("認証済みユーザーの場合、200 とユーザー情報を返す", async () => {
    const mockUser: User = {
      avatarUrl: "https://example.com/avatar.jpg",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      email: "test@example.com",
      id: 1,
      name: "Test User",
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    }

    mockFindById.mockResolvedValue(mockUser)

    const token = generateToken(1)

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body.email).toBe("test@example.com")
    expect(res.body.name).toBe("Test User")
  })

  it("ユーザーが存在しない場合、404 を返す", async () => {
    mockFindById.mockResolvedValue(null)

    const token = generateToken(999)

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

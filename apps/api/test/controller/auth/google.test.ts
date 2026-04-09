import request from "supertest"

import { GoogleOAuthClient, IGoogleOAuthClient } from "../../../src/client/google-oauth"
import { AuthGoogleController } from "../../../src/controller/auth/google"
import { AuthGoogleCallbackController } from "../../../src/controller/auth/google-callback"
import { AuthMeController } from "../../../src/controller/auth/me"
import { authRouter } from "../../../src/routes/auth-router"
import { createTestApp } from "../helper"

// Google OAuth はモック
const mockGenerateAuthUrl = jest.fn<string, []>()

const mockGoogleOAuthClient: IGoogleOAuthClient = {
  generateAuthUrl: mockGenerateAuthUrl,
  getUserInfo: jest.fn(),
}

const app = createTestApp()

// ダミーのコントローラー（google.testでは使わない）
const dummyCallbackController = new AuthGoogleCallbackController(
  { create: jest.fn(), findByProvider: jest.fn() },
  { createUserWithAuthAccountAndUserCharacterTx: jest.fn() },
  mockGoogleOAuthClient as GoogleOAuthClient,
)
const dummyMeController = new AuthMeController(
  { create: jest.fn(), findByEmail: jest.fn(), findById: jest.fn() },
)

const authGoogleController = new AuthGoogleController(mockGoogleOAuthClient as GoogleOAuthClient)

app.use("/api/auth", authRouter(authGoogleController, dummyCallbackController, dummyMeController))

describe("GET /api/auth/google", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("Google認証URLにリダイレクトする", async () => {
    mockGenerateAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?test=1")

    const res = await request(app).get("/api/auth/google")

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe("https://accounts.google.com/o/oauth2/v2/auth?test=1")
  })

  it("URL生成エラー時、500 を返す", async () => {
    mockGenerateAuthUrl.mockImplementation(() => {
      throw new Error("Failed to generate URL")
    })

    const res = await request(app).get("/api/auth/google")

    expect(res.status).toBe(500)
    expect(res.body.error).toBe("Failed to generate URL")
  })
})

import { Admin } from "@repo/domain"

import { AdminRepository, RefreshTokenRepository } from "../../../src/repository"
import { refreshAdminTokens } from "../../../src/service/admin-auth-service"

const mockFindById = vi.fn<(_0: number) => Promise<Admin | null>>()
const mockAdminRepository: AdminRepository = {
  findByEmail: vi.fn(),
  findById: mockFindById,
  recordSignIn: vi.fn(),
}

const mockDelete = vi.fn<(_0: string) => Promise<void>>()
const mockFindUserId = vi.fn<(_0: string) => Promise<number | null>>()
const mockSave = vi.fn<(_0: string, _1: number, _2: number) => Promise<void>>()
const mockRefreshTokenRepository: RefreshTokenRepository = {
  delete: mockDelete,
  findUserId: mockFindUserId,
  save: mockSave,
}

const mockGenerators = {
  generateAccessToken: vi.fn((_adminId: number) => "new.access"),
  generateRefreshToken: vi.fn((_adminId: number) => ({ jti: "new-jti", token: "new.refresh" })),
}

const admin: Admin = {
  id: 3,
  avatarUrl: null,
  email: "admin@example.com",
  lastSignedInAt: null,
  name: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
}

const repo = { adminRepository: mockAdminRepository, refreshTokenRepository: mockRefreshTokenRepository }

describe("refreshAdminTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("正常系", () => {
    it("admins にいれば、旧 jti を破棄して新しいトークンを発行する", async () => {
      mockFindById.mockResolvedValue(admin)
      mockFindUserId.mockResolvedValue(3)

      const result = await refreshAdminTokens(
        { refreshToken: "valid.token" },
        repo,
        () => ({ jti: "old-jti", userId: 3 }),
        mockGenerators,
      )

      expect(result).toEqual({ ok: true, value: { accessToken: "new.access", refreshToken: "new.refresh" } })
      expect(mockDelete).toHaveBeenCalledWith("old-jti")
      expect(mockSave).toHaveBeenCalledWith("new-jti", 3, expect.any(Number))
    })
  })

  describe("異常系", () => {
    it("admins から消えていれば 401 で、jti を消してトークンを発行しない", async () => {
      mockFindById.mockResolvedValue(null)

      const result = await refreshAdminTokens(
        { refreshToken: "valid.token" },
        repo,
        () => ({ jti: "old-jti", userId: 3 }),
        mockGenerators,
      )

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.statusCode).toBe(401)
      expect(mockDelete).toHaveBeenCalledWith("old-jti")
      expect(mockSave).not.toHaveBeenCalled()
    })

    it("検証に失敗したトークンは 401（admins を引かない）", async () => {
      const result = await refreshAdminTokens({ refreshToken: "invalid" }, repo, () => null, mockGenerators)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.statusCode).toBe(401)
      expect(mockFindById).not.toHaveBeenCalled()
    })
  })
})

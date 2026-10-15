import { AuthAccount, User } from "@repo/domain"

import { AuthAccountRepository, UserRepository } from "../../../src/repository"
import { getUserDetail } from "../../../src/service/user-service"

const mockFindById = vi.fn<(_0: number) => Promise<User | null>>()
const mockUserRepository: UserRepository = {
  create: vi.fn(),
  findByEmail: vi.fn(),
  findById: mockFindById,
  search: vi.fn(),
}

const mockFindByUserId = vi.fn<(_0: number) => Promise<AuthAccount[]>>()
const mockAuthAccountRepository: AuthAccountRepository = {
  create: vi.fn(),
  findByProvider: vi.fn(),
  findByUserId: mockFindByUserId,
}

const repo = { authAccountRepository: mockAuthAccountRepository, userRepository: mockUserRepository }

const user: User = {
  id: 1,
  avatarUrl: null,
  email: "alice@example.com",
  name: "Alice",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
}

const authAccount: AuthAccount = {
  id: 10,
  provider: "google",
  providerAccountId: "google-1",
  userId: 1,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
}

describe("getUserDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("正常系", () => {
    it("ユーザーとログイン方法を返す", async () => {
      mockFindById.mockResolvedValue(user)
      mockFindByUserId.mockResolvedValue([authAccount])

      const result = await getUserDetail(1, repo)

      expect(result).toEqual({ ok: true, value: { authAccounts: [authAccount], user } })
      expect(mockFindByUserId).toHaveBeenCalledWith(1)
    })
  })

  describe("異常系", () => {
    it("存在しない ID は 404 で、ログイン方法を引かない", async () => {
      mockFindById.mockResolvedValue(null)

      const result = await getUserDetail(999, repo)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.statusCode).toBe(404)
      expect(mockFindByUserId).not.toHaveBeenCalled()
    })
  })
})

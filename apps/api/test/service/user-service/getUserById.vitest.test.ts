import { beforeEach, describe, expect, it, vi } from "vitest"

import { UserRepository } from "../../../src/repository/prisma/user-repository"
import { getUserById } from "../../../src/service/user-service"
import { User } from "../../../src/types/domain"

/**
 * POC: Vitest 移行の動作検証用テスト。
 * - jest.fn → vi.fn の置換のみで Jest 版と等価に動くか確認する
 * - user-repository が Prisma 生成コード（.js 拡張子付き import）に
 *   依存しているため、ts-jest で必要だった .js → .ts のリゾルバハック
 *   なしに Vite が解決できることを併せて検証する
 */
const mockFindById = vi.fn<(id: number) => Promise<User | null>>()

const mockUserRepository: UserRepository = {
  create: vi.fn(),
  findByEmail: vi.fn(),
  findById: mockFindById,
}

describe("getUserById (vitest poc)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ユーザーが存在する場合、ok: true とユーザー情報を返す", async () => {
    const mockUser: User = {
      avatarUrl: "https://example.com/avatar.jpg",
      createdAt: new Date(),
      email: "test@example.com",
      id: 1,
      name: "Test User",
      updatedAt: new Date(),
    }

    mockFindById.mockResolvedValue(mockUser)

    const result = await getUserById(1, { userRepository: mockUserRepository })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(mockUser)
    }
    expect(mockFindById).toHaveBeenCalledWith(1)
    expect(mockFindById).toHaveBeenCalledTimes(1)
  })

  it("ユーザーが存在しない場合、ok: false と NOT_FOUND エラーを返す", async () => {
    mockFindById.mockResolvedValue(null)

    const result = await getUserById(999, { userRepository: mockUserRepository })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe("NOT_FOUND")
      expect(result.error.statusCode).toBe(404)
    }
    expect(mockFindById).toHaveBeenCalledWith(999)
  })

  it("データベースエラー時にエラーをスローする", async () => {
    mockFindById.mockRejectedValue(new Error("Database connection failed"))

    await expect(
      getUserById(1, { userRepository: mockUserRepository })
    ).rejects.toThrow()
    expect(mockFindById).toHaveBeenCalledWith(1)
  })
})

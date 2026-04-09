import { UserRepository } from "../../../src/repository/mysql/user-repository"
import { getUserById } from "../../../src/service/user-service"
import { User } from "../../../src/types/domain"

// モック
const mockFindById = jest.fn<Promise<User | null>, [number]>()

const mockUserRepository: UserRepository = {
  create: jest.fn(),
  findByEmail: jest.fn(),
  findById: mockFindById,
}

describe("getUserById", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("ユーザーが存在する場合、ユーザー情報を返す", async () => {
    // Arrange
    const mockUser: User = {
      avatarUrl: "https://example.com/avatar.jpg",
      createdAt: new Date(),
      email: "test@example.com",
      id: 1,
      name: "Test User",
      updatedAt: new Date(),
    }

    mockFindById.mockResolvedValue(mockUser)

    // Act
    const result = await getUserById(1, mockUserRepository)

    // Assert
    expect(result).toEqual(mockUser)
    expect(mockFindById).toHaveBeenCalledWith(1)
    expect(mockFindById).toHaveBeenCalledTimes(1)
  })

  it("ユーザーが存在しない場合、nullを返す", async () => {
    // Arrange
    mockFindById.mockResolvedValue(null)

    // Act
    const result = await getUserById(999, mockUserRepository)

    // Assert
    expect(result).toBeNull()
    expect(mockFindById).toHaveBeenCalledWith(999)
    expect(mockFindById).toHaveBeenCalledTimes(1)
  })

  it("データベースエラー時にエラーをスローする", async () => {
    // Arrange
    const mockError = new Error("Database connection failed")
    mockFindById.mockRejectedValue(mockError)

    // Act & Assert
    await expect(getUserById(1, mockUserRepository)).rejects.toThrow(
      "Database connection failed"
    )
    expect(mockFindById).toHaveBeenCalledWith(1)
  })
})

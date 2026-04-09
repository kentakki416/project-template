import { MemoRepository } from "../../../src/repository/mysql/memo-repository"
import { deleteMemo } from "../../../src/service/memo-service"
import { Memo } from "../../../src/types/domain"

// モック
const mockFindById = jest.fn<Promise<Memo | null>, [number]>()
const mockDeleteById = jest.fn<Promise<void>, [number]>()

const mockMemoRepository: MemoRepository = {
  create: jest.fn(),
  deleteById: mockDeleteById,
  findAll: jest.fn(),
  findById: mockFindById,
  update: jest.fn(),
}

describe("deleteMemo", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("メモが存在する場合、削除してtrueを返す", async () => {
    // Arrange
    const existingMemo: Memo = {
      body: "Test Body",
      createdAt: new Date(),
      id: 1,
      title: "Test Title",
      updatedAt: new Date(),
    }

    mockFindById.mockResolvedValue(existingMemo)
    mockDeleteById.mockResolvedValue(undefined)

    // Act
    const result = await deleteMemo(1, mockMemoRepository)

    // Assert
    expect(result).toBe(true)
    expect(mockFindById).toHaveBeenCalledWith(1)
    expect(mockDeleteById).toHaveBeenCalledWith(1)
  })

  it("メモが存在しない場合、falseを返す", async () => {
    // Arrange
    mockFindById.mockResolvedValue(null)

    // Act
    const result = await deleteMemo(999, mockMemoRepository)

    // Assert
    expect(result).toBe(false)
    expect(mockFindById).toHaveBeenCalledWith(999)
    expect(mockDeleteById).not.toHaveBeenCalled()
  })

  it("データベースエラー時にエラーをスローする", async () => {
    // Arrange
    const mockError = new Error("Database connection failed")
    mockFindById.mockRejectedValue(mockError)

    // Act & Assert
    await expect(deleteMemo(1, mockMemoRepository)).rejects.toThrow(
      "Database connection failed"
    )
    expect(mockFindById).toHaveBeenCalledWith(1)
  })
})

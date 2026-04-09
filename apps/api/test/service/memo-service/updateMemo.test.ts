import { MemoRepository, UpdateMemoInput } from "../../../src/repository/mysql/memo-repository"
import { updateMemo } from "../../../src/service/memo-service"
import { Memo } from "../../../src/types/domain"

// モック
const mockFindById = jest.fn<Promise<Memo | null>, [number]>()
const mockUpdate = jest.fn<Promise<Memo>, [number, UpdateMemoInput]>()

const mockMemoRepository: MemoRepository = {
  create: jest.fn(),
  deleteById: jest.fn(),
  findAll: jest.fn(),
  findById: mockFindById,
  update: mockUpdate,
}

describe("updateMemo", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("メモが存在する場合、更新して返す", async () => {
    // Arrange
    const existingMemo: Memo = {
      body: "Old Body",
      createdAt: new Date(),
      id: 1,
      title: "Old Title",
      updatedAt: new Date(),
    }

    const input: UpdateMemoInput = {
      body: "Updated Body",
      title: "Updated Title",
    }

    const updatedMemo: Memo = {
      body: "Updated Body",
      createdAt: existingMemo.createdAt,
      id: 1,
      title: "Updated Title",
      updatedAt: new Date(),
    }

    mockFindById.mockResolvedValue(existingMemo)
    mockUpdate.mockResolvedValue(updatedMemo)

    // Act
    const result = await updateMemo(1, input, mockMemoRepository)

    // Assert
    expect(result).toEqual(updatedMemo)
    expect(mockFindById).toHaveBeenCalledWith(1)
    expect(mockUpdate).toHaveBeenCalledWith(1, input)
  })

  it("メモが存在しない場合、nullを返す", async () => {
    // Arrange
    const input: UpdateMemoInput = {
      body: "Updated Body",
      title: "Updated Title",
    }

    mockFindById.mockResolvedValue(null)

    // Act
    const result = await updateMemo(999, input, mockMemoRepository)

    // Assert
    expect(result).toBeNull()
    expect(mockFindById).toHaveBeenCalledWith(999)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("データベースエラー時にエラーをスローする", async () => {
    // Arrange
    const input: UpdateMemoInput = {
      body: "Updated Body",
      title: "Updated Title",
    }

    const mockError = new Error("Database connection failed")
    mockFindById.mockRejectedValue(mockError)

    // Act & Assert
    await expect(updateMemo(1, input, mockMemoRepository)).rejects.toThrow(
      "Database connection failed"
    )
    expect(mockFindById).toHaveBeenCalledWith(1)
  })
})

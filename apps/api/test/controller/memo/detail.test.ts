import request from "supertest"

import { MemoCreateController } from "../../../src/controller/memo/create"
import { MemoDeleteController } from "../../../src/controller/memo/delete"
import { MemoDetailController } from "../../../src/controller/memo/detail"
import { MemoListController } from "../../../src/controller/memo/list"
import { MemoUpdateController } from "../../../src/controller/memo/update"
import { MemoRepository } from "../../../src/repository/mysql/memo-repository"
import { memoRouter } from "../../../src/routes/memo-router"
import { Memo } from "../../../src/types/domain"
import { createTestApp } from "../helper"

// モック
const mockFindById = jest.fn<Promise<Memo | null>, [number]>()

const mockMemoRepository: MemoRepository = {
  create: jest.fn(),
  deleteById: jest.fn(),
  findAll: jest.fn(),
  findById: mockFindById,
  update: jest.fn(),
}

const app = createTestApp()

app.use(
  "/api/memo",
  memoRouter(
    new MemoListController(mockMemoRepository),
    new MemoDetailController(mockMemoRepository),
    new MemoCreateController(mockMemoRepository),
    new MemoUpdateController(mockMemoRepository),
    new MemoDeleteController(mockMemoRepository),
  ),
)

describe("GET /api/memo/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("200 とメモ詳細を返す", async () => {
    const mockMemo: Memo = {
      body: "Test Body",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      id: 1,
      title: "Test Title",
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    }

    mockFindById.mockResolvedValue(mockMemo)

    const res = await request(app).get("/api/memo/1")

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body.title).toBe("Test Title")
    expect(res.body.body).toBe("Test Body")
  })

  it("メモが存在しない場合、404 を返す", async () => {
    mockFindById.mockResolvedValue(null)

    const res = await request(app).get("/api/memo/999")

    expect(res.status).toBe(404)
    expect(res.body.error).toBe("Memo not found")
  })

  it("無効なID形式の場合、400 を返す", async () => {
    const res = await request(app).get("/api/memo/abc")

    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Invalid memo ID")
  })
})

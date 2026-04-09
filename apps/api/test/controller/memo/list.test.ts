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
const mockFindAll = jest.fn<Promise<Memo[]>, []>()

const mockMemoRepository: MemoRepository = {
  create: jest.fn(),
  deleteById: jest.fn(),
  findAll: mockFindAll,
  findById: jest.fn(),
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

describe("GET /api/memo", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("200 とメモ一覧を返す", async () => {
    const mockMemos: Memo[] = [
      {
        body: "Body 1",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        id: 1,
        title: "Title 1",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      },
      {
        body: "Body 2",
        createdAt: new Date("2024-01-02T00:00:00.000Z"),
        id: 2,
        title: "Title 2",
        updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      },
    ]

    mockFindAll.mockResolvedValue(mockMemos)

    const res = await request(app).get("/api/memo")

    expect(res.status).toBe(200)
    expect(res.body.memos).toHaveLength(2)
    expect(res.body.memos[0].id).toBe(1)
    expect(res.body.memos[0].title).toBe("Title 1")
    expect(res.body.memos[1].id).toBe(2)
  })

  it("メモが存在しない場合、200 と空配列を返す", async () => {
    mockFindAll.mockResolvedValue([])

    const res = await request(app).get("/api/memo")

    expect(res.status).toBe(200)
    expect(res.body.memos).toEqual([])
  })

  it("サービスエラー時、500 を返す", async () => {
    mockFindAll.mockRejectedValue(new Error("Database error"))

    const res = await request(app).get("/api/memo")

    expect(res.status).toBe(500)
    expect(res.body.error).toBe("Database error")
  })
})

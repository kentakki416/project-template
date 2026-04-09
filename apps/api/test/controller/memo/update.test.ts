import request from "supertest"

import { MemoCreateController } from "../../../src/controller/memo/create"
import { MemoDeleteController } from "../../../src/controller/memo/delete"
import { MemoDetailController } from "../../../src/controller/memo/detail"
import { MemoListController } from "../../../src/controller/memo/list"
import { MemoUpdateController } from "../../../src/controller/memo/update"
import { MemoRepository, UpdateMemoInput } from "../../../src/repository/mysql/memo-repository"
import { memoRouter } from "../../../src/routes/memo-router"
import { Memo } from "../../../src/types/domain"
import { createTestApp } from "../helper"

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

describe("PUT /api/memo/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("200 と更新されたメモを返す", async () => {
    const existingMemo: Memo = {
      body: "Old Body",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      id: 1,
      title: "Old Title",
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    }

    const updatedMemo: Memo = {
      body: "Updated Body",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      id: 1,
      title: "Updated Title",
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
    }

    mockFindById.mockResolvedValue(existingMemo)
    mockUpdate.mockResolvedValue(updatedMemo)

    const res = await request(app)
      .put("/api/memo/1")
      .send({ body: "Updated Body", title: "Updated Title" })

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body.title).toBe("Updated Title")
    expect(res.body.body).toBe("Updated Body")
  })

  it("メモが存在しない場合、404 を返す", async () => {
    mockFindById.mockResolvedValue(null)

    const res = await request(app)
      .put("/api/memo/999")
      .send({ body: "Updated Body", title: "Updated Title" })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe("Memo not found")
  })

  it("無効なID形式の場合、400 を返す", async () => {
    const res = await request(app)
      .put("/api/memo/abc")
      .send({ body: "Updated Body", title: "Updated Title" })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Invalid memo ID")
  })

  it("リクエストボディが不正な場合、400 を返す", async () => {
    const res = await request(app)
      .put("/api/memo/1")
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })
})

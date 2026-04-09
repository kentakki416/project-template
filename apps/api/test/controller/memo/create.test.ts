import request from "supertest"

import { MemoCreateController } from "../../../src/controller/memo/create"
import { MemoDeleteController } from "../../../src/controller/memo/delete"
import { MemoDetailController } from "../../../src/controller/memo/detail"
import { MemoListController } from "../../../src/controller/memo/list"
import { MemoUpdateController } from "../../../src/controller/memo/update"
import { CreateMemoInput, MemoRepository } from "../../../src/repository/mysql/memo-repository"
import { memoRouter } from "../../../src/routes/memo-router"
import { Memo } from "../../../src/types/domain"
import { createTestApp } from "../helper"

// モック
const mockCreate = jest.fn<Promise<Memo>, [CreateMemoInput]>()

const mockMemoRepository: MemoRepository = {
  create: mockCreate,
  deleteById: jest.fn(),
  findAll: jest.fn(),
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

describe("POST /api/memo", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("201 と作成されたメモを返す", async () => {
    const mockMemo: Memo = {
      body: "New Body",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      id: 1,
      title: "New Title",
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    }

    mockCreate.mockResolvedValue(mockMemo)

    const res = await request(app)
      .post("/api/memo")
      .send({ body: "New Body", title: "New Title" })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe(1)
    expect(res.body.title).toBe("New Title")
    expect(res.body.body).toBe("New Body")
  })

  it("リクエストボディが不正な場合、400 を返す", async () => {
    const res = await request(app)
      .post("/api/memo")
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it("titleが空の場合、400 を返す", async () => {
    const res = await request(app)
      .post("/api/memo")
      .send({ body: "Body", title: "" })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })
})

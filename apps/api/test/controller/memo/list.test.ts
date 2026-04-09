import request from "supertest"

import { MemoCreateController } from "../../../src/controller/memo/create"
import { MemoDeleteController } from "../../../src/controller/memo/delete"
import { MemoDetailController } from "../../../src/controller/memo/detail"
import { MemoListController } from "../../../src/controller/memo/list"
import { MemoUpdateController } from "../../../src/controller/memo/update"
import { PrismaMemoRepository } from "../../../src/repository/mysql/memo-repository"
import { memoRouter } from "../../../src/routes/memo-router"
import { createTestApp } from "../helper"
import { cleanupTestData, disconnectTestDb, testPrisma } from "../setup"

const memoRepository = new PrismaMemoRepository(testPrisma)

const app = createTestApp()

app.use(
  "/api/memo",
  memoRouter(
    new MemoListController(memoRepository),
    new MemoDetailController(memoRepository),
    new MemoCreateController(memoRepository),
    new MemoUpdateController(memoRepository),
    new MemoDeleteController(memoRepository),
  ),
)

beforeEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
})

describe("GET /api/memo", () => {
  it("200 とメモ一覧を返す", async () => {
    await testPrisma.memo.createMany({
      data: [
        { body: "Body 1", title: "Title 1" },
        { body: "Body 2", title: "Title 2" },
      ],
    })

    const res = await request(app).get("/api/memo")

    expect(res.status).toBe(200)
    expect(res.body.memos).toHaveLength(2)
  })

  it("メモが存在しない場合、200 と空配列を返す", async () => {
    const res = await request(app).get("/api/memo")

    expect(res.status).toBe(200)
    expect(res.body.memos).toEqual([])
  })
})

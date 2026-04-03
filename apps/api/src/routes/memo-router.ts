import { Router } from "express"

import { MemoCreateController } from "../controller/memo/create"
import { MemoDeleteController } from "../controller/memo/delete"
import { MemoDetailController } from "../controller/memo/detail"
import { MemoListController } from "../controller/memo/list"
import { MemoUpdateController } from "../controller/memo/update"

/**
 * メモ関連のルーター
 */
export const memoRouter = (
  memoListController: MemoListController,
  memoDetailController: MemoDetailController,
  memoCreateController: MemoCreateController,
  memoUpdateController: MemoUpdateController,
  memoDeleteController: MemoDeleteController,
): Router => {
  const router = Router()

  // GET /api/memo
  router.get("/", async (req, res) => memoListController.execute(req, res))

  // GET /api/memo/:id
  router.get("/:id", async (req, res) => memoDetailController.execute(req, res))

  // POST /api/memo
  router.post("/", async (req, res) => memoCreateController.execute(req, res))

  // PUT /api/memo/:id
  router.put("/:id", async (req, res) => memoUpdateController.execute(req, res))

  // DELETE /api/memo/:id
  router.delete("/:id", async (req, res) => memoDeleteController.execute(req, res))

  return router
}

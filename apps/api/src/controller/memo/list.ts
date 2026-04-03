import { Request, Response } from "express"

import { ErrorResponse, getMemoListResponseSchema } from "@repo/api-schema"

import { logger } from "../../log"
import { MemoRepository } from "../../repository/mysql"
import * as service from "../../service"

/**
 * メモ一覧取得API
 */
export class MemoListController {
  constructor(private memoRepository: MemoRepository) {}

  async execute(_req: Request, res: Response) {
    try {
      const memos = await service.memo.getAllMemos(this.memoRepository)

      const response = getMemoListResponseSchema.parse({
        memos: memos.map((memo) => ({
          body: memo.body,
          created_at: memo.createdAt.toISOString(),
          id: memo.id,
          title: memo.title,
          updated_at: memo.updatedAt.toISOString(),
        })),
      })

      res.status(200).json(response)
    } catch (error) {
      logger.error(
        "MemoListController: Failed to get memos",
        error instanceof Error ? error : new Error("Unknown error")
      )
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : "Failed to get memos",
        status_code: 500,
      }
      res.status(500).json(errorResponse)
    }
  }
}

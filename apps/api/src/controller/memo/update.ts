import { Request, Response } from "express"

import { ErrorResponse, updateMemoRequestSchema, updateMemoResponseSchema } from "@repo/api-schema"

import { logger } from "../../log"
import { MemoRepository } from "../../repository/mysql"
import * as service from "../../service"

/**
 * メモ更新API
 */
export class MemoUpdateController {
  constructor(private memoRepository: MemoRepository) {}

  async execute(req: Request, res: Response) {
    try {
      const id = Number(req.params.id)

      if (isNaN(id)) {
        const errorResponse: ErrorResponse = {
          error: "Invalid memo ID",
          status_code: 400,
        }
        return res.status(400).json(errorResponse)
      }

      const data = updateMemoRequestSchema.parse(req.body)

      const memo = await service.memo.updateMemo(id, data, this.memoRepository)

      if (!memo) {
        const errorResponse: ErrorResponse = {
          error: "Memo not found",
          status_code: 404,
        }
        return res.status(404).json(errorResponse)
      }

      const response = updateMemoResponseSchema.parse({
        body: memo.body,
        created_at: memo.createdAt.toISOString(),
        id: memo.id,
        title: memo.title,
        updated_at: memo.updatedAt.toISOString(),
      })

      res.status(200).json(response)
    } catch (error) {
      logger.error(
        "MemoUpdateController: Failed to update memo",
        error instanceof Error ? error : new Error("Unknown error")
      )
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : "Failed to update memo",
        status_code: 400,
      }
      res.status(400).json(errorResponse)
    }
  }
}

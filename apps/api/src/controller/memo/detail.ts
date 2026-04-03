import { Request, Response } from "express"

import { ErrorResponse, getMemoRequestSchema, getMemoResponseSchema } from "@repo/api-schema"

import { logger } from "../../log"
import { MemoRepository } from "../../repository/mysql"
import * as service from "../../service"

/**
 * メモ詳細取得API
 */
export class MemoDetailController {
  constructor(private memoRepository: MemoRepository) {}

  async execute(req: Request, res: Response) {
    try {
      const params = getMemoRequestSchema.parse({ id: req.params.id })
      const id = Number(params.id)

      if (isNaN(id)) {
        const errorResponse: ErrorResponse = {
          error: "Invalid memo ID",
          status_code: 400,
        }
        return res.status(400).json(errorResponse)
      }

      const memo = await service.memo.getMemoById(id, this.memoRepository)

      if (!memo) {
        const errorResponse: ErrorResponse = {
          error: "Memo not found",
          status_code: 404,
        }
        return res.status(404).json(errorResponse)
      }

      const response = getMemoResponseSchema.parse({
        body: memo.body,
        created_at: memo.createdAt.toISOString(),
        id: memo.id,
        title: memo.title,
        updated_at: memo.updatedAt.toISOString(),
      })

      res.status(200).json(response)
    } catch (error) {
      logger.error(
        "MemoDetailController: Failed to get memo",
        error instanceof Error ? error : new Error("Unknown error")
      )
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : "Failed to get memo",
        status_code: 500,
      }
      res.status(500).json(errorResponse)
    }
  }
}

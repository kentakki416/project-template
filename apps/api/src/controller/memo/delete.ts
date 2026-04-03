import { Request, Response } from "express"

import { deleteMemoResponseSchema, ErrorResponse } from "@repo/api-schema"

import { logger } from "../../log"
import { MemoRepository } from "../../repository/mysql"
import * as service from "../../service"

/**
 * メモ削除API
 */
export class MemoDeleteController {
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

      const deleted = await service.memo.deleteMemo(id, this.memoRepository)

      if (!deleted) {
        const errorResponse: ErrorResponse = {
          error: "Memo not found",
          status_code: 404,
        }
        return res.status(404).json(errorResponse)
      }

      const response = deleteMemoResponseSchema.parse({
        message: "Memo deleted successfully",
      })

      res.status(200).json(response)
    } catch (error) {
      logger.error(
        "MemoDeleteController: Failed to delete memo",
        error instanceof Error ? error : new Error("Unknown error")
      )
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : "Failed to delete memo",
        status_code: 500,
      }
      res.status(500).json(errorResponse)
    }
  }
}

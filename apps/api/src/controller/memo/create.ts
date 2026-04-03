import { Request, Response } from "express"

import { createMemoRequestSchema, createMemoResponseSchema, ErrorResponse } from "@repo/api-schema"

import { logger } from "../../log"
import { MemoRepository } from "../../repository/mysql"
import * as service from "../../service"

/**
 * メモ作成API
 */
export class MemoCreateController {
  constructor(private memoRepository: MemoRepository) {}

  async execute(req: Request, res: Response) {
    try {
      const data = createMemoRequestSchema.parse(req.body)

      const memo = await service.memo.createMemo(data, this.memoRepository)

      const response = createMemoResponseSchema.parse({
        body: memo.body,
        created_at: memo.createdAt.toISOString(),
        id: memo.id,
        title: memo.title,
        updated_at: memo.updatedAt.toISOString(),
      })

      res.status(201).json(response)
    } catch (error) {
      logger.error(
        "MemoCreateController: Failed to create memo",
        error instanceof Error ? error : new Error("Unknown error")
      )
      const errorResponse: ErrorResponse = {
        error: error instanceof Error ? error.message : "Failed to create memo",
        status_code: 400,
      }
      res.status(400).json(errorResponse)
    }
  }
}

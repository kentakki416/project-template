import type { Request, Response } from "express"

import { ErrorResponse } from "@repo/api-schema"
import { ApiError } from "@repo/errors"
import { logger } from "@repo/logger"

/**
 * Controller が res.status().json() を直接書くとログを書き忘れるので、業務エラーはここを通して返す
 */
export const sendError = (req: Request, res: Response, error: ApiError) => {
  logger.warn("API business error", {
    method: req.method,
    path: req.path,
    statusCode: error.statusCode,
    type: error.type,
  })
  const errorResponse: ErrorResponse = {
    error: error.message,
    status_code: error.statusCode,
  }
  return res.status(error.statusCode).json(errorResponse)
}

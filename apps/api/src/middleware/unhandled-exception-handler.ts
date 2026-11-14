import { NextFunction, Request, Response } from "express"

import { ErrorResponse } from "@repo/api-schema"
import { logger } from "@repo/logger"

import { RequestSchemaMismatchError, ResponseSchemaMismatchError } from "../lib/parse-schema"

/**
 * Express は引数が 4 つのミドルウェアをエラーハンドラとして扱うので、呼ばない next も受け取る
 */
export const unhandledExceptionHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  /**
   * レスポンスを送信済みなら、二重に送らないように何もしない
   */
  if (res.headersSent) {
    return
  }

  if (err instanceof RequestSchemaMismatchError) {
    logger.warn("Request validation error", {
      issues: err.zodError.issues,
      method: req.method,
      path: req.path,
    })
    const errorResponse: ErrorResponse = {
      error: "Invalid request",
      status_code: 400,
    }
    return res.status(400).json(errorResponse)
  }

  if (err instanceof ResponseSchemaMismatchError) {
    logger.error("Response schema mismatch", err, {
      issues: err.zodError.issues,
      method: req.method,
      path: req.path,
    })
    const errorResponse: ErrorResponse = {
      error: "Internal Server Error",
      status_code: 500,
    }
    return res.status(500).json(errorResponse)
  }

  /**
   * Service が外部 API のレスポンスを Zod で検証して投げる素の ZodError も、ここで 500 にする
   */
  logger.error(
    "Unhandled exception",
    err instanceof Error ? err : new Error(String(err)),
    {
      method: req.method,
      path: req.path,
    }
  )

  const errorResponse: ErrorResponse = {
    error: "Internal Server Error",
    status_code: 500,
  }
  res.status(500).json(errorResponse)
}

import { NextFunction, Request, Response } from "express"

import { ErrorResponse } from "@repo/api-schema"
import { logContext } from "@repo/logger"

import { ADMIN_PUBLIC_PATHS } from "../const"
import { verifyAdminAccessToken } from "../lib/admin-jwt"
import { isPathUnderPrefix } from "../lib/is-path-under-prefix"

export interface AdminAuthRequest extends Request {
  adminId?: number
}

/**
 * admin の Access Token で認証する。
 *
 * index.ts で `app.use(ADMIN_PATH_PREFIX, adminAuthMiddleware, adminRouter(...))` と mount の中に置く。
 * 全体に適用して req.path で判定すると、Express 5 が大文字小文字を区別せずに Router に渡す
 * `/API/Admin/users` のようなパスで、認証の判定だけがすり抜けるため。
 * ここでの req.path は mount からの相対（/auth/google など）。
 *
 * user のトークンは鍵が違うので verifyAdminAccessToken で必ず失敗する。
 */
export const adminAuthMiddleware = (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  if (ADMIN_PUBLIC_PATHS.some(p => isPathUnderPrefix(req.path, p))) {
    return next()
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    const errorResponse: ErrorResponse = { error: "No token provided", status_code: 401 }
    return res.status(401).json(errorResponse)
  }

  const payload = verifyAdminAccessToken(authHeader.substring(7))
  if (!payload) {
    const errorResponse: ErrorResponse = { error: "Invalid or expired token", status_code: 401 }
    return res.status(401).json(errorResponse)
  }

  req.adminId = payload.adminId
  /**
   * requestLogger は全体に掛かっていて、ここより先に動く（userId しか積めない）。
   * 以降のログに adminId が付くよう、今のログのコンテキストに足して続きを動かす
   */
  return logContext.run({ ...logContext.getStore(), adminId: payload.adminId }, () => next())
}

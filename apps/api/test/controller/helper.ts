import express from "express"

import { authMiddleware } from "../../src/middleware/auth"

/**
 * テスト用Expressアプリを構築する
 * 本番と同じミドルウェア構成を再現する
 */
export const createTestApp = (): express.Express => {
  const app = express()
  app.use(express.json())
  app.use(authMiddleware)
  return app
}

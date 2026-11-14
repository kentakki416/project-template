import type { NextFunction, Request, Response } from "express"

import { unhandledExceptionHandler } from "../../src/middleware/unhandled-exception-handler"

const buildRequest = (): Request => ({ method: "GET", path: "/test" }) as Request

const buildResponse = (headersSent: boolean) => {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))
  return { json, res: { headersSent, status } as unknown as Response, status }
}

describe("unhandledExceptionHandler", () => {
  describe("正常系", () => {
    it("レスポンスを送信済みなら、何も書かずに Express の既定のエラーハンドラへ渡す", () => {
      const { res, status } = buildResponse(true)
      const next: NextFunction = vi.fn()
      const error = new Error("stream failed")

      unhandledExceptionHandler(error, buildRequest(), res, next)

      expect(next).toHaveBeenCalledWith(error)
      expect(status).not.toHaveBeenCalled()
    })

    it("レスポンスを送信していなければ 500 を返し、next は呼ばない", () => {
      const { json, res, status } = buildResponse(false)
      const next: NextFunction = vi.fn()

      unhandledExceptionHandler(new Error("db down"), buildRequest(), res, next)

      expect(status).toHaveBeenCalledWith(500)
      expect(json).toHaveBeenCalledWith({ error: "Internal Server Error", status_code: 500 })
      expect(next).not.toHaveBeenCalled()
    })
  })
})

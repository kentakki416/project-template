import express from "express"
import request from "supertest"

import { LoggerFactory } from "@repo/logger"

import { unhandledExceptionHandler } from "../../src/middleware/unhandled-exception-handler"

const buildApp = (): express.Express => {
  const app = express()
  app.get("/before-send", () => {
    throw new Error("db down")
  })
  app.get("/while-sending", (_req, res) => {
    res.status(200).write("partial")
    throw new Error("stream failed")
  })
  app.get("/after-send", (_req, res) => {
    res.status(200).json({ ok: true })
    throw new Error("after response")
  })
  app.use(unhandledExceptionHandler)
  return app
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("unhandledExceptionHandler", () => {
  describe("正常系", () => {
    it("レスポンスを送る前の例外は 500 を返す", async () => {
      const res = await request(buildApp()).get("/before-send")

      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: "Internal Server Error", status_code: 500 })
    })

    it("レスポンスを送っている途中の例外は、ログに残して接続を切る", async () => {
      const error = vi.spyOn(LoggerFactory.getLogger(), "error")

      await expect(request(buildApp()).get("/while-sending")).rejects.toThrow()

      expect(error).toHaveBeenCalledWith(
        "Unhandled exception after the response started",
        expect.objectContaining({ message: "stream failed" }),
        { method: "GET", path: "/while-sending" },
      )
    })

    it("レスポンスを送り終えた後の例外は、ログに残すだけで、返したレスポンスと接続はそのままにする", async () => {
      const error = vi.spyOn(LoggerFactory.getLogger(), "error")
      const agent = request.agent(buildApp())

      const first = await agent.get("/after-send")
      const second = await agent.get("/after-send")

      expect(first.status).toBe(200)
      expect(first.body).toEqual({ ok: true })
      expect(second.status).toBe(200)
      expect(error).toHaveBeenCalledWith(
        "Unhandled exception after the response started",
        expect.objectContaining({ message: "after response" }),
        { method: "GET", path: "/after-send" },
      )
    })
  })
})

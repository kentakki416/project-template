import express, { Router } from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

import { generateAdminAccessToken } from "../../src/lib/admin-jwt"
import { generateAccessToken } from "../../src/lib/jwt"
import { AdminAuthRequest } from "../../src/middleware/admin-auth"
import { createAdminTestApp } from "../controller/helper"

/**
 * adminAuthMiddleware を通ったら adminId を返すだけの Router
 */
const echoRouter = Router()
echoRouter.all(/.*/, (req: AdminAuthRequest, res: express.Response) => {
  res.status(200).json({ adminId: req.adminId ?? null })
})

const app = createAdminTestApp(echoRouter)

describe("adminAuthMiddleware", () => {
  describe("正常系", () => {
    it("admin の access token なら通し、adminId を付ける", async () => {
      const res = await request(app)
        .get("/api/admin/me")
        .set("Authorization", `Bearer ${generateAdminAccessToken(7)}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ adminId: 7 })
    })

    it("ADMIN_PUBLIC_PATHS はトークンなしで通す（大文字小文字と末尾の / の違いを含む）", async () => {
      for (const path of [
        "/api/admin/auth/google",
        "/api/admin/auth/refresh",
        "/api/admin/auth/logout",
        "/API/Admin/Auth/Google",
        "/api/admin/auth/google/",
      ]) {
        const res = await request(app).post(path)
        expect(res.status).toBe(200)
      }
    })
  })

  describe("異常系", () => {
    it("トークンなしは 401", async () => {
      const res = await request(app).get("/api/admin/me")

      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: expect.any(String), status_code: 401 })
    })

    it("一般ユーザーの access token は 401", async () => {
      const res = await request(app)
        .get("/api/admin/me")
        .set("Authorization", `Bearer ${generateAccessToken(1)}`)

      expect(res.status).toBe(401)
    })

    it("大文字のパスでも一般ユーザーの access token は 401（判定をすり抜けない）", async () => {
      for (const path of ["/API/ADMIN/me", "/Api/Admin/me"]) {
        const res = await request(app)
          .get(path)
          .set("Authorization", `Bearer ${generateAccessToken(1)}`)
        expect(res.status).toBe(401)
      }
    })

    it("admin の鍵で署名されていても payload に adminId が無ければ 401", async () => {
      const token = jwt.sign({ userId: 1 }, process.env.JWT_ADMIN_ACCESS_SECRET!, { expiresIn: "15m" })

      const res = await request(app)
        .get("/api/admin/me")
        .set("Authorization", `Bearer ${token}`)

      expect(res.status).toBe(401)
    })

    it("admin の鍵で署名されていても payload に jti があれば（refresh token の形なら）401", async () => {
      const token = jwt.sign({ adminId: 7, jti: "jti" }, process.env.JWT_ADMIN_ACCESS_SECRET!, { expiresIn: "15m" })

      const res = await request(app)
        .get("/api/admin/me")
        .set("Authorization", `Bearer ${token}`)

      expect(res.status).toBe(401)
    })

    it("公開パスに文字や下の階層を足したパスは公開扱いにしない", async () => {
      for (const path of ["/api/admin/auth/google-foo", "/api/admin/auth/google/callback"]) {
        const res = await request(app).post(path)
        expect(res.status).toBe(401)
      }
    })
  })
})

import { Express, Router } from "express"

import { ADMIN_PATH_PREFIX } from "../const"
import { AdminAuthDevLoginController } from "../controller/admin/auth/dev-login"
import { AdminAuthGoogleController } from "../controller/admin/auth/google"
import { AdminAuthLogoutController } from "../controller/admin/auth/logout"
import { AdminAuthRefreshController } from "../controller/admin/auth/refresh"
import { AdminMeGetController } from "../controller/admin/me/get"
import { adminAuthMiddleware } from "../middleware/admin-auth"

type AdminRouterControllers = {
  authDevLogin?: AdminAuthDevLoginController
  authGoogle?: AdminAuthGoogleController
  authLogout?: AdminAuthLogoutController
  authRefresh?: AdminAuthRefreshController
  meGet?: AdminMeGetController
}

/**
 * admin の API のルーター（/api/admin に mount する）
 * 認証は mount の中の adminAuthMiddleware が済ませている。渡されたコントローラーのルートのみ登録する
 */
export const adminRouter = (controllers: AdminRouterControllers): Router => {
  const router = Router()

  /** POST /api/admin/auth/google */
  if (controllers.authGoogle) {
    const controller = controllers.authGoogle
    router.post("/auth/google", async (req, res) => controller.execute(req, res))
  }

  /**
   * POST /api/admin/auth/dev-login（NODE_ENV !== "production" のみ）
   * index.ts で本番時は controllers.authDevLogin に undefined を渡すため、ルート自体が登録されない
   */
  if (controllers.authDevLogin) {
    const controller = controllers.authDevLogin
    router.post("/auth/dev-login", async (req, res) => controller.execute(req, res))
  }

  /** POST /api/admin/auth/refresh（ADMIN_PUBLIC_PATHS に含まれるため admin の認証不要） */
  if (controllers.authRefresh) {
    const controller = controllers.authRefresh
    router.post("/auth/refresh", async (req, res) => controller.execute(req, res))
  }

  /** POST /api/admin/auth/logout（ADMIN_PUBLIC_PATHS に含まれる。refresh token で本人を確かめる） */
  if (controllers.authLogout) {
    const controller = controllers.authLogout
    router.post("/auth/logout", async (req, res) => controller.execute(req, res))
  }

  /** GET /api/admin/me */
  if (controllers.meGet) {
    const controller = controllers.meGet
    router.get("/me", async (req, res) => controller.execute(req, res))
  }

  return router
}

/**
 * admin の API を /api/admin に mount する。index.ts とテストで同じ組み方にするため、ここにまとめる。
 *
 * adminAuthMiddleware は全体ではなく mount の中に置く。Express 5 の mount は大文字小文字を区別しないので、
 * 全体に適用して文字列で比べると /API/Admin/... が認証の判定をすり抜けて Router に届くため。ここなら Router の前に必ず通る
 */
export const mountAdminApi = (app: Express, router: Router): void => {
  app.use(ADMIN_PATH_PREFIX, adminAuthMiddleware, router)
}

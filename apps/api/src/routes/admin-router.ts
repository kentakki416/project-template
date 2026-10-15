import { Router } from "express"

import { AdminAuthDevLoginController } from "../controller/admin/auth/dev-login"
import { AdminAuthGoogleController } from "../controller/admin/auth/google"
import { AdminAuthLogoutController } from "../controller/admin/auth/logout"
import { AdminAuthRefreshController } from "../controller/admin/auth/refresh"
import { AdminMeGetController } from "../controller/admin/me/get"

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

import { Express, Router } from "express"

import { ADMIN_PATH_PREFIX } from "../const"
import { AdminAuthDevLoginController } from "../controller/admin/auth/dev-login"
import { AdminAuthGoogleController } from "../controller/admin/auth/google"
import { AdminAuthLogoutController } from "../controller/admin/auth/logout"
import { AdminAuthRefreshController } from "../controller/admin/auth/refresh"
import { AdminMeGetController } from "../controller/admin/me/get"
import { AdminUserDetailController } from "../controller/admin/user/detail"
import { AdminUserListController } from "../controller/admin/user/list"
import { adminAuthMiddleware } from "../middleware/admin-auth"

type AdminRouterControllers = {
  authDevLogin?: AdminAuthDevLoginController
  authGoogle?: AdminAuthGoogleController
  authLogout?: AdminAuthLogoutController
  authRefresh?: AdminAuthRefreshController
  meGet?: AdminMeGetController
  userDetail?: AdminUserDetailController
  userList?: AdminUserListController
}

/**
 * admin の API のルーター
 * 渡されたコントローラーのルートのみ登録する
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
   */
  if (controllers.authDevLogin) {
    const controller = controllers.authDevLogin
    router.post("/auth/dev-login", async (req, res) => controller.execute(req, res))
  }

  /** POST /api/admin/auth/refresh */
  if (controllers.authRefresh) {
    const controller = controllers.authRefresh
    router.post("/auth/refresh", async (req, res) => controller.execute(req, res))
  }

  /** POST /api/admin/auth/logout */
  if (controllers.authLogout) {
    const controller = controllers.authLogout
    router.post("/auth/logout", async (req, res) => controller.execute(req, res))
  }

  /** GET /api/admin/me */
  if (controllers.meGet) {
    const controller = controllers.meGet
    router.get("/me", async (req, res) => controller.execute(req, res))
  }

  /** GET /api/admin/users */
  if (controllers.userList) {
    const controller = controllers.userList
    router.get("/users", async (req, res) => controller.execute(req, res))
  }

  /** GET /api/admin/users/:id */
  if (controllers.userDetail) {
    const controller = controllers.userDetail
    router.get("/users/:id", async (req, res) => controller.execute(req, res))
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

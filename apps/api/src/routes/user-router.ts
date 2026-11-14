import { Router } from "express"

import { UserGetController } from "../controller/user/get"

type UserRouterControllers = {
  get?: UserGetController
}

export const userRouter = (controllers: UserRouterControllers): Router => {
  const router = Router()

  if (controllers.get) {
    const controller = controllers.get
    router.get("/", async (req, res) => controller.execute(req, res))
  }

  return router
}

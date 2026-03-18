import { Router } from "express"

import { HealthLivenessController } from "../controller/health/liveness"
import { HealthReadinessController } from "../controller/health/readiness"

/**
 * ヘルスチェック関連のルーター
 */
export const healthRouter = (
  healthLivenessController: HealthLivenessController,
  healthReadinessController: HealthReadinessController
): Router => {
  const router = Router()

  // GET /api/health
  router.get("/", (req, res) => healthLivenessController.execute(req, res))

  // GET /api/health/ready
  router.get("/ready", async (req, res) =>
    healthReadinessController.execute(req, res)
  )

  return router
}

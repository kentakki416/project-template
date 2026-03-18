import { Request, Response } from "express"

import { ErrorResponse, healthReadinessResponseSchema } from "@repo/api-schema"

import { logger } from "../../log"
import { DatabaseHealthRepository } from "../../repository/mysql"
import { RedisHealthRepository } from "../../repository/redis"
import * as service from "../../service"

/**
 * Readiness チェック
 * 外部サービス（DB, Redis）への接続状態を確認する
 */
export class HealthReadinessController {
  constructor(
    private _databaseHealthRepository: DatabaseHealthRepository,
    private _redisHealthRepository: RedisHealthRepository,
  ) {}

  async execute(_req: Request, res: Response) {
    try {
      const result = await service.health.checkReadiness({
        databaseHealthRepository: this._databaseHealthRepository,
        redisHealthRepository: this._redisHealthRepository,
      })

      const overallStatus =
        result.database.status === "ok" && result.redis.status === "ok" ? "ok" : "degraded"

      const response = healthReadinessResponseSchema.parse({
        services: {
          database: result.database,
          redis: result.redis,
        },
        status: overallStatus,
      })

      const statusCode = overallStatus === "ok" ? 200 : 503
      res.status(statusCode).json(response)
    } catch (error) {
      logger.error(
        "HealthReadinessController: Unexpected error",
        error instanceof Error ? error : new Error("Unknown error")
      )
      const errorResponse: ErrorResponse = {
        error: "Health check failed",
        status_code: 500,
      }
      res.status(500).json(errorResponse)
    }
  }
}

import { logger } from "../log"
import { DatabaseHealthRepository } from "../repository/mysql"
import { RedisHealthRepository } from "../repository/redis"

export type ServiceStatus = {
  latency_ms: number
  status: "ok" | "error"
}

export type ReadinessResult = {
  database: ServiceStatus
  redis: ServiceStatus
}

/**
 * Readiness チェック
 * 外部サービス（DB, Redis）への接続状態を並列で確認する
 */
export const checkReadiness = async (
  repository: {
    databaseHealthRepository: DatabaseHealthRepository
    redisHealthRepository: RedisHealthRepository
  },
): Promise<ReadinessResult> => {
  const [database, redis] = await Promise.all([
    checkService("Database", repository.databaseHealthRepository),
    checkService("Redis", repository.redisHealthRepository),
  ])

  return {
    database,
    redis,
  }
}

const checkService = async (
  name: string,
  repository: { ping(): Promise<void> },
): Promise<ServiceStatus> => {
  const start = Date.now()
  try {
    await repository.ping()
    return {
      latency_ms: Date.now() - start,
      status: "ok",
    }
  } catch (error) {
    logger.error(
      `HealthService: ${name} check failed`,
      error instanceof Error ? error : new Error("Unknown error")
    )
    return {
      latency_ms: Date.now() - start,
      status: "error",
    }
  }
}

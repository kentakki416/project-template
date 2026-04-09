import request from "supertest"

import { HealthLivenessController } from "../../../src/controller/health/liveness"
import { HealthReadinessController } from "../../../src/controller/health/readiness"
import { DatabaseHealthRepository } from "../../../src/repository/mysql/healthcheck-repository"
import { RedisHealthRepository } from "../../../src/repository/redis/healthcheck-repository"
import { healthRouter } from "../../../src/routes/health-router"
import { createTestApp } from "../helper"

// モック
const mockDatabasePing = jest.fn<Promise<void>, []>()
const mockRedisPing = jest.fn<Promise<void>, []>()

const mockDatabaseHealthRepository: DatabaseHealthRepository = {
  ping: mockDatabasePing,
}

const mockRedisHealthRepository: RedisHealthRepository = {
  ping: mockRedisPing,
}

const app = createTestApp()

const readinessController = new HealthReadinessController(
  mockDatabaseHealthRepository,
  mockRedisHealthRepository,
)

app.use("/api/health", healthRouter(new HealthLivenessController(), readinessController))

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("全サービス正常時、200 と status: ok を返す", async () => {
    mockDatabasePing.mockResolvedValue(undefined)
    mockRedisPing.mockResolvedValue(undefined)

    const res = await request(app).get("/api/health/ready")

    expect(res.status).toBe(200)
    expect(res.body.status).toBe("ok")
    expect(res.body.services.database.status).toBe("ok")
    expect(res.body.services.redis.status).toBe("ok")
  })

  it("DB障害時、503 と status: degraded を返す", async () => {
    mockDatabasePing.mockRejectedValue(new Error("DB connection failed"))
    mockRedisPing.mockResolvedValue(undefined)

    const res = await request(app).get("/api/health/ready")

    expect(res.status).toBe(503)
    expect(res.body.status).toBe("degraded")
    expect(res.body.services.database.status).toBe("error")
    expect(res.body.services.redis.status).toBe("ok")
  })

  it("Redis障害時、503 と status: degraded を返す", async () => {
    mockDatabasePing.mockResolvedValue(undefined)
    mockRedisPing.mockRejectedValue(new Error("Redis connection failed"))

    const res = await request(app).get("/api/health/ready")

    expect(res.status).toBe(503)
    expect(res.body.status).toBe("degraded")
    expect(res.body.services.database.status).toBe("ok")
    expect(res.body.services.redis.status).toBe("error")
  })

  it("全サービス障害時、503 と status: degraded を返す", async () => {
    mockDatabasePing.mockRejectedValue(new Error("DB connection failed"))
    mockRedisPing.mockRejectedValue(new Error("Redis connection failed"))

    const res = await request(app).get("/api/health/ready")

    expect(res.status).toBe(503)
    expect(res.body.status).toBe("degraded")
    expect(res.body.services.database.status).toBe("error")
    expect(res.body.services.redis.status).toBe("error")
  })
})

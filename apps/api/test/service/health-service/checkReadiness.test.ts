import { DatabaseHealthRepository } from "../../../src/repository/mysql/healthcheck-repository"
import { RedisHealthRepository } from "../../../src/repository/redis/healthcheck-repository"
import { checkReadiness } from "../../../src/service/health-service"

// モック
const mockDatabasePing = jest.fn<Promise<void>, []>()
const mockRedisPing = jest.fn<Promise<void>, []>()

const mockRepository: {
  databaseHealthRepository: DatabaseHealthRepository
  redisHealthRepository: RedisHealthRepository
} = {
  databaseHealthRepository: {
    ping: mockDatabasePing,
  },
  redisHealthRepository: {
    ping: mockRedisPing,
  },
}

describe("checkReadiness", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("全サービスが正常な場合、全てokを返す", async () => {
    // Arrange
    mockDatabasePing.mockResolvedValue(undefined)
    mockRedisPing.mockResolvedValue(undefined)

    // Act
    const result = await checkReadiness(mockRepository)

    // Assert
    expect(result.database.status).toBe("ok")
    expect(result.redis.status).toBe("ok")
    expect(result.database.latency_ms).toBeGreaterThanOrEqual(0)
    expect(result.redis.latency_ms).toBeGreaterThanOrEqual(0)
    expect(mockDatabasePing).toHaveBeenCalledTimes(1)
    expect(mockRedisPing).toHaveBeenCalledTimes(1)
  })

  it("データベースがエラーの場合、databaseのみerrorを返す", async () => {
    // Arrange
    mockDatabasePing.mockRejectedValue(new Error("DB connection failed"))
    mockRedisPing.mockResolvedValue(undefined)

    // Act
    const result = await checkReadiness(mockRepository)

    // Assert
    expect(result.database.status).toBe("error")
    expect(result.redis.status).toBe("ok")
  })

  it("Redisがエラーの場合、redisのみerrorを返す", async () => {
    // Arrange
    mockDatabasePing.mockResolvedValue(undefined)
    mockRedisPing.mockRejectedValue(new Error("Redis connection failed"))

    // Act
    const result = await checkReadiness(mockRepository)

    // Assert
    expect(result.database.status).toBe("ok")
    expect(result.redis.status).toBe("error")
  })

  it("全サービスがエラーの場合、全てerrorを返す", async () => {
    // Arrange
    mockDatabasePing.mockRejectedValue(new Error("DB connection failed"))
    mockRedisPing.mockRejectedValue(new Error("Redis connection failed"))

    // Act
    const result = await checkReadiness(mockRepository)

    // Assert
    expect(result.database.status).toBe("error")
    expect(result.redis.status).toBe("error")
  })
})

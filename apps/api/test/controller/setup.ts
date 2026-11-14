import { createDrizzleClient, sql } from "@repo/db"
import { createRedisClient } from "@repo/redis"

const db = createDrizzleClient()
const redis = createRedisClient()

export { db as testDb }
export { redis as testRedis }

let cachedTableNames: string[] | null = null

/**
 * Drizzle の管理テーブルは drizzle スキーマにあるので、public スキーマだけを見れば対象から外れる
 */
const fetchTableNames = async (): Promise<string[]> => {
  if (cachedTableNames) return cachedTableNames
  const result = await db.execute<{ tablename: string }>(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
  `)
  cachedTableNames = result.rows.map((row) => row.tablename)
  return cachedTableNames
}

export const cleanupTestData = async (): Promise<void> => {
  const names = await fetchTableNames()
  if (names.length === 0) return
  const tables = names.map((name) => `"${name}"`).join(", ")
  await db.execute(sql.raw(`TRUNCATE TABLE ${tables} CASCADE`))
}

/**
 * FLUSHDB は接続中の DB 番号だけを消すので、開発用のデータには影響しない
 */
export const cleanupTestRedis = async (): Promise<void> => {
  await redis.flushdb()
}

export const disconnectTestDb = async (): Promise<void> => {
  await db.$disconnect()
}

export const disconnectTestRedis = async (): Promise<void> => {
  await redis.quit()
}

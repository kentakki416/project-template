import { createRedisClient } from "@repo/redis"

/**
 * @deprecated step6 で削除予定。
 * 新規コードは src/index.ts で createRedisClient() を呼び、
 * Repository に DI で渡すこと。
 */
export const redis = createRedisClient()

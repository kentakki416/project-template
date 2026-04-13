// テスト用DBの指定（prisma.client.ts のインポート前にセットする必要がある）
// prisma.client.ts が process.env.DB_NAME を参照してDB名を決定するため、
// ここでテスト専用DB名をセットすることで、開発用DB(project-template_dev)とテスト用DB(project-template_test)を分離する。
// 同一MySQLコンテナ内に別DBを作成する方式なので、Docker Compose の変更は不要。
// CI(GitHub Actions等)でも services: mysql を1つ立てて CREATE DATABASE するだけで対応できる。
process.env.DB_NAME = process.env.DB_NAME || "project-template_test"

// テスト用RedisのDB番号を指定（redis.ts のインポート前にセットする必要がある）
// Redisはデフォルトで DB 0〜15 を持つ。開発用(DB 0)とテスト用(DB 1)を分離することで、
// テスト時の FLUSHDB が開発データに影響しない。
process.env.REDIS_DB = process.env.REDIS_DB || "1"

import { redis } from "../../src/client/redis"
import { Prisma } from "../../src/prisma/generated/client"
import { prisma } from "../../src/prisma/prisma.client"

export { prisma as testPrisma }
export { redis as testRedis }

/**
 * Prisma の ModelName からモデルの delegate（prisma.user 等）を取得する
 * ModelName は PascalCase（例: "UserCharacter"）なので先頭を小文字に変換する
 */
const getModelDelegate = (modelName: string): { deleteMany: () => Promise<unknown> } | null => {
  const key = modelName.charAt(0).toLowerCase() + modelName.slice(1)
  const delegate = (prisma as unknown as Record<string, unknown>)[key]
  if (delegate && typeof (delegate as Record<string, unknown>).deleteMany === "function") {
    return delegate as { deleteMany: () => Promise<unknown> }
  }
  return null
}

/**
 * テスト間でデータをクリーンアップする（全モデルのデータを動的に削除する）
 * Prisma の ModelName から全モデルを取得し、FK制約を無効にして deleteMany する
 * テーブル追加時に手動でメンテナンスする必要がない
 * 各テストは beforeEach で呼び出し、必要なデータは自分で seed する方針
 */
export const cleanupTestData = async (): Promise<void> => {
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0")
  for (const modelName of Object.values(Prisma.ModelName)) {
    const delegate = getModelDelegate(modelName)
    if (delegate) {
      await delegate.deleteMany()
    }
  }
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1")
}

/**
 * テスト間でRedisデータをクリーンアップする
 * FLUSHDB はテスト用DB番号のみをクリアするため、開発用データに影響しない
 */
export const cleanupTestRedis = async (): Promise<void> => {
  await redis.flushdb()
}

/**
 * テスト終了時にDB接続を切断する
 */
export const disconnectTestDb = async (): Promise<void> => {
  await prisma.$disconnect()
}

/**
 * テスト終了時にRedis接続を切断する
 */
export const disconnectTestRedis = async (): Promise<void> => {
  await redis.quit()
}
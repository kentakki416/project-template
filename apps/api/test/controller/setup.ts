// テスト用DBの指定（prisma.client.ts のインポート前にセットする必要がある）
// prisma.client.ts が process.env.DB_NAME を参照してDB名を決定するため、
// ここでテスト専用DB名をセットすることで、開発用DB(project_template_dev)とテスト用DB(project_template_test)を分離する。
// 同一MySQLコンテナ内に別DBを作成する方式なので、Docker Compose の変更は不要。
// CI(GitHub Actions等)でも services: mysql を1つ立てて CREATE DATABASE するだけで対応できる。
process.env.DB_NAME = process.env.DB_NAME || "project_template_test"

// テスト用RedisのDB番号を指定（redis.ts のインポート前にセットする必要がある）
// Redisはデフォルトで DB 0〜15 を持つ。開発用(DB 0)とテスト用(DB 1)を分離することで、
// テスト時の FLUSHDB が開発データに影響しない。
process.env.REDIS_DB = process.env.REDIS_DB || "1"

import { redis } from "../../src/client/redis"
import { CharacterCode } from "../../src/prisma/generated/client"
import { prisma } from "../../src/prisma/prisma.client"

export { prisma as testPrisma }
export { redis as testRedis }

/**
 * テスト用のマスターデータを投入する
 */
export const seedTestData = async (): Promise<void> => {
  await prisma.character.upsert({
    create: {
      characterCode: CharacterCode.TRAECHAN,
      description: "目標達成をサポートするあなたの相棒",
      name: "トレちゃん",
    },
    update: {},
    where: { characterCode: CharacterCode.TRAECHAN },
  })

  await prisma.character.upsert({
    create: {
      characterCode: CharacterCode.MASTER,
      description: "あなたの成長を見守る師匠",
      name: "マスター",
    },
    update: {},
    where: { characterCode: CharacterCode.MASTER },
  })
}

/**
 * テスト間でデータをクリーンアップする（マスターデータは残す）
 */
export const cleanupTestData = async (): Promise<void> => {
  await prisma.userCharacter.deleteMany()
  await prisma.authAccount.deleteMany()
  await prisma.memo.deleteMany()
  await prisma.user.deleteMany()
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

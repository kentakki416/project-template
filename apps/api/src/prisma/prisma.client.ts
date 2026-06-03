import { createPrismaClient } from "@repo/db"

/**
 * @deprecated step6 で削除予定。
 * 新規コードは src/index.ts で createPrismaClient() を呼び、
 * Repository に DI で渡すこと。
 */
export const prisma = createPrismaClient()

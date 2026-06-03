export { createPrismaClient } from "./client"
export type { CreatePrismaClientOptions } from "./client"
export { buildConnectionString } from "./connection-string"

/**
 * Prisma が生成するドメイン型を re-export
 * 利用側は import type { User, Memo } from "@repo/db" で参照できる
 */
export * from "../generated/client"

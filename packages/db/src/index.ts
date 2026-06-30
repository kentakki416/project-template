export { createPrismaClient } from "./client"
export type { CreatePrismaClientOptions } from "./client"

/**
 * Prisma が生成するドメイン型 / 型ユーティリティを「型としてのみ」re-export する。
 *
 * `export *` だと PrismaClient クラス本体（runtime の値）まで公開され、app 側で
 * `new PrismaClient()` と書けて factory（createPrismaClient）を迂回できてしまう。
 * これは「factory のみ export」という共通パッケージの設計境界を壊すため、値は
 * 出さず型だけを明示 re-export する。利用側は
 * `import type { User, Memo, PrismaClient } from "@repo/db"` で参照する。
 */
export type {
  AuthAccount,
  Memo,
  Prisma,
  PrismaClient,
  User,
} from "../generated/client"

import cors from "cors"
import express from "express"
import helmet from "helmet"

import { createPrismaClient } from "@repo/db"
import { logger } from "@repo/logger"
import { createRedisClient } from "@repo/redis"

import { GoogleOAuthClient } from "./client/google-oauth"
import { AuthDevLoginController } from "./controller/auth/dev-login"
import { AuthGoogleController } from "./controller/auth/google"
import { AuthLogoutController } from "./controller/auth/logout"
import { AuthRefreshController } from "./controller/auth/refresh"
import { HealthLivenessController } from "./controller/health/liveness"
import { HealthReadinessController } from "./controller/health/readiness"
import { MemoCreateController } from "./controller/memo/create"
import { MemoDeleteController } from "./controller/memo/delete"
import { MemoDetailController } from "./controller/memo/detail"
import { MemoListController } from "./controller/memo/list"
import { MemoUpdateController } from "./controller/memo/update"
import { UserGetController } from "./controller/user/get"
import { env } from "./env"
import { authMiddleware } from "./middleware/auth"
import { apiRateLimiter } from "./middleware/rate-limit"
import { requestLogger } from "./middleware/request-logger"
import { unhandledExceptionHandler } from "./middleware/unhandled-exception-handler"
import {
  PrismaAuthAccountRepository,
  PrismaDatabaseHealthRepository,
  PrismaMemoRepository,
  PrismaTransactionRunner,
  PrismaUserRepository,
} from "./repository/prisma"
import { IoRedisHealthRepository, IoRedisRefreshTokenRepository } from "./repository/redis"
import { authRouter } from "./routes/auth-router"
import { healthRouter } from "./routes/health-router"
import { memoRouter } from "./routes/memo-router"
import { userRouter } from "./routes/user-router"

/**
 * インフラ client の生成 (プロセス起動時に 1 回だけ)
 * - createPrismaClient: DATABASE_URL / DATABASE_REPLICA_URL を読んで PrismaClient を生成
 * - createRedisClient: REDIS_URL を最優先で読んで Redis を生成
 */
const prisma = createPrismaClient()
const redis = createRedisClient()

/**
 * Repository の DI assembly
 */
const userRepository = new PrismaUserRepository(prisma)
const authAccountRepository = new PrismaAuthAccountRepository(prisma)
const transactionRunner = new PrismaTransactionRunner(prisma)
const memoRepository = new PrismaMemoRepository(prisma)
const databaseHealthRepository = new PrismaDatabaseHealthRepository(prisma)
const redisHealthRepository = new IoRedisHealthRepository(redis)
const refreshTokenRepository = new IoRedisRefreshTokenRepository(redis)

/**
 * 外部 SaaS client の DI assembly
 */
const googleOAuthClient = new GoogleOAuthClient(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)

/**
 * Health Controller のインスタンス化
 */
const healthLivenessController = new HealthLivenessController()
const healthReadinessController = new HealthReadinessController(databaseHealthRepository, redisHealthRepository)

/**
 * Auth Controller のインスタンス化
 */
const authGoogleController = new AuthGoogleController(
  authAccountRepository,
  userRepository,
  refreshTokenRepository,
  transactionRunner,
  googleOAuthClient,
)
const authRefreshController = new AuthRefreshController(refreshTokenRepository)
const authLogoutController = new AuthLogoutController(refreshTokenRepository)

/**
 * User Controller のインスタンス化（認証中ユーザー自身の取得）
 */
const userGetController = new UserGetController(userRepository)

/**
 * dev-login Controller は production 以外でのみ生成する
 * （本番では auth-router でルート自体が登録されない）
 */
const authDevLoginController = process.env.NODE_ENV !== "production"
  ? new AuthDevLoginController(userRepository, refreshTokenRepository)
  : undefined

/**
 * Memo Controller のインスタンス化
 */
const memoListController = new MemoListController(memoRepository)
const memoDetailController = new MemoDetailController(memoRepository)
const memoCreateController = new MemoCreateController(memoRepository)
const memoUpdateController = new MemoUpdateController(memoRepository)
const memoDeleteController = new MemoDeleteController(memoRepository)

const app = express()

/**
 * ロードバランサ / リバースプロキシ（ALB 等）の裏で動くため、プロキシが付与する
 * X-Forwarded-For ヘッダーから本当のクライアント IP を取得できるようにする。
 *
 * これを設定しないと、Express が見る IP は「直接の接続元 = プロキシの内部 IP」になり、
 * 全ユーザーが同じ IP として扱われてしまう。その結果、IP 単位のレート制限が
 * 「全ユーザーで 1 つの枠を共有」する状態になり、ほぼ機能しなくなる。
 *
 * 値 `1` は「自分の手前にある信頼できるプロキシ 1 段だけを信頼する」という意味。
 * プロキシの段数に一致させる（プロキシが無い環境では false に戻す）。
 */
app.set("trust proxy", 1)

/**
 * セキュリティヘッダー（HSTS / X-Content-Type-Options: nosniff / X-Frame-Options 等）。
 * 別オリジンのフロントから API のリソースを <img> 等で読み込む場合は
 * `crossOriginResourcePolicy` を cross-origin に緩める。
 */
app.use(helmet())

/**
 * cors設定のミドルウェア
 */
app.use(
  cors({
    credentials: true,
    origin: env.FRONTEND_URL,
  })
)

/**
 * jsonを変換するミドルウェア
 */
app.use(express.json())

/**
 * 認証ミドルウェア
 */
app.use(authMiddleware)

/**
 * リクエストのロギングミドルウェア
 */
app.use(requestLogger)

/**
 * ルーティング
 */
app.use(
  "/api/health",
  healthRouter({
    liveness: healthLivenessController,
    readiness: healthReadinessController,
  })
)
/**
 * レート制限を API 全体に適用する。
 * ヘルスチェック（/api/health）はロードバランサの死活監視で高頻度に叩かれるため、本ミドル
 * ウェアより前に登録して対象外にしている（制限に巻き込むと target が unhealthy 判定される恐れ）。
 */
app.use(apiRateLimiter)
app.use(
  "/api/auth",
  authRouter({
    devLogin: authDevLoginController,
    google: authGoogleController,
    logout: authLogoutController,
    refresh: authRefreshController,
  })
)
app.use(
  "/api/user",
  userRouter({
    get: userGetController,
  })
)
app.use(
  "/api/memo",
  memoRouter({
    create: memoCreateController,
    delete: memoDeleteController,
    detail: memoDetailController,
    list: memoListController,
    update: memoUpdateController,
  })
)

/**
 * 想定外例外を捕捉する Express の最終エラーハンドラ
 * 業務 4xx エラーは Controller の sendError 経由で返却されるため、ここを通らない
 * ルーティング定義の最後に登録する必要がある
 */
app.use(unhandledExceptionHandler)

/**
 * サーバー起動
 */
const server = app.listen(env.PORT, () => {
  logger.info("API server running", {
    environment: env.NODE_ENV,
    port: env.PORT,
    url: `http://localhost:${env.PORT}`,
  })
})

/**
 * Graceful shutdown
 * SIGTERM / SIGINT を受けたら HTTP server を閉じてから DB / Redis を切断
 */
const shutdown = async (signal: string): Promise<void> => {
  logger.info("Shutdown initiated", { signal })
  server.close(async () => {
    await Promise.all([
      prisma.$disconnect(),
      redis.quit(),
    ])
    logger.info("Shutdown completed")
    process.exit(0)
  })
}
process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))

/**
 * 予期しない例外をキャッチ（念のため）
 */
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", error)
  process.exit(1)
})

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", reason as Error)
  process.exit(1)
})

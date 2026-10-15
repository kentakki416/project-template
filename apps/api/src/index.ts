import cors from "cors"
import express from "express"
import helmet from "helmet"

import { createDrizzleClient } from "@repo/db"
import { type EventTracker, NoopEventTracker, QueueEventTracker } from "@repo/events"
import { logger } from "@repo/logger"
import { BullMQJobQueue, TRACK_EVENT_QUEUE_NAME } from "@repo/queue"
import { createRedisClient } from "@repo/redis"

import { GoogleOAuthClient } from "./client/google-oauth"
import { AdminAuthDevLoginController } from "./controller/admin/auth/dev-login"
import { AdminAuthGoogleController } from "./controller/admin/auth/google"
import { AdminAuthLogoutController } from "./controller/admin/auth/logout"
import { AdminAuthRefreshController } from "./controller/admin/auth/refresh"
import { AdminMeGetController } from "./controller/admin/me/get"
import { AdminUserDetailController } from "./controller/admin/user/detail"
import { AdminUserListController } from "./controller/admin/user/list"
import { AuthDevLoginController } from "./controller/auth/dev-login"
import { AuthGoogleController } from "./controller/auth/google"
import { AuthLogoutController } from "./controller/auth/logout"
import { AuthRefreshController } from "./controller/auth/refresh"
import { EventCreateController } from "./controller/event/create"
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
import { flushEventsBeforeResponse } from "./middleware/flush-events"
import { apiRateLimiter } from "./middleware/rate-limit"
import { requestLogger } from "./middleware/request-logger"
import { unhandledExceptionHandler } from "./middleware/unhandled-exception-handler"
import {
  DrizzleAdminRepository,
  DrizzleAuthAccountRepository,
  DrizzleDatabaseHealthRepository,
  DrizzleMemoRepository,
  DrizzleTransactionRunner,
  DrizzleUserRepository,
} from "./repository/drizzle"
import { IoRedisHealthRepository, IoRedisRefreshTokenRepository } from "./repository/redis"
import { adminRouter, mountAdminApi } from "./routes/admin-router"
import { authRouter } from "./routes/auth-router"
import { eventRouter } from "./routes/event-router"
import { healthRouter } from "./routes/health-router"
import { memoRouter } from "./routes/memo-router"
import { userRouter } from "./routes/user-router"

const db = createDrizzleClient({
  onError: (error) => {
    logger.error("db idle client error", error)
  },
})
/**
 * Redis は refresh token と queue の両方を載せているため、障害は error として残す。
 */
const redis = createRedisClient({
  onError: (error) => {
    logger.error("redis connection error", error)
  },
})

/**
 * Repository の DI assembly
 */
const userRepository = new DrizzleUserRepository(db)
const authAccountRepository = new DrizzleAuthAccountRepository(db)
const transactionRunner = new DrizzleTransactionRunner(db)
const memoRepository = new DrizzleMemoRepository(db)
const databaseHealthRepository = new DrizzleDatabaseHealthRepository(db)
const redisHealthRepository = new IoRedisHealthRepository(redis)
const refreshTokenRepository = new IoRedisRefreshTokenRepository(redis)
const adminRepository = new DrizzleAdminRepository(db)
const adminRefreshTokenRepository = new IoRedisRefreshTokenRepository(redis, "admin_refresh_token")

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
 */
const authDevLoginController = process.env.NODE_ENV !== "production"
  ? new AuthDevLoginController(userRepository, refreshTokenRepository)
  : undefined

/**
 * Admin Controller のインスタンス化
 */
const adminAuthGoogleController = new AdminAuthGoogleController(
  adminRepository,
  adminRefreshTokenRepository,
  googleOAuthClient,
)
const adminAuthRefreshController = new AdminAuthRefreshController(adminRepository, adminRefreshTokenRepository)
const adminAuthLogoutController = new AdminAuthLogoutController(adminRefreshTokenRepository)
const adminMeGetController = new AdminMeGetController(adminRepository)
const adminUserListController = new AdminUserListController(userRepository)
const adminUserDetailController = new AdminUserDetailController(userRepository, authAccountRepository)

/**
 * admin の dev-login Controller も production 以外でだけ生成する
 */
const adminAuthDevLoginController = process.env.NODE_ENV !== "production"
  ? new AdminAuthDevLoginController(adminRepository, adminRefreshTokenRepository)
  : undefined

/**
 * Memo Controller のインスタンス化
 */
const memoListController = new MemoListController(memoRepository)
const memoDetailController = new MemoDetailController(memoRepository)
/**
 * 行動イベントの送出先は EVENT_TRACKER_TYPE で選ぶ。
 */
const eventTracker: EventTracker = env.EVENT_TRACKER_TYPE === "queue"
  ? new QueueEventTracker(new BullMQJobQueue(redis, TRACK_EVENT_QUEUE_NAME))
  : new NoopEventTracker()

const eventCreateController = new EventCreateController(eventTracker)

const memoCreateController = new MemoCreateController(memoRepository, eventTracker)
const memoUpdateController = new MemoUpdateController(memoRepository, eventTracker)
const memoDeleteController = new MemoDeleteController(memoRepository, eventTracker)

const app = express()

/**
 * ALB 越しの X-Forwarded-For から実 IP を取る。設定しないと全ユーザーが
 * プロキシの内部 IP として扱われ、IP 単位のレート制限が機能しない。
 * 値はプロキシの段数（プロキシが無い環境では false）。
 */
app.set("trust proxy", 1)

/**
 * 別オリジンのフロントから <img> 等で読む場合は crossOriginResourcePolicy を
 * cross-origin に緩める。
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

if (env.FLUSH_EVENTS_BEFORE_RESPONSE) {
  app.use(flushEventsBeforeResponse(eventTracker))
}

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
  "/api/events",
  eventRouter({
    create: eventCreateController,
  })
)
/**
 * admin の API
 */
mountAdminApi(
  app,
  adminRouter({
    authDevLogin: adminAuthDevLoginController,
    authGoogle: adminAuthGoogleController,
    authLogout: adminAuthLogoutController,
    authRefresh: adminAuthRefreshController,
    meGet: adminMeGetController,
    userDetail: adminUserDetailController,
    userList: adminUserListController,
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
      db.$disconnect(),
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

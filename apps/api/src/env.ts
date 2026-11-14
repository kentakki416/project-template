import { z } from "zod"

const apiEnvSchema = z.object({
  /**
   * 未指定なら packages/db がローカル開発用の接続文字列を使う
   */
  DATABASE_URL: z.string().url().optional(),

  DATABASE_REPLICA_URL: z.string().url().optional(),

  DB_NAME: z.string().optional(),

  EVENT_TRACKER_TYPE: z.enum(["none", "queue"]).default("queue"),

  /**
   * レスポンスを返す前にイベント送出の完了を待つか。
   * レスポンス後に実行環境が凍結される Lambda（minimal 構成）でだけ true にする。
   */
  FLUSH_EVENTS_BEFORE_RESPONSE: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .default("false"),

  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  /**
   * Google ログインを使わない開発環境でも起動できるように、既定値を置く
   */
  GOOGLE_CLIENT_ID: z.string().default("dummy"),

  GOOGLE_CLIENT_SECRET: z.string().default("dummy"),

  JWT_ACCESS_EXPIRATION: z.string().default("15m"),

  JWT_ACCESS_SECRET: z.string().min(32),

  JWT_ADMIN_ACCESS_SECRET: z.string().min(32),

  JWT_ADMIN_REFRESH_SECRET: z.string().min(32),

  JWT_REFRESH_EXPIRATION: z.string().default("7d"),

  JWT_REFRESH_SECRET: z.string().min(32),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  LOGGER_TYPE: z.enum(["pino", "winston", "console", "silent"]).default("pino"),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  PORT: z.coerce.number().int().positive().default(8080),

  REDIS_URL: z.string().url().optional(),
})
  /**
   * JWT の鍵 4 つが 1 つでも同じ値なら起動を止める。写し間違えると、
   * user のトークンが admin の API を通ったり、refresh token が access token として通ったりする
   */
  .superRefine((env, ctx) => {
    const keys = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "JWT_ADMIN_ACCESS_SECRET", "JWT_ADMIN_REFRESH_SECRET"] as const
    keys.forEach((key, index) => {
      const duplicate = keys.slice(0, index).find((other) => env[other] === env[key])
      if (duplicate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${key} は ${duplicate} と別の値にする`, path: [key] })
      }
    })
  })

const result = apiEnvSchema.safeParse(process.env)
if (!result.success) {
  console.error("❌ Invalid environment variables:")
  console.error(JSON.stringify(result.error.format(), null, 2))
  process.exit(1)
}

export const env = result.data

export type ApiEnv = typeof env

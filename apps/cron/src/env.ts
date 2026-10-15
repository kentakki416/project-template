import { z } from "zod"

const cronEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().url().optional(),
    LOGGER_TYPE: z
      .enum(["pino", "winston", "console", "silent"])
      .default("pino"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    /**
     * cleanup-old-memos が削除対象とする「何日以上前の memo か」の閾値
     */
    CLEANUP_MEMO_OLDER_THAN_DAYS: z.coerce.number().int().positive().default(90),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "test" && !env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL is required when NODE_ENV is not 'test'",
        path: ["DATABASE_URL"],
      })
    }
  })

const result = cronEnvSchema.safeParse(process.env)
if (!result.success) {
  console.error("Invalid environment variables:")
  console.error(JSON.stringify(result.error.format(), null, 2))
  process.exit(1)
}

export const env = result.data

export type CronEnv = typeof env

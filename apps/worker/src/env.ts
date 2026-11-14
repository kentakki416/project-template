import { z } from "zod"

const workerEnvSchema = z
  .object({
    DATABASE_URL: z.string().url().optional(),
    DATA_WAREHOUSE_DATABASE: z.string().default("project_template"),
    DATA_WAREHOUSE_PASSWORD: z.string().default("password"),
    /**
     * `none` にすると、何も書き込まない DataWarehouse を使う
     */
    DATA_WAREHOUSE_TYPE: z.enum(["clickhouse", "none"]).default("clickhouse"),
    /**
     * 名前に ClickHouse を入れていないのは、データウェアハウスを差し替えても env の名前を変えずに済ませるため
     */
    DATA_WAREHOUSE_URL: z.string().url().optional(),
    DATA_WAREHOUSE_USER: z.string().default("default"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    LOGGER_TYPE: z
      .enum(["pino", "winston", "console", "silent"])
      .default("pino"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    REDIS_URL: z.string().optional(),
    /**
     * queue ごとの同時実行ジョブ数（worker 全体の上限ではない）
     */
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "test" && !env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL is required when NODE_ENV is not 'test'",
        path: ["DATABASE_URL"],
      })
    }
    if (
      env.NODE_ENV !== "test"
      && env.DATA_WAREHOUSE_TYPE === "clickhouse"
      && !env.DATA_WAREHOUSE_URL
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATA_WAREHOUSE_URL is required when DATA_WAREHOUSE_TYPE is 'clickhouse'",
        path: ["DATA_WAREHOUSE_URL"],
      })
    }
    if (env.NODE_ENV !== "test" && !env.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "REDIS_URL is required when NODE_ENV is not 'test'",
        path: ["REDIS_URL"],
      })
    }
  })

const result = workerEnvSchema.safeParse(process.env)
if (!result.success) {
  console.error("Invalid environment variables:")
  console.error(JSON.stringify(result.error.format(), null, 2))
  process.exit(1)
}

export const env = result.data

export type WorkerEnv = typeof env

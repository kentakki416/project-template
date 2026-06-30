import Redis, { type RedisOptions } from "ioredis"

export type CreateRedisClientOptions = {
  /**
   * 接続 URL を明示指定（例: redis://:password@host:6379/0）
   * 省略時は process.env.REDIS_URL を優先し、無ければ個別の
   * REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_DB から組み立てる
   */
  url?: string
  /**
   * ioredis に追加で渡したいオプション
   * 例: { maxRetriesPerRequest: null } (BullMQ Queue/Worker 用)
   *     { lazyConnect: true } (テスト用)
   *     { keyPrefix: "myapp:" } (キー名衝突回避)
   */
  options?: RedisOptions
  /**
   * `error` イベントのハンドラ。
   * ioredis は接続失敗・再接続失敗時に `error` を emit するが、リスナが 1 つも
   * 無いと Node の EventEmitter 規約で throw され、常駐プロセスが落ちる。
   * 各 app の logger を注入してログに残すのが推奨（省略時は console.error で
   * フォールバックし、最低限プロセスクラッシュだけは防ぐ）。
   */
  onError?: (error: Error) => void
}

/**
 * 環境変数から ioredis に渡すオプションを組み立てる
 * REDIS_URL が優先される。無ければ REDIS_HOST/PORT/PASSWORD/DB を個別に読む
 */
const buildOptionsFromEnv = (): RedisOptions | string => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL
  return {
    db: Number(process.env.REDIS_DB) || 0,
    host: process.env.REDIS_HOST || "localhost",
    password: process.env.REDIS_PASSWORD || undefined,
    port: Number(process.env.REDIS_PORT) || 6379,
  }
}

/**
 * ioredis クライアントのファクトリ
 * 各 app の src/index.ts で 1 回呼び、Repository コンストラクタに渡す。
 * BullMQ や Pub/Sub の subscriber などは別接続が必須なので、
 * 用途ごとに複数回呼んで使い分ける。
 */
export const createRedisClient = (params: CreateRedisClientOptions = {}): Redis => {
  const client = instantiateRedisClient(params)
  /**
   * 未処理の `error` イベントによるプロセスクラッシュを防ぐ。利用側が onError を
   * 渡さなかった場合でも、最低限 console.error でフォールバックする。
   */
  const onError = params.onError ?? ((error: Error): void => {
    console.error("[redis] connection error:", error.message)
  })
  client.on("error", onError)
  return client
}

/**
 * url / 環境変数のいずれかから ioredis インスタンスを生成する内部ヘルパ。
 */
const instantiateRedisClient = (params: CreateRedisClientOptions): Redis => {
  if (params.url) {
    return new Redis(params.url, params.options ?? {})
  }
  const base = buildOptionsFromEnv()
  if (typeof base === "string") {
    return new Redis(base, params.options ?? {})
  }
  return new Redis({ ...base, ...params.options })
}

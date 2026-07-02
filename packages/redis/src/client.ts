import Redis, { type RedisOptions } from "ioredis"

export type CreateRedisClientOptions = {
  /**
   * 接続 URL を明示指定（例: redis://:password@host:6379/0）
   * 省略時は process.env.REDIS_URL を読み、未設定なら localhost デフォルトを使う
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

const DEFAULT_URL = "redis://localhost:6379"

/**
 * 環境変数から接続 URL を解決する。
 * REDIS_URL を読み、未設定なら local 開発用の localhost デフォルトにフォールバックする。
 */
const resolveUrlFromEnv = (): string => process.env.REDIS_URL ?? DEFAULT_URL

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
  const url = params.url ?? resolveUrlFromEnv()
  return new Redis(url, params.options ?? {})
}

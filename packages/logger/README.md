# @repo/logger

server-side app 共通のロガー。**ILogger インターフェース + 複数実装 (pino / winston / console / silent) + AsyncLocalStorage によるリクエストコンテキスト** を提供する。

## 目次

- [設計の意図](#設計の意図)
- [役割](#役割)
- [公開 API](#公開-api)
- [使い方](#使い方)
- [環境変数](#環境変数)
- [実装の選び方](#実装の選び方)
## 設計の意図

**singleton（`LoggerFactory`）+ デフォルト `logger` を `Proxy` で遅延生成。** logger は middleware / test / 各層で使い回すので毎回 new したくない → singleton で 1 つに固定する。

> 💡 **なぜ `new Proxy` で遅延インスタンス化しているか**
> `import { logger }` した瞬間に実体（pino）を生成すると、dev では pino-pretty の **worker thread が自動起動**するなど eager な副作用が出る。logger を使わない app（queue の producer 等）まで無駄なオープンハンドルや初期化コストを負ってしまう。
> そこで `logger` を `Proxy` で包み、**実際にメソッド（`logger.info` 等）が呼ばれた時点**まで `LoggerFactory.getLogger()` を遅延させている。「import = 即インスタンス化」を避けつつ、利用側は普通に `logger.info(...)` と書ける。
> test では `LoggerFactory.reset()` でリセット、`LOGGER_TYPE=silent` で抑制する。

```ts
/** import しただけでは実体（pino / worker thread）を生成しない */
export const logger: ILogger = new Proxy({} as ILogger, {
  get(_target, property, receiver) {
    const instance = LoggerFactory.getLogger()   // ← 初回メソッド呼び出し時に生成
    const value = Reflect.get(instance as object, property, receiver)
    return typeof value === "function" ? value.bind(instance) : value
  },
})
```

## 役割

- 全 server-side app (api / cron / worker) で **同じ構造化ログ** を出力
- 環境変数 `LOGGER_TYPE` で実装を切り替え可能（コードは無変更）
- リクエスト / ジョブごとの `requestId` / `userId` を `AsyncLocalStorage` で全ログに自動付与
- `password` / `token` / `authorization` 等の機密キーを **自動マスク（`[REDACTED]`）** し、平文流出を防ぐ（pino は native redact、console / winston は `redactMetadata` で再帰的に置換）
- Express / Next.js に依存しないため cron / worker からも使える

## 公開 API

```ts
import {
  logger,
  LoggerFactory,
  logContext,
  type ILogger,
  type LogMetadata,
  type LogContext,
} from "@repo/logger"
```

| Export | 用途 |
| --- | --- |
| `logger` | app 全体で共有するデフォルト logger（`LoggerFactory.getLogger()` の結果） |
| `LoggerFactory.getLogger()` | `LOGGER_TYPE` に応じた logger を返す singleton |
| `logContext` | AsyncLocalStorage。`run({ requestId, userId }, fn)` でスコープを張る |
| `ILogger` | logger の interface（`debug` / `info` / `warn` / `error`） |

## 使い方

### 通常のログ出力

```ts
import { logger } from "@repo/logger"

logger.info("user created", { userId: 42 })
logger.warn("rate limit close", { remaining: 5 })
logger.error("payment failed", { orderId: 100, error: e })
```

### リクエストコンテキストの伝播

```ts
// apps/api の middleware
import { logContext } from "@repo/logger"
import { randomUUID } from "node:crypto"

app.use((req, res, next) => {
  logContext.run({ requestId: randomUUID(), userId: req.user?.id }, next)
})

// 以降、任意の関数内で logger.info("...") を呼ぶと
// 自動で { requestId, userId } がログに付与される
```

### cron / worker での利用

```ts
import { logContext, logger } from "@repo/logger"

await logContext.run({ requestId: jobId }, async () => {
  logger.info("job started")
  // ...
})
```

## 環境変数

各 app の `src/env.ts` で宣言・検証する（本パッケージは `process.env` を直接読む）。

| 変数 | デフォルト | 説明 |
| --- | --- | --- |
| `LOGGER_TYPE` | `pino` | `pino` / `winston` / `console` / `silent` |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

## 実装の選び方

| 実装 | 用途 |
| --- | --- |
| `pino`（デフォルト・推奨） | 本番。最高速 + 構造化 JSON |
| `winston` | 既存資産との互換が必要な場合 |
| `console` | ローカル開発で人が読む |
| `silent` | テスト時（ログを抑制） |
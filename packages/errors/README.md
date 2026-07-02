# @repo/errors

業務エラーを **値として** 返すための `Result<T>` 型と、`ApiError` 生成ヘルパを提供する共有パッケージ。**API / cron / worker 等の server-side app 全てで利用する**。

## 目次

- [設計の意図](#設計の意図)
- [役割](#役割)
- [公開 API](#公開-api)
- [使い方](#使い方)

## 設計の意図

**純粋な型 + 関数のみ。singleton も factory も持たず、他の `@repo/*` にも依存しない**（Node / ブラウザ両対応）。

> 💡 **使い分けの原則**
> 業務エラー（404 / 409 等）は `Result` で**値として返す**（throw しない）。DB 障害などの想定外エラーは **throw** し `Result` には乗せない。`Result<T>` は discriminated union なので、呼び出し側は必ず `.ok` の分岐を強制される。

## 役割

- 業務エラーは `Result<T>` で **値として** 返す（throw しない）
- DB 障害などの想定外エラーは **throw** が原則で `Result` には乗せない
- service / repository 層のコードを app 横断で再利用できる共通言語を提供

## 公開 API

```ts
import {
  type Result,
  type ApiError,
  type ApiErrorType,
  ok,
  err,
  badRequestError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
} from "@repo/errors"
```

### 型

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError }

type ApiError = {
  statusCode: number
  type: ApiErrorType
  message: string
}

type ApiErrorType =
  | "BAD_REQUEST"     // 400
  | "UNAUTHORIZED"    // 401
  | "FORBIDDEN"       // 403
  | "NOT_FOUND"       // 404
  | "CONFLICT"        // 409
```

### ヘルパ

| 関数 | 用途 |
| --- | --- |
| `ok(value)` | 成功 `Result` を作る |
| `err(apiError)` | 失敗 `Result` を作る |
| `badRequestError(msg)` | 400 エラーを作る |
| `unauthorizedError(msg)` | 401 エラーを作る |
| `forbiddenError(msg)` | 403 エラーを作る |
| `notFoundError(msg)` | 404 エラーを作る |
| `conflictError(msg)` | 409 エラーを作る |

## 使い方

### service 層

```ts
import { type Result, ok, err, notFoundError } from "@repo/errors"
import type { Memo } from "@repo/db"

export const getMemoById = async (
  id: number,
  { memoRepository }: { memoRepository: MemoRepository },
): Promise<Result<Memo>> => {
  const memo = await memoRepository.findById(id)
  if (!memo) return err(notFoundError(`memo ${id} not found`))
  return ok(memo)
}
```

### controller 層

```ts
const result = await service.memo.getMemoById(id, { memoRepository })
if (!result.ok) {
  return res.status(result.error.statusCode).json({ error: result.error })
}
return res.json(result.value)
```
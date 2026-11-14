/**
 * サービス層が呼び出し元に返す「業務エラー」の型
 * 例外 (throw) ではなく、戻り値として返すことで呼び出し側が型安全に扱える
 */
export type ApiError = {
  /**
   * HTTP ステータスコード（4xx 系）
   */
  statusCode: number
  type: ApiErrorType
  /**
   * ユーザー向けのエラーメッセージ
   */
  message: string
}

export type ApiErrorType =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNAUTHORIZED"

/**
 * `ok: false` で返すのは業務エラーだけ。DB 障害などの予期しないエラーは例外として throw する
 */
export type Result<T> =
  | { ok: true; value: T }
  | { error: ApiError; ok: false }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })

export const err = <T = never>(error: ApiError): Result<T> => ({ error, ok: false })

export const badRequestError = (message: string): ApiError => ({
  message,
  statusCode: 400,
  type: "BAD_REQUEST",
})

export const notFoundError = (message: string): ApiError => ({
  message,
  statusCode: 404,
  type: "NOT_FOUND",
})

export const conflictError = (message: string): ApiError => ({
  message,
  statusCode: 409,
  type: "CONFLICT",
})

export const unauthorizedError = (message: string): ApiError => ({
  message,
  statusCode: 401,
  type: "UNAUTHORIZED",
})

export const forbiddenError = (message: string): ApiError => ({
  message,
  statusCode: 403,
  type: "FORBIDDEN",
})

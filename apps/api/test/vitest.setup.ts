/**
 * Vitest 共通セットアップ。Jest 設定の test/controller/setup.ts のうち、
 * service ユニットテストにも必要な環境変数の初期値を設定する。
 */
process.env.LOGGER_TYPE = process.env.LOGGER_TYPE || "silent"
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-jwt-access-secret"
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-jwt-refresh-secret"
process.env.JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || "15m"
process.env.JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || "7d"

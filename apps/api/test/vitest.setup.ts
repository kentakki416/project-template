/**
 * setupFiles はテストモジュールの import より前に実行されるので、環境変数を参照する src/ 配下のモジュール
 * （env.ts など）が読み込まれる前に値を設定できる
 */
process.env.LOGGER_TYPE = process.env.LOGGER_TYPE || "silent"

/**
 * JWT secret は src/env.ts の apiEnvSchema で min(32) 制約があるため、
 * テスト用デフォルトも 32 文字以上にする
 */
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || "test-jwt-access-secret-at-least-32-chars"
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test-jwt-refresh-secret-at-least-32-chars"
process.env.JWT_ADMIN_ACCESS_SECRET =
  process.env.JWT_ADMIN_ACCESS_SECRET || "test-jwt-admin-access-secret-at-least-32-chars"
process.env.JWT_ADMIN_REFRESH_SECRET =
  process.env.JWT_ADMIN_REFRESH_SECRET || "test-jwt-admin-refresh-secret-at-least-32-chars"
process.env.JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || "15m"
process.env.JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || "7d"

process.env.DB_NAME = process.env.DB_NAME || "project-template_test"
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6380/1"

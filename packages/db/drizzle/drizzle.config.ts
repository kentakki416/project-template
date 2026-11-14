import { defineConfig } from "drizzle-kit"

import { buildConnectionString } from "../src/connection-string"

/**
 * drizzle-kit（generate / migrate / push / studio）の設定
 *
 * パスは packages/db から見た相対パス（package.json の scripts は packages/db で実行される）。
 * DB_NAME=project-template_test を指定するとテスト用 DB にマイグレーションを適用できる。
 */
export default defineConfig({
  dbCredentials: {
    url: buildConnectionString(),
  },
  dialect: "postgresql",
  /**
   * db:migrate が、途中までのフォルダだけを適用するときに差し替える（migrate/migrate.ts）
   */
  out: process.env.DRIZZLE_MIGRATIONS_DIR ?? "./drizzle/migrations",
  schema: "./src/drizzle/schema/index.ts",
})

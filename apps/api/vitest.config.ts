import { resolve } from "node:path"

import { defineConfig } from "vitest/config"

/**
 * Vitest 設定。POC 段階では service ユニットテストのみを対象にする。
 *
 * Jest 設定との主な差分:
 *   - .js 拡張子の moduleNameMapper ハックは Vite resolver が .ts へ
 *     自動フォールバックするため不要
 *   - ts-jest 経由の transpile が不要（esbuild ベース）で
 *     TS151002 警告との闘いから解放される
 *   - tsconfig の paths は Vite 7+ の resolve.tsconfigPaths でネイティブ解決
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    /**
     * Jest 互換 globals（describe / it / expect / beforeEach 等）を有効化し、
     * 既存テストの import 文を追加せずに動かす
     */
    globals: true,

    /**
     * Jest の testEnvironment: "node" に相当
     */
    environment: "node",

    /**
     * POC 段階は .vitest.test.ts サフィックスのファイルだけを対象にし、
     * 既存の Jest テスト（jest.fn を使用）と併存できるようにする。
     * 全面移行時に test/**\/*.test.ts へ広げる。
     */
    include: ["test/**/*.vitest.test.ts"],

    /**
     * Jest の maxWorkers: 1 と同じく直列実行。実 DB を共有する
     * controller テストを取り込む際の前提を揃えるため POC でも fileParallelism は無効化する
     */
    fileParallelism: false,

    /**
     * テストの timeout（ミリ秒）。Jest 設定の testTimeout: 3000 と一致
     */
    testTimeout: 3000,

    /**
     * カバレッジは V8 ベース。Jest の collectCoverageFrom と同等の除外を指定
     */
    coverage: {
      exclude: ["src/**/*.d.ts", "src/index.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
    },

    /**
     * Jest 設定の test/controller/setup.ts に相当する環境変数初期化を
     * setupFiles で再現する（POC 段階では service テストのみ対象だが、
     * 認証系 service が JWT_* を参照するため最低限ここで設定する）
     */
    setupFiles: [resolve(__dirname, "test/vitest.setup.ts")],
  },
})

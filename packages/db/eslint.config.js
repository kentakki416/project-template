const baseConfig = require("@repo/eslint-config")

/**
 * - drizzle/ (CLI 用設定・マイグレーション・seed) は lint 対象外にする
 * - migrate/ のコマンドはライブラリの build（src/ → dist/）に含めないため、型情報は migrate/tsconfig.json から取る
 */
module.exports = [
  ...baseConfig,
  {
    ignores: ["drizzle/**"],
  },
  {
    files: ["migrate/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./migrate/tsconfig.json",
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./migrate/tsconfig.json",
        },
      },
    },
  },
]

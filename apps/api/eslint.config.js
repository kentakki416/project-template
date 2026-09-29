const { defineConfig } = require("eslint/config")
const typescriptEslint = require("@typescript-eslint/eslint-plugin")
const typescriptParser = require("@typescript-eslint/parser")
const importPlugin = require("eslint-plugin-import")
const vitestPlugin = require("@vitest/eslint-plugin")

const { commonPlugins, commonRules } = require("@repo/eslint-config/common-rules")
const prismaBoundary = require("@repo/eslint-config/prisma-boundary")

module.exports = defineConfig([
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        project: "./tsconfig.json",
        sourceType: "module",
      },
    },
    plugins: {
      ...commonPlugins,
      "@typescript-eslint": typescriptEslint,
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      ...commonRules,
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "src/prisma/generated/**"],
  },
  /**
   * Prisma 型の import 境界。詳細と限界は
   * packages/eslint-config/prisma-boundary.js を参照。
   */
  ...prismaBoundary,
  {
    files: ["test/**/*.ts"],
    plugins: {
      vitest: vitestPlugin,
    },
    rules: {
      "vitest/expect-expect": "error",
      "vitest/no-disabled-tests": "warn",
      "vitest/no-focused-tests": "error",
      "vitest/valid-expect": "error",
    },
  },
])

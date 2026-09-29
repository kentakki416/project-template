/**
 * Prisma 型の import 境界を強制する flat config フラグメント
 *
 * `@repo/db` を依存に持つ server-side app（api / cron / worker / 将来の push）の
 * eslint.config.* から spread して使う:
 *
 *   const baseConfig = require("@repo/eslint-config")
 *   const prismaBoundary = require("@repo/eslint-config/prisma-boundary")
 *   module.exports = [...baseConfig, ...prismaBoundary]
 *
 * 目的: Prisma の型を repository 層の内側に閉じ、service / jobs / controller が
 * 永続化モデルに型付けされるのを防ぐ。業務ロジックは `@repo/domain` の型を使う。
 *
 * **限界**: このルールが検出できるのは「`@repo/db` からの直接 import」だけ。
 * repository 層の `interface` が戻り値に Prisma 型を使った場合、その型は推論で
 * service / jobs へ伝播するが lint では検出できない（実際に apps/worker で起きた）。
 * 「interface の引数・戻り値を domain 型にする」規約は各 app の CLAUDE.md とレビューで担保する。
 */

/**
 * repository 実装の内側にだけ置いてよい Prisma の型。
 *
 * `PrismaClient` は composition root（`src/index.ts`）と graceful shutdown で
 * `$disconnect()` のために必要なので、意図的に制限対象から外している。
 */
const RESTRICTED_PRISMA_TYPE_NAMES = ["AuthAccount", "Memo", "Prisma", "User"]

const RESTRICTED_IMPORT_MESSAGE =
  "Prisma の型は repository 層の内側に閉じる。業務ロジックでは @repo/domain の型を使う"

/**
 * Prisma の型を直接扱ってよい層。
 * Repository 実装だけが「DB row → domain 型」の変換責務を持つ。
 */
const PRISMA_TYPE_ALLOWED_FILES = ["src/repository/**/*.ts"]

module.exports = [
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              importNames: RESTRICTED_PRISMA_TYPE_NAMES,
              message: RESTRICTED_IMPORT_MESSAGE,
              name: "@repo/db",
            },
          ],
        },
      ],
    },
  },
  {
    files: PRISMA_TYPE_ALLOWED_FILES,
    rules: {
      "no-restricted-imports": "off",
    },
  },
]

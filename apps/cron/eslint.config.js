const baseConfig = require("@repo/eslint-config")
const prismaBoundary = require("@repo/eslint-config/prisma-boundary")

/**
 * Prisma 型の import 境界（prisma-boundary）を有効にする。
 * 詳細と限界は packages/eslint-config/prisma-boundary.js を参照。
 */
module.exports = [...baseConfig, ...prismaBoundary]

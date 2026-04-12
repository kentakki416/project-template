import { defineConfig, env } from "prisma/config"

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL") || "mysql://root:password@localhost:3306/project_template_dev",
  },
  migrations: {
    path: "./migrations",
    seed: "npx tsx ./src/prisma/seed.ts"
  },
  schema: "./schema.prisma",
})

const DEV_ONLY_PUBLIC_PATHS = process.env.NODE_ENV !== "production"
  ? ["/api/auth/dev-login"]
  : []

export const PUBLIC_PATHS: readonly string[] = [
  "/api/auth/google",
  "/api/auth/refresh",
  "/api/health",
  "/api/memo",
  ...DEV_ONLY_PUBLIC_PATHS,
]

export const ADMIN_PATH_PREFIX = "/api/admin"

const ADMIN_DEV_ONLY_PUBLIC_PATHS = process.env.NODE_ENV !== "production"
  ? ["/auth/dev-login"]
  : []

/**
 * ADMIN_PATH_PREFIX からの相対パス。
 * logout は refresh token で本人を確かめるので、access token が切れていても呼べるように含める
 */
export const ADMIN_PUBLIC_PATHS: readonly string[] = [
  "/auth/google",
  "/auth/logout",
  "/auth/refresh",
  ...ADMIN_DEV_ONLY_PUBLIC_PATHS,
]

export const LOG_EXCLUDE_PATHS = [
  "/api/health",
  "/api/health/ready",
] as const
